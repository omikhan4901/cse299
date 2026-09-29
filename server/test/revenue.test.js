/**
 * The admin Revenue view (lib/revenue.js): payments recorded with where they came from
 * (plan, interval, kind, country, upgrade prompt, campaign), recurring revenue, subscription
 * health, the funnel, fixed costs and profit, and the CSV export. Paddle's API is stubbed.
 */
const crypto = require('node:crypto');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, resetState, paddleApi, superadmin, setSettings } = require('./helpers');

const SECRET = 'pdl_ntfset_test_secret';
const PRICES = { pro: { month: 'pri_pro_m', year: 'pri_pro_y' }, premium: { month: 'pri_prem_m', year: 'pri_prem_y' } };
const ENV = {
    PADDLE_ENV: 'sandbox', PADDLE_API_KEY: 'pdl_sdbx_apikey_test', PADDLE_WEBHOOK_SECRET: SECRET, PADDLE_CLIENT_TOKEN: 'test_clienttoken',
    PADDLE_PRICE_PRO_MONTH: PRICES.pro.month, PADDLE_PRICE_PRO_YEAR: PRICES.pro.year, PADDLE_PRICE_PREMIUM_MONTH: PRICES.premium.month, PADDLE_PRICE_PREMIUM_YEAR: PRICES.premium.year,
};

before(() => start('revenue'));
after(() => {
    Object.keys(ENV).forEach((k) => delete process.env[k]);
    return stop();
});
beforeEach(async () => {
    await resetState();
    for (const m of ['Subscription', 'PaddleCustomer', 'Payment', 'BillingEvent', 'Campaign']) await require(`../models/${m}`).deleteMany({});
    Object.assign(process.env, ENV);
    // Paddle's address lookup: a Bangladeshi address, unless a test says otherwise.
    paddleApi.handler = (url) => (/\/addresses\/add_bd$/.test(url) ? { body: { data: address('add_bd', 'BD') } } : /\/addresses\/add_gb$/.test(url) ? { body: { data: address('add_gb', 'GB') } } : null);
});

const User = () => require('../models/User');
const Payment = () => require('../models/Payment');
let seq = 0;
const iso = (d) => new Date(d).toISOString();
const address = (id, country) => ({ id, customer_id: 'ctm_x', description: null, first_line: null, second_line: null, city: null, postal_code: null, region: null, country_code: country, custom_data: null, status: 'active', created_at: iso(0), updated_at: iso(0), import_meta: null });
function priceObj(id) {
    return {
        id, product_id: id.includes('prem') ? 'pro_premium' : 'pro_pro', description: '', type: 'standard', name: null,
        billing_cycle: { interval: /_y$/.test(id) ? 'year' : 'month', frequency: 1 }, trial_period: null, tax_mode: 'account_setting',
        unit_price: { amount: '699', currency_code: 'USD' }, unit_price_overrides: [], quantity: { minimum: 1, maximum: 1 },
        status: 'active', custom_data: null, import_meta: null, created_at: iso(0), updated_at: iso(0),
    };
}
function subscriptionData({ id, status = 'active', price = PRICES.pro.month, customer, userId, scheduled = null, periodEnd = Date.now() + 20 * 864e5 }) {
    const now = Date.now();
    return {
        id, status, customer_id: customer, address_id: null, business_id: null, currency_code: 'USD',
        created_at: iso(now), updated_at: iso(now), started_at: iso(now), first_billed_at: iso(now), next_billed_at: iso(periodEnd),
        paused_at: null, canceled_at: status === 'canceled' ? iso(now) : null, discount: null, collection_mode: 'automatic', billing_details: null,
        current_billing_period: { starts_at: iso(now), ends_at: iso(periodEnd) }, billing_cycle: { interval: /_y$/.test(price) ? 'year' : 'month', frequency: 1 },
        scheduled_change: scheduled, management_urls: null,
        items: [{ status: 'active', quantity: 1, recurring: true, created_at: iso(now), updated_at: iso(now), previously_billed_at: null, next_billed_at: null, trial_dates: null, price: priceObj(price), product: { id: 'pro_pro', name: 'Plan', description: null, type: 'standard', tax_category: 'standard', image_url: null, custom_data: null, status: 'active', import_meta: null, created_at: iso(0), updated_at: iso(0) } }],
        custom_data: userId ? { userId } : null, import_meta: null,
    };
}
/** A completed transaction: amounts in cents; fee and earnings as Paddle reports them. */
function txn({ id = `txn_${++seq}`, userId, customer, sub, price = PRICES.pro.month, origin = 'web', total = 699, tax = 0, fee = 85, source, addressId = 'add_bd', billedAt = new Date(), currency = 'USD' }) {
    const earnings = total - tax - fee;
    return {
        id, status: 'completed', customer_id: customer, subscription_id: sub, custom_data: { userId, ...(source ? { source } : {}) }, origin, currency_code: currency,
        collection_mode: 'automatic', billing_details: null, billing_period: null, address_id: addressId, business_id: null, discount_id: null, invoice_id: null,
        invoice_number: null, available_payment_methods: [], payments: [], checkout: null, created_at: iso(billedAt), updated_at: iso(billedAt), billed_at: iso(billedAt),
        items: [{ price: priceObj(price), quantity: 1, proration: null }],
        details: {
            tax_rates_used: [], line_items: [], payout_totals: null, adjusted_totals: null,
            totals: { subtotal: String(total - tax), discount: '0', tax: String(tax), total: String(total), credit: '0', credit_to_balance: '0', balance: '0', grand_total: String(total), fee: String(fee), earnings: String(earnings), currency_code: currency },
        },
    };
}
const event = (type, data, occurredAt = new Date()) => ({ event_id: `evt_${++seq}`, event_type: type, occurred_at: iso(occurredAt), notification_id: `ntf_${seq}`, data });
function deliver(payload) {
    const ts = Math.floor(Date.now() / 1000);
    const h1 = crypto.createHmac('sha256', SECRET).update(`${ts}:${JSON.stringify(payload)}`).digest('hex');
    return api('POST', '/paddle/webhook', { raw: JSON.stringify(payload), headers: { 'Content-Type': 'application/json', 'Paddle-Signature': `ts=${ts};h1=${h1}` } });
}
/** A customer who subscribes (and pays), from an upgrade prompt. */
async function customer({ price = PRICES.pro.month, source, addressId, total = 699, fee = 85, status = 'active', scheduled = null, billedAt } = {}) {
    const u = await register();
    const n = ++seq;
    const sub = `sub_${n}`;
    const cust = `ctm_${n}`;
    assert.equal((await deliver(event('subscription.created', subscriptionData({ id: sub, customer: cust, userId: u.user.id, price, status, scheduled })))).status, 200);
    const t = txn({ userId: u.user.id, customer: cust, sub, price, source, addressId, total, fee, billedAt });
    assert.equal((await deliver(event('transaction.completed', t))).status, 200);
    return { ...u, sub, cust, txn: t };
}
const report = async (days = 30) => {
    const boss = await superadmin();
    const r = await api('GET', `/admin/revenue?days=${days}`, { token: boss.token });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data;
};

describe('payments remember where they came from', () => {
    it('plan, interval, kind, country, upgrade prompt and campaign are stored with each payment', async () => {
        const Campaign = require('../models/Campaign');
        const c = await Campaign.create({ name: 'NSU', code: 'NSU2026', plan: 'pro', durationDays: 30, active: true });
        const u = await register();
        await User().updateOne({ email: u.email }, { campaign: c._id });
        await deliver(event('subscription.created', subscriptionData({ id: 'sub_c', customer: 'ctm_c', userId: u.user.id, price: PRICES.premium.year })));
        await deliver(event('transaction.completed', txn({ id: 'txn_c', userId: u.user.id, customer: 'ctm_c', sub: 'sub_c', price: PRICES.premium.year, source: 'feature:polish', total: 12000, tax: 1000, fee: 600 })));
        const p = await Payment().findOne({ transactionId: 'txn_c' }).lean();
        assert.equal(p.type, 'new');
        assert.equal(p.plan, 'premium');
        assert.equal(p.interval, 'year');
        assert.equal(p.country, 'BD');
        assert.equal(p.source, 'feature:polish');
        assert.equal(String(p.campaign), String(c._id));
        assert.equal(p.subscriptionId, 'sub_c');
        assert.deepEqual([p.total, p.tax, p.fee, p.earnings], [12000, 1000, 600, 10400]);
    });

    it('a renewal is a renewal, an update is a change; junk sources are dropped; a failed address lookup still records the payment', async () => {
        const u = await customer({ source: 'limit:applications' });
        await deliver(event('transaction.completed', txn({ id: 'txn_ren', userId: u.user.id, customer: u.cust, sub: u.sub, origin: 'subscription_recurring', addressId: 'add_unknown', source: 'x"><script>' })));
        await deliver(event('transaction.completed', txn({ id: 'txn_chg', userId: u.user.id, customer: u.cust, sub: u.sub, origin: 'subscription_update', price: PRICES.premium.month, addressId: null })));
        const ren = await Payment().findOne({ transactionId: 'txn_ren' }).lean();
        assert.equal(ren.type, 'renewal');
        assert.equal(ren.source, undefined, 'not a plain label: not stored');
        assert.equal(ren.country, undefined, 'lookup failed: no country, payment still recorded');
        const chg = await Payment().findOne({ transactionId: 'txn_chg' }).lean();
        assert.equal(chg.type, 'change');
        assert.equal(chg.plan, 'premium');
        // A price we don't sell: no plan, still counted.
        await deliver(event('transaction.completed', txn({ id: 'txn_odd', userId: u.user.id, customer: u.cust, sub: u.sub, price: 'pri_other' })));
        assert.equal((await Payment().findOne({ transactionId: 'txn_odd' }).lean()).plan, undefined);
    });
});

describe('the Revenue report', () => {
    it('adds up money in, splits it by plan, prompt, country and kind, and works out MRR', async () => {
        const a = await customer({ source: 'feature:polish' }); // Pro monthly: 699 − 85 = 614
        await customer({ price: PRICES.premium.year, source: 'limit:applications', total: 12000, fee: 600, addressId: 'add_gb' }); // 11400 a year → 950/month
        await customer({ source: 'feature:polish' });
        // A renewal for the first customer: revenue, but not a "new customer" and not credited to a prompt.
        await deliver(event('transaction.completed', txn({ userId: a.user.id, customer: a.cust, sub: a.sub, origin: 'subscription_recurring' })));

        const r = await report();
        assert.equal(r.currency, 'USD');
        assert.equal(r.current.payments, 4);
        assert.equal(r.current.gross, 6.99 * 3 + 120);
        assert.equal(r.current.fees, 0.85 * 3 + 6);
        assert.equal(r.current.net, 6.14 * 3 + 114);
        assert.equal(r.current.customers, 3);
        assert.equal(r.current.newCustomers, 3);
        assert.equal(r.previous.net, 0);
        // MRR: each live subscription at its latest payment, yearly divided by 12.
        assert.equal(r.mrr.subscriptions, 3);
        assert.equal(r.mrr.total, Math.round((614 + 614 + 11400 / 12) * 100) / 10000);
        assert.equal(r.mrr.arr, Math.round((614 + 614 + 11400 / 12) * 12) / 100);
        assert.deepEqual(r.mrr.byPlan.map((p) => [p.plan, p.subscriptions]).sort(), [['premium', 1], ['pro', 2]]);

        const by = (list, label) => list.find((x) => x.label === label);
        assert.equal(by(r.breakdown.byPlan, 'Pro · monthly').payments, 3);
        assert.equal(by(r.breakdown.byPlan, 'Premium · yearly').net, 114);
        assert.equal(r.breakdown.byPlan[0].label, 'Premium · yearly', 'biggest first');
        assert.equal(by(r.breakdown.bySource, 'Locked: polish').customers, 2);
        assert.equal(by(r.breakdown.bySource, 'Locked: polish').payments, 2, 'the renewal is not credited to the prompt');
        assert.equal(by(r.breakdown.bySource, 'Limit: applications').net, 114);
        assert.equal(by(r.breakdown.byCountry, 'BD').payments, 3);
        assert.equal(by(r.breakdown.byCountry, 'GB').payments, 1);
        assert.equal(by(r.breakdown.byType, 'Renewals').payments, 1);
        assert.equal(by(r.breakdown.byCampaign, 'No campaign').payments, 4);
        // This month's bar holds it all, split into new and renewals.
        const month = r.months.at(-1);
        assert.equal(r.months.length, 12);
        assert.equal(month.renewal, 6.14);
        assert.equal(month.new, 6.14 * 2 + 114);
        assert.equal(month.net, r.current.net);
        assert.equal(r.recent.length, 4);
        assert.equal(r.recent[0].email.includes('@'), true);
    });

    it('refunds lower net revenue in the period they happen; older payments count in the previous period', async () => {
        const old = await customer({ billedAt: new Date(Date.now() - 45 * 864e5) });
        const now = await customer();
        const refund = { id: 'adj_1', action: 'refund', type: 'partial', status: 'approved', transaction_id: now.txn.id, subscription_id: now.sub, customer_id: now.cust, reason: 'x', credit_applied_to_balance: false, currency_code: 'USD', items: [], totals: { subtotal: '300', tax: '0', total: '300', fee: '0', earnings: '300', currency_code: 'USD' }, payout_totals: null, created_at: iso(Date.now()), updated_at: iso(Date.now()) };
        await deliver(event('adjustment.created', refund));
        await deliver(event('adjustment.updated', refund)); // repeated: counted once
        const r = await report();
        assert.equal(r.current.refunds, 3);
        assert.equal(r.current.net, Math.round((6.14 - 3) * 100) / 100);
        assert.equal(r.previous.net, 6.14, 'the 45-day-old payment is in the 30 days before');
        assert.equal(r.months.at(-1).refunds, 3);
        assert.equal(r.recent.find((p) => p.transactionId === now.txn.id).refunded, 3);
        assert.ok(old);
    });

    it('subscription health: failing payments, scheduled cancellations with MRR at risk, churn and renewals due', async () => {
        await customer(); // renews within 30 days
        await customer({ status: 'past_due' });
        await customer({ scheduled: { action: 'cancel', effective_at: iso(Date.now() + 10 * 864e5), resume_at: null } });
        const gone = await customer();
        await deliver(event('subscription.canceled', subscriptionData({ id: gone.sub, customer: gone.cust, userId: gone.user.id, status: 'canceled' })));
        const h = (await report()).health;
        assert.equal(h.pastDue.length, 1);
        assert.equal(h.canceling.length, 1);
        assert.equal(h.mrrAtRisk, 6.14);
        assert.equal(h.churned, 1);
        assert.equal(h.mrrLost, 6.14);
        assert.equal(h.renewals.count, 1, 'past-due and cancelling ones are not expected to renew');
        assert.equal(h.renewals.expected, 6.14);
        assert.ok(h.canceling[0].email.includes('@'));
    });

    it('payments in another payout currency are kept apart and named', async () => {
        const u = await customer();
        await customer();
        await deliver(event('transaction.completed', txn({ userId: u.user.id, customer: u.cust, sub: u.sub, origin: 'subscription_recurring', currency: 'EUR' })));
        const r = await report();
        assert.equal(r.currency, 'USD', 'the most common payout currency');
        assert.deepEqual(r.otherCurrencies, ['EUR']);
        assert.equal(r.current.payments, 2);
    });

    it('with no payments at all it still answers, with zeros', async () => {
        const r = await report(365);
        assert.equal(r.current.net, 0);
        assert.equal(r.mrr.total, 0);
        assert.equal(r.months.length, 12);
        assert.deepEqual(r.breakdown.byPlan, []);
        assert.ok(Math.abs(r.costs.profit - (-r.costs.ai - r.costs.fixed)) < 1e-9);
    });

    it('is admin only', async () => {
        const u = await register();
        assert.equal((await api('GET', '/admin/revenue', { token: u.token })).status, 403);
        assert.equal((await api('GET', '/admin/revenue/payments.csv', { token: u.token })).status, 403);
        assert.equal((await api('GET', '/admin/revenue')).status, 401);
    });
});

describe('the funnel: prompts, checkouts and payments', () => {
    it('records steps once per 10 minutes, refuses junk, needs an account, and ties payments back to prompts', async () => {
        const a = await register();
        const b = await register();
        const post = (u, body) => api('POST', '/billing/event', { token: u.token, body });
        assert.equal((await post(a, { kind: 'prompt', source: 'feature:polish' })).status, 200);
        assert.equal((await post(a, { kind: 'prompt', source: 'feature:polish' })).status, 200); // repeat: not counted again
        assert.equal((await post(a, { kind: 'checkout', source: 'feature:polish', plan: 'pro' })).status, 200);
        assert.equal((await post(b, { kind: 'prompt', source: 'feature:polish' })).status, 200);
        assert.equal((await post(b, { kind: 'prompt', source: 'template' })).status, 200);
        for (const bad of [{ kind: 'buy', source: 'x' }, { kind: 'prompt', source: '' }, { kind: 'prompt', source: 'a b' }, { kind: 'prompt', source: 'x'.repeat(61) }, { kind: 'prompt', source: { $gt: '' } }, {}]) {
            assert.equal((await post(a, bad)).status, 400, JSON.stringify(bad));
        }
        assert.equal((await api('POST', '/billing/event', { body: { kind: 'prompt', source: 'x' } })).status, 401);
        assert.equal(await require('../models/BillingEvent').countDocuments(), 4);

        // a pays after the polish prompt.
        await deliver(event('subscription.created', subscriptionData({ id: 'sub_f', customer: 'ctm_f', userId: a.user.id })));
        await deliver(event('transaction.completed', txn({ userId: a.user.id, customer: 'ctm_f', sub: 'sub_f', source: 'feature:polish' })));
        const f = (await report()).funnel;
        assert.ok(f.signups >= 2);
        assert.equal(f.prompted, 2);
        assert.equal(f.checkout, 1);
        assert.equal(f.paid, 1);
        const polish = f.bySource.find((s) => s.source === 'feature:polish');
        assert.deepEqual([polish.prompted, polish.checkout, polish.paid, polish.net], [2, 1, 1, 6.14]);
        assert.equal(polish.label, 'Locked: polish');
        assert.equal(require('../lib/revenue').sourceLabel('feature:interviewPrep'), 'Locked: interview prep');
        assert.equal(f.bySource[0].source, 'feature:polish', 'sources that led to payments first');
    });

    it('deleting an account deletes its funnel steps (payments stay, unlinked)', async () => {
        const u = await register({ password: 'password123' });
        await api('POST', '/billing/event', { token: u.token, body: { kind: 'prompt', source: 'template' } });
        const del = await api('DELETE', '/auth/me', { token: u.token, body: { password: 'password123' } });
        assert.ok([200, 204].includes(del.status), JSON.stringify(del.body));
        assert.equal(await require('../models/BillingEvent').countDocuments({ user: u.user.id }), 0);
    });
});

describe('fixed costs, profit and the CSV export', () => {
    it('fixed costs are validated, pro-rated to the period, and taken off with AI to give profit', async () => {
        await customer();
        await setSettings({ fixedCosts: [{ name: 'Vercel Pro', amount: 20 }, { name: 'Domain', amount: 1.5 }, { name: '', amount: 5 }, { name: 'Junk', amount: -4 }, 'nope', { name: 'x'.repeat(80), amount: 1e9 }] });
        const s = require('../lib/settings');
        const saved = (await s.getSettings()).fixedCosts;
        assert.deepEqual(saved.map((c) => c.name), ['Vercel Pro', 'Domain', 'Junk', 'x'.repeat(40)]);
        assert.equal(saved.find((c) => c.name === 'Junk').amount, 0, 'negative becomes 0');
        assert.equal(saved.at(-1).amount, 100000, 'capped');
        await setSettings({ fixedCosts: [{ name: 'Vercel Pro', amount: 20 }, { name: 'Domain', amount: 1.5 }] });
        const r = await report(30);
        assert.equal(r.costs.fixedMonthly, 21.5);
        assert.equal(r.costs.fixed, Math.round(21.5 * (30 / 30.44) * 100) / 100);
        assert.equal(r.costs.profit, Math.round((r.current.net - r.costs.ai - r.costs.fixed) * 100) / 100);
        await setSettings({ fixedCosts: Array.from({ length: 30 }, (_, i) => ({ name: `c${i}`, amount: 1 })) });
        assert.equal((await s.getSettings()).fixedCosts.length, 20);
    });

    it('the admin can save fixed costs from the console', async () => {
        const boss = await superadmin();
        const r = await api('PUT', '/admin/settings', { token: boss.token, body: { fixedCosts: [{ name: 'Email', amount: 3 }] } });
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.data.settings.fixedCosts, [{ name: 'Email', amount: 3 }]);
    });

    it('exports every payment as CSV, with the audit log noting it', async () => {
        await customer({ source: 'feature:polish' });
        await customer({ price: PRICES.premium.year, total: 12000, fee: 600, addressId: 'add_gb' });
        const boss = await superadmin();
        const r = await api('GET', '/admin/revenue/payments.csv', { token: boss.token });
        assert.equal(r.status, 200);
        const text = typeof r.body === 'string' ? r.body : r.text;
        const lines = text.trim().split('\n');
        assert.equal(lines[0], 'date,transaction,email,type,plan,interval,country,source,campaign,currency,total,tax,fee,earnings,refunded,net');
        assert.equal(lines.length, 3);
        assert.ok(lines.some((l) => l.includes('"premium","year","GB"') && l.includes('"120","0","6","114","0","114"')), lines.join('\n'));
        assert.ok(lines.some((l) => l.includes('"feature:polish"')));
        const AdminLog = require('../models/AdminLog');
        assert.ok(await AdminLog.exists({ action: 'revenue.export' }));
    });
});
