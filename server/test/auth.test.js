const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, resetState, uniqueEmail } = require('./helpers');

before(() => start('auth'));
after(stop);
beforeEach(resetState);

describe('registration', () => {
    it('creates an account and signs in', async () => {
        const { token, user } = await register({ name: 'Ada' });
        assert.ok(token);
        assert.equal(user.name, 'Ada');
        const me = await api('GET', '/auth/me', { token });
        assert.equal(me.status, 200);
        assert.equal(me.body.user.email, user.email);
    });

    it('treats emails case-insensitively (no duplicate accounts)', async () => {
        const email = uniqueEmail('Case');
        await register({ email });
        const again = await api('POST', '/auth/register', { body: { name: 'X', email: email.toUpperCase(), password: 'password123' } });
        assert.equal(again.status, 400);
        const login = await api('POST', '/auth/login', { body: { email: email.toUpperCase(), password: 'password123' } });
        assert.equal(login.status, 200);
    });

    for (const [label, password] of [['short', 'short'], ['over 72 bytes', 'é'.repeat(40)]]) {
        it(`rejects a ${label} password`, async () => {
            const r = await api('POST', '/auth/register', { body: { name: 'X', email: uniqueEmail(), password } });
            assert.equal(r.status, 400);
        });
    }

    it('rejects an invalid email', async () => {
        const r = await api('POST', '/auth/register', { body: { name: 'X', email: 'not-an-email', password: 'password123' } });
        assert.equal(r.status, 400);
    });

    it('respects registration = closed and = campaign', async () => {
        const { setSettings } = require('./helpers');
        await setSettings({ registration: 'closed' });
        assert.equal((await api('POST', '/auth/register', { body: { name: 'X', email: uniqueEmail(), password: 'password123' } })).status, 403);
        await setSettings({ registration: 'campaign' });
        assert.equal((await api('POST', '/auth/register', { body: { name: 'X', email: uniqueEmail(), password: 'password123' } })).status, 403);
    });
});

describe('login and sessions', () => {
    it('gives the same answer for a wrong password and an unknown email', async () => {
        const { email } = await register();
        const wrong = await api('POST', '/auth/login', { body: { email, password: 'wrong-password' } });
        const unknown = await api('POST', '/auth/login', { body: { email: uniqueEmail('nobody'), password: 'wrong-password' } });
        assert.equal(wrong.status, 401);
        assert.deepEqual(wrong.body, unknown.body);
    });

    it('changing the password signs out other sessions but keeps this one', async () => {
        const { token, password } = await register();
        const other = token;
        const r = await api('PUT', '/auth/password', { token, body: { currentPassword: password, newPassword: 'new-password-1' } });
        assert.equal(r.status, 200);
        assert.equal((await api('GET', '/auth/me', { token: other })).status, 401, 'old token must stop working');
        assert.equal((await api('GET', '/auth/me', { token: r.body.token })).status, 200, 'new token works');
    });

    it('sign out everywhere invalidates old tokens', async () => {
        const { token } = await register();
        const r = await api('POST', '/auth/logout-all', { token });
        assert.equal((await api('GET', '/auth/me', { token })).status, 401);
        assert.equal((await api('GET', '/auth/me', { token: r.body.token })).status, 200);
    });

    it('rejects tampered, expired-purpose and alg=none tokens', async () => {
        const jwt = require('jsonwebtoken');
        const { token, user } = await register();
        const [h, p] = token.split('.');
        assert.equal((await api('GET', '/auth/me', { token: `${h}.${p}.bad` })).status, 401);
        const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${p}.`;
        assert.equal((await api('GET', '/auth/me', { token: none })).status, 401);
        const mfaTicket = jwt.sign({ id: user.id, v: 0, purpose: 'mfa' }, process.env.JWT_SECRET);
        assert.equal((await api('GET', '/auth/me', { token: mfaTicket })).status, 401, 'a 2FA ticket is not a session');
    });

    it('a banned user is refused everywhere, with a clear message', async () => {
        const User = require('../models/User');
        const { token, email, password } = await register();
        await User.updateOne({ email }, { banned: true, bannedReason: 'spam' });
        const me = await api('GET', '/auth/me', { token });
        assert.equal(me.status, 403);
        assert.equal(me.body.code, 'banned');
        const login = await api('POST', '/auth/login', { body: { email, password } });
        assert.equal(login.status, 403);
        assert.match(login.body.error, /spam/);
    });

    it('deleting the account needs the password and removes everything', async () => {
        const { token, password, user } = await register();
        await api('POST', '/resumes', { token, body: { nickname: 'Mine' } });
        assert.equal((await api('DELETE', '/auth/me', { token, body: { password: 'nope-nope' } })).status, 400);
        assert.equal((await api('DELETE', '/auth/me', { token, body: { password } })).status, 200);
        const Resume = require('../models/Resume');
        assert.equal(await Resume.countDocuments({ user: user.id }), 0);
        assert.equal((await api('GET', '/auth/me', { token })).status, 401);
    });
});

describe('two-factor authentication', () => {
    const totp = require('../lib/totp');
    const codeFor = (secret, offset = 0) => totp.hotp(secret, Math.floor(Date.now() / 30000) + offset);

    it('full flow: setup, enable, log in with a code, refuse a replayed code, recovery code works once', async () => {
        const { token, email, password } = await register();
        const setup = await api('POST', '/auth/2fa/setup', { token });
        const secret = setup.body.data.secret;
        assert.equal((await api('POST', '/auth/2fa/enable', { token, body: { code: '000000' } })).status, 400);
        const enabled = await api('POST', '/auth/2fa/enable', { token, body: { code: codeFor(secret) } });
        assert.equal(enabled.status, 200);
        const recovery = enabled.body.recoveryCodes;
        assert.equal(recovery.length, 10);

        const login = await api('POST', '/auth/login', { body: { email, password } });
        assert.equal(login.body.mfaRequired, true);
        assert.equal(login.body.token, undefined, 'no session before the code');
        // The code used to enable 2FA can't be replayed.
        const replay = await api('POST', '/auth/2fa/verify', { body: { mfaToken: login.body.mfaToken, code: codeFor(secret) } });
        assert.equal(replay.status, 401);
        const byRecovery = await api('POST', '/auth/2fa/verify', { body: { mfaToken: login.body.mfaToken, recoveryCode: recovery[0].toLowerCase() } });
        assert.equal(byRecovery.status, 200);
        const login2 = await api('POST', '/auth/login', { body: { email, password } });
        const reused = await api('POST', '/auth/2fa/verify', { body: { mfaToken: login2.body.mfaToken, recoveryCode: recovery[0] } });
        assert.equal(reused.status, 401, 'a recovery code works only once');
    });

    it('a password reset link does not bypass 2FA', async () => {
        const crypto = require('crypto');
        const User = require('../models/User');
        const { token, email } = await register();
        const secret = (await api('POST', '/auth/2fa/setup', { token })).body.data.secret;
        await api('POST', '/auth/2fa/enable', { token, body: { code: codeFor(secret) } });
        const raw = crypto.randomBytes(32).toString('hex');
        await User.updateOne({ email }, { resetTokenHash: crypto.createHash('sha256').update(raw).digest('hex'), resetTokenExpires: new Date(Date.now() + 60000) });
        const r = await api('POST', '/auth/reset-password', { body: { token: raw, password: 'brand-new-pass' } });
        assert.equal(r.status, 200);
        assert.equal(r.body.mfaRequired, true);
        assert.equal(r.body.token, undefined);
    });
});
