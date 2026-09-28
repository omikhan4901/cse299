const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { start, stop, api, register, resetState, superadmin, setSettings } = require('./helpers');

before(() => start('admin'));
after(stop);
beforeEach(resetState);

const User = () => require('../models/User');
const sessionFor = (user, mfa) => jwt.sign({ id: user._id, v: user.sessionVersion || 0, ...(mfa ? { mfa: true } : {}) }, process.env.JWT_SECRET, { algorithm: 'HS256' });

describe('who can open the admin API', () => {
    it('regular users, admins without 2FA, and admin sessions that skipped the code are refused', async () => {
        const plain = await register();
        assert.equal((await api('GET', '/admin/overview', { token: plain.token })).status, 403);

        const adm = await register();
        await User().updateOne({ email: adm.email }, { role: 'admin' });
        const r1 = await api('GET', '/admin/overview', { token: adm.token });
        assert.equal(r1.body.code, 'mfa_setup_required');

        const totp = require('../lib/totp');
        await User().updateOne({ email: adm.email }, { twoFactor: { enabled: true, secret: totp.encrypt(totp.generateSecret()) } });
        const r2 = await api('GET', '/admin/overview', { token: adm.token });
        assert.equal(r2.body.code, 'mfa_required', 'a session without the 2FA step is not enough');

        const u = await User().findOne({ email: adm.email });
        assert.equal((await api('GET', '/admin/overview', { token: sessionFor(u, true) })).status, 200);
    });

    it('a super admin email must be verified first (someone could register it before the owner)', async () => {
        const squatter = await register({ email: 'boss@test.dev' });
        const totp = require('../lib/totp');
        await User().updateOne({ email: 'boss@test.dev' }, { twoFactor: { enabled: true, secret: totp.encrypt(totp.generateSecret()) } });
        const u = await User().findOne({ email: 'boss@test.dev' });
        const r = await api('GET', '/admin/overview', { token: sessionFor(u, true) });
        assert.equal(r.body.code, 'email_verification_required');
        assert.ok(squatter);
    });
});

describe('admin actions', () => {
    it('admins cannot edit or ban super admins, other admins, or themselves', async () => {
        const boss = await superadmin();
        const adm = await register();
        await User().updateOne({ email: adm.email }, { role: 'admin', twoFactor: { enabled: true } });
        const admUser = await User().findOne({ email: adm.email });
        const admToken = sessionFor(admUser, true);
        const other = await register();
        await User().updateOne({ email: other.email }, { role: 'admin' });
        const otherUser = await User().findOne({ email: other.email });

        assert.equal((await api('PATCH', `/admin/users/${boss.user._id}`, { token: admToken, body: { banned: true } })).status, 403);
        assert.equal((await api('PATCH', `/admin/users/${otherUser._id}`, { token: admToken, body: { plan: 'premium' } })).status, 403);
        assert.equal((await api('PATCH', `/admin/users/${admUser._id}`, { token: admToken, body: { role: 'user' } })).status, 403, 'only super admins change roles');
        assert.equal((await api('DELETE', `/admin/users/${otherUser._id}`, { token: admToken })).status, 403);
        const reserved = await api('POST', '/admin/users', { token: admToken, body: { name: 'X', email: 'BOSS@test.dev', password: 'password123' } });
        assert.ok([400, 403].includes(reserved.status), 'cannot create an account with the super admin email');
    });

    it('banning signs the user out everywhere; the audit log never stores passwords', async () => {
        const boss = await superadmin();
        const u = await register();
        const id = (await User().findOne({ email: u.email }))._id;
        await api('PATCH', `/admin/users/${id}`, { token: boss.token, body: { banned: true, bannedReason: 'abuse' } });
        const me = await api('GET', '/auth/me', { token: u.token });
        assert.equal(me.status, 403);
        assert.equal(me.body.code, 'banned');
        // Unbanning (or a new password) must not revive the old session either.
        await api('PATCH', `/admin/users/${id}`, { token: boss.token, body: { banned: false, password: 'secret-new-pass' } });
        assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 401);
        const AdminLog = require('../models/AdminLog');
        const logs = JSON.stringify(await AdminLog.find({}).lean());
        assert.ok(!logs.includes('secret-new-pass'), 'password must not be in the audit log');
        assert.ok(logs.includes('[hidden]'));
    });

    it('the users CSV neutralises spreadsheet formulas', async () => {
        const boss = await superadmin();
        await register({ name: '=HYPERLINK("http://evil","x")' });
        const r = await api('GET', '/admin/users/export.csv', { token: boss.token });
        assert.ok(!/(^|,)"=HYPERLINK/m.test(r.body), 'a name starting with = must not stay a formula');
        assert.ok(r.body.includes(`"'=HYPERLINK`));
    });
});

describe('settings', () => {
    it('a partial or malformed save never drops a plan', async () => {
        const boss = await superadmin();
        const r = await api('PUT', '/admin/settings', { token: boss.token, body: { plans: [{ name: 'Starter' }], freeMode: null, featureCosts: 'x' } });
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.data.settings.plans.map((p) => p.id), ['free', 'pro', 'premium']);
        assert.equal(r.body.data.settings.plans[0].name, 'Starter');
    });

    it('removing a template override or a rate limit really removes it', async () => {
        const boss = await superadmin();
        const { DEFAULTS } = require('../lib/settings');
        await api('PUT', '/admin/settings', { token: boss.token, body: { templates: { categories: DEFAULTS.templates.categories, overrides: { Nordic: 'free' } }, rateLimits: { 'login-email': { max: 3, windowMs: 60000 } } } });
        const r = await api('PUT', '/admin/settings', { token: boss.token, body: { templates: { categories: DEFAULTS.templates.categories, overrides: {} }, rateLimits: {} } });
        assert.deepEqual(r.body.data.settings.templates.overrides, {});
        assert.deepEqual(r.body.data.settings.rateLimits, {});
    });

    it('changes show up for everyone right away (public plans endpoint is not cached)', async () => {
        const boss = await superadmin();
        await api('PUT', '/admin/settings', { token: boss.token, body: { featureCosts: { chat: 7 } } });
        const pub = await api('GET', '/billing/plans');
        assert.equal(pub.body.data.featureCosts.chat, 7);
        assert.match(pub.headers.get('cache-control'), /no-cache|no-store/);
    });

    it('rate limit changes apply live, with a floor for the admin console', async () => {
        const boss = await superadmin();
        await api('PUT', '/admin/settings', { token: boss.token, body: { rateLimits: { 'login-email': { max: 2, windowMs: 60000 } } } });
        const { email } = await register();
        const tries = [];
        for (let i = 0; i < 3; i++) tries.push((await api('POST', '/auth/login', { body: { email, password: 'wrong-one' } })).status);
        assert.deepEqual(tries, [401, 401, 429]);
        // Setting the admin limit to 1 must not lock the admin out (floor is 30).
        await api('PUT', '/admin/settings', { token: boss.token, body: { rateLimits: { admin: { max: 1, windowMs: 60000 } } } });
        const statuses = [];
        for (let i = 0; i < 5; i++) statuses.push((await api('GET', '/admin/overview', { token: boss.token })).status);
        assert.ok(statuses.every((s) => s === 200), `admin console still usable: ${statuses}`);
    });

    it('every rate limit in the API is listed for the admin', async () => {
        const boss = await superadmin();
        const r = await api('GET', '/admin/settings', { token: boss.token });
        const names = r.body.data.rateLimits.map((l) => l.name);
        for (const n of ['api-ip', 'login-ip', 'login-email', 'register-ip', 'mfa-ip', 'mfa-user', 'ai-minute', 'resumes', 'resume-create', 'public-ip', 'campaign-ip', 'admin', 'export', 'profile']) {
            assert.ok(names.includes(n), `${n} missing from the admin list`);
        }
        for (const l of r.body.data.rateLimits) assert.ok(l.label && l.description, `${l.name} needs a label and description`);
    });

    it('settings saved on one instance reach others via the refresh', async () => {
        const settings = require('../lib/settings');
        await setSettings({ featureCosts: { refine: 4 } });
        assert.equal((await settings.getSettings()).featureCosts.refine, 4);
    });
});
