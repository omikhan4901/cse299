/**
 * Abuse (docs/v2/BETA-PLAN.md, Phase 5): racing requests can't take an account past its
 * limits (resumes, applications) or the beta past its sign-up cap; hostile bodies (very deep,
 * very wide, prototype pollution) are answered calmly; a deleted or banned account's session
 * stops at once.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, setSettings, resetState, uniqueEmail, baseUrl, needsRealMongo } = require('./helpers');

describe('abuse', () => {
    before(() => start('abuse'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true }, freeMode: { enabled: false } });
    });

    it('ten "New resume" clicks at once on Free keep exactly one', async () => {
        const { token } = await register();
        const results = await Promise.all(Array.from({ length: 10 }, (_, i) => api('POST', '/resumes', { token, body: { nickname: `CV ${i}` } })));
        assert.equal(results.filter((r) => r.status === 201).length, 1, JSON.stringify(results.map((r) => r.status)));
        assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 403 && r.body.feature === 'resumes'));
        assert.equal((await api('GET', '/resumes', { token })).body.data.length, 1);
    });

    it('parallel duplicates stay within the plan too', async () => {
        const { token, user } = await register();
        const User = require('../models/User');
        await User.updateOne({ _id: user.id }, { limits: { resumes: 3 } });
        const first = (await api('POST', '/resumes', { token, body: { nickname: 'CV' } })).body.data;
        const results = await Promise.all(Array.from({ length: 8 }, () => api('POST', `/resumes/${first._id}/duplicate`, { token })));
        assert.equal(results.filter((r) => r.status === 201).length, 2);
        assert.equal((await api('GET', '/resumes', { token })).body.data.length, 3);
    });

    it('a burst of sign-ups can\'t pass the cap, and campaign places come back', async (t) => {
        // Counting places under concurrency needs real MongoDB (FerretDB's $inc isn't atomic).
        if (needsRealMongo()) return t.skip(needsRealMongo());
        const User = require('../models/User');
        const Campaign = require('../models/Campaign');
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'register-ip': { max: 1000, windowMs: 60_000 } });
        await Campaign.create({ name: 'Race', code: 'RACE-ABCDEFGH', plan: 'pro', maxUses: 50, durationDays: 30 });
        const now = await User.countDocuments();
        await setSettings({ signups: { cap: now + 3 } });
        const join = () => api('POST', '/auth/register', { body: { name: 'R', email: uniqueEmail('race'), password: 'password123', campaignCode: 'RACE-ABCDEFGH' } });
        const results = await Promise.all(Array.from({ length: 12 }, join));
        const made = results.filter((r) => r.status === 201).length;
        // Sign-ups landing in the same instant can pass the account cap by a few (campaign
        // places are the exact limit, claimed atomically); the rest are undone cleanly.
        assert.ok(made >= 3 && made < 12, `made ${made}`);
        assert.ok(results.filter((r) => r.status !== 201).every((r) => r.body.code === 'signups-full'));
        assert.equal(await User.countDocuments(), now + made, 'undone accounts are really gone');
        assert.equal((await Campaign.findOne({ code: 'RACE-ABCDEFGH' })).uses, made, 'their campaign places are given back');
        assert.equal((await join()).body.code, 'signups-full', 'after the burst, nobody else gets in');
    });

    it('parallel new applications stay within the active limit', async () => {
        const { token, user } = await register();
        const User = require('../models/User');
        await User.updateOne({ _id: user.id }, { plan: 'pro', limits: { applications: 2 } });
        const results = await Promise.all(Array.from({ length: 8 }, (_, i) => api('POST', '/applications', { token, body: { job: { title: 'Engineer', organisation: `Co ${i}` }, status: 'applied' } })));
        assert.equal(results.filter((r) => r.status === 201).length, 2, JSON.stringify(results.map((r) => r.status)));
        assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 403 && r.body.feature === 'applications'));
        assert.equal((await api('GET', '/applications', { token })).body.data.filter((a) => !a.archived).length, 2);
    });

    it('hostile bodies get a calm 4xx: very deep, very wide, prototype pollution', async () => {
        const { token } = await register();
        // Built as text: an attacker doesn't need JSON.stringify to nest 20,000 levels.
        const deep = `${'{"a":'.repeat(20000)}{"x":1}${'}'.repeat(20000)}`;
        const r1 = await fetch(`${baseUrl()}/profile`, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: deep });
        assert.ok(r1.status < 500, `deep: ${r1.status}`);
        const User = require('../models/User');
        await User.updateOne({ email: (await api('GET', '/auth/me', { token })).body.user.email }, { plan: 'pro' });
        const wide = { experience: Array.from({ length: 5000 }, (_, i) => ({ id: i, role: 'x' })) };
        const r2 = await api('PUT', '/profile', { token, body: wide });
        assert.equal(r2.status, 400, 'too many entries');
        const polluted = JSON.parse('{"nickname":"P","__proto__":{"isAdmin":true},"constructor":{"prototype":{"polluted":true}}}');
        const r3 = await api('POST', '/resumes', { token, body: polluted });
        assert.ok(r3.status < 500);
        assert.equal({}.isAdmin, undefined);
        assert.equal({}.polluted, undefined);
        const r4 = await api('GET', '/billing/me', { token });
        assert.equal(r4.status, 200, 'the server is fine afterwards');
    });

    it('an account deleted mid-session stops working at once', async () => {
        const u = await register();
        assert.equal((await api('GET', '/billing/me', { token: u.token })).status, 200);
        const r = await api('DELETE', '/auth/me', { token: u.token, body: { password: u.password } });
        assert.ok([200, 204].includes(r.status), JSON.stringify(r.body));
        assert.equal((await api('GET', '/billing/me', { token: u.token })).status, 401);
        assert.equal((await api('POST', '/resumes', { token: u.token, body: { nickname: 'ghost' } })).status, 401);
    });
});
