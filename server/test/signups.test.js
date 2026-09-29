/**
 * Sign-up controls (Phase 1): a hard cap on accounts, and AI credits only once the email is
 * verified (made-up accounts can't farm free credits). The model is stubbed.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState, ai, uniqueEmail } = require('./helpers');

describe('sign-up controls', () => {
    before(() => start('signups'));
    after(stop);
    beforeEach(resetState);

    const signUp = (email = uniqueEmail()) => api('POST', '/auth/register', { body: { name: 'New', email, password: 'password123' } });

    it('the cap closes sign-ups at N accounts; super admins can still sign up; no cap means none', async () => {
        const User = require('../models/User');
        const now = await User.countDocuments();
        await setSettings({ signups: { cap: now + 1, requireVerifiedEmail: false } });
        assert.equal((await signUp()).status, 201);
        const full = await signUp();
        assert.equal(full.status, 403);
        assert.equal(full.body.code, 'signups-full');
        const before = process.env.SUPERADMIN_EMAILS;
        process.env.SUPERADMIN_EMAILS = [before, 'boss@test.dev'].filter(Boolean).join(',');
        try {
            assert.equal((await signUp('boss@test.dev')).status, 201, 'the owner is never locked out');
        } finally {
            process.env.SUPERADMIN_EMAILS = before;
            if (before === undefined) delete process.env.SUPERADMIN_EMAILS;
        }
        await setSettings({ signups: { cap: null, requireVerifiedEmail: false } });
        assert.equal((await signUp()).status, 201);
        const cfg = (await superadmin()).token;
        const s = (await api('GET', '/admin/settings', { token: cfg })).body.data;
        assert.equal(s.settings.signups.cap, null);
        assert.ok(s.userCount >= now + 3);
    });

    it('AI needs a verified email: refused with no charge until verified; admins exempt; switchable', async () => {
        await setSettings({ signups: { cap: null, requireVerifiedEmail: true } });
        const { token, user } = await register();
        const refine = () => api('POST', '/ai/refine', { token, body: { resumeText: 'handled complaints', sectionType: 'experience' } });
        ai.reply = 'Resolved complaints';
        const r = await refine();
        assert.equal(r.status, 403);
        assert.equal(r.body.code, 'verify-email');
        assert.equal(ai.calls, 0);
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 0);
        assert.equal((await api('GET', '/billing/plans')).body.data.verifyForAi, true);

        const User = require('../models/User');
        await User.updateOne({ _id: user.id }, { emailVerifiedAt: new Date() });
        assert.equal((await refine()).status, 200);

        const admin = await superadmin();
        await User.updateOne({ _id: admin.user._id }, { $unset: { emailVerifiedAt: 1 } });
        assert.equal((await api('POST', '/ai/refine', { token: admin.token, body: { resumeText: 'x y', sectionType: 'experience' } })).status, 200, 'admins can always test');

        const other = await register();
        await setSettings({ signups: { cap: null, requireVerifiedEmail: false } });
        assert.equal((await api('POST', '/ai/refine', { token: other.token, body: { resumeText: 'x y', sectionType: 'experience' } })).status, 200, 'switched off');
        assert.equal((await api('GET', '/billing/plans')).body.data.verifyForAi, false);
    });

    it('without email set up on the server, nobody could verify, so AI is not held back', async () => {
        await setSettings({ signups: { cap: null, requireVerifiedEmail: true } });
        const { token } = await register();
        const env = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production'; // no SMTP_URL and production: email is off
        try {
            ai.reply = 'Resolved complaints';
            assert.equal((await api('POST', '/ai/refine', { token, body: { resumeText: 'handled complaints', sectionType: 'experience' } })).status, 200);
            assert.equal((await api('GET', '/billing/plans')).body.data.verifyForAi, false);
        } finally {
            process.env.NODE_ENV = env;
        }
    });
});
