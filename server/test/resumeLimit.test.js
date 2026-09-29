/**
 * Resumes per plan (lib/resumeLimit.js): Free 1, Pro 15, Premium 30 by default, editable in
 * Admin › Plans; every way of creating one counts; nothing existing is ever removed; free
 * mode lifts the plan limit but the hard ceiling (MAX_RESUMES_PER_ACCOUNT) stays.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, setSettings, resetState } = require('./helpers');
const { DEFAULTS } = require('../lib/settings');

describe('resumes per plan', () => {
    before(() => start('resumelimit'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ freeMode: { enabled: false } });
    });
    const make = (token, nickname = 'CV') => api('POST', '/resumes', { token, body: { nickname, summary: 'Engineer' } });

    it('defaults: Free 1, Pro 15, Premium 30; shown to the site as a plan limit', async () => {
        assert.deepEqual(DEFAULTS.plans.map((p) => p.limits.resumes), [1, 15, 30]);
        const limits = (await api('GET', '/billing/plans')).body.data.planLimits;
        assert.equal(limits[0].key, 'resumes');
        assert.equal(limits[0].v2, undefined, 'shown whether or not V2 is on');
    });

    it('Free keeps one: a second new or duplicated resume is refused with an upgrade prompt', async () => {
        const { token } = await register();
        const first = await make(token);
        assert.equal(first.status, 201);
        const second = await make(token);
        assert.equal(second.status, 403);
        assert.equal(second.body.code, 'upgrade');
        assert.equal(second.body.feature, 'resumes');
        assert.equal(second.body.plan, 'pro');
        assert.match(second.body.error, /keeps up to 1 resume\b.*upgrade to Pro/);
        assert.equal((await api('POST', `/resumes/${first.body.data._id}/duplicate`, { token })).status, 403);
        assert.equal((await api('GET', '/resumes', { token })).body.data.length, 1);
    });

    it('lowering the limit keeps what people have: they can still open and save, only new ones are refused', async () => {
        const { token } = await register();
        await setSettings({ freeMode: { enabled: true } });
        const ids = [];
        for (let i = 0; i < 3; i++) ids.push((await make(token, `CV ${i}`)).body.data._id);
        await setSettings({ freeMode: { enabled: false } });
        const got = (await api('GET', `/resumes/${ids[2]}`, { token })).body.data;
        const saved = await api('PUT', `/resumes/${ids[2]}`, { token, body: { summary: 'Still mine', baseRev: got.rev } });
        assert.equal(saved.status, 200, 'editing an existing resume over the limit still works');
        assert.equal((await make(token)).status, 403);
        await api('DELETE', `/resumes/${ids[0]}`, { token });
        await api('DELETE', `/resumes/${ids[1]}`, { token });
        await api('DELETE', `/resumes/${ids[2]}`, { token });
        assert.equal((await make(token)).status, 201, 'room again after deleting');
    });

    it('the limit is editable per plan, and tailored resumes count too', async () => {
        const { token } = await register();
        const plans = structuredClone(DEFAULTS.plans);
        plans[0].limits.resumes = 2;
        plans[0].limits.tailored = 5;
        plans[0].features.applications = true;
        await setSettings({ plans, v2: { enabled: true } });
        assert.equal((await make(token)).status, 201);
        const app = (await api('POST', '/applications', { token, body: { job: { title: 'Engineer', description: 'Build things with Node.js and SQL.' } } })).body.data;
        const content = { personal: { name: 'A' }, summary: 'Engineer' };
        const one = await api('POST', '/applications/tailored', { token, body: { items: [{ application: app._id, nickname: 'T1', content }] } });
        assert.equal(one.status, 201, JSON.stringify(one.body));
        const two = await api('POST', '/applications/tailored', { token, body: { items: [{ application: app._id, nickname: 'T2', content }] } });
        assert.equal(two.status, 403);
        assert.equal(two.body.feature, 'resumes');
    });

    it('free mode lifts the plan limit; the hard ceiling still holds', async () => {
        await setSettings({ freeMode: { enabled: true } });
        const { token } = await register();
        process.env.MAX_RESUMES_PER_ACCOUNT = '3';
        try {
            for (let i = 0; i < 3; i++) assert.equal((await make(token)).status, 201);
            const r = await make(token);
            assert.equal(r.status, 400);
            assert.match(r.body.error, /up to 3 resumes/);
        } finally {
            delete process.env.MAX_RESUMES_PER_ACCOUNT;
        }
    });
});
