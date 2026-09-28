const User = require('../models/User');
const Usage = require('../models/Usage');
const AiEvent = require('../models/AiEvent');
const { getSettings, planById, AI_FEATURES } = require('./settings');
const { limit, retryIn } = require('./rateLimit');

/**
 * AI credits. Every AI feature has a credit cost (set in the admin console).
 * Each account gets an allowance per day or per month:
 *   1. its own custom allowance, if an admin or a campaign set one;
 *   2. otherwise, on a paid plan (Pro/Premium), that plan's allowance;
 *   3. otherwise, in free mode, the free-mode daily allowance;
 *   4. otherwise the Free plan's allowance.
 * Feature locks from plans only apply when free mode is off.
 */

/** The plan an account is on right now (a paid plan past its end date falls back to Free). */
const effectivePlanId = (user) =>
    user?.plan && user.plan !== 'free' && (!user.planExpiresAt || new Date(user.planExpiresAt) > new Date()) ? user.plan : 'free';

/** A custom allowance applies until its end date (campaign allowances end with the campaign period). */
const hasCustomAllowance = (user) => user?.creditLimit != null && (!user.creditLimitExpiresAt || new Date(user.creditLimitExpiresAt) > new Date());

function allowanceFor(user, settings) {
    const plan = planById(settings, effectivePlanId(user));
    const paid = plan.id !== 'free';
    if (hasCustomAllowance(user)) {
        return { plan, limit: user.creditLimit, period: user.creditPeriod || (paid || !settings.freeMode.enabled ? plan.creditPeriod : 'day'), source: 'custom' };
    }
    if (!paid && settings.freeMode.enabled) return { plan, limit: settings.freeMode.dailyCredits, period: 'day', source: 'freeMode' };
    return { plan, limit: plan.credits, period: plan.creditPeriod, source: 'plan' };
}

const canUse = (user, settings, feature) => settings.freeMode.enabled || !!planById(settings, effectivePlanId(user)).features[feature];

const periodKey = (period, d = new Date()) => (period === 'month' ? `m:${d.toISOString().slice(0, 7)}` : d.toISOString().slice(0, 10));
const periodEnd = (period) => {
    const d = new Date();
    if (period === 'month') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    d.setUTCHours(24, 0, 0, 0);
    return d;
};

const USER_FIELDS = 'plan planExpiresAt creditLimit creditPeriod creditLimitExpiresAt';

async function usageSummary(userOrId) {
    const [user, settings] = await Promise.all([
        typeof userOrId === 'object' && userOrId?.plan !== undefined ? userOrId : User.findById(userOrId).select(USER_FIELDS).lean(),
        getSettings(),
    ]);
    const a = allowanceFor(user, settings);
    const doc = await Usage.findOne({ user: user._id, day: periodKey(a.period) }).lean();
    const used = doc?.ai || 0;
    return {
        used,
        limit: a.limit,
        remaining: Math.max(0, a.limit - used),
        period: a.period,
        resetsAt: periodEnd(a.period).toISOString(),
        source: a.source,
        plan: { id: a.plan.id, name: a.plan.name },
        freeMode: settings.freeMode.enabled,
        planExpiresAt: user.planExpiresAt || null,
    };
}

const aiBurst = limit({
    name: 'ai-minute',
    windowMs: 60 * 1000,
    max: Number(process.env.AI_RATE_PER_MINUTE) || 8,
    key: (req) => req.userId,
    message: "You're sending AI requests very quickly.",
    label: 'AI requests per minute',
    group: 'AI',
    scope: 'account',
    description: 'Burst limit on top of the daily/monthly credits, so one account can’t flood the AI provider.',
});

/**
 * Atomically adds `cost` to this period's usage while there is room, creating the
 * period's counter if needed. Returns the updated counter, or null when full.
 */
async function chargeCredits(userId, key, cost, allowance) {
    const filter = { user: userId, day: key, ai: { $lte: allowance.limit - cost } };
    const update = { $inc: { ai: cost } };
    try {
        return await Usage.findOneAndUpdate(filter, { ...update, $setOnInsert: { expiresAt: new Date(Date.now() + (allowance.period === 'month' ? 40 : 3) * 864e5) } }, { upsert: true, new: true });
    } catch (err) {
        if (err.code !== 11000) throw err;
        // The counter already exists: either it's full, or a parallel request just created it.
        return Usage.findOneAndUpdate(filter, update, { new: true });
    }
}

/**
 * Route middleware for an AI feature: checks the plan allows it, then charges
 * its credit cost. Requests that fail (bad input, AI provider down) are refunded.
 */
function aiQuota(feature) {
    if (!AI_FEATURES.some((f) => f.key === feature)) throw new Error(`Unknown AI feature "${feature}"`);
    return [
        aiBurst,
        async (req, res, next) => {
            try {
                const [user, settings] = await Promise.all([User.findById(req.userId).select(USER_FIELDS).lean(), getSettings()]);
                const featureName = AI_FEATURES.find((f) => f.key === feature).name;
                if (!canUse(user, settings, feature)) {
                    const upgrade = settings.plans.find((p) => p.features[feature]);
                    return res.status(403).json({
                        success: false,
                        code: 'upgrade',
                        feature,
                        error: `${featureName} is part of the ${upgrade?.name || 'paid'} plan.`,
                    });
                }
                const cost = settings.featureCosts[feature] ?? 1;
                const a = allowanceFor(user, settings);
                const key = periodKey(a.period);
                let doc = null;
                if (cost > 0) {
                    // An insert ignores the "room left" condition, so a first request that
                    // costs more than the whole allowance (e.g. an allowance of 0) is refused here.
                    if (cost <= a.limit) doc = await chargeCredits(req.userId, key, cost, a);
                    if (!doc) {
                        const seconds = Math.ceil((periodEnd(a.period) - Date.now()) / 1000);
                        res.set('Retry-After', String(seconds));
                        return res.status(429).json({
                            success: false,
                            code: 'credits',
                            error: `${featureName} needs ${cost} credit${cost === 1 ? '' : 's'} and you have ${Math.max(0, a.limit - ((await Usage.findOne({ user: req.userId, day: key }).lean())?.ai || 0))} left. Your credits refresh in ${retryIn(seconds)}.`,
                        });
                    }
                }
                res.set('X-Credits-Limit', String(a.limit));
                res.set('X-Credits-Remaining', String(Math.max(0, a.limit - (doc?.ai || 0))));
                res.on('finish', () => {
                    if (res.statusCode >= 400) {
                        if (cost > 0) Usage.updateOne({ user: req.userId, day: key }, { $inc: { ai: -cost } }).catch(() => {});
                    } else {
                        AiEvent.create({ user: req.userId, feature, credits: cost }).catch(() => {});
                    }
                });
                next();
            } catch (err) {
                next(err);
            }
        },
    ];
}

module.exports = { aiQuota, usageSummary, effectivePlanId, allowanceFor, canUse, periodKey };
