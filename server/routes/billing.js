const express = require('express');
const Campaign = require('../models/Campaign');
const { protect, campaignProblem } = require('./auth');
const { getSettings, planById, AI_FEATURES, APP_FEATURES } = require('../lib/settings');
const { usageSummary } = require('../lib/credits');
const { limit, clientIp } = require('../lib/rateLimit');

const router = express.Router();

// @route GET /api/billing/plans — plans, prices, credit costs and free mode (public)
router.get('/plans', async (req, res, next) => {
    try {
        const s = await getSettings();
        res.set('Cache-Control', 'public, max-age=30');
        res.json({
            success: true,
            data: {
                freeMode: s.freeMode,
                registration: s.registration,
                currency: s.currency,
                showPricing: s.showPricing,
                featureCosts: s.featureCosts,
                plans: s.plans,
                aiFeatures: AI_FEATURES,
                appFeatures: APP_FEATURES,
            },
        });
    } catch (err) {
        next(err);
    }
});

// @route GET /api/billing/me — the signed-in account's credits and plan
router.get('/me', protect, async (req, res, next) => {
    try {
        res.json({ success: true, data: await usageSummary(req.userId) });
    } catch (err) {
        next(err);
    }
});

// @route GET /api/billing/campaign/:code — what a campaign code gives (for the join page)
// Tight limit so campaign codes can't be guessed by brute force.
router.get('/campaign/:code', limit({ name: 'campaign-ip', windowMs: 15 * 60 * 1000, max: 40, key: clientIp, message: 'Too many attempts.' }), async (req, res, next) => {
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
