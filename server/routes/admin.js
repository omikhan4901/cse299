const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Usage = require('../models/Usage');
const AiEvent = require('../models/AiEvent');
const Campaign = require('../models/Campaign');
const { protect, requireAdmin, roleOf, isSuperadmin, hashPassword, passwordProblem } = require('./auth');
const AdminLog = require('../models/AdminLog');
const { audit } = require('../lib/audit');
const { limit } = require('../lib/rateLimit');
const { getSettings, updateSettings, AI_FEATURES, APP_FEATURES } = require('../lib/settings');
const { allowanceFor, periodKey, effectivePlanId } = require('../lib/credits');

/**
 * Admin console API. Everything here needs an admin or super admin
 * (SUPERADMIN_EMAILS). Only super admins can change who is an admin.
 */
const router = express.Router();
router.use(protect, requireAdmin, limit({ name: 'admin', windowMs: 60 * 1000, max: 240, key: (req) => req.userId, message: 'Too many admin requests.' }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, error, status = 400) => res.status(status).json({ success: false, error });
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

const PLAN_IDS = ['free', 'pro', 'premium'];
const USER_FIELDS = 'name email plan planExpiresAt creditLimit creditPeriod role banned bannedReason campaign createdAt lastLoginAt twoFactor.enabled emailVerifiedAt';

/** Adds role, current plan, credit usage and resume counts to a page of users. */
async function describeUsers(users) {
    const settings = await getSettings();
    const ids = users.map((u) => u._id);
    const [usage, resumes] = await Promise.all([
        Usage.find({ user: { $in: ids } }).lean(),
        Resume.find({ user: { $in: ids } }).select('user').lean(),
    ]);
    const resumeCount = {};
    for (const r of resumes) resumeCount[r.user] = (resumeCount[r.user] || 0) + 1;
    return users.map((u) => {
        const a = allowanceFor(u, settings);
        const used = usage.find((x) => String(x.user) === String(u._id) && x.day === periodKey(a.period))?.ai || 0;
        return {
            ...u,
            role: roleOf(u),
            effectivePlan: effectivePlanId(u),
            credits: { used, limit: a.limit, period: a.period, source: a.source },
            resumes: resumeCount[u._id] || 0,
        };
    });
}

// ---------- Overview ----------

router.get('/overview', wrap(async (req, res) => {
    const now = Date.now();
    const since30 = new Date(now - 30 * 864e5);
    const since7 = new Date(now - 7 * 864e5);
    const today = dayKey(now);
    const [total, new7, new30, banned, byPlanRaw, resumesTotal, resumesPublic, events, campaignsActive] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: since7 } }),
        User.countDocuments({ createdAt: { $gte: since30 } }),
        User.countDocuments({ banned: true }),
        User.find().select('plan planExpiresAt').lean(),
        Resume.countDocuments(),
        Resume.countDocuments({ isPublic: true }),
        AiEvent.find({ at: { $gte: since30 } }).select('user feature credits at').limit(100000).lean(),
        Campaign.countDocuments({ active: true }),
    ]);

    const byPlan = Object.fromEntries(PLAN_IDS.map((p) => [p, 0]));
    for (const u of byPlanRaw) byPlan[effectivePlanId(u)] = (byPlan[effectivePlanId(u)] || 0) + 1;

    const daily = {};
    for (let i = 29; i >= 0; i--) daily[dayKey(now - i * 864e5)] = { date: dayKey(now - i * 864e5), requests: 0, credits: 0 };
    const byFeature = Object.fromEntries(AI_FEATURES.map((f) => [f.key, { feature: f.key, name: f.name, requests: 0, credits: 0 }]));
    const byUser = {};
    const todayStats = { requests: 0, credits: 0 };
    for (const e of events) {
        const d = daily[dayKey(e.at)];
        if (d) { d.requests += 1; d.credits += e.credits; }
        if (byFeature[e.feature]) { byFeature[e.feature].requests += 1; byFeature[e.feature].credits += e.credits; }
        byUser[e.user] = (byUser[e.user] || 0) + e.credits;
        if (dayKey(e.at) === today) { todayStats.requests += 1; todayStats.credits += e.credits; }
    }
    const topIds = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topUsers = await User.find({ _id: { $in: topIds.map(([id]) => id) } }).select('name email').lean();

    res.json({
        success: true,
        data: {
            users: { total, new7, new30, banned, byPlan },
            resumes: { total: resumesTotal, public: resumesPublic },
            ai: {
                today: todayStats,
                last30: { requests: events.length, credits: events.reduce((s, e) => s + e.credits, 0) },
                byFeature: Object.values(byFeature),
                daily: Object.values(daily),
                topUsers: topIds.map(([id, credits]) => ({ ...topUsers.find((u) => String(u._id) === id), credits })).filter((u) => u._id),
            },
            campaigns: { active: campaignsActive },
        },
    });
}));

// ---------- Users ----------

router.get('/users', wrap(async (req, res) => {
    const { q = '', plan = '', status = '', campaign = '' } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const filter = {};
    if (q) filter.$or = [{ name: new RegExp(escapeRe(q), 'i') }, { email: new RegExp(escapeRe(q), 'i') }];
    if (PLAN_IDS.includes(plan)) filter.plan = plan;
    if (status === 'banned') filter.banned = true;
    if (status === 'active') filter.banned = { $ne: true };
    if (status === 'admin') filter.role = 'admin';
    if (mongoose.isValidObjectId(campaign)) filter.campaign = campaign;
    const [total, users] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter).select(USER_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    res.json({ success: true, data: { total, page, limit, users: await describeUsers(users) } });
}));

router.get('/users/export.csv', wrap(async (req, res) => {
    const users = await describeUsers(await User.find().select(USER_FIELDS).sort({ createdAt: -1 }).lean());
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Name', 'Email', 'Plan', 'Plan ends', 'Role', 'Banned', 'Credits used', 'Credit limit', 'Period', 'Resumes', 'Joined', 'Last login']];
    for (const u of users) {
        rows.push([u.name, u.email, u.effectivePlan, u.planExpiresAt ? dayKey(u.planExpiresAt) : '', u.role, u.banned ? 'yes' : '', u.credits.used, u.credits.limit, u.credits.period, u.resumes, u.createdAt ? dayKey(u.createdAt) : '', u.lastLoginAt ? dayKey(u.lastLoginAt) : '']);
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="resumex-users-${dayKey(Date.now())}.csv"`);
    res.send(rows.map((r) => r.map(cell).join(',')).join('\n'));
}));

router.get('/users/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404);
    const user = await User.findById(req.params.id).select(USER_FIELDS).lean();
    if (!user) return bad(res, 'User not found.', 404);
    const [described] = await describeUsers([user]);
    const [resumes, events, campaign] = await Promise.all([
        Resume.find({ user: user._id }).select('nickname template isPublic shortId isMaster updatedAt').sort({ updatedAt: -1 }).lean(),
        AiEvent.find({ user: user._id }).sort({ at: -1 }).limit(50).lean(),
        user.campaign ? Campaign.findById(user.campaign).select('name code').lean() : null,
    ]);
    res.json({ success: true, data: { ...described, resumesList: resumes, events, campaign } });
}));

/** Applies the editable fields from an admin request to a user document. */
async function applyUserFields(user, body, req) {
    const fail = (message, status = 400) => {
        throw Object.assign(new Error(message), { status });
    };
    // Admin accounts can only be edited by super admins, and super admins only by themselves.
    const targetRole = roleOf(user);
    if (targetRole === 'superadmin' && String(user._id) !== req.userId) fail("Super admin accounts can't be edited here.", 403);
    if (targetRole === 'admin' && req.role !== 'superadmin') fail('Only super admins can edit admin accounts.', 403);
    if (body.name !== undefined) user.name = String(body.name).trim();
    if (body.email !== undefined) {
        const email = String(body.email).trim().toLowerCase();
        if (email !== user.email) {
            if (isSuperadmin({ email })) fail("That email is reserved for a super admin.", 403);
            user.email = email;
            user.emailVerifiedAt = undefined;
        }
    }
    if (body.plan !== undefined) {
        if (!PLAN_IDS.includes(body.plan)) throw Object.assign(new Error('Unknown plan.'), { status: 400 });
        user.plan = body.plan;
    }
    if (body.planExpiresAt !== undefined) user.planExpiresAt = body.planExpiresAt ? new Date(body.planExpiresAt) : null;
    if (body.creditLimit !== undefined) user.creditLimit = body.creditLimit === null || body.creditLimit === '' ? null : Math.max(0, Math.round(Number(body.creditLimit) || 0));
    if (body.creditPeriod !== undefined) user.creditPeriod = ['day', 'month'].includes(body.creditPeriod) ? body.creditPeriod : null;
    if (body.password) {
        if (passwordProblem(body.password)) fail(passwordProblem(body.password));
        user.password = await hashPassword(body.password);
        user.sessionVersion = (user.sessionVersion || 0) + 1;
    }
    if (body.role !== undefined) {
        if (req.role !== 'superadmin') throw Object.assign(new Error('Only super admins can change roles.'), { status: 403 });
        user.role = body.role === 'admin' ? 'admin' : 'user';
    }
    if (body.banned !== undefined) {
        if (body.banned && (String(user._id) === req.userId || isSuperadmin(user))) throw Object.assign(new Error("You can't ban yourself or a super admin."), { status: 400 });
        if (body.banned && !user.banned) user.sessionVersion = (user.sessionVersion || 0) + 1; // sign them out everywhere
        user.banned = !!body.banned;
        user.bannedReason = body.banned ? String(body.bannedReason || '').slice(0, 200) : '';
    } else if (body.bannedReason !== undefined && user.banned) {
        user.bannedReason = String(body.bannedReason).slice(0, 200);
    }
}

const sendUser = async (res, user, status = 200) => {
    const [described] = await describeUsers([user.toObject ? user.toObject() : user]);
    delete described.password;
    res.status(status).json({ success: true, data: described });
};

router.post('/users', wrap(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return bad(res, 'Name, email and password are required.');
    if (await User.exists({ email: String(email).trim().toLowerCase() })) return bad(res, 'An account with that email already exists.');
    if (isSuperadmin({ email: String(email).trim().toLowerCase() })) return bad(res, 'That email is reserved for a super admin.', 403);
    const user = new User({ name, email, password: 'placeholder' });
    try {
        await applyUserFields(user, { ...req.body, name, email, password }, req);
    } catch (err) {
        if (err.status) return bad(res, err.message, err.status);
        throw err;
    }
    try {
        await user.save();
    } catch (err) {
        if (err.name === 'ValidationError') return bad(res, Object.values(err.errors)[0].message);
        throw err;
    }
    audit(req, 'user.create', user.email, { plan: user.plan });
    await sendUser(res, user, 201);
}));

router.patch('/users/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404);
    const user = await User.findById(req.params.id);
    if (!user) return bad(res, 'User not found.', 404);
    try {
        await applyUserFields(user, req.body || {}, req);
        await user.save();
        audit(req, 'user.update', user.email, req.body);
    } catch (err) {
        if (err.status) return bad(res, err.message, err.status);
        if (err.name === 'ValidationError') return bad(res, Object.values(err.errors)[0].message);
        if (err.code === 11000) return bad(res, 'Another account already uses that email.');
        throw err;
    }
    await sendUser(res, user);
}));

// Gives the user their full allowance back for the current period.
router.post('/users/:id/reset-credits', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404);
    const user = await User.findById(req.params.id).select(USER_FIELDS).lean();
    if (!user) return bad(res, 'User not found.', 404);
    const a = allowanceFor(user, await getSettings());
    await Usage.deleteOne({ user: user._id, day: periodKey(a.period) });
    audit(req, 'user.restore_credits', user.email);
    await sendUser(res, user);
}));

// Turns off 2FA for someone locked out of their authenticator (super admins only).
router.post('/users/:id/reset-2fa', wrap(async (req, res) => {
    if (req.role !== 'superadmin') return bad(res, 'Only super admins can reset two-factor authentication.', 403);
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404);
    const user = await User.findById(req.params.id);
    if (!user) return bad(res, 'User not found.', 404);
    if (String(user._id) === req.userId) return bad(res, "You can't reset your own two-factor authentication here.");
    user.twoFactor = { enabled: false };
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();
    audit(req, 'user.reset_2fa', user.email);
    await sendUser(res, user);
}));

router.delete('/users/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404);
    const user = await User.findById(req.params.id);
    if (!user) return bad(res, 'User not found.', 404);
    if (String(user._id) === req.userId || isSuperadmin(user)) return bad(res, "You can't delete yourself or a super admin.");
    if (roleOf(user) === 'admin' && req.role !== 'superadmin') return bad(res, 'Only super admins can delete admin accounts.', 403);
    await Promise.all([Resume.deleteMany({ user: user._id }), Usage.deleteMany({ user: user._id }), AiEvent.deleteMany({ user: user._id })]);
    await user.deleteOne();
    audit(req, 'user.delete', user.email);
    res.json({ success: true });
}));

// ---------- Audit log ----------

router.get('/audit', wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const filter = typeof req.query.action === 'string' && req.query.action ? { action: new RegExp(`^${escapeRe(req.query.action)}`) } : {};
    const [total, entries] = await Promise.all([
        AdminLog.countDocuments(filter),
        AdminLog.find(filter).sort({ at: -1 }).skip((page - 1) * 50).limit(50).lean(),
    ]);
    res.json({ success: true, data: { total, page, entries } });
}));

// ---------- Settings (plans, prices, credit costs, free mode) ----------

router.get('/settings', wrap(async (req, res) => {
    res.json({ success: true, data: { settings: await getSettings(), aiFeatures: AI_FEATURES, appFeatures: APP_FEATURES } });
}));

router.put('/settings', wrap(async (req, res) => {
    const settings = await updateSettings(req.body || {}, req.adminEmail);
    audit(req, 'settings.update', null, req.body);
    res.json({ success: true, data: { settings, aiFeatures: AI_FEATURES, appFeatures: APP_FEATURES } });
}));

// ---------- Campaigns ----------

const CAMPAIGN_FIELDS = ['name', 'code', 'description', 'plan', 'creditLimit', 'creditPeriod', 'durationDays', 'maxUses', 'emailDomain', 'expiresAt', 'active'];
const pickCampaign = (body = {}) => {
    const out = {};
    for (const k of CAMPAIGN_FIELDS) if (body[k] !== undefined) out[k] = body[k];
    if (out.plan !== undefined && !PLAN_IDS.includes(out.plan)) out.plan = 'free';
    if (out.creditLimit === '' ) out.creditLimit = null;
    if (out.creditPeriod === '' ) out.creditPeriod = null;
    if (out.expiresAt === '') out.expiresAt = null;
    if (typeof out.emailDomain === 'string') out.emailDomain = out.emailDomain.replace(/^@/, '');
    return out;
};
const campaignError = (res, err) => {
    if (err.name === 'ValidationError') return bad(res, Object.values(err.errors)[0].message);
    if (err.code === 11000) return bad(res, 'That code is already used by another campaign.');
    throw err;
};

router.get('/campaigns', wrap(async (req, res) => {
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: campaigns });
}));

router.post('/campaigns', wrap(async (req, res) => {
    try {
        const campaign = await Campaign.create(pickCampaign(req.body));
        audit(req, 'campaign.create', campaign.code, pickCampaign(req.body));
        res.status(201).json({ success: true, data: campaign });
    } catch (err) {
        campaignError(res, err);
    }
}));

router.patch('/campaigns/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Campaign not found.', 404);
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return bad(res, 'Campaign not found.', 404);
    Object.assign(campaign, pickCampaign(req.body));
    try {
        await campaign.save();
        audit(req, 'campaign.update', campaign.code, pickCampaign(req.body));
        res.json({ success: true, data: campaign });
    } catch (err) {
        campaignError(res, err);
    }
}));

router.delete('/campaigns/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Campaign not found.', 404);
    // Members keep what they were given; the code just stops working.
    const gone = await Campaign.findByIdAndDelete(req.params.id);
    audit(req, 'campaign.delete', gone?.code);
    res.json({ success: true });
}));

module.exports = router;
