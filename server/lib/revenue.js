/**
 * The admin Revenue view: where the money comes from and how. Everything is computed from
 * Paddle's own records mirrored by the webhooks (Payment, Subscription), the upgrade steps
 * the app reports (BillingEvent), AI usage (AiEvent) and the admin's fixed costs.
 *
 * Money is in the payout currency's smallest unit in the database and in whole units here.
 * "Net" is what reaches the account after Paddle's fee and tax, minus refunds.
 * Summed in JavaScript rather than with $group, so it works the same on every
 * MongoDB-compatible store.
 */
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const BillingEvent = require('../models/BillingEvent');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { aiEconomics } = require('./economics');

const DAY = 864e5;
const LIVE = ['active', 'trialing', 'past_due'];
const units = (c) => Math.round(c) / 100;
const refundedIn = (p, from, to) => (p.refunds || []).filter((r) => !from || (r.at && new Date(r.at) >= from && new Date(r.at) < to)).reduce((s, r) => s + (r.earnings || 0), 0);
const netOf = (p) => (p.earnings || 0) - refundedIn(p);
const monthKey = (d) => new Date(d).toISOString().slice(0, 7);
const TYPE_LABEL = { new: 'New customers', renewal: 'Renewals', change: 'Plan changes', pass: 'Job Search Pass', other: 'Other' };
const planLabel = (p) => (p.plan ? `${p.plan[0].toUpperCase()}${p.plan.slice(1)} · ${p.interval === 'year' ? 'yearly' : 'monthly'}` : p.type === 'pass' ? 'Job Search Pass' : 'Other');
const sourceLabel = (s) => {
    if (!s) return 'Not recorded';
    const [kind, what = ''] = s.split(':');
    const name = what.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
    return { feature: `Locked: ${name}`, limit: `Limit: ${name}`, template: 'Paid template', pricing: 'Pricing page', credits: 'Out of credits' }[kind] || s;
};

/** Adds a payment to a named bucket of a breakdown. */
function add(map, key, label, p) {
    const b = map.get(key) || { key, label, payments: 0, net: 0, customers: new Set() };
    b.payments += 1;
    b.net += netOf(p);
    if (p.user) b.customers.add(String(p.user));
    map.set(key, b);
}
const rows = (map, top = 12) => {
    const list = [...map.values()].map((b) => ({ key: b.key, label: b.label, payments: b.payments, customers: b.customers.size, net: units(b.net) })).sort((a, b) => b.net - a.net || b.payments - a.payments);
    if (list.length <= top) return list;
    const rest = list.slice(top - 1);
    return [...list.slice(0, top - 1), { key: 'other', label: `${rest.length} others`, payments: rest.reduce((s, r) => s + r.payments, 0), customers: rest.reduce((s, r) => s + r.customers, 0), net: Math.round(rest.reduce((s, r) => s + r.net, 0) * 100) / 100 }];
};

/** Money in over a window: gross, tax, Paddle's fee, earnings, refunds (by refund date) and net. */
function summarise(payments, from, to) {
    const inWindow = payments.filter((p) => p.billedAt && new Date(p.billedAt) >= from && new Date(p.billedAt) < to);
    const refunds = payments.reduce((s, p) => s + refundedIn(p, from, to), 0);
    const earnings = inWindow.reduce((s, p) => s + (p.earnings || 0), 0);
    return {
        payments: inWindow.length,
        gross: units(inWindow.reduce((s, p) => s + (p.total || 0), 0)),
        tax: units(inWindow.reduce((s, p) => s + (p.tax || 0), 0)),
        fees: units(inWindow.reduce((s, p) => s + (p.fee || 0), 0)),
        earnings: units(earnings),
        refunds: units(refunds),
        net: units(earnings - refunds),
        customers: new Set(inWindow.filter((p) => p.user).map((p) => String(p.user))).size,
        newCustomers: new Set(inWindow.filter((p) => p.type === 'new' && p.user).map((p) => String(p.user))).size,
    };
}

async function revenueReport({ days = 30, settings, now = new Date() } = {}) {
    const to = now;
    const from = new Date(now.getTime() - days * DAY);
    const prevFrom = new Date(now.getTime() - 2 * days * DAY);
    const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const since = new Date(Math.min(prevFrom.getTime(), yearAgo.getTime()));

    const [allPayments, subs] = await Promise.all([
        Payment.find({ billedAt: { $gte: since } }).sort({ billedAt: -1 }).limit(200000).lean(),
        Subscription.find({}).select('subscriptionId user status plan interval currentPeriodEnd scheduledChange updatedAt').lean(),
    ]);

    // One currency: the most common payout currency (Paddle pays out in one, so normally all).
    const counts = {};
    for (const p of allPayments) counts[p.currency || 'USD'] = (counts[p.currency || 'USD'] || 0) + 1;
    const currency = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';
    const payments = allPayments.filter((p) => (p.currency || 'USD') === currency);
    const inRange = payments.filter((p) => new Date(p.billedAt) >= from);

    // ---- Money in, this window and the one before ----
    const current = summarise(payments, from, to);
    const previous = summarise(payments, prevFrom, from);

    // ---- The last 12 calendar months, split by kind ----
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push({ month: monthKey(d), new: 0, renewal: 0, other: 0, refunds: 0, net: 0 });
    }
    const byMonth = new Map(months.map((m) => [m.month, m]));
    for (const p of payments) {
        const m = byMonth.get(monthKey(p.billedAt));
        if (m) m[p.type === 'new' ? 'new' : p.type === 'renewal' ? 'renewal' : 'other'] += p.earnings || 0;
        for (const r of p.refunds || []) {
            const rm = r.at && byMonth.get(monthKey(r.at));
            if (rm) rm.refunds += r.earnings || 0;
        }
    }
    for (const m of months) {
        m.net = units(m.new + m.renewal + m.other - m.refunds);
        for (const k of ['new', 'renewal', 'other', 'refunds']) m[k] = units(m[k]);
    }

    // ---- Recurring revenue: each live subscription at its latest payment, per month ----
    const lastBySub = new Map();
    for (const p of payments) if (p.subscriptionId && !lastBySub.has(p.subscriptionId) && netOf(p) > 0) lastBySub.set(p.subscriptionId, p); // newest first
    const monthly = (sub) => {
        const p = lastBySub.get(sub.subscriptionId);
        if (!p) return null;
        return (p.earnings || 0) / ((p.interval || sub.interval) === 'year' ? 12 : 1);
    };
    const live = subs.filter((s) => LIVE.includes(s.status));
    const mrrByPlan = {};
    let mrr = 0;
    let unpriced = 0;
    for (const s of live) {
        const m = monthly(s);
        if (m == null) unpriced += 1;
        const key = s.plan || 'other';
        mrrByPlan[key] ||= { plan: key, subscriptions: 0, mrr: 0 };
        mrrByPlan[key].subscriptions += 1;
        mrrByPlan[key].mrr += m || 0;
        mrr += m || 0;
    }

    // ---- Health: failing payments, cancellations coming, churn, renewals due ----
    const userIds = new Set([...subs.map((s) => s.user), ...inRange.slice(0, 40).map((p) => p.user)].filter(Boolean).map(String));
    const users = new Map((await User.find({ _id: { $in: [...userIds] } }).select('email name').lean()).map((u) => [String(u._id), u]));
    const who = (id) => (id && users.get(String(id))?.email) || '(deleted account)';
    const canceling = live.filter((s) => s.scheduledChange?.action === 'cancel');
    const churned = subs.filter((s) => s.status === 'canceled' && s.updatedAt && new Date(s.updatedAt) >= from);
    const soon = new Date(now.getTime() + 30 * DAY);
    const renewing = live.filter((s) => s.status !== 'past_due' && s.scheduledChange?.action !== 'cancel' && s.currentPeriodEnd && new Date(s.currentPeriodEnd) >= now && new Date(s.currentPeriodEnd) <= soon);
    const expected = (list) => list.reduce((sum, s) => sum + (lastBySub.get(s.subscriptionId)?.earnings || 0), 0);
    const health = {
        pastDue: live.filter((s) => s.status === 'past_due').map((s) => ({ email: who(s.user), plan: s.plan, interval: s.interval, since: s.updatedAt })),
        canceling: canceling.map((s) => ({ email: who(s.user), plan: s.plan, interval: s.interval, at: s.scheduledChange.effectiveAt, mrr: units(monthly(s) || 0) })),
        mrrAtRisk: units(canceling.reduce((sum, s) => sum + (monthly(s) || 0), 0)),
        churned: churned.length,
        mrrLost: units(churned.reduce((sum, s) => sum + (monthly(s) || 0), 0)),
        renewals: { count: renewing.length, expected: units(expected(renewing)) },
    };

    // ---- Where the money came from, in this window ----
    const campaigns = new Map((await Campaign.find({ _id: { $in: [...new Set(inRange.map((p) => p.campaign).filter(Boolean).map(String))] } }).select('code name').lean()).map((c) => [String(c._id), c]));
    const byPlan = new Map();
    const byType = new Map();
    const byCountry = new Map();
    const bySource = new Map();
    const byCampaign = new Map();
    for (const p of inRange) {
        add(byPlan, `${p.plan || p.type}-${p.interval || ''}`, planLabel(p), p);
        add(byType, p.type || 'other', TYPE_LABEL[p.type] || 'Other', p);
        add(byCountry, p.country || '—', p.country || 'Not recorded', p);
        // Upgrade prompts only lead to first purchases; renewals keep their original source.
        if (p.type === 'new' || p.type === 'pass') add(bySource, p.source || '—', sourceLabel(p.source), p);
        const c = p.campaign && campaigns.get(String(p.campaign));
        add(byCampaign, c ? String(c._id) : '—', c ? `${c.code}${c.name ? ` · ${c.name}` : ''}` : 'No campaign', p);
    }

    // ---- The way to paying: sign-ups → saw an upgrade prompt → opened checkout → paid ----
    const [signups, events] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: from } }),
        BillingEvent.find({ at: { $gte: from } }).select('kind source user').limit(200000).lean(),
    ]);
    const distinct = (list) => new Set(list.map((e) => String(e.user))).size;
    const paidNew = inRange.filter((p) => p.type === 'new' || p.type === 'pass');
    const sources = new Map();
    for (const e of events) {
        const s = sources.get(e.source) || { source: e.source, label: sourceLabel(e.source), prompted: new Set(), checkout: new Set(), paid: new Set(), net: 0 };
        s[e.kind === 'prompt' ? 'prompted' : 'checkout'].add(String(e.user));
        sources.set(e.source, s);
    }
    for (const p of paidNew) {
        if (!p.source) continue;
        const s = sources.get(p.source) || { source: p.source, label: sourceLabel(p.source), prompted: new Set(), checkout: new Set(), paid: new Set(), net: 0 };
        if (p.user) s.paid.add(String(p.user));
        s.net += netOf(p);
        sources.set(p.source, s);
    }
    const funnel = {
        signups,
        prompted: distinct(events.filter((e) => e.kind === 'prompt')),
        checkout: distinct(events.filter((e) => e.kind === 'checkout')),
        paid: new Set(paidNew.filter((p) => p.user).map((p) => String(p.user))).size,
        bySource: [...sources.values()]
            .map((s) => ({ source: s.source, label: s.label, prompted: s.prompted.size, checkout: s.checkout.size, paid: s.paid.size, net: units(s.net) }))
            .sort((a, b) => b.paid - a.paid || b.checkout - a.checkout || b.prompted - a.prompted)
            .slice(0, 15),
    };

    // ---- Profit: net revenue minus AI (measured) and fixed costs (entered by the admin) ----
    const ai = await aiEconomics({ days, settings });
    const fixedMonthly = (settings.fixedCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
    const fixed = Math.round(fixedMonthly * (days / 30.44) * 100) / 100;
    const aiCost = Math.round(ai.totals.cost * 100) / 100;

    const allTimeCustomers = new Set(payments.filter((p) => p.user).map((p) => String(p.user))).size;
    return {
        days,
        currency,
        otherCurrencies: Object.keys(counts).filter((c) => c !== currency),
        current,
        previous,
        mrr: { total: units(mrr), arr: units(mrr * 12), subscriptions: live.length, unpriced, byPlan: Object.values(mrrByPlan).map((p) => ({ ...p, mrr: units(p.mrr) })) },
        perCustomer: current.customers ? Math.round((current.net / current.customers) * 100) / 100 : 0,
        months,
        health,
        breakdown: { byPlan: rows(byPlan), byType: rows(byType), byCountry: rows(byCountry, 10), bySource: rows(bySource), byCampaign: rows(byCampaign) },
        funnel,
        costs: { ai: aiCost, aiCurrency: 'USD', fixed, fixedMonthly, fixedItems: settings.fixedCosts || [], profit: Math.round((current.net - aiCost - fixed) * 100) / 100 },
        recent: inRange.slice(0, 30).map((p) => ({
            at: p.billedAt,
            transactionId: p.transactionId,
            email: who(p.user),
            type: p.type || 'other',
            plan: planLabel(p),
            country: p.country || null,
            source: p.source ? sourceLabel(p.source) : null,
            total: units(p.total || 0),
            fee: units(p.fee || 0),
            tax: units(p.tax || 0),
            earnings: units(p.earnings || 0),
            refunded: units(refundedIn(p)),
        })),
        allTimeCustomers,
    };
}

/** Every payment as CSV rows (for the accountant, or a spreadsheet). */
async function paymentsCsv({ days } = {}) {
    const filter = days ? { billedAt: { $gte: new Date(Date.now() - days * DAY) } } : {};
    const payments = await Payment.find(filter).sort({ billedAt: -1 }).limit(100000).lean();
    const users = new Map((await User.find({ _id: { $in: [...new Set(payments.map((p) => p.user).filter(Boolean).map(String))] } }).select('email').lean()).map((u) => [String(u._id), u.email]));
    const campaigns = new Map((await Campaign.find({ _id: { $in: [...new Set(payments.map((p) => p.campaign).filter(Boolean).map(String))] } }).select('code').lean()).map((c) => [String(c._id), c.code]));
    // Quoted, and a leading = + - @ is neutralised so a spreadsheet never runs it as a formula.
    const cell = (v) => {
        const s = v == null ? '' : String(v);
        return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
    const head = ['date', 'transaction', 'email', 'type', 'plan', 'interval', 'country', 'source', 'campaign', 'currency', 'total', 'tax', 'fee', 'earnings', 'refunded', 'net'];
    const lines = payments.map((p) =>
        [
            p.billedAt ? new Date(p.billedAt).toISOString() : '', p.transactionId, users.get(String(p.user)) || '', p.type || 'other', p.plan || '', p.interval || '', p.country || '', p.source || '',
            campaigns.get(String(p.campaign)) || '', p.currency || '', units(p.total || 0), units(p.tax || 0), units(p.fee || 0), units(p.earnings || 0), units(refundedIn(p)), units(netOf(p)),
        ].map(cell).join(',')
    );
    return [head.join(','), ...lines].join('\n');
}

module.exports = { revenueReport, paymentsCsv, sourceLabel };
