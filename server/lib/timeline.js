/**
 * One account's history for Admin › Users (docs/v2/BETA-PLAN.md, Phase 3), newest first,
 * built from what's already stored: sign-up and how, verification, resumes, the Career
 * Profile, applications and their moves, AI use with its real cost, upgrade prompts and
 * checkouts, payments and refunds, and what admins changed. Plus totals and the storage
 * the account uses.
 */
const Resume = require('../models/Resume');
const CareerProfile = require('../models/CareerProfile');
const Application = require('../models/Application');
const AiEvent = require('../models/AiEvent');
const Payment = require('../models/Payment');
const BillingEvent = require('../models/BillingEvent');
const AdminLog = require('../models/AdminLog');
const User = require('../models/User');
const { callCost } = require('./aiSpend');
const { AI_FEATURES, APP_FEATURES, PLAN_LIMITS } = require('./settings');

const MAX = 200;
const featureName = (key) => [...AI_FEATURES, ...APP_FEATURES, ...PLAN_LIMITS].find((f) => f.key === key)?.name || key;
const bytes = (doc) => Buffer.byteLength(JSON.stringify(doc));
const jobName = (a) => [a.job?.title, a.job?.organisation].filter(Boolean).join(' · ') || 'an application';

async function userTimeline(user, settings) {
    const id = user._id;
    const [resumes, profile, apps, ai, payments, prompts, adminLogs, sameNet] = await Promise.all([
        Resume.find({ user: id }).lean(),
        CareerProfile.findOne({ user: id }).lean(),
        Application.find({ user: id }).lean(),
        AiEvent.find({ user: id }).sort({ at: -1 }).limit(500).lean(),
        Payment.find({ user: id }).lean(),
        BillingEvent.find({ user: id }).sort({ at: -1 }).limit(100).lean(),
        AdminLog.find({ target: user.email }).sort({ at: -1 }).limit(100).lean(),
        user.signupNet ? User.countDocuments({ signupNet: user.signupNet, _id: { $ne: id } }) : 0,
    ]);
    const out = [];
    const add = (at, kind, text, extra = {}) => at && out.push({ at: new Date(at), kind, text, ...extra });

    const how = user.source === 'admin' ? 'added by an admin' : user.campaign ? 'with a campaign code' : 'on their own';
    add(user.createdAt, 'signup', `Signed up ${how}${user.ref ? ` from the link "${user.ref}"` : ''}`);
    add(user.emailVerifiedAt, 'verified', 'Verified their email');
    for (const r of resumes) add(r.createdAt, 'resume', r.tailoredFor ? `Made a tailored resume "${r.nickname}"` : `Created the resume "${r.nickname}"`);
    if (profile) add(profile.createdAt, 'profile', 'Set up their Career Profile');
    for (const a of apps) {
        add(a.createdAt, 'application', `Added ${jobName(a)}`);
        for (const h of (a.statusHistory || []).slice(1)) add(h.at, 'application', `Moved ${jobName(a)} to ${h.status}`);
    }
    for (const e of ai) {
        const cost = callCost(e, settings.aiPrices);
        add(e.at, 'ai', `${featureName(e.feature)}${e.ok === false ? ' (failed, refunded)' : ''}`, { credits: e.ok === false ? 0 : e.credits || 0, cost });
    }
    for (const p of prompts) add(p.at, 'billing', p.kind === 'checkout' ? `Opened checkout for ${p.plan || 'a plan'}` : (p.source === 'pricing' ? 'Opened the pricing page' : `Saw the upgrade prompt for ${featureName(String(p.source).replace(/^(feature|limit):/, ''))}`));
    for (const p of payments) {
        add(p.billedAt || p.createdAt, 'payment', `Paid ${p.currency || ''} ${Number(p.total || 0).toFixed(2)} (${p.kind === 'pass' ? 'pass' : p.plan || 'plan'}, ${p.type})`.replace('  ', ' '));
        for (const r of p.refunds || []) add(r.at, 'payment', `Refunded ${p.currency || ''} ${Number(r.total || 0).toFixed(2)}`.replace('  ', ' '));
    }
    for (const l of adminLogs) add(l.at, 'admin', `${l.actorEmail || 'An admin'}: ${l.action.replace(/^user\./, '').replace(/_/g, ' ')}`);

    out.sort((a, b) => b.at - a.at);
    const ok = ai.filter((e) => e.ok !== false);
    return {
        entries: out.slice(0, MAX),
        more: Math.max(0, out.length - MAX),
        totals: {
            aiUses: ok.length,
            aiCredits: ok.reduce((n, e) => n + (e.credits || 0), 0),
            aiCost: ai.reduce((n, e) => n + callCost(e, settings.aiPrices), 0),
            storage: resumes.reduce((n, r) => n + bytes(r), 0) + (profile ? bytes(profile) : 0) + apps.reduce((n, a) => n + bytes(a), 0),
            sameNetwork: sameNet,
        },
    };
}

module.exports = { userTimeline };
