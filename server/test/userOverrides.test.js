/**
 * Per-account overrides in Admin › Users (docs/v2/BETA-PLAN.md, Phase 2): feature switches
 * with an end date, limits that replace the plan's, "all AI off", and the tester flag. They
 * reuse the campaign switches (user.features) and win over the plan and free mode.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState, ai } = require('./helpers');
const { AI_FEATURES } = require('../lib/settings');

describe('per-account overrides', () => {
    before(() => start('useroverrides'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true }, freeMode: { enabled: false } });
    });
    const patch = (admin, id, body) => api('PATCH', `/admin/users/${id}`, { token: admin.token, body });

    it('feature switches: only known features with true/false are kept; an "on" opens a paid area on Free', async () => {
        const admin = await superadmin();
        const m = await register();
        assert.equal((await api('GET', '/applications', { token: m.token })).status, 403);
        const r = await patch(admin, m.user.id, { features: { applications: true, madeUp: true, chat: 'yes', __proto__: { x: 1 } } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual(r.body.data.features, { applications: true });
        assert.equal((await api('GET', '/applications', { token: m.token })).status, 200);
        assert.deepEqual((await api('GET', '/billing/me', { token: m.token })).body.data.features, { applications: true }, 'the page unlocks the same way');

        // Clearing them goes back to the plan.
        assert.equal((await patch(admin, m.user.id, { features: {} })).body.data.features, undefined);
        assert.equal((await api('GET', '/applications', { token: m.token })).status, 403);
    });

    it('switches end on their date; a bad date is refused', async () => {
        const admin = await superadmin();
        const m = await register();
        assert.equal((await patch(admin, m.user.id, { featuresExpireAt: 'not a date' })).status, 400);
        await patch(admin, m.user.id, { features: { profile: true }, featuresExpireAt: new Date(Date.now() + 864e5).toISOString() });
        assert.equal((await api('GET', '/profile', { token: m.token })).status, 200);
        await patch(admin, m.user.id, { featuresExpireAt: new Date(Date.now() - 864e5).toISOString() });
        assert.equal((await api('GET', '/profile', { token: m.token })).status, 403, 'ended: the plan rules again');
        await patch(admin, m.user.id, { featuresExpireAt: null });
        assert.equal((await api('GET', '/profile', { token: m.token })).status, 200, 'no end date');
    });

    it('all AI off holds even in free mode, and nothing is charged', async () => {
        const admin = await superadmin();
        const m = await register();
        await patch(admin, m.user.id, { features: Object.fromEntries(AI_FEATURES.map((f) => [f.key, false])) });
        await setSettings({ freeMode: { enabled: true } });
        ai.reply = 'Better';
        const r = await api('POST', '/ai/refine', { token: m.token, body: { resumeText: 'did stuff', sectionType: 'experience' } });
        assert.equal(r.status, 403);
        assert.equal(ai.calls, 0);
        assert.equal((await api('GET', '/billing/me', { token: m.token })).body.data.used, 0);
    });

    it('own limits replace the plan\'s (up or down, even in free mode); bad values are refused', async () => {
        const admin = await superadmin();
        const m = await register();
        const make = () => api('POST', '/resumes', { token: m.token, body: { nickname: 'CV', summary: 'x' } });
        assert.equal((await patch(admin, m.user.id, { limits: { resumes: -1 } })).status, 400);
        assert.equal((await patch(admin, m.user.id, { limits: { resumes: 2.4e9 } })).status, 400);
        const r = await patch(admin, m.user.id, { limits: { resumes: 3, bogus: 9, applications: null } });
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.data.limits, { resumes: 3 });
        for (let i = 0; i < 3; i++) assert.equal((await make()).status, 201, `resume ${i + 1} of 3 on Free`);
        assert.equal((await make()).status, 403);
        assert.deepEqual((await api('GET', '/billing/me', { token: m.token })).body.data.limits, { resumes: 3 });

        await setSettings({ freeMode: { enabled: true } });
        await patch(admin, m.user.id, { limits: { resumes: 1 } });
        assert.equal((await make()).status, 403, 'an own limit holds in free mode');
        await patch(admin, m.user.id, { limits: {} });
        assert.equal((await make()).status, 201, 'cleared: free mode has no limit');
    });

    it('own limits apply to applications, and a plan kept after a downgrade counts there too', async () => {
        const admin = await superadmin();
        const m = await register();
        const User = require('../models/User');
        await User.updateOne({ _id: m.user.id }, { plan: 'free', heldPlan: 'pro', heldUntil: new Date(Date.now() + 864e5) });
        await patch(admin, m.user.id, { limits: { applications: 1 } });
        const add = () => api('POST', '/applications', { token: m.token, body: { job: { title: 'Engineer', organisation: 'Acme' }, status: 'applied' } });
        assert.equal((await add()).status, 201, 'Pro held after the downgrade opens Applications');
        assert.equal((await add()).status, 403, 'the own limit of 1 active application');
    });

    it('the tester flag is saved and audited; only admins can set any of this', async () => {
        const admin = await superadmin();
        const m = await register();
        const r = await patch(admin, m.user.id, { tester: true });
        assert.equal(r.body.data.tester, true);
        const log = (await api('GET', '/admin/audit', { token: admin.token })).body.data;
        const rows = Array.isArray(log) ? log : log.items || log.entries || [];
        assert.ok(rows.some((e) => e.action === 'user.update'), 'audited');
        const other = await register();
        assert.equal((await patch(other, m.user.id, { features: { applications: true } })).status, 403);
    });
});
