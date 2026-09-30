/**
 * "Rewrite with AI" for a plan's perks (Admin › Plans, lib/perksDraft.js): the AI gets only
 * facts from the plan's settings, and what it returns is cleaned and checked before the admin
 * sees it (lines the pricing page would hide, or with numbers the facts don't have, are left
 * out). Admins only, rate limited, and its cost counts towards the AI cap. Stubbed model.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState, ai } = require('./helpers');
const { DEFAULTS } = require('../lib/settings');

describe('perks rewrite', () => {
    before(() => start('perksdraft'));
    after(stop);
    beforeEach(() => {
        ai.reply = 'AI says hi';
        ai.status = 200;
        ai.usage = null;
        return resetState();
    });

    const plans = () => structuredClone(DEFAULTS.plans);

    it('suggests perks from the plan\'s facts and drops lines that don\'t match them', async () => {
        const admin = await superadmin();
        await setSettings({ v2: { enabled: false } });
        const draft = plans();
        const pro = draft.find((p) => p.id === 'pro');
        pro.name = 'Pro Plus'; // the unsaved editor is what counts
        pro.perks = ['500 AI credits a month', 'All 50 templates'];
        ai.reply = '- Everything in Free\n* **All 52 templates**\n1. Cover letters and AI rewrites.\n500 AI credits a month\nPriority support for 99 years\nEverything in Free';
        ai.usage = { promptTokenCount: 1000, candidatesTokenCount: 100 };
        ai.model = 'gemini-2.5-flash';
        const r = await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'pro', plans: draft } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual(r.body.data.perks, ['Everything in Free', 'All 52 templates', 'Cover letters and AI rewrites'], 'bullets, bold and full stops gone; duplicates once');
        assert.deepEqual(r.body.data.dropped, ['500 AI credits a month', 'Priority support for 99 years'], 'a credit amount, and a number the facts lack');

        const prompt = ai.last.body.contents[0].parts[0].text;
        assert.match(prompt, /Plan: Pro Plus/);
        assert.match(prompt, /Templates: 52 of 52/);
        assert.match(prompt, /Plan below: Free/);
        assert.doesNotMatch(prompt, /Career Profile|Applications/, 'V2 features stay out while V2 is off');
        assert.match(prompt, /500 AI credits a month/, 'current perks go in for tone');
        assert.match(ai.last.body.systemInstruction.parts[0].text, /Use only the facts given/);
        assert.ok(ai.last.body.generationConfig.maxOutputTokens <= 300, 'a small, bounded call');

        const AiEvent = require('../models/AiEvent');
        const ev = await AiEvent.findOne({ feature: 'adminPerks' }).lean();
        assert.equal(ev.credits, 0);
        assert.equal(ev.inputTokens, 1000);
        const { spentThisMonth } = require('../lib/aiSpend');
        assert.ok((await spentThisMonth()) > 0, 'counts towards the monthly AI cap');
    });

    it('V2 features are facts once V2 is on for everyone', async () => {
        const admin = await superadmin();
        await setSettings({ v2: { enabled: true } });
        ai.reply = 'Career Profile and Applications';
        const r = await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'pro', plans: plans() } });
        assert.equal(r.status, 200);
        assert.match(ai.last.body.contents[0].parts[0].text, /Career Profile/);
    });

    it('refuses unknown plans, non-admins, and says so when the AI fails or gives nothing usable', async () => {
        const admin = await superadmin();
        assert.equal((await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'gold', plans: plans() } })).status, 400);
        assert.equal((await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'pro', plans: 'nope' } })).status, 400);
        const u = await register();
        assert.equal((await api('POST', '/admin/perks-draft', { token: u.token, body: { planId: 'pro', plans: plans() } })).status, 403);
        ai.status = 503;
        const down = await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'pro', plans: plans() } });
        assert.equal(down.status, 502);
        assert.match(down.body.error, /weren't changed/);
        ai.status = 200;
        ai.reply = '300 AI credits a month\nUp to 10 resumes';
        const useless = await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'pro', plans: plans() } });
        assert.equal(useless.status, 502);
        assert.match(useless.body.error, /didn't match/);
    });

    it('is rate limited per admin', async () => {
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'admin-perks': { max: 1, windowMs: 3600_000 } });
        const admin = await superadmin();
        ai.reply = 'Cover letters';
        assert.equal((await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'pro', plans: plans() } })).status, 200);
        assert.equal((await api('POST', '/admin/perks-draft', { token: admin.token, body: { planId: 'pro', plans: plans() } })).status, 429);
    });
});
