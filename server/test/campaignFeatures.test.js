/**
 * Campaign feature switches and the campaign cost estimate: a campaign turns features on or
 * off for its members whatever the plan (an "off" wins even in free mode), copied to each
 * member at sign-up for the campaign's length; the admin list shows members and AI spend;
 * the browser estimates worst and typical AI cost (client/src/lib/campaignCost.js).
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { start, stop, api, superadmin, setSettings, resetState, ai, uniqueEmail, signUp } = require('./helpers');
const { DEFAULTS, AI_FEATURES } = require('../lib/settings');
const { cleanLimits } = require('../lib/aiLimits');

const costLib = () => import(path.join(__dirname, '../../client/src/lib/campaignCost.js'));
const aiCostLib = () => import(path.join(__dirname, '../../client/src/lib/aiCost.js'));

describe('campaign cost estimate (browser)', () => {
    const settings = { ...structuredClone(DEFAULTS), aiLimits: cleanLimits({}, AI_FEATURES.map((f) => f.key)) };

    it('counts the allowance periods a campaign can touch', async () => {
        const { periodsIn } = await costLib();
        assert.equal(periodsIn(30, 'day'), 30);
        assert.equal(periodsIn(28, 'month'), 2, 'a 28-day window touches at most 2 calendar months');
        assert.equal(periodsIn(30, 'month'), 3, 'Jan 31 to Mar 1 touches 3');
        assert.equal(periodsIn(0, 'day'), 1);
    });

    it('members get the allowance the server would give, and only the AI features they can use count', async () => {
        const { memberAllowance, memberAiFeatures, campaignEstimate } = await costLib();
        const { worstPerCredit } = await aiCostLib();
        const s = structuredClone(settings);
        s.freeMode.enabled = false;
        assert.deepEqual(memberAllowance({ plan: 'pro', creditLimit: 60, creditPeriod: 'month' }, s), { credits: 60, period: 'month' });
        assert.deepEqual(memberAllowance({ plan: 'pro', creditLimit: null }, s), { credits: 300, period: 'month' });
        s.freeMode.enabled = true;
        assert.deepEqual(memberAllowance({ plan: 'free', creditLimit: null }, s), { credits: s.freeMode.dailyCredits, period: 'day' });
        s.freeMode.enabled = false;
        const onlyRefine = { plan: 'free', features: { chat: false } };
        assert.deepEqual(memberAiFeatures(onlyRefine, s, AI_FEATURES).map((f) => f.key), ['refine'], 'free plan has chat and refine; chat switched off');
        const e = campaignEstimate({ ...onlyRefine, maxUses: 80, creditLimit: 60, creditPeriod: 'month', durationDays: 28 }, s, AI_FEATURES);
        const perCredit = worstPerCredit('refine', s);
        assert.equal(e.feature.key, 'refine');
        assert.equal(e.worst, 80 * 60 * 2 * perCredit);
        assert.equal(e.atMost, e.worst, 'no cap given: nothing lowers the worst case');
        const none = campaignEstimate({ plan: 'free', features: { chat: false, refine: false }, maxUses: 80, creditLimit: 60, creditPeriod: 'month', durationDays: 30 }, s, AI_FEATURES);
        assert.equal(none.worst, 0, 'no AI features, no AI cost');
        assert.equal(none.likely, 0);
    });

    it('likely: real use (else 25 credits a month), never over the allowance, at the real (else typical) credit cost', async () => {
        const { campaignEstimate, expectedPeriods, ASSUMED_CREDITS_PER_MONTH, TYPICAL_SHARE_OF_WORST } = await costLib();
        const { worstPerCredit } = await aiCostLib();
        const s = structuredClone(settings);
        s.freeMode.enabled = false;
        assert.ok(Math.abs(expectedPeriods(30, 'month') - (1 + 30 / 30.44)) < 1e-9, 'members join on different days');
        assert.ok(expectedPeriods(30, 'month') < 3);
        const base = { plan: 'premium', maxUses: 50, durationDays: 30 };
        const guess = campaignEstimate(base, s, AI_FEATURES);
        assert.equal(guess.usePerMonth, ASSUMED_CREDITS_PER_MONTH);
        assert.equal(guess.measured.use, false);
        const costed = AI_FEATURES.filter((f) => s.featureCosts[f.key] && s.plans.find((p) => p.id === 'premium').features[f.key]);
        const mean = costed.reduce((t, f) => t + worstPerCredit(f.key, s), 0) / costed.length;
        assert.ok(Math.abs(guess.typicalPerCredit - mean * TYPICAL_SHARE_OF_WORST) < 1e-12);
        assert.ok(Math.abs(guess.likely - 50 * 25 * (30 / 30.44) * guess.typicalPerCredit) < 1e-9);
        assert.ok(guess.likely < guess.worst / 50, `a 1000-credit plan isn't used up: ${guess.likely} vs ${guess.worst}`);

        const real = campaignEstimate(base, s, AI_FEATURES, { perCredit: 0.002, creditsPerAccount: 12, aiPerMinute: 8 });
        assert.equal(real.usePerMonth, 12);
        assert.equal(real.typicalPerCredit, 0.002);
        assert.deepEqual(real.measured, { use: true, cost: true });
        const small = campaignEstimate({ ...base, plan: 'pro', creditLimit: 5, creditPeriod: 'month' }, s, AI_FEATURES, { creditsPerAccount: 40 });
        assert.equal(small.usePerMonth, 5, 'never more than the allowance');
    });

    it('a one-week campaign: a month\'s credits arrive at once, twice if the week crosses the 1st', async () => {
        const { campaignEstimate, ASSUMED_CREDITS_PER_MONTH } = await costLib();
        const s = structuredClone(settings);
        s.freeMode.enabled = false;
        const week = campaignEstimate({ plan: 'pro', maxUses: 80, durationDays: 7, creditLimit: 40, creditPeriod: 'month' }, s, AI_FEATURES, {}, { enabled: true, cap: 40, spent: 0 }, new Date(Date.UTC(2026, 0, 28)));
        assert.equal(week.short, true);
        assert.equal(week.periods, 2, '28 January + 7 days crosses into February');
        assert.equal(week.worst, 80 * 40 * 2 * week.perCredit);
        assert.ok(Math.abs(week.expected - (1 + 7 / 30.44)) < 1e-9);
        assert.ok(Math.abs(week.likely - 80 * ASSUMED_CREDITS_PER_MONTH * (7 / 30.44) * week.typicalPerCredit) < 1e-9, 'a week of typical use');
        assert.equal(week.capMonths, 2);
        assert.equal(week.dailyEquivalent, 1);
        const month = campaignEstimate({ plan: 'pro', maxUses: 80, durationDays: 28, creditLimit: 40, creditPeriod: 'month' }, s, AI_FEATURES);
        assert.equal(month.short, false);
        assert.equal(month.onePeriod.worst, 80 * 40 * month.perCredit, "one month's credits for everyone");
    });

    it('at most: the monthly AI cap bounds the worst case; the rate limit only when it binds', async () => {
        const { campaignEstimate } = await costLib();
        const s = structuredClone(settings);
        s.freeMode.enabled = false;
        const c = { plan: 'premium', maxUses: 50, durationDays: 30 };
        const jan31 = new Date(Date.UTC(2026, 0, 31, 12));
        const e = campaignEstimate(c, s, AI_FEATURES, { aiPerMinute: 8 }, { enabled: true, cap: 40, spent: 10 }, jan31);
        assert.ok(e.worst > 500);
        assert.equal(e.capped, true);
        assert.equal(e.capMonths, 3, '31 January + 30 days reaches 2 March');
        assert.equal(e.atMost, 30 + 40 * 2, "what's left this month, plus a full cap for each further month it touches");
        const mid = campaignEstimate(c, s, AI_FEATURES, {}, { enabled: true, cap: 40, spent: 10 }, new Date(Date.UTC(2026, 0, 15)));
        assert.equal(mid.capMonths, 2);
        assert.equal(mid.atMost, 70);
        const later = campaignEstimate({ ...c, expiresAt: '2026-03-15' }, s, AI_FEATURES, {}, { enabled: true, cap: 40, spent: 10 }, new Date(Date.UTC(2026, 0, 1)));
        assert.equal(later.capMonths, 4, 'members can join until the code expires, then have their 30 days');
        assert.equal(e.rateLimited, false, '8 a minute is far above 1000 credits a month');
        const off = campaignEstimate(c, s, AI_FEATURES, {}, { enabled: false, cap: 40, spent: 0 });
        assert.equal(off.atMost, off.worst);
        const slow = campaignEstimate({ ...c, creditLimit: 100000, creditPeriod: 'day', durationDays: 1 }, s, AI_FEATURES, { aiPerMinute: 1 });
        assert.equal(slow.rateLimited, true, 'one a minute can\'t spend 100,000 credits in a day');
        assert.ok(slow.worst < 50 * 100000 * slow.perCredit);
    });
});

describe('campaign feature switches', () => {
    before(() => start('campaignfeatures'));
    after(stop);
    beforeEach(resetState);

    const create = async (token, body) => api('POST', '/admin/campaigns', { token, body: { name: 'Beta', code: `B${Date.now() % 1e6}`, maxUses: 5, durationDays: 30, ...body } });
    const join = (code) => signUp({ name: 'Member', email: uniqueEmail(), password: 'password123', campaignCode: code });

    it('keeps only known features with true/false; members get them at sign-up, for the campaign\'s length', async () => {
        await setSettings({ freeMode: { enabled: false } });
        const admin = await superadmin();
        const c = await create(admin.token, { plan: 'pro', features: { coverLetter: false, interviewAi: false, madeUp: true, chat: 'yes' } });
        assert.equal(c.status, 201, JSON.stringify(c.body));
        assert.deepEqual(c.body.data.features, { coverLetter: false, interviewAi: false });
        const m = await join(c.body.data.code);
        assert.equal(m.status, 201);
        const me = (await api('GET', '/billing/me', { token: m.body.token })).body.data;
        assert.deepEqual(me.features, { coverLetter: false, interviewAi: false });
        const User = require('../models/User');
        const u = await User.findById(m.body.user.id).lean();
        assert.ok(Math.abs(new Date(u.featuresExpireAt) - (Date.now() + 30 * 864e5)) < 60_000);

        // Pro includes the cover letter, but the campaign turned it off.
        const r = await api('POST', '/ai/cover-letter', { token: m.body.token, body: { resumeData: { summary: 'Engineer' }, jobDescription: 'Backend role' } });
        assert.equal(r.status, 403);
        assert.equal(r.body.feature, 'coverLetter');
        ai.reply = 'Better text';
        assert.equal((await api('POST', '/ai/refine', { token: m.body.token, body: { resumeText: 'did stuff', sectionType: 'experience' } })).status, 200, 'the rest of Pro works');
    });

    it('an "on" grants a feature the plan lacks; an "off" holds even in free mode; both end with the campaign', async () => {
        const admin = await superadmin();
        await setSettings({ freeMode: { enabled: false } });
        const c = await create(admin.token, { plan: 'free', features: { coverLetter: true } });
        const m = await join(c.body.data.code);
        ai.reply = 'Dear team';
        const letter = () => api('POST', '/ai/cover-letter', { token: m.body.token, body: { resumeData: { summary: 'Engineer' }, jobDescription: 'Backend role' } });
        assert.equal((await letter()).status, 200, 'Free plan, but the campaign gives cover letters');

        const off = await create(admin.token, { plan: 'free', features: { refine: false } });
        const m2 = await join(off.body.data.code);
        await setSettings({ freeMode: { enabled: true } });
        assert.equal((await api('POST', '/ai/refine', { token: m2.body.token, body: { resumeText: 'x y z', sectionType: 'experience' } })).status, 403, 'free mode does not undo an explicit off');

        const User = require('../models/User');
        await User.updateOne({ _id: m.body.user.id }, { featuresExpireAt: new Date(Date.now() - 1000) });
        await setSettings({ freeMode: { enabled: false } });
        assert.equal((await letter()).status, 403, 'after the campaign, the plan rules again');
    });

    it('the admin list shows members, weekly actives and what their AI cost', async () => {
        const admin = await superadmin();
        const c = await create(admin.token, { plan: 'pro' });
        const m = await join(c.body.data.code);
        await join(c.body.data.code);
        ai.usage = { promptTokenCount: 100_000, candidatesTokenCount: 10_000 };
        ai.model = 'gemini-2.5-flash';
        ai.reply = 'Better text';
        await api('POST', '/ai/refine', { token: m.body.token, body: { resumeText: 'did stuff', sectionType: 'experience' } });
        const list = (await api('GET', '/admin/campaigns', { token: admin.token })).body.data;
        const row = list.find((x) => x.code === c.body.data.code);
        assert.equal(row.stats.members, 2);
        assert.equal(row.stats.active, 2, 'signing up counts as a login');
        assert.equal(row.stats.credits, 1);
        assert.equal(row.stats.aiCost.toFixed(3), '0.055', '100k in × $0.30 + 10k out × $2.50');
    });
});

describe('AI usage basis (the campaign estimate)', () => {
    before(() => start('aiusage'));
    after(stop);
    beforeEach(resetState);

    it('measures cost per credit and credits per account only once there is enough to go on; admins only', async () => {
        const admin = await superadmin();
        const { MIN_CREDITS, MIN_ACCOUNTS } = require('../lib/economics');
        const AiEvent = require('../models/AiEvent');
        const User = require('../models/User');
        const mongoose = require('mongoose');
        const get = async () => (await api('GET', '/admin/ai-usage', { token: admin.token })).body.data;
        let b = await get();
        assert.equal(b.perCredit, null);
        assert.equal(b.creditsPerAccount, null);
        assert.equal(b.aiPerMinute, 8);

        const user = new mongoose.Types.ObjectId();
        const now = new Date();
        // 1,000,000 input tokens at $0.30 and 100,000 output at $2.50 = $0.55, over MIN_CREDITS credits…
        await AiEvent.create({ user, feature: 'refine', credits: MIN_CREDITS, model: 'gemini-2.5-flash', inputTokens: 1e6, outputTokens: 1e5, at: now });
        // …plus a failed call: paid for, but its credits were refunded.
        await AiEvent.create({ user, feature: 'refine', credits: 0, ok: false, model: 'gemini-2.5-flash', inputTokens: 1e6, outputTokens: 0, at: now });
        // Too old to count.
        await AiEvent.create({ user, feature: 'refine', credits: 500, model: 'gemini-2.5-flash', inputTokens: 1e6, outputTokens: 0, at: new Date(Date.now() - 70 * 864e5) });
        b = await get();
        assert.ok(Math.abs(b.perCredit - 0.85 / MIN_CREDITS) < 1e-12, String(b.perCredit));

        const seen = new Date();
        await User.collection.insertMany(Array.from({ length: MIN_ACCOUNTS }, (_, i) => ({ name: `U${i}`, email: `u${i}-${Date.now()}@x.dev`, password: 'x', lastSeenAt: seen })));
        b = await get();
        const accounts = await User.countDocuments({ lastSeenAt: { $gte: new Date(Date.now() - 30 * 864e5) } });
        assert.equal(b.accounts, accounts);
        assert.ok(Math.abs(b.creditsPerAccount - MIN_CREDITS / accounts) < 1e-9);

        const { register } = require('./helpers');
        const u = await register();
        assert.equal((await api('GET', '/admin/ai-usage', { token: u.token })).status, 403);
    });
});
