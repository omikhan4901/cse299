/**
 * Campaign feature switches and the campaign cost estimate: a campaign turns features on or
 * off for its members whatever the plan (an "off" wins even in free mode), copied to each
 * member at sign-up for the campaign's length; the admin list shows members and AI spend;
 * the browser estimates worst and typical AI cost (client/src/lib/campaignCost.js).
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { start, stop, api, superadmin, setSettings, resetState, ai, uniqueEmail } = require('./helpers');
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
        assert.equal(e.typical, e.worst / 4);
        const none = campaignEstimate({ plan: 'free', features: { chat: false, refine: false }, maxUses: 80, creditLimit: 60, creditPeriod: 'month', durationDays: 30 }, s, AI_FEATURES);
        assert.equal(none.worst, 0, 'no AI features, no AI cost');
    });
});

describe('campaign feature switches', () => {
    before(() => start('campaignfeatures'));
    after(stop);
    beforeEach(resetState);

    const create = async (token, body) => api('POST', '/admin/campaigns', { token, body: { name: 'Beta', code: `B${Date.now() % 1e6}`, maxUses: 5, durationDays: 30, ...body } });
    const join = (code) => api('POST', '/auth/register', { body: { name: 'Member', email: uniqueEmail(), password: 'password123', campaignCode: code } });

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
