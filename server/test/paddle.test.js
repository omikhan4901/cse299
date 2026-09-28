/**
 * Paddle billing: webhook signature checks, mirroring subscriptions (repeats,
 * out-of-order deliveries), which subscriptions give access, and the billing
 * portal and plan changes. Paddle's API is stubbed (helpers.paddleApi).
 */
const crypto = require('node:crypto');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, resetState, paddleApi } = require('./helpers');

const SECRET = 'pdl_ntfset_test_secret';
const PRICES = { pro: { month: 'pri_pro_m', year: 'pri_pro_y' }, premium: { month: 'pri_prem_m', year: 'pri_prem_y' } };
const ENV = {
    PADDLE_ENV: 'sandbox',
    PADDLE_API_KEY: 'pdl_sdbx_apikey_test',
    PADDLE_WEBHOOK_SECRET: SECRET,
    PADDLE_CLIENT_TOKEN: 'test_clienttoken',
    PADDLE_PRICE_PRO_MONTH: PRICES.pro.month,
    PADDLE_PRICE_PRO_YEAR: PRICES.pro.year,
    PADDLE_PRICE_PREMIUM_MONTH: PRICES.premium.month,
    PADDLE_PRICE_PREMIUM_YEAR: PRICES.premium.year,
};
const setEnv = (vars) => Object.assign(process.env, vars);
const clearEnv = () => Object.keys(ENV).forEach((k) => delete process.env[k]);

before(() => start('paddle'));
after(() => {
    clearEnv();
    return stop();
});
beforeEach(async () => {
    await resetState();
    await require('../models/Subscription').deleteMany({});
    await require('../models/PaddleCustomer').deleteMany({});
    setEnv(ENV);
});

const User = () => require('../models/User');
const Subscription = () => require('../models/Subscription');

// ---- Paddle-shaped payloads (snake_case, as Paddle sends them) ----
let seq = 0;
const iso = (d) => new Date(d).toISOString();
function priceObj(id) {
    const interval = /_y$/.test(id) ? 'year' : 'month';
    return {
        id, product_id: id.includes('prem') ? 'pro_premium' : 'pro_pro', description: '', type: 'standard', name: null,
        billing_cycle: { interval, frequency: 1 }, trial_period: null, tax_mode: 'account_setting',
        unit_price: { amount: '699', currency_code: 'USD' }, unit_price_overrides: [], quantity: { minimum: 1, maximum: 1 },
        status: 'active', custom_data: null, import_meta: null, created_at: iso(0), updated_at: iso(0),
    };
}
function subscriptionData({ id = 'sub_1', status = 'active', price = PRICES.pro.month, customer = 'ctm_1', userId, scheduled = null } = {}) {
    const now = Date.now();
    return {
        id, status, customer_id: customer, address_id: 'add_1', business_id: null, currency_code: 'USD',
        created_at: iso(now), updated_at: iso(now), started_at: iso(now), first_billed_at: iso(now), next_billed_at: iso(now + 30 * 864e5),
        paused_at: null, canceled_at: status === 'canceled' ? iso(now) : null, discount: null, collection_mode: 'automatic', billing_details: null,
        current_billing_period: { starts_at: iso(now), ends_at: iso(now + 30 * 864e5) },
        billing_cycle: { interval: 'month', frequency: 1 },
        scheduled_change: scheduled,
        management_urls: null,
        items: [{ status: 'active', quantity: 1, recurring: true, created_at: iso(now), updated_at: iso(now), previously_billed_at: null, next_billed_at: null, trial_dates: null, price: priceObj(price), product: { id: priceObj(price).product_id, name: 'Plan', description: null, type: 'standard', tax_category: 'standard', image_url: null, custom_data: null, status: 'active', import_meta: null, created_at: iso(0), updated_at: iso(0) } }],
        custom_data: userId ? { userId } : null,
        import_meta: null,
    };
}
const event = (type, data, occurredAt = new Date()) => ({ event_id: `evt_${++seq}`, event_type: type, occurred_at: iso(occurredAt), notification_id: `ntf_${seq}`, data });

/** Delivers an event the way Paddle does: raw JSON with a Paddle-Signature header. */
function deliver(payload, { secret = SECRET, ts = Math.floor(Date.now() / 1000), body } = {}) {
    const raw = body ?? JSON.stringify(payload);
    const h1 = crypto.createHmac('sha256', secret).update(`${ts}:${JSON.stringify(payload)}`).digest('hex');
    return api('POST', '/paddle/webhook', { raw, headers: { 'Content-Type': 'application/json', 'Paddle-Signature': `ts=${ts};h1=${h1}` } });
}
const planOf = async (email) => (await User().findOne({ email }).lean()).plan;

describe('webhook security', () => {
    it('refuses a wrong secret, a changed body, an old timestamp or no signature, and changes nothing', async () => {
        const u = await register();
        const payload = event('subscription.created', subscriptionData({ userId: u.user.id }));
        assert.equal((await deliver(payload, { secret: 'wrong' })).status, 401);
        assert.equal((await deliver(payload, { body: JSON.stringify(payload).replace('"active"', '"trialing"') })).status, 401);
        assert.equal((await deliver(payload, { ts: Math.floor(Date.now() / 1000) - 60 })).status, 401);
        assert.equal((await api('POST', '/paddle/webhook', { raw: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } })).status, 401);
        assert.equal(await Subscription().countDocuments(), 0);
        assert.equal(await planOf(u.email), 'free');
    });

    it('is off (503) until Paddle is configured, and never assumes an environment', async () => {
        delete process.env.PADDLE_ENV;
        const payload = event('subscription.created', subscriptionData());
        assert.equal((await deliver(payload)).status, 503);
        assert.equal((await api('GET', '/billing/plans')).body.data.paddle, null);
    });

    it('a live token with the sandbox environment (or the reverse) disables checkout', async () => {
        const { paddleConfig } = require('../lib/paddle');
        setEnv({ PADDLE_CLIENT_TOKEN: 'live_abc' });
        assert.equal(paddleConfig().enabled, false);
        assert.match(paddleConfig().problems.join(), /sandbox token/);
        setEnv({ PADDLE_ENV: 'production' });
        assert.equal(paddleConfig().enabled, true);
    });

    it('ignores event types it does not handle', async () => {
        assert.equal((await deliver(event('address.created', { id: 'add_1' }))).status, 200);
    });
});

describe('subscriptions and access', () => {
    it('a completed checkout gives the plan; a repeated delivery changes nothing', async () => {
        const u = await register();
        const payload = event('subscription.created', subscriptionData({ userId: u.user.id }));
        assert.equal((await deliver(payload)).status, 200);
        assert.equal(await planOf(u.email), 'pro');
        const user = await User().findOne({ email: u.email }).lean();
        assert.equal(user.planSource, 'paddle');
        assert.equal(user.paddleCustomerId, 'ctm_1');
        assert.equal((await deliver(payload)).status, 200);
        assert.equal(await Subscription().countDocuments(), 1);
        const me = (await api('GET', '/billing/me', { token: u.token })).body.data;
        assert.equal(me.plan.id, 'pro');
        assert.equal(me.subscription.status, 'active');
        assert.equal(me.subscription.interval, 'month');
        assert.equal(me.limit, 300, "Pro's monthly credits");
    });

    it('an older delivery arriving late never undoes a newer one', async () => {
        const u = await register();
        const t = Date.now();
        await deliver(event('subscription.created', subscriptionData({ userId: u.user.id }), t - 60000));
        await deliver(event('subscription.canceled', subscriptionData({ userId: u.user.id, status: 'canceled' }), t));
        await deliver(event('subscription.updated', subscriptionData({ userId: u.user.id, status: 'active' }), t - 30000)); // late
        assert.equal((await Subscription().findOne().lean()).status, 'canceled');
        assert.equal(await planOf(u.email), 'free');
    });

    it('upgrade, scheduled cancellation (still has access), then immediate cancellation', async () => {
        const u = await register();
        const t = Date.now();
        await deliver(event('subscription.created', subscriptionData({ userId: u.user.id }), t - 3000));
        // (a) upgraded to Premium
        await deliver(event('subscription.updated', subscriptionData({ userId: u.user.id, price: PRICES.premium.month }), t - 2000));
        assert.equal(await planOf(u.email), 'premium');
        // (b) cancels at the end of the period: still active, still Premium
        const endsAt = iso(Date.now() + 20 * 864e5);
        await deliver(event('subscription.updated', subscriptionData({ userId: u.user.id, price: PRICES.premium.month, scheduled: { action: 'cancel', effective_at: endsAt, resume_at: null } }), t - 1000));
        assert.equal(await planOf(u.email), 'premium');
        const me = (await api('GET', '/billing/me', { token: u.token })).body.data.subscription;
        assert.equal(me.scheduledChange.action, 'cancel');
        assert.equal(me.active, true);
        // (c) canceled now
        await deliver(event('subscription.canceled', subscriptionData({ userId: u.user.id, price: PRICES.premium.month, status: 'canceled' }), t));
        assert.equal(await planOf(u.email), 'free');
    });

    it('a failed renewal being retried (past_due) keeps access; paused does not', async () => {
        const u = await register();
        const t = Date.now();
        await deliver(event('subscription.past_due', subscriptionData({ userId: u.user.id, status: 'past_due' }), t - 1000));
        assert.equal(await planOf(u.email), 'pro');
        await deliver(event('subscription.paused', subscriptionData({ userId: u.user.id, status: 'paused' }), t));
        assert.equal(await planOf(u.email), 'free');
    });

    it('finds the account by the customer email when checkout had no user id', async () => {
        const u = await register();
        paddleApi.handler = (url) => (url.includes('/customers/ctm_9') ? { body: { data: { id: 'ctm_9', email: u.email.toUpperCase(), status: 'active', custom_data: null, locale: 'en', created_at: iso(0), updated_at: iso(0), marketing_consent: false, import_meta: null } } } : null);
        await deliver(event('subscription.created', subscriptionData({ id: 'sub_9', customer: 'ctm_9' })));
        assert.equal(await planOf(u.email), 'pro');
        assert.equal((await User().findOne({ email: u.email }).lean()).paddleCustomerId, 'ctm_9');
    });

    it('a customer event first links the account, and the subscription follows', async () => {
        const u = await register();
        await deliver(event('customer.created', { id: 'ctm_5', email: u.email, status: 'active', custom_data: null, locale: 'en', created_at: iso(0), updated_at: iso(0), marketing_consent: false, import_meta: null }));
        await deliver(event('subscription.created', subscriptionData({ id: 'sub_5', customer: 'ctm_5' })));
        assert.equal(await planOf(u.email), 'pro');
    });

    it("ending a Paddle subscription doesn't remove a plan an admin gave, nor downgrade a higher one", async () => {
        const u = await register();
        await User().updateOne({ email: u.email }, { plan: 'premium' }); // e.g. a campaign
        await deliver(event('subscription.created', subscriptionData({ userId: u.user.id })));
        assert.equal(await planOf(u.email), 'premium', 'not downgraded to Pro');
        await deliver(event('subscription.canceled', subscriptionData({ userId: u.user.id, status: 'canceled' }), Date.now() + 1000));
        assert.equal(await planOf(u.email), 'premium', 'the admin plan stays');
    });

    it("another account can't take over someone's Paddle customer", async () => {
        const a = await register();
        const b = await register();
        await deliver(event('subscription.created', subscriptionData({ userId: a.user.id, customer: 'ctm_a', id: 'sub_a' })));
        await deliver(event('transaction.completed', { id: 'txn_1', status: 'completed', customer_id: 'ctm_b', subscription_id: null, custom_data: { userId: a.user.id }, items: [], details: null, payments: [], checkout: null, created_at: iso(0), updated_at: iso(0), billed_at: null, origin: 'web', currency_code: 'USD', collection_mode: 'automatic', billing_details: null, billing_period: null, address_id: null, business_id: null, discount_id: null, invoice_id: null, invoice_number: null, available_payment_methods: [] }));
        assert.equal((await User().findOne({ email: a.email }).lean()).paddleCustomerId, 'ctm_a', 'the first customer stays');
        assert.equal(await planOf(b.email), 'free');
    });
});

describe('refunds and chargebacks', () => {
    const adjustment = (fields) => ({
        id: `adj_${++seq}`, transaction_id: 'txn_1', subscription_id: 'sub_1', customer_id: 'ctm_1', reason: 'test', credit_applied_to_balance: false,
        currency_code: 'USD', items: [], totals: { subtotal: '699', tax: '0', total: '699', fee: '0', earnings: '0', currency_code: 'USD' }, payout_totals: null,
        created_at: iso(Date.now()), updated_at: iso(Date.now()), ...fields,
    });
    const setup = async () => {
        const u = await register();
        await deliver(event('subscription.created', subscriptionData({ userId: u.user.id }), Date.now() - 5000));
        paddleApi.handler = (url, opts) => (url.endsWith('/subscriptions/sub_1/cancel') && opts.method === 'POST' ? { body: { data: subscriptionData({ userId: u.user.id, status: 'canceled' }) } } : null);
        return u;
    };
    const cancels = () => paddleApi.calls.filter((c) => c.url.endsWith('/cancel'));

    it('an approved full refund ends the plan straight away', async () => {
        const u = await setup();
        assert.equal(await planOf(u.email), 'pro');
        await deliver(event('adjustment.created', adjustment({ action: 'refund', type: 'full', status: 'approved' })));
        assert.equal(cancels().length, 1);
        assert.deepEqual(cancels()[0].body, { effective_from: 'immediately' });
        assert.equal(await planOf(u.email), 'free');
    });

    it('a refund waiting for approval does nothing until it is approved', async () => {
        const u = await setup();
        const pending = adjustment({ action: 'refund', type: 'full', status: 'pending_approval' });
        await deliver(event('adjustment.created', pending));
        assert.equal(cancels().length, 0);
        assert.equal(await planOf(u.email), 'pro');
        await deliver(event('adjustment.updated', { ...pending, status: 'approved' }));
        assert.equal(await planOf(u.email), 'free');
    });

    it('a partial refund (e.g. a goodwill credit) keeps the plan', async () => {
        const u = await setup();
        await deliver(event('adjustment.created', adjustment({ action: 'refund', type: 'partial', status: 'approved' })));
        assert.equal(cancels().length, 0);
        assert.equal(await planOf(u.email), 'pro');
    });

    it('a chargeback ends the plan', async () => {
        const u = await setup();
        await deliver(event('adjustment.created', adjustment({ action: 'chargeback', type: 'full', status: 'approved' })));
        assert.equal(await planOf(u.email), 'free');
    });
});

describe('billing endpoints', () => {
    it('/billing/plans gives the browser what checkout needs, with the prices Paddle charges', async () => {
        paddleApi.handler = (url) => {
            const id = url.match(/prices\/(pri_\w+)/)?.[1];
            if (!id) return null;
            const amount = { pri_pro_m: '699', pri_pro_y: '7549', pri_prem_m: '1299', pri_prem_y: '14029' }[id];
            return { body: { data: { ...priceObj(id), unit_price: { amount, currency_code: 'USD' } } } };
        };
        const { data } = (await api('GET', '/billing/plans')).body;
        assert.deepEqual(data.paddle, { environment: 'sandbox', clientToken: 'test_clienttoken', prices: PRICES });
        const pro = data.plans.find((p) => p.id === 'pro');
        const premium = data.plans.find((p) => p.id === 'premium');
        assert.deepEqual([pro.price, pro.yearlyPrice, premium.price, premium.yearlyPrice], [6.99, 75.49, 12.99, 140.29]);
        assert.ok(!JSON.stringify(data).includes(process.env.PADDLE_API_KEY), 'the API key never leaves the server');
        assert.ok(!JSON.stringify(data).includes(SECRET));
    });

    it("the billing portal opens only for the signed-in account's own customer", async () => {
        const u = await register();
        assert.equal((await api('POST', '/billing/portal')).status, 401);
        assert.equal((await api('POST', '/billing/portal', { token: u.token })).status, 404, 'no subscription yet');
        await deliver(event('subscription.created', subscriptionData({ userId: u.user.id, customer: 'ctm_own' })));
        paddleApi.handler = (url) => (url.includes('/customers/ctm_own/portal-sessions') ? { status: 201, body: { data: { id: 'cpls_1', customer_id: 'ctm_own', urls: { general: { overview: 'https://customer-portal.paddle.com/cpl_x' }, subscriptions: [] }, created_at: iso(0) } } } : null);
        const r = await api('POST', '/billing/portal', { token: u.token, body: { customerId: 'ctm_someone_else' } });
        assert.equal(r.status, 200);
        assert.equal(r.body.url, 'https://customer-portal.paddle.com/cpl_x');
        assert.ok(paddleApi.calls.some((c) => c.url.includes('/customers/ctm_own/portal-sessions')));
        assert.ok(!paddleApi.calls.some((c) => c.url.includes('ctm_someone_else')));
    });

    it('changing plan updates the existing subscription (no second checkout)', async () => {
        const u = await register();
        assert.equal((await api('POST', '/billing/change-plan', { token: u.token, body: { plan: 'premium', interval: 'month' } })).status, 404);
        await deliver(event('subscription.created', subscriptionData({ userId: u.user.id })));
        assert.equal((await api('POST', '/billing/change-plan', { token: u.token, body: { plan: 'pro', interval: 'month' } })).status, 400, 'already on it');
        assert.equal((await api('POST', '/billing/change-plan', { token: u.token, body: { plan: 'gold', interval: 'week' } })).status, 400);
        paddleApi.handler = (url, opts) => (url.endsWith('/subscriptions/sub_1') && opts.method === 'PATCH' ? { body: { data: subscriptionData({ userId: u.user.id, price: PRICES.premium.year }) } } : null);
        const r = await api('POST', '/billing/change-plan', { token: u.token, body: { plan: 'premium', interval: 'year' } });
        assert.equal(r.status, 200);
        const call = paddleApi.calls.find((c) => c.method === 'PATCH');
        assert.deepEqual(call.body.items, [{ price_id: PRICES.premium.year, quantity: 1 }]);
        assert.equal(call.body.proration_billing_mode, 'prorated_immediately');
        assert.equal(await planOf(u.email), 'premium');
        assert.equal(r.body.data.interval, 'year');
    });
});
