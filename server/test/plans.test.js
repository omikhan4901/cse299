const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, resetState, setSettings, ai, uniqueEmail, needsRealMongo } = require('./helpers');

before(() => start('plans'));
after(stop);
beforeEach(resetState);

const refine = (token) => api('POST', '/ai/refine', { token, body: { resumeText: 'I did things' } });
const usage = async (token) => (await api('GET', '/billing/me', { token })).body.data;

describe('AI credits', () => {
    it('charges the configured cost and refunds failed requests', async () => {
        await setSettings({ featureCosts: { refine: 3 } });
        const { token } = await register();
        assert.equal((await refine(token)).status, 200);
        assert.equal((await usage(token)).used, 3);
        ai.status = 500; // AI provider down
        const failed = await refine(token);
        assert.equal(failed.status, 502);
        assert.equal((await usage(token)).used, 3, 'failed request refunded');
        assert.equal((await api('POST', '/ai/refine', { token, body: { resumeText: '' } })).status, 400);
        assert.equal((await usage(token)).used, 3, 'bad input refunded');
    });

    it('stops exactly at the allowance, and an allowance of 0 blocks the first request', async () => {
        await setSettings({ freeMode: { enabled: true, dailyCredits: 2 } });
        const { token } = await register();
        assert.equal((await refine(token)).status, 200);
        assert.equal((await refine(token)).status, 200);
        const third = await refine(token);
        assert.equal(third.status, 429);
        assert.equal(third.body.code, 'credits');
        await setSettings({ freeMode: { enabled: true, dailyCredits: 0 } });
        const fresh = await register();
        assert.equal((await refine(fresh.token)).status, 429, 'nothing charged beyond an allowance of 0');
    });

    it('parallel requests never overspend', async (t) => {
        if (needsRealMongo()) return t.skip(needsRealMongo());
        await setSettings({ freeMode: { enabled: true, dailyCredits: 5 } });
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'ai-minute': { max: 100, windowMs: 60000 } });
        const { token } = await register();
        const results = await Promise.all(Array.from({ length: 12 }, () => refine(token)));
        const ok = results.filter((r) => r.status === 200).length;
        assert.ok(ok <= 5, `${ok} succeeded with 5 credits`);
        assert.ok((await usage(token)).used <= 5);
    });

    it('plan locks are enforced by the server when free mode is off', async () => {
        await setSettings({ freeMode: { enabled: false } });
        const { token } = await register();
        const r = await api('POST', '/ai/cover-letter', { token, body: { resumeData: {}, jobDescription: 'A job' } });
        assert.equal(r.status, 403);
        assert.equal(r.body.code, 'upgrade');
        assert.equal(r.body.feature, 'coverLetter');
        assert.equal((await usage(token)).used, 0, 'locked requests cost nothing');
    });

    it('an expired paid plan falls back to Free immediately', async () => {
        const User = require('../models/User');
        await setSettings({ freeMode: { enabled: false } });
        const { token, email } = await register();
        await User.updateOne({ email }, { plan: 'pro', planExpiresAt: new Date(Date.now() + 60000) });
        assert.equal((await usage(token)).plan.id, 'pro');
        await User.updateOne({ email }, { planExpiresAt: new Date(Date.now() - 1000) });
        assert.equal((await usage(token)).plan.id, 'free');
        assert.equal((await api('POST', '/ai/cover-letter', { token, body: { resumeData: {}, jobDescription: 'x' } })).status, 403);
    });
});

describe('campaigns', () => {
    const Campaign = () => require('../models/Campaign');
    const join = (code, email = uniqueEmail()) => api('POST', '/auth/register', { body: { name: 'C', email, password: 'password123', campaignCode: code } });

    it('gives the plan and a credit allowance that ends with the campaign', async () => {
        await Campaign().create({ name: 'Uni', code: 'UNI1', plan: 'pro', creditLimit: 50, creditPeriod: 'day', durationDays: 30, maxUses: 5 });
        const r = await join('uni1');
        assert.equal(r.status, 201);
        assert.equal(r.body.user.plan, 'pro');
        const User = require('../models/User');
        const u = await User.findById(r.body.user.id).lean();
        assert.equal(u.creditLimit, 50);
        assert.ok(u.creditLimitExpiresAt > new Date(Date.now() + 29 * 864e5));
    });

    it('never goes over its places, even with parallel sign-ups', async (t) => {
        if (needsRealMongo()) return t.skip(needsRealMongo());
        await Campaign().create({ name: 'Small', code: 'SMALL', plan: 'free', maxUses: 3 });
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'register-ip': { max: 1000, windowMs: 60000 } });
        const results = await Promise.all(Array.from({ length: 8 }, () => join('SMALL')));
        assert.equal(results.filter((r) => r.status === 201).length, 3);
        assert.equal((await Campaign().findOne({ code: 'SMALL' })).uses, 3);
    });

    it('checks domain, expiry and paused campaigns', async () => {
        await Campaign().create({ name: 'Dom', code: 'DOM1', emailDomain: 'uni.edu', maxUses: 5 });
        await Campaign().create({ name: 'Old', code: 'OLD1', expiresAt: new Date(Date.now() - 1000), maxUses: 5 });
        await Campaign().create({ name: 'Off', code: 'OFF1', active: false, maxUses: 5 });
        assert.equal((await join('DOM1', uniqueEmail())).status, 400);
        assert.equal((await join('DOM1', `a${Date.now()}@cs.uni.edu`)).status, 201, 'subdomains count');
        assert.equal((await join('OLD1')).status, 400);
        assert.equal((await join('OFF1')).status, 400);
        assert.equal((await join('NOPE')).status, 400);
    });
});

describe('AI input', () => {
    it('junk or empty input is refused before calling the AI, and costs nothing', async () => {
        require('../lib/rateLimit').setOverrides({ 'ai-minute': { max: 100, windowMs: 60e3 } });
        const { token } = await register();
        const cases = [
            ['/ai/audit', { resumeData: 'x' }],
            ['/ai/audit', { resumeData: {} }],
            ['/ai/audit', { resumeData: { personal: { fullName: '' }, experience: [{}] } }],
            ['/ai/audit', { resumeData: { summary: 'A dev' }, jobDescription: { a: 1 } }],
            ['/ai/cover-letter', { resumeData: { summary: 'A dev' }, jobDescription: ['a job'] }],
            ['/ai/cover-letter', { resumeData: [], jobDescription: 'A job' }],
            ['/ai/refine', { resumeText: { text: 'hi' } }],
            ['/ai/refine', { resumeText: '   ' }],
            ['/ai/chat', { conversation: [{ role: 'user', content: { a: 1 } }] }],
            ['/ai/chat', { conversation: 'hi' }],
        ];
        for (const [path, body] of cases) {
            const r = await api('POST', path, { token, body });
            assert.equal(r.status, 400, `${path} ${JSON.stringify(body)} -> ${r.status}`);
        }
        assert.equal(ai.calls, 0, 'the AI was never called');
        assert.equal((await usage(token)).used, 0, 'no credits spent');
    });

    it('a resume with real content is audited', async () => {
        ai.reply = '{"score":140,"summary":"ok","strengths":[],"improvements":[],"missingKeywords":[]}';
        const { token } = await register();
        const r = await api('POST', '/ai/audit', { token, body: { resumeData: { summary: 'Backend developer' } } });
        assert.equal(r.status, 200);
        assert.equal(r.body.analysis.score, 100, 'score clamped to 0-100');
    });
});
