/**
 * Admin › Sign-ups (docs/v2/BETA-PLAN.md, Phase 3): newest accounts with how they came in
 * (campaign, organic, admin, the marketing tag of their link), verified or not, plan, first
 * actions, and how many signed up from the same network (a salted hash, never the address).
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState, uniqueEmail, ai, signUp } = require('./helpers');
const { networkOf, networkPrefix, cleanRef } = require('../lib/network');

describe('network hash and marketing tags', () => {
    it('groups addresses by network (IPv4 /24, IPv6 /48) and never keeps the address', () => {
        assert.equal(networkPrefix('203.0.113.7'), '203.0.113');
        assert.equal(networkPrefix('::ffff:203.0.113.99'), '203.0.113');
        assert.equal(networkPrefix('2001:db8:abcd:12::1'), '2001:db8:abcd');
        assert.equal(networkPrefix('2001:db8::1'), '2001:db8:0', ':: expands to zero groups');
        assert.equal(networkPrefix('2001:0db8:00ab:1::'), '2001:db8:ab');
        assert.equal(networkPrefix(''), '');
        assert.equal(networkPrefix('not an ip'), '');
        assert.equal(networkOf('203.0.113.7'), networkOf('203.0.113.200'));
        assert.notEqual(networkOf('203.0.113.7'), networkOf('203.0.114.7'));
        assert.match(networkOf('203.0.113.7'), /^[0-9a-f]{16}$/);
        assert.ok(!networkOf('203.0.113.7').includes('203'));
        assert.equal(networkOf(undefined), '');
    });

    it('marketing tags are short, lower case and plain', () => {
        assert.equal(cleanRef('FB-Post_3'), 'fb-post_3');
        assert.equal(cleanRef('<script>alert(1)</script>'), 'script-alert-1-script');
        assert.equal(cleanRef('x'.repeat(100)).length, 40);
        assert.equal(cleanRef({ $gt: '' }), '');
        assert.equal(cleanRef('   '), '');
    });
});

describe('sign-ups feed', () => {
    before(() => start('signupsfeed'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ freeMode: { enabled: true } });
    });

    const feed = (token, query = '') => api('GET', `/admin/signups${query}`, { token });

    it('shows how each account came in, with its first actions, newest first', async () => {
        const admin = await superadmin();
        const organic = await signUp({ name: 'Org', email: uniqueEmail(), password: 'password123', ref: 'FB-Post-1' });
        const camp = await api('POST', '/admin/campaigns', { token: admin.token, body: { name: 'Beta', code: 'FEED80', maxUses: 5, durationDays: 30, plan: 'pro' } });
        const member = await signUp({ name: 'Mem', email: uniqueEmail(), password: 'password123', campaignCode: 'FEED80' });
        const made = await api('POST', '/admin/users', { token: admin.token, body: { name: 'Made', email: uniqueEmail(), password: 'password123' } });
        assert.equal(made.status, 201, JSON.stringify(made.body));

        await api('POST', '/resumes', { token: member.body.token, body: { nickname: 'CV', summary: 'x' } });
        ai.reply = 'Better';
        await api('POST', '/ai/refine', { token: member.body.token, body: { resumeText: 'did stuff', sectionType: 'experience' } });

        const r = await feed(admin.token);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const d = r.body.data;
        const row = (email) => d.users.find((u) => u.email === email);
        assert.equal(row(organic.body.user.email).source, 'organic');
        assert.equal(row(organic.body.user.email).ref, 'fb-post-1');
        const m = row(member.body.user.email);
        assert.equal(m.source, 'campaign');
        assert.equal(m.campaign.code, camp.body.data.code);
        assert.equal(m.plan, 'pro');
        assert.deepEqual(m.did, { resumes: 1, profile: false, applications: 0, aiUses: 1, aiCredits: 1 });
        assert.equal(row(made.body.data.email).source, 'admin');
        assert.equal(d.bySource.campaign, 1);
        assert.equal(d.bySource.admin, 1);
        assert.ok(d.bySource.organic >= 2, 'the owner and the organic sign-up');
        assert.ok(new Date(d.users[0].createdAt) >= new Date(d.users.at(-1).createdAt), 'newest first');
        assert.equal(d.daily.at(-1).day, new Date().toISOString().slice(0, 10));
        assert.equal(d.daily.reduce((n, x) => n + x.organic + x.campaign + x.admin, 0), d.total);
        assert.equal(d.accounts, d.total);
        assert.ok(!('signupNet' in m) && !('password' in m), 'no network hash or secrets in the feed');
    });

    it('filters by source, tag, campaign, verified, search and date; pages', async () => {
        const admin = await superadmin();
        const t0 = new Date().toISOString();
        for (let i = 0; i < 3; i++) await signUp({ name: `Ref ${i}`, email: uniqueEmail('tagged'), password: 'password123', ref: 'ig' });
        const plain = await register({ name: 'Plain' });
        // Every sign-up verifies its email now; this one is from before that.
        await require('../models/User').updateOne({ _id: plain.user.id }, { $unset: { emailVerifiedAt: 1 } });
        // Only accounts made in this test (earlier tests' accounts stay in the database).
        const q = async (s) => (await feed(admin.token, `${s}${s.includes('?') ? '&' : '?'}from=${t0}`)).body.data;
        assert.equal((await q('?ref=IG')).total, 3);
        assert.equal((await q('?source=campaign')).total, 0);
        assert.equal((await q('?source=admin')).total, 0);
        assert.equal((await q('?source=organic')).total, 4);
        assert.equal((await q('?verified=yes')).total, 3);
        assert.equal((await q('?verified=no')).total, 1);
        assert.equal((await q('?q=tagged')).total, 3);
        assert.equal((await q('?q=.*')).total, 0, 'search is literal text');
        const paged = await q('?limit=5&page=2');
        assert.equal(paged.total, 4);
        assert.equal(paged.users.length, 0);
        const small = await q('?limit=2');
        assert.equal(small.limit, 5, 'at least 5 a page');
        assert.equal(small.users.length, 4);
        const future = new Date(Date.now() + 864e5).toISOString();
        assert.equal((await feed(admin.token, `?from=${future}`)).body.data.total, 0);
        assert.ok((await feed(admin.token, '?from=garbage&days=9999')).body.data.daily.length <= 366, 'range capped');
    });

    it('counts sign-ups from the same network; older accounts without a source read from their campaign', async () => {
        const admin = await superadmin();
        const a = await register();
        await register();
        const User = require('../models/User');
        const stored = await User.findById(a.user.id).lean();
        assert.match(stored.signupNet, /^[0-9a-f]{16}$/);
        const d = (await feed(admin.token)).body.data;
        assert.ok(d.users.find((u) => u.email === a.email).sameNetwork >= 1, 'tests all come from one address');

        await User.updateOne({ _id: a.user.id }, { $unset: { source: 1, signupNet: 1 } });
        const old = (await feed(admin.token, '?source=organic')).body.data.users.find((u) => u.email === a.email);
        assert.equal(old.source, 'organic');
        assert.equal(old.sameNetwork, 0);
    });

    it('admins only', async () => {
        const { token } = await register();
        assert.equal((await feed(token)).status, 403);
        assert.equal((await api('GET', '/admin/signups')).status, 401);
    });
});
