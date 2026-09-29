/**
 * AI economics (docs/v2/SPEC.md §7): what AI costs per feature, and against what paying
 * users bring in. Costs come from the tokens stored on each AiEvent and the admin's
 * per-model prices; revenue from Paddle payments (after fees, tax and refunds).
 */
const AiEvent = require('../models/AiEvent');
const Payment = require('../models/Payment');
const { AI_FEATURES } = require('./settings');

/** The price for a model: its own, else the longest configured name it starts with, else "default". */
function priceFor(model, prices) {
    if (model && prices[model]) return prices[model];
    const prefix = Object.keys(prices)
        .filter((k) => k !== 'default' && model?.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
    return prices[prefix] || prices.default || { input: 0, output: 0 };
}

const costOf = (row, prices) => {
    const p = priceFor(row.model, prices);
    return (row.inputTokens * p.input + row.outputTokens * p.output) / 1e6;
};

async function aiEconomics({ days = 30, settings }) {
    const since = new Date(Date.now() - days * 864e5);
    const prices = settings.aiPrices || { default: { input: 0, output: 0 } };

    // Summed here rather than in the database: simple, and works the same on every MongoDB-compatible store.
    const [events, payments] = await Promise.all([
        AiEvent.find({ at: { $gte: since } }).select('user feature model ok credits inputTokens outputTokens').limit(500000).lean(),
        Payment.find({ billedAt: { $gte: since } }).select('user currency earnings refunds').lean(),
    ]);
    const groups = new Map();
    for (const e of events) {
        const k = [e.feature, e.model || '', e.ok !== false, e.user || ''].join('|');
        const g = groups.get(k) || { _id: { feature: e.feature, model: e.model, ok: e.ok !== false, user: e.user }, calls: 0, credits: 0, inputTokens: 0, outputTokens: 0 };
        g.calls += 1;
        g.credits += e.credits || 0;
        g.inputTokens += e.inputTokens || 0;
        g.outputTokens += e.outputTokens || 0;
        groups.set(k, g);
    }
    const byFeature = [...groups.values()];

    // Revenue: earnings minus refunds, in the most common payout currency.
    const currencies = {};
    for (const p of payments) currencies[p.currency || 'USD'] = (currencies[p.currency || 'USD'] || 0) + 1;
    const currency = Object.entries(currencies).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD';
    const counted = payments.filter((p) => (p.currency || 'USD') === currency);
    const net = counted.reduce((s, p) => s + (p.earnings || 0) - (p.refunds || []).reduce((r, x) => r + (x.earnings || 0), 0), 0) / 100;
    const paying = new Set(counted.filter((p) => p.user).map((p) => String(p.user)));

    const features = new Map(AI_FEATURES.map((f) => [f.key, { key: f.key, name: f.name, calls: 0, failed: 0, credits: 0, inputTokens: 0, outputTokens: 0, cost: 0 }]));
    const unpriced = new Set();
    let payingCost = 0;
    for (const row of byFeature) {
        const { feature, model, user } = row._id;
        const ok = row._id.ok !== false; // events from before this field existed were successes
        const f = features.get(feature) || features.set(feature, { key: feature, name: feature, calls: 0, failed: 0, credits: 0, inputTokens: 0, outputTokens: 0, cost: 0 }).get(feature);
        const cost = costOf({ model, inputTokens: row.inputTokens || 0, outputTokens: row.outputTokens || 0 }, prices);
        if (model && !prices[model] && priceFor(model, prices) === prices.default) unpriced.add(model);
        f[ok ? 'calls' : 'failed'] += row.calls;
        f.credits += row.credits;
        f.inputTokens += row.inputTokens || 0;
        f.outputTokens += row.outputTokens || 0;
        f.cost += cost;
        if (user && paying.has(String(user))) payingCost += cost;
    }
    const list = [...features.values()].map((f) => ({ ...f, costPerCall: f.calls + f.failed ? f.cost / (f.calls + f.failed) : 0 }));
    const totalCost = list.reduce((s, f) => s + f.cost, 0);
    return {
        days,
        features: list,
        totals: { calls: list.reduce((s, f) => s + f.calls, 0), failed: list.reduce((s, f) => s + f.failed, 0), cost: totalCost },
        revenue: {
            currency,
            otherCurrencies: Object.keys(currencies).filter((c) => c !== currency),
            net,
            payingUsers: paying.size,
            perPayingUser: paying.size ? net / paying.size : 0,
            aiCostPerPayingUser: paying.size ? payingCost / paying.size : 0,
            // Share of paying users' net revenue spent on their AI (the spec's target: under 20%).
            costRatio: net > 0 ? payingCost / net : null,
        },
        unpricedModels: [...unpriced],
    };
}

module.exports = { aiEconomics, priceFor };
