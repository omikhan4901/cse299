/**
 * Career Profile and Applications are paid features (docs/v2/BETA-PLAN.md, Phase 2): every
 * profile, applications and interview-prep route refuses an account whose plan (or own
 * switch) lacks them, with an upgrade prompt, before anything is read or charged. Free mode
 * opens them; a campaign or admin "on" grants them on Free; an explicit "off" wins.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, setSettings, resetState, ai } = require('./helpers');
const { DEFAULTS } = require('../lib/settings');

describe('paid areas: Career Profile and Applications', () => {
    before(() => start('paidareas'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true }, freeMode: { enabled: false } });
    });

    const User = () => require('../models/User');
    const give = (id, patch) => User().updateOne({ _id: id }, patch);
    const routes = (token) => [
        ['GET /profile', () => api('GET', '/profile', { token }), 'profile'],
        ['PUT /profile', () => api('PUT', '/profile', { token, body: { summary: 'x' } }), 'profile'],
        ['GET /applications', () => api('GET', '/applications', { token }), 'applications'],
        ['POST /applications', () => api('POST', '/applications', { token, body: { job: { title: 'Engineer', organisation: 'Acme' } } }), 'applications'],
        ['POST /ai/interview-prep', () => api('POST', '/ai/interview-prep', { token, body: { applicationId: '0'.repeat(24) } }), 'applications'],
    ];

    it('defaults: off on Free, on for Pro and Premium; listed as V2 features', () => {
        for (const key of ['profile', 'applications']) {
            assert.deepEqual(DEFAULTS.plans.map((p) => !!p.features[key]), [false, true, true], key);
        }
        const { APP_FEATURES } = require('../lib/settings');
        assert.ok(APP_FEATURES.filter((f) => ['profile', 'applications'].includes(f.key)).every((f) => f.v2));
    });

    it('Free is refused on every route with an upgrade prompt naming the plan, and nothing is charged', async () => {
        const { token } = await register();
        for (const [name, call, feature] of routes(token)) {
            const r = await call();
            assert.equal(r.status, 403, name);
            assert.equal(r.body.code, 'upgrade', name);
            assert.equal(r.body.feature, feature, name);
            assert.equal(r.body.plan, 'pro', name);
            assert.match(r.body.error, /Pro plan/, name);
        }
        assert.equal(ai.calls, 0);
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 0);
    });

    it('the plan decides, including after an admin edits it, and a plan kept after a downgrade', async () => {
        const { token, user } = await register();
        await give(user.id, { plan: 'pro' });
        assert.equal((await api('GET', '/profile', { token })).status, 200);
        assert.equal((await api('GET', '/applications', { token })).status, 200);

        const plans = structuredClone(DEFAULTS.plans);
        plans.find((p) => p.id === 'pro').features.applications = false;
        await setSettings({ plans });
        assert.equal((await api('GET', '/applications', { token })).status, 403, 'the admin took it out of Pro');
        assert.equal((await api('GET', '/applications', { token })).body.plan, 'premium', 'the prompt names the plan that has it');
        assert.equal((await api('GET', '/profile', { token })).status, 200);

        await setSettings({ plans: DEFAULTS.plans });
        await give(user.id, { plan: 'free', heldPlan: 'pro', heldUntil: new Date(Date.now() + 864e5) });
        assert.equal((await api('GET', '/applications', { token })).status, 200, 'paid-for time after a downgrade still counts');
    });

    it('free mode opens them; an explicit "off" on the account still wins', async () => {
        const { token, user } = await register();
        await setSettings({ freeMode: { enabled: true } });
        assert.equal((await api('GET', '/profile', { token })).status, 200);
        await give(user.id, { features: { profile: false } });
        assert.equal((await api('GET', '/profile', { token })).status, 403);
        assert.equal((await api('GET', '/applications', { token })).status, 200);
    });

    it('an account "on" grants them on Free until it expires', async () => {
        const { token, user } = await register();
        await give(user.id, { features: { profile: true, applications: true }, featuresExpireAt: new Date(Date.now() + 864e5) });
        assert.equal((await api('GET', '/profile', { token })).status, 200);
        const made = await api('POST', '/applications', { token, body: { job: { title: 'Engineer', organisation: 'Acme' } } });
        assert.ok([200, 201].includes(made.status), JSON.stringify(made.body));
        await give(user.id, { featuresExpireAt: new Date(Date.now() - 1000) });
        assert.equal((await api('GET', '/applications', { token })).status, 403, 'back to the plan');
        assert.equal((await api('GET', '/profile', { token })).status, 403);
    });

    it('admins follow the same rule (they give themselves a plan to test)', async () => {
        const { token, user } = await register();
        await give(user.id, { role: 'admin' });
        assert.equal((await api('GET', '/profile', { token })).status, 403);
    });

    it('V2 switched off hides the areas (404) before any plan check', async () => {
        const { token, user } = await register();
        await give(user.id, { plan: 'premium' });
        await setSettings({ v2: { enabled: false } });
        assert.equal((await api('GET', '/profile', { token })).status, 404);
        assert.equal((await api('GET', '/applications', { token })).status, 404);
    });
});
