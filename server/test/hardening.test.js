/**
 * Hardening for the beta (docs/v2/BETA-PLAN.md, Phase 4): limits that matter are counted in
 * the database so they hold across server instances; signed-in traffic counts per account
 * (a campus shares one address); throwaway email domains can't sign up.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, setSettings, resetState, uniqueEmail } = require('./helpers');

describe('hardening', () => {
    before(() => start('hardening'));
    after(stop);
    beforeEach(resetState);

    it('shared limits keep counting when another instance (or a restart) has an empty memory', async () => {
        const { limit } = require('../lib/rateLimit');
        const mw = limit({ name: 'test-shared', shared: true, windowMs: 60_000, max: 3, key: () => 'k', message: 'Slow down.' });
        const local = limit({ name: 'test-local', windowMs: 60_000, max: 3, key: () => 'k', message: 'Slow down.' });
        const hit = async (m) => {
            let status = 200;
            const res = { set() {}, status(s) { status = s; return { json() {} }; } };
            await m({}, res, () => {});
            return status;
        };
        for (let i = 0; i < 3; i++) assert.equal(await hit(mw), 200);
        // A second instance: same database, its own (empty) memory.
        const again = limit({ name: 'test-shared', shared: true, windowMs: 60_000, max: 3, key: () => 'k', message: 'Slow down.' });
        assert.equal(await hit(again), 429, 'the 4th request is refused wherever it lands');
        for (let i = 0; i < 3; i++) assert.equal(await hit(local), 200);
        assert.equal(await hit(local), 429);
        const RateCount = require('../models/RateCount');
        const doc = await RateCount.findOne({ _id: /^test-shared:k:/ }).lean();
        assert.equal(doc.n, 4);
        assert.ok(doc.expireAt > new Date(), 'removed by the database after the window');
    });

    it('login and sign-up limits are shared; the campus-sized defaults let a class in', async () => {
        const { describeLimits } = require('../lib/rateLimit');
        const byName = Object.fromEntries(describeLimits().map((l) => [l.name, l]));
        for (const n of ['login-ip', 'login-email', 'register-ip', 'reset-ip', 'reset-email', 'mfa-ip', 'email-code', 'ai-minute', 'campaign-ip']) assert.equal(byName[n]?.shared, true, n);
        assert.ok(byName['login-ip'].max >= 150, 'a classroom can log in together');
        assert.ok(byName['register-ip'].max >= 40, 'a class can sign up together');
        assert.ok(byName['login-email'].max <= 10, 'password guessing on one account stays tight');
        assert.equal(byName['api-network'].min, 600);
    });

    it('signed-in requests count per account, not per address; signed out per address', async () => {
        await setSettings({ rateLimits: { 'api-ip': { max: 60, windowMs: 60_000 } } });
        const a = await register();
        const b = await register();
        for (let i = 0; i < 60; i++) await api('GET', '/billing/me', { token: a.token });
        assert.equal((await api('GET', '/billing/me', { token: a.token })).status, 429, 'account a used its minute');
        assert.equal((await api('GET', '/billing/me', { token: b.token })).status, 200, 'b, on the same address, is unaffected');
        const forged = await api('GET', '/billing/plans', { token: 'not-a-real-token' });
        assert.equal(forged.status, 200, 'a bad token counts as signed out (per address), not as an account');
    });

    it('throwaway email domains are refused at sign-up (subdomains too); the list is editable', async () => {
        const reg = (email) => api('POST', '/auth/register', { body: { name: 'X', email, password: 'password123' } });
        const r = await reg('someone@mailinator.com');
        assert.equal(r.status, 400);
        assert.equal(r.body.code, 'email-blocked');
        assert.equal((await reg('a@eu.yopmail.com')).body.code, 'email-blocked', 'subdomain');
        assert.equal((await reg(uniqueEmail())).status, 201);
        assert.equal((await reg(`x${Date.now()}@notmailinator.com`)).status, 201, 'only whole labels match');
        await setSettings({ signups: { blockedDomains: ['Example.org', '@bad.io', 'not a domain', 'x'.repeat(200) + '.com'] } });
        const { getSettings } = require('../lib/settings');
        assert.deepEqual((await getSettings()).signups.blockedDomains, ['example.org', 'bad.io']);
        assert.equal((await reg(`y${Date.now()}@mailinator.com`)).status, 201, 'removed from the list');
        assert.equal((await reg(`z${Date.now()}@bad.io`)).body.code, 'email-blocked');
    });

    it('the session check is cached for 30 s, and any change to the account applies at once', async () => {
        const sessionCache = require('../lib/sessionCache');
        const User = require('../models/User');
        const { superadmin } = require('./helpers');
        const admin = await superadmin();
        const u = await register();
        assert.equal((await api('GET', '/billing/me', { token: u.token })).status, 200);
        assert.ok(sessionCache.get(u.user.id), 'cached after the first request');
        // A ban by an admin is seen on the very next request.
        assert.equal((await api('PATCH', `/admin/users/${u.user.id}`, { token: admin.token, body: { banned: true } })).status, 200);
        assert.equal(sessionCache.get(u.user.id), null, 'forgotten when the account changes');
        assert.equal((await api('GET', '/billing/me', { token: u.token })).status, 403);
        // Any mongoose update forgets it too (e.g. sign out everywhere bumps sessionVersion).
        await User.updateOne({ _id: u.user.id }, { banned: false });
        assert.equal((await api('GET', '/billing/me', { token: u.token })).status, 401, 'the ban also signed them out everywhere');
        const again = await api('POST', '/auth/login', { body: { email: u.email, password: u.password } });
        assert.equal(again.status, 200);
        assert.equal((await api('GET', '/billing/me', { token: again.body.token })).status, 200);
        assert.ok(sessionCache.get(u.user.id));
        await User.updateOne({ _id: u.user.id }, { $inc: { sessionVersion: 1 } });
        assert.equal((await api('GET', '/billing/me', { token: again.body.token })).status, 401, 'sign out everywhere applies at once');
        // Entries expire on their own.
        sessionCache.put('abc', { sessionVersion: 0 });
        const realNow = Date.now;
        Date.now = () => realNow() + 31_000;
        try {
            assert.equal(sessionCache.get('abc'), null);
        } finally {
            Date.now = realNow;
        }
    });

    it('the network hash handles addresses forwarded by the site server', () => {
        const { networkOf } = require('../lib/network');
        assert.equal(networkOf('fwd:203.0.113.5'), networkOf('203.0.113.9'));
        assert.notEqual(networkOf('fwd:203.0.113.5'), '');
    });
});
