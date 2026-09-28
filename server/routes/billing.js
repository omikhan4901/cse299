const express = require('express');
const Campaign = require('../models/Campaign');
const { protect, campaignProblem } = require('./auth');
const { getSettings, planById, AI_FEATURES, APP_FEATURES, PLAN_LIMITS } = require('../lib/settings');
const { usageSummary } = require('../lib/credits');
const { limit, clientIp } = require('../lib/rateLimit');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { paddleConfig, paddle, paddlePrices, grantsAccess, PLANS, INTERVALS } = require('../lib/paddle');
const { applySubscription } = require('../lib/paddleEvents');
const Download = require('../models/Download');
const { templateTier } = require('../lib/templates');
const CATEGORY_OF = require('../../shared/templates.json');

const router = express.Router();

// @route GET /api/billing/plans — plans, prices, credit costs and free mode (public)
router.get('/plans', async (req, res, next) => {
    try {
        const s = await getSettings();
        const cfg = paddleConfig();
        // With Paddle connected, its prices are the ones shown (they're what people are charged).
        const charged = cfg.enabled ? await paddlePrices() : null;
        const plans = charged
            ? s.plans.map((p) => (charged[p.id] ? { ...p, price: charged[p.id].month, yearlyPrice: charged[p.id].year } : p))
            : s.plans;
        // Revalidated on every load, so changes made in the admin console show up straight away.
        res.set('Cache-Control', 'no-cache');
        res.json({
            success: true,
            data: {
                freeMode: s.freeMode,
                registration: s.registration,
                currency: charged?.currency || s.currency,
                showPricing: s.showPricing,
                v2: s.v2,
                featureCosts: s.featureCosts,
                templates: s.templates,
                plans,
                // Public by design: Paddle.js needs these in the browser to open checkout.
                paddle: cfg.enabled ? { environment: cfg.environment, clientToken: cfg.clientToken, prices: cfg.prices } : null,
                aiFeatures: AI_FEATURES,
                appFeatures: APP_FEATURES,
                planLimits: PLAN_LIMITS,
            },
        });
    } catch (err) {
        next(err);
    }
});

/** The account's current Paddle subscription (the one giving access, else the latest), for display. */
async function currentSubscription(userId) {
    const subs = await Subscription.find({ user: userId }).sort({ updatedAt: -1 }).lean();
    const sub = subs.find(grantsAccess) || subs[0];
    if (!sub) return null;
    return { plan: sub.plan, interval: sub.interval, status: sub.status, active: grantsAccess(sub), currentPeriodEnd: sub.currentPeriodEnd, scheduledChange: sub.scheduledChange?.action ? sub.scheduledChange : null };
}

// @route GET /api/billing/me — the signed-in account's credits, plan and subscription
router.get('/me', protect, async (req, res, next) => {
    try {
        const [usage, subscription] = await Promise.all([usageSummary(req.userId), currentSubscription(req.userId)]);
        res.json({ success: true, data: { ...usage, subscription } });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/billing/download — the builder reports a PDF download with a paid template
// (for the refund policy: a resume already downloaded can't be given back).
const downloadsByUser = limit({ name: 'downloads', windowMs: 60 * 60 * 1000, max: 120, key: (req) => req.userId, message: 'Too many downloads.', label: 'PDF downloads recorded', group: 'Billing', scope: 'account', description: 'PDF downloads the builder reports (only paid templates are recorded, for the refund policy).' });
router.post('/download', protect, downloadsByUser, async (req, res) => {
    const template = req.body?.template;
    if (typeof template !== 'string' || !CATEGORY_OF[template]) return res.status(400).json({ success: false, error: 'Unknown template.' });
    const tier = templateTier(template, (await getSettings()).templates);
    if (tier !== 'free') await Download.create({ user: req.userId, template, tier });
    res.json({ success: true });
});

const billingActions = limit({ name: 'billing-actions', windowMs: 60 * 60 * 1000, max: 20, key: (req) => req.userId, message: 'Too many billing requests.', label: 'Billing portal and plan changes', group: 'Billing', scope: 'account', description: 'Opening the Paddle billing portal and switching plans.' });

// @route POST /api/billing/portal — a link to Paddle's customer portal (cards, invoices, cancelling)
router.post('/portal', protect, billingActions, async (req, res) => {
    // The customer is looked up from the session, never taken from the request.
    const user = await User.findById(req.userId).select('paddleCustomerId').lean();
    if (!user?.paddleCustomerId) return res.status(404).json({ success: false, error: "You don't have a subscription yet." });
    try {
        const subs = await Subscription.find({ user: req.userId }).select('subscriptionId').lean();
        const session = await paddle().customerPortalSessions.create(user.paddleCustomerId, subs.map((s) => s.subscriptionId));
        res.json({ success: true, url: session.urls.general.overview });
    } catch (err) {
        console.error('Paddle portal failed:', err.message);
        res.status(err.status || 502).json({ success: false, error: err.status ? err.message : "We couldn't open the billing portal. Please try again." });
    }
});

// @route POST /api/billing/change-plan — switch the current subscription to another plan or billing period
// (a second checkout would start a second subscription and charge twice).
router.post('/change-plan', protect, billingActions, async (req, res) => {
    const { plan, interval } = req.body || {};
    if (!PLANS.includes(plan) || !INTERVALS.includes(interval)) return res.status(400).json({ success: false, error: 'Choose a plan and a billing period.' });
    const sub = (await Subscription.find({ user: req.userId }).lean()).find(grantsAccess);
    if (!sub) return res.status(404).json({ success: false, error: "You don't have an active subscription to change." });
    const cfg = paddleConfig();
    const priceId = cfg.prices?.[plan]?.[interval];
    if (!priceId) return res.status(503).json({ success: false, error: 'Payments are not set up yet.' });
    if (priceId === sub.priceId) return res.status(400).json({ success: false, error: "You're already on that plan." });
    try {
        // Charged (or credited) for the difference now; the webhook confirms the change too.
        const updated = await paddle().subscriptions.update(sub.subscriptionId, { items: [{ priceId, quantity: 1 }], prorationBillingMode: 'prorated_immediately' });
        await applySubscription(updated, new Date());
        res.json({ success: true, data: await currentSubscription(req.userId) });
    } catch (err) {
        console.error('Paddle plan change failed:', err.message);
        res.status(err.status || 502).json({ success: false, error: err.status ? err.message : "We couldn't change your plan. Please try again, or use Manage billing." });
    }
});

// @route GET /api/billing/campaign/:code — what a campaign code gives (for the join page)
// Tight limit so campaign codes can't be guessed by brute force.
router.get('/campaign/:code', limit({ name: 'campaign-ip', windowMs: 15 * 60 * 1000, max: 40, key: clientIp, message: 'Too many attempts.', label: 'Campaign code checks', group: 'Public pages', description: 'Invite links opened from one network (stops codes being guessed).' }), async (req, res, next) => {
    try {
        const code = String(req.params.code || '').trim().toUpperCase();
        const campaign = /^[A-Z0-9_-]{3,32}$/.test(code) ? await Campaign.findOne({ code }).lean() : null;
        const problem = campaignProblem(campaign, null);
        if (!campaign) return res.status(404).json({ success: false, error: problem });
        const s = await getSettings();
        const plan = planById(s, campaign.plan);
        res.json({
            success: true,
            data: {
                code: campaign.code,
                name: campaign.name,
                description: campaign.description,
                plan: { id: plan.id, name: plan.name },
                credits: campaign.creditLimit ?? (plan.id === 'free' && s.freeMode.enabled ? s.freeMode.dailyCredits : plan.credits),
                creditPeriod: campaign.creditPeriod || (campaign.creditLimit == null && plan.id !== 'free' ? plan.creditPeriod : 'day'),
                durationDays: campaign.durationDays,
                emailDomain: campaign.emailDomain,
                placesLeft: Math.max(0, campaign.maxUses - campaign.uses),
                expiresAt: campaign.expiresAt,
                problem,
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
