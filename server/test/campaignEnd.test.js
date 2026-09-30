/**
 * When a campaign ends (lib/campaignEnd.js, run by the scheduled /internal/reminders call):
 * members go back to an ordinary account on the Free plan, the campaign's credits and
 * switches are removed from the account, the credits used this month still count, and
 * nothing a subscription or a running campaign gives is touched. Also: a Free campaign that
 * switches Applications on really lets members track applications (the plan's limit of 0
 * gives way to the cheapest plan that has the feature), until the campaign ends.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, superadmin, setSettings, resetState, uniqueEmail, signUp } = require('./helpers');
const { DEFAULTS } = require('../lib/settings');

describe('when a campaign ends', () => {
    before(() => start('campaignend'));
    after(stop);
    beforeEach(resetState);

    const User = () => require('../models/User');
    const create = (token, body) => api('POST', '/admin/campaigns', { token, body: { name: 'Beta', code: `E${Date.now() % 1e7}`, maxUses: 10, durationDays: 7, ...body } });
    const join = async (code) => {
        const r = await signUp({ name: 'Member', email: uniqueEmail(), password: 'password123', campaignCode: code });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body;
    };
    // Moves an account's sign-up and every campaign end date 8 days back.
    const age = async (id) => {
        const past = new Date(Date.now() - 864e5);
        await User().updateOne({ _id: id }, { $set: { createdAt: new Date(Date.now() - 8 * 864e5) } }, { timestamps: false });
        const u = await User().findById(id).lean();
        await User().updateOne({ _id: id }, { $set: { ...(u.planExpiresAt ? { planExpiresAt: past } : {}), ...(u.creditLimitExpiresAt ? { creditLimitExpiresAt: past } : {}), ...(u.featuresExpireAt ? { featuresExpireAt: past } : {}) } });
    };

    it('an ended member is an ordinary Free account; the campaign link stays as history', async () => {
        await setSettings({ freeMode: { enabled: false } });
        const admin = await superadmin();
        const c = (await create(admin.token, { plan: 'pro', creditLimit: 50, creditPeriod: 'month', features: { coverLetter: false } })).body.data;
        const m = await join(c.code);
        const fresh = await join(c.code);
        await age(m.user.id);

        const { endExpiredGrants } = require('../lib/campaignEnd');
        const r = await endExpiredGrants();
        assert.equal(r.finished, 1);
        const u = await User().findById(m.user.id).lean();
        assert.equal(u.plan, 'free');
        for (const k of ['planExpiresAt', 'creditLimit', 'creditPeriod', 'creditLimitExpiresAt', 'features', 'featuresExpireAt']) assert.equal(u[k], undefined, `${k} removed`);
        assert.equal(String(u.campaign), String(c._id));
        assert.ok(u.campaignEndedAt);
        const me = (await api('GET', '/billing/me', { token: m.token })).body.data;
        assert.equal(me.plan.id, 'free');
        assert.equal(me.limit, DEFAULTS.plans[0].credits, "the Free plan's own allowance");
        assert.equal(me.features, null);

        const still = await User().findById(fresh.user.id).lean();
        assert.equal(still.plan, 'pro', 'a member whose days are still running keeps everything');
        assert.equal(still.creditLimit, 50);
        assert.equal(still.campaignEndedAt, undefined);

        const list = (await api('GET', '/admin/campaigns', { token: admin.token })).body.data.find((x) => x.code === c.code);
        assert.equal(list.stats.members, 2);
        assert.equal(list.stats.finished, 1);
        assert.deepEqual(await endExpiredGrants(), { finished: 0, plans: 0, credits: 0, features: 0 }, 'running it again changes nothing');
    });

    it("credits used this month still count on the Free plan: over its allowance means none left until the 1st", async () => {
        const plans = structuredClone(DEFAULTS.plans);
        plans[0].credits = 20;
        plans[0].creditPeriod = 'month';
        await setSettings({ freeMode: { enabled: false }, plans });
        const admin = await superadmin();
        const c = (await create(admin.token, { plan: 'free', creditLimit: 50, creditPeriod: 'month' })).body.data;
        const m = await join(c.code);
        const Usage = require('../models/Usage');
        await Usage.create({ user: m.user.id, day: `m:${new Date().toISOString().slice(0, 7)}`, ai: 30, expiresAt: new Date(Date.now() + 40 * 864e5) });
        assert.equal((await api('GET', '/billing/me', { token: m.token })).body.data.remaining, 20, '50 - 30 during the campaign');
        await age(m.user.id);
        await require('../lib/campaignEnd').endExpiredGrants();
        const me = (await api('GET', '/billing/me', { token: m.token })).body.data;
        assert.equal(me.limit, 20);
        assert.equal(me.remaining, 0);
    });

    it("leaves subscriptions alone, and ends an admin's timed plan the same way", async () => {
        const past = new Date(Date.now() - 864e5);
        const paid = { _id: new (require('mongoose').Types.ObjectId)(), name: 'Paid', email: uniqueEmail(), password: 'x', plan: 'pro', planSource: 'paddle' };
        const gift = { _id: new (require('mongoose').Types.ObjectId)(), name: 'Gift', email: uniqueEmail(), password: 'x', plan: 'premium', planExpiresAt: past };
        await User().collection.insertMany([paid, gift]);
        await require('../lib/campaignEnd').endExpiredGrants();
        assert.equal((await User().findById(paid._id).lean()).plan, 'pro');
        assert.equal((await User().findById(gift._id).lean()).plan, 'free');
    });

    it('the scheduled call runs it', async () => {
        process.env.INTERNAL_API_KEY = 'internal-test-key-123';
        const r = await api('POST', '/internal/reminders', { body: {}, headers: { 'X-Internal-Key': 'internal-test-key-123' } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.ok(r.body.data.ended, JSON.stringify(r.body.data));
    });

    it('an admin deleting a member frees the place; not once their campaign days are over', async () => {
        const admin = await superadmin();
        const c = (await create(admin.token, { plan: 'pro', maxUses: 2 })).body.data;
        const a = await join(c.code);
        const b = await join(c.code);
        const Campaign = require('../models/Campaign');
        assert.equal((await Campaign.findById(c._id).lean()).uses, 2);
        const del = await api('DELETE', `/admin/users/${a.user.id}`, { token: admin.token });
        assert.equal(del.status, 200);
        assert.equal(del.body.placeFreed, true);
        assert.equal((await Campaign.findById(c._id).lean()).uses, 1, 'a real student can have it');
        assert.equal(await User().countDocuments({ _id: a.user.id }), 0);
        assert.equal((await join(c.code)).user.plan, 'pro', 'the freed place is taken again');

        await age(b.user.id);
        await require('../lib/campaignEnd').endExpiredGrants();
        const done = await api('DELETE', `/admin/users/${b.user.id}`, { token: admin.token });
        assert.equal(done.body.placeFreed, false, 'a finished member used their place');
        assert.equal((await Campaign.findById(c._id).lean()).uses, 2);
        const log = (await api('GET', '/admin/audit', { token: admin.token })).body.data;
        assert.ok(JSON.stringify(log).includes('user.delete'));
    });

    it('a Free campaign with Applications switched on: members can track applications until it ends', async () => {
        await setSettings({ freeMode: { enabled: false }, v2: { enabled: true } });
        const admin = await superadmin();
        const c = (await create(admin.token, { plan: 'free', features: { applications: true } })).body.data;
        const m = await join(c.code);
        const add = () => api('POST', '/applications', { token: m.token, body: { job: { title: 'Engineer', organisation: 'Acme' }, status: 'applied' } });
        assert.equal((await add()).status, 201, 'the Free plan allows 0, the switch uses the cheapest plan with Applications');
        await age(m.user.id);
        await require('../lib/campaignEnd').endExpiredGrants();
        assert.equal((await add()).status, 403, 'back on Free, the feature is off again');
    });
});
