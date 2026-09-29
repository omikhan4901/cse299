/**
 * The monthly AI spending cap (lib/aiSpend.js, lib/credits.js): real cost per call adds up
 * per month; at the cap, or when an admin pauses AI, requests are refused before anything
 * is charged or sent to the model; admins are exempt; the owner is alerted once per level.
 * The model is stubbed.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState, ai, needsRealMongo } = require('./helpers');
const { callCost, monthKey, nextMonth, recordSpend, pauseState, spentThisMonth } = require('../lib/aiSpend');
const AiSpend = require('../models/AiSpend');

const refine = (token) => api('POST', '/ai/refine', { token, body: { resumeText: 'Built a payments service used every day.', sectionType: 'experience' } });
const used = async (token) => (await api('GET', '/billing/me', { token })).body.data.used;

describe('AI spending cap: accounting', () => {
    it('prices a call by model, with prefixes and a default', () => {
        const prices = { default: { input: 1, output: 10 }, 'gemini-2.5-flash': { input: 0.3, output: 2.5 } };
        assert.equal(callCost({ model: 'gemini-2.5-flash-001', inputTokens: 1e6, outputTokens: 1e6 }, prices), 2.8);
        assert.equal(callCost({ model: 'other', inputTokens: 1000, outputTokens: 0 }, prices), 0.001);
        assert.equal(callCost({ model: null }, prices), 0);
        assert.equal(monthKey(new Date('2026-12-31T23:59:59Z')), '2026-12');
        assert.equal(nextMonth(new Date('2026-12-31T23:59:59Z')).toISOString(), '2027-01-01T00:00:00.000Z');
    });
});

describe('AI spending cap', () => {
    before(() => start('aispend'));
    after(stop);
    beforeEach(resetState);

    it('adds each call\'s real cost to the month, including calls that failed after using tokens', async () => {
        const { token } = await register();
        ai.usage = { promptTokenCount: 1_000_000, candidatesTokenCount: 100_000 };
        ai.model = 'gemini-2.5-flash';
        ai.reply = 'Built a payments service used every day by customers.';
        assert.equal((await refine(token)).status, 200);
        assert.equal((await spentThisMonth()).toFixed(2), '0.55', '1M in × $0.30 + 100k out × $2.50');
        ai.reply = '';
        assert.notEqual((await refine(token)).status, 200, 'an empty answer fails and is refunded…');
        assert.equal((await spentThisMonth()).toFixed(2), '1.10', '…but its tokens were paid for');
        const doc = await AiSpend.findById(monthKey()).lean();
        assert.equal(doc.calls, 2);
    });

    it('at the cap AI pauses for everyone but admins, before any credit or model call, until the 1st', async () => {
        await setSettings({ aiSpend: { enabled: true, cap: 1, alertAt: 50, paused: false } });
        const { token } = await register();
        ai.usage = { promptTokenCount: 1_000_000, candidatesTokenCount: 300_000 }; // $1.05
        ai.model = 'gemini-2.5-flash';
        ai.reply = 'Built a payments service used every day by customers.';
        assert.equal((await refine(token)).status, 200, 'the call that crosses the cap still completes');
        const before = await used(token);
        const calls = ai.calls;
        const r = await refine(token);
        assert.equal(r.status, 503);
        assert.equal(r.body.code, 'ai-paused');
        assert.equal(new Date(r.body.until).toISOString(), nextMonth().toISOString());
        assert.match(r.body.error, /paused until .* weren't charged/);
        assert.equal(await used(token), before, 'no credit taken');
        assert.equal(ai.calls, calls, 'the model was not called');
        const cfg = (await api('GET', '/billing/plans')).body.data.aiPaused;
        assert.equal(cfg.reason, 'cap');

        const admin = await superadmin();
        assert.equal((await refine(admin.token)).status, 200, 'admins can still test');
        const doc = await AiSpend.findById(monthKey()).lean();
        assert.deepEqual([...doc.alerts].sort((a, b) => a - b), [50, 100], 'each alert once');

        await setSettings({ aiSpend: { enabled: true, cap: 5, alertAt: 50, paused: false } });
        assert.equal((await refine(token)).status, 200, 'raising the cap resumes AI straight away');
        await setSettings({ aiSpend: { enabled: false, cap: 1, alertAt: 50, paused: false } });
        assert.equal((await refine(token)).status, 200, 'with the cap switched off, spend never pauses AI');
    });

    it('the admin pause stops AI at once, with no date, and resuming brings it back', async () => {
        const { token } = await register();
        await setSettings({ aiSpend: { enabled: true, cap: 40, alertAt: 80, paused: true } });
        const r = await refine(token);
        assert.equal(r.status, 503);
        assert.equal(r.body.until, null);
        assert.equal((await api('GET', '/billing/plans')).body.data.aiPaused.reason, 'manual');
        await setSettings({ aiSpend: { enabled: true, cap: 40, alertAt: 80, paused: false } });
        assert.equal((await refine(token)).status, 200);
        assert.equal((await api('GET', '/billing/plans')).body.data.aiPaused, null);
    });

    it('admins see this month against the cap, with the pace and the day it would run out', async () => {
        const admin = await superadmin();
        await recordSpend({ model: 'gemini-2.5-flash', inputTokens: 10_000_000, outputTokens: 0 }, { aiPrices: { default: { input: 0.3, output: 2.5 } }, aiSpend: { enabled: true, cap: 40, alertAt: 80 } });
        const r = await api('GET', '/admin/ai-spend', { token: admin.token });
        assert.equal(r.status, 200);
        assert.equal(r.body.data.spent, 3);
        assert.equal(r.body.data.cap, 40);
        assert.ok(r.body.data.projected >= 3);
        assert.equal((await api('GET', '/admin/ai-spend', { token: (await register()).token })).status, 403);
    });

    it('settings are validated: a cap is at least $1, the alert below 100%', async () => {
        await setSettings({ aiSpend: { enabled: 'yes', cap: -5, alertAt: 400, paused: 'no' } });
        const s = await require('../lib/settings').getSettings();
        assert.deepEqual(s.aiSpend, { enabled: true, cap: 1, alertAt: 99, paused: true });
        assert.equal((await pauseState(s)).paused, true);
    });

    it('many calls at once all count (no lost updates)', async (t) => {
        if (needsRealMongo()) return t.skip(needsRealMongo());
        const settings = { aiPrices: { default: { input: 1, output: 0 } }, aiSpend: { enabled: false, cap: 40, alertAt: 80 } };
        await Promise.all(Array.from({ length: 25 }, () => recordSpend({ model: 'x', inputTokens: 1_000_000, outputTokens: 0 }, settings)));
        assert.equal(await spentThisMonth(), 25);
    });
});
