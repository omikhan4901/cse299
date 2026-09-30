const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Usage = require('../models/Usage');
const AiEvent = require('../models/AiEvent');
const Campaign = require('../models/Campaign');
const CareerProfile = require('../models/CareerProfile');
const Application = require('../models/Application');
const { protect, requireAdmin, roleOf, isSuperadmin, hashPassword, passwordProblem } = require('./auth');
const AdminLog = require('../models/AdminLog');
const { audit } = require('../lib/audit');
const { escapeRe, validEmail, emailQuery, searchText } = require('../lib/email');
const { limit, describeLimits } = require('../lib/rateLimit');
const { deleteUserData } = require('../lib/userData');
const { aiEconomics, usageBasis } = require('../lib/economics');
const { pauseState, monthKey, nextMonth, callCost, recordSpend } = require('../lib/aiSpend');
const { revenueReport, paymentsCsv } = require('../lib/revenue');
const { storageReport, checkStorage } = require('../lib/storage');
const { cleanRef } = require('../lib/network');
const { userTimeline } = require('../lib/timeline');
const { recentAlerts } = require('../lib/alerts');
const Feedback = require('../models/Feedback');
const { sendMail, canSendMail } = require('../lib/mailer');
const ErrorGroup = require('../models/ErrorGroup');
const { getSettings, readSettings, updateSettings, AI_FEATURES, APP_FEATURES, PLAN_LIMITS } = require('../lib/settings');
const { allowanceFor, periodKey, effectivePlanId } = require('../lib/credits');
const { refundCheck } = require('../lib/refunds');

/**
 * Admin console API. Everything here needs an admin or super admin
 * (SUPERADMIN_EMAILS). Only super admins can change who is an admin.
 */
const router = express.Router();
router.use(protect, requireAdmin, limit({ name: 'admin', windowMs: 60 * 1000, max: 240, key: (req) => req.userId, message: 'Too many admin requests.', label: 'Admin console', group: 'Admin', scope: 'account', description: 'Requests one admin can make. Can’t go below 30, so the console stays usable.', min: 30 }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, error, status = 400) => res.status(status).json({ success: false, error });
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

const PLAN_IDS = ['free', 'pro', 'premium'];
const USER_FIELDS = 'name email plan planExpiresAt passPlan passUntil heldPlan heldUntil features featuresExpireAt limits tester creditLimit creditPeriod creditLimitExpiresAt role v2Preview banned bannedReason campaign createdAt lastLoginAt twoFactor.enabled emailVerifiedAt';

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
    const [total, new7, new30, banned, byPlanRaw, resumesTotal, resumesPublic, events, campaignsActive, profiles, applications, applications7, tailored] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: since7 } }),
        User.countDocuments({ createdAt: { $gte: since30 } }),
        User.countDocuments({ banned: true }),
        User.find().select('plan planExpiresAt passPlan passUntil heldPlan heldUntil').lean(),
        Resume.countDocuments(),
        Resume.countDocuments({ isPublic: true }),
        AiEvent.find({ at: { $gte: since30 }, ok: { $ne: false } }).select('user feature credits at model inputTokens outputTokens').limit(100000).lean(),
        Campaign.countDocuments({ active: true }),
        // V2 adoption: the numbers the job-search launch is measured by.
        CareerProfile.countDocuments(),
        Application.countDocuments(),
        Application.countDocuments({ createdAt: { $gte: since7 } }),
        Resume.countDocuments({ tailoredFor: { $exists: true, $ne: null } }),
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
    // The beta at a glance: who's active, sign-ups today and left, AI spend against the cap.
    const settings = await getSettings();
    const startOfDay = new Date(`${today}T00:00:00Z`);
    const [activeToday, active7, signupsToday, spend, feedbackNew, errorGroups] = await Promise.all([
        User.countDocuments({ lastSeenAt: { $gte: startOfDay } }),
        User.countDocuments({ lastSeenAt: { $gte: since7 } }),
        User.countDocuments({ createdAt: { $gte: startOfDay } }),
        pauseState(settings),
        Feedback.countDocuments({ status: 'new' }),
        ErrorGroup.find({ lastAt: { $gte: startOfDay } }).select('hours').lean(),
    ]);
    const errorsToday = errorGroups.reduce((n, g) => n + Object.entries(g.hours || {}).reduce((m, [k, v]) => m + (k >= today ? v : 0), 0), 0);
    const spentToday = events.filter((e) => e.at >= startOfDay).reduce((n, e) => n + callCost(e, settings.aiPrices), 0);
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
            glance: {
                activeToday,
                active7,
                signupsToday,
                signupsLeft: settings.signups.cap != null ? Math.max(0, settings.signups.cap - total) : null,
                aiToday: spentToday,
                aiMonth: spend.spent,
                aiCap: settings.aiSpend.enabled ? settings.aiSpend.cap : null,
                aiPaused: spend.paused,
                feedbackNew,
                errorsToday,
            },
            jobSearch: { profiles, applications, applications7, tailored },
        },
    });
}));

// ---------- Users ----------

router.get('/users', wrap(async (req, res) => {
    const { plan = '', status = '', campaign = '' } = req.query;
    const q = searchText(req.query.q);
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

// ---------- Sign-ups feed ----------

// How an account came in; accounts from before sources were recorded are read from their campaign.
const sourceOf = (u) => u.source || (u.campaign ? 'campaign' : 'organic');
const SOURCE_FILTERS = {
    organic: { $or: [{ source: 'organic' }, { source: { $exists: false }, campaign: null }] },
    campaign: { $or: [{ source: 'campaign' }, { source: { $exists: false }, campaign: { $ne: null } }] },
    admin: { source: 'admin' },
};
const dayOf = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Newest accounts first with how they came in, whether they verified, their plan and what
 * they did first; a per-day count for the range; how many signed up from the same network.
 */
router.get('/signups', wrap(async (req, res) => {
    const days = Math.min(365, Math.max(1, Math.round(Number(req.query.days) || 30)));
    const to = req.query.to && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : new Date();
    const from = req.query.from && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : new Date(to.getTime() - days * 864e5);
    const page = Math.max(1, Math.round(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(5, Math.round(Number(req.query.limit) || 25)));
    const and = [{ createdAt: { $gte: from, $lte: to } }];
    if (SOURCE_FILTERS[req.query.source]) and.push(SOURCE_FILTERS[req.query.source]);
    if (typeof req.query.ref === 'string' && req.query.ref) and.push({ ref: cleanRef(req.query.ref) });
    if (mongoose.isValidObjectId(req.query.campaign)) and.push({ campaign: req.query.campaign });
    if (req.query.verified === 'yes') and.push({ emailVerifiedAt: { $ne: null } });
    if (req.query.verified === 'no') and.push({ emailVerifiedAt: null });
    const q = searchText(req.query.q);
    if (q) and.push({ $or: [{ name: new RegExp(escapeRe(q), 'i') }, { email: new RegExp(escapeRe(q), 'i') }] });
    const filter = { $and: and };

    const fields = `${USER_FIELDS} source ref signupNet`;
    const [all, rows, accounts, settings] = await Promise.all([
        User.find(filter).select('createdAt source campaign').lean(),
        User.find(filter).select(fields).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        User.countDocuments(),
        getSettings(),
    ]);
    const ids = rows.map((u) => u._id);
    const nets = [...new Set(rows.map((u) => u.signupNet).filter(Boolean))];
    const campaignIds = [...new Set(rows.map((u) => u.campaign && String(u.campaign)).filter(Boolean))];
    const [resumes, apps, profiles, aiEvents, sameNet, campaigns] = await Promise.all([
        Resume.find({ user: { $in: ids } }).select('user').lean(),
        Application.find({ user: { $in: ids } }).select('user').lean(),
        CareerProfile.find({ user: { $in: ids } }).select('user').lean(),
        AiEvent.find({ user: { $in: ids }, ok: { $ne: false } }).select('user credits').lean(),
        nets.length ? User.find({ signupNet: { $in: nets } }).select('signupNet').lean() : [],
        Campaign.find({ _id: { $in: campaignIds } }).select('code name').lean(),
    ]);
    const countBy = (list, key = 'user') => list.reduce((m, x) => m.set(String(x[key]), (m.get(String(x[key])) || 0) + 1), new Map());
    const resumeN = countBy(resumes);
    const appN = countBy(apps);
    const profileN = countBy(profiles);
    const netN = countBy(sameNet, 'signupNet');
    const ai = new Map();
    for (const e of aiEvents) {
        const a = ai.get(String(e.user)) || { uses: 0, credits: 0 };
        a.uses += 1;
        a.credits += e.credits || 0;
        ai.set(String(e.user), a);
    }

    // Per day, by source, across the whole range (not just this page).
    const perDay = new Map();
    const bySource = { organic: 0, campaign: 0, admin: 0 };
    for (const u of all) {
        const s = sourceOf(u);
        bySource[s] += 1;
        const d = perDay.get(dayOf(u.createdAt)) || { organic: 0, campaign: 0, admin: 0 };
        d[s] += 1;
        perDay.set(dayOf(u.createdAt), d);
    }
    const daily = [];
    for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t <= to.getTime() && daily.length < 366; t += 864e5) {
        const day = dayOf(t);
        daily.push({ day, ...(perDay.get(day) || { organic: 0, campaign: 0, admin: 0 }) });
    }

    res.json({
        success: true,
        data: {
            total: all.length,
            page,
            limit,
            bySource,
            daily,
            accounts,
            cap: settings.signups.cap,
            users: rows.map((u) => {
                const c = campaigns.find((x) => String(x._id) === String(u.campaign));
                return {
                    _id: u._id,
                    name: u.name,
                    email: u.email,
                    createdAt: u.createdAt,
                    lastLoginAt: u.lastLoginAt,
                    source: sourceOf(u),
                    ref: u.ref || null,
                    campaign: c ? { _id: c._id, code: c.code, name: c.name } : null,
                    verified: !!u.emailVerifiedAt,
                    plan: effectivePlanId(u),
                    banned: !!u.banned,
                    sameNetwork: u.signupNet ? (netN.get(u.signupNet) || 1) - 1 : 0,
                    did: {
                        resumes: resumeN.get(String(u._id)) || 0,
                        profile: profileN.has(String(u._id)),
                        applications: appN.get(String(u._id)) || 0,
                        aiUses: ai.get(String(u._id))?.uses || 0,
                        aiCredits: ai.get(String(u._id))?.credits || 0,
                    },
                };
            }),
        },
    });
}));

router.get('/users/export.csv', wrap(async (req, res) => {
    const users = await describeUsers(await User.find().select(USER_FIELDS).sort({ createdAt: -1 }).lean());
    // Names are typed by users: a leading = + - @ would run as a formula in Excel or Sheets.
    const cell = (v) => {
        const s = String(v ?? '');
        return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    };
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
    const user = await User.findById(req.params.id).select(`${USER_FIELDS} source ref signupNet`).lean();
    if (!user) return bad(res, 'User not found.', 404);
    const [described] = await describeUsers([user]);
    delete described.signupNet;
    const [resumes, events, campaign] = await Promise.all([
        Resume.find({ user: user._id }).select('nickname template isPublic shortId isMaster updatedAt').sort({ updatedAt: -1 }).lean(),
        AiEvent.find({ user: user._id }).sort({ at: -1 }).limit(50).lean(),
        user.campaign ? Campaign.findById(user.campaign).select('name code').lean() : null,
    ]);
    const billing = await User.findById(user._id).select('firstPaidAt lastPaidAt refundIds chargebackIds').lean();
    const timeline = await userTimeline(user, await getSettings());
    res.json({ success: true, data: { ...described, resumesList: resumes, events, campaign, refundCheck: await refundCheck(billing), timeline } });
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
    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) fail('Please enter a name.');
        user.name = body.name.trim();
    }
    if (body.email !== undefined) {
        if (!validEmail(body.email)) fail('Please enter a valid email.');
        const email = validEmail(body.email).toLowerCase();
        if (email !== user.email) {
            if (isSuperadmin({ email })) fail("That email is reserved for a super admin.", 403);
            // Case-insensitive, so it also catches older accounts stored with capitals.
            if (await User.exists({ email: emailQuery(email), _id: { $ne: user._id } })) fail('Another account already uses that email.');
            user.email = email;
            user.emailVerifiedAt = undefined;
        }
    }
    if (body.plan !== undefined) {
        if (!PLAN_IDS.includes(body.plan)) throw Object.assign(new Error('Unknown plan.'), { status: 400 });
        user.plan = body.plan;
    }
    if (body.planExpiresAt !== undefined) user.planExpiresAt = body.planExpiresAt ? new Date(body.planExpiresAt) : null;
    if (body.creditLimit !== undefined) {
        const next = body.creditLimit === null || body.creditLimit === '' ? null : Math.max(0, Math.round(Number(body.creditLimit) || 0));
        // An allowance set by an admin has no end date (a campaign's one did). Saving the same
        // value back unchanged keeps the campaign's end date.
        if (next !== user.creditLimit) user.creditLimitExpiresAt = undefined;
        user.creditLimit = next;
    }
    if (body.v2Preview !== undefined) user.v2Preview = body.v2Preview === true;
    if (body.tester !== undefined) user.tester = body.tester === true;
    // The account's own feature switches ({ chat: false, applications: true }); a feature left
    // out follows the plan. They end at featuresExpireAt (empty = no end).
    if (body.features !== undefined) {
        const f = cleanFeatures(body.features);
        user.features = Object.keys(f).length ? f : undefined;
        user.markModified('features');
    }
    if (body.featuresExpireAt !== undefined) {
        const d = body.featuresExpireAt ? new Date(body.featuresExpireAt) : null;
        if (d && Number.isNaN(d.getTime())) fail('Please pick a valid end date.');
        user.featuresExpireAt = d || undefined;
    }
    // Limits of its own ({ resumes: 5 }); null or a missing key follows the plan.
    if (body.limits !== undefined) {
        const src = body.limits && typeof body.limits === 'object' && !Array.isArray(body.limits) ? body.limits : {};
        const out = {};
        for (const { key } of PLAN_LIMITS) {
            const v = src[key];
            if (v === null || v === undefined || v === '') continue;
            const n = Math.round(Number(v));
            if (!Number.isFinite(n) || n < 0 || n > 10000) fail('Limits are whole numbers from 0 to 10,000.');
            out[key] = n;
        }
        user.limits = Object.keys(out).length ? out : undefined;
        user.markModified('limits');
    }
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
    if (!validEmail(email)) return bad(res, 'Please enter a valid email.');
    if (await User.exists({ email: emailQuery(validEmail(email)) })) return bad(res, 'An account with that email already exists.');
    if (isSuperadmin({ email: validEmail(email).toLowerCase() })) return bad(res, 'That email is reserved for a super admin.', 403);
    const user = new User({ name: 'placeholder', email: validEmail(email).toLowerCase(), password: 'placeholder', source: 'admin' });
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
    await audit(req, 'user.create', user.email, { plan: user.plan });
    await sendUser(res, user, 201);
}));

router.patch('/users/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404);
    const user = await User.findById(req.params.id);
    if (!user) return bad(res, 'User not found.', 404);
    try {
        await applyUserFields(user, req.body || {}, req);
        await user.save();
        await audit(req, 'user.update', user.email, req.body);
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
    await audit(req, 'user.restore_credits', user.email);
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
    await audit(req, 'user.reset_2fa', user.email);
    await sendUser(res, user);
}));

router.delete('/users/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404);
    const user = await User.findById(req.params.id);
    if (!user) return bad(res, 'User not found.', 404);
    if (String(user._id) === req.userId || isSuperadmin(user)) return bad(res, "You can't delete yourself or a super admin.");
    if (roleOf(user) === 'admin' && req.role !== 'superadmin') return bad(res, 'Only super admins can delete admin accounts.', 403);
    await deleteUserData(user._id);
    await user.deleteOne();
    await audit(req, 'user.delete', user.email);
    res.json({ success: true });
}));

// ---------- AI economics ----------

router.get('/economics', wrap(async (req, res) => {
    const days = Math.min(180, Math.max(1, Math.round(Number(req.query.days) || 30)));
    res.json({ success: true, data: await aiEconomics({ days, settings: await getSettings() }) });
}));

// @route GET /api/admin/ai-spend — this month's AI cost against the cap (lib/aiSpend.js)
// ---------- Feedback and errors (Phase 6) ----------

router.get('/feedback', wrap(async (req, res) => {
    const status = ['new', 'seen', 'fixed'].includes(req.query.status) ? req.query.status : null;
    const page = Math.max(1, Math.round(Number(req.query.page) || 1));
    const [items, counts] = await Promise.all([
        Feedback.find(status ? { status } : {}).select('-screenshot').sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).lean(),
        Feedback.find().select('status screenshot').lean(),
    ]);
    const shots = new Set(counts.filter((f) => f.screenshot).map((f) => String(f._id)));
    const by = { new: 0, seen: 0, fixed: 0 };
    for (const f of counts) by[f.status] += 1;
    res.json({ success: true, data: { items: items.map((f) => ({ ...f, hasScreenshot: shots.has(String(f._id)) })), counts: by, page } });
}));

router.get('/feedback/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Not found.', 404);
    const fb = await Feedback.findById(req.params.id).lean();
    if (!fb) return bad(res, 'Not found.', 404);
    res.json({ success: true, data: fb });
}));

router.patch('/feedback/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Not found.', 404);
    if (!['new', 'seen', 'fixed'].includes(req.body?.status)) return bad(res, 'Unknown status.');
    // Update, then read (FerretDB can't return a projection from findOneAndUpdate).
    const r = await Feedback.updateOne({ _id: req.params.id }, { status: req.body.status });
    if (!r.matchedCount) return bad(res, 'Not found.', 404);
    const fb = await Feedback.findById(req.params.id).select('-screenshot').lean();
    await audit(req, 'feedback.status', String(fb._id), { status: fb.status });
    res.json({ success: true, data: fb });
}));

// A reply by email to whoever sent it (when they left an address and email is set up).
router.post('/feedback/:id/reply', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Not found.', 404);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return bad(res, 'Write a reply first.');
    if (text.length > 4000) return bad(res, 'Please keep the reply under 4,000 characters.');
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return bad(res, 'Not found.', 404);
    if (!fb.email) return bad(res, "They didn't leave an email address.");
    if (!canSendMail()) return bad(res, 'Email is not set up on the server (SMTP_URL).');
    await sendMail({
        to: fb.email,
        subject: 'About your ResumeX feedback',
        text: `${text}\n\n---\nYou wrote: "${fb.message.slice(0, 500)}"`,
    });
    const me = await User.findById(req.userId).select('email').lean();
    fb.replies.push({ text, at: new Date(), by: me?.email || 'admin' });
    const next = ['new', 'seen', 'fixed'].includes(req.body?.status) ? req.body.status : fb.status === 'new' ? 'seen' : fb.status;
    fb.status = next;
    await fb.save();
    await audit(req, 'feedback.reply', String(fb._id));
    const out = fb.toObject();
    delete out.screenshot;
    res.json({ success: true, data: out });
}));

const lastHours = (hours, n) => {
    const since = new Date(Date.now() - n * 3600 * 1000).toISOString().slice(0, 13);
    return Object.entries(hours || {}).reduce((sum, [k, v]) => sum + (k >= since ? v : 0), 0);
};

router.get('/errors', wrap(async (req, res) => {
    const filter = {};
    if (['browser', 'server'].includes(req.query.kind)) filter.kind = req.query.kind;
    if (req.query.resolved !== '1') filter.resolvedAt = null;
    const groups = await ErrorGroup.find(filter).sort({ lastAt: -1 }).limit(200).lean();
    res.json({ success: true, data: groups.map(({ hours, ...g }) => ({ ...g, lastHour: lastHours(hours, 1), lastDay: lastHours(hours, 24) })) });
}));

router.patch('/errors/:id', wrap(async (req, res) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f]{16}$/.test(id)) return bad(res, 'Not found.', 404);
    const r = await ErrorGroup.updateOne({ _id: id }, req.body?.resolved === false ? { $unset: { resolvedAt: 1 } } : { resolvedAt: new Date() });
    if (!r.matchedCount) return bad(res, 'Not found.', 404);
    await audit(req, req.body?.resolved === false ? 'errors.reopen' : 'errors.resolve', id);
    res.json({ success: true });
}));

// The owner's alerts (the console's bell): spend, storage, sign-ups, bursts.
router.get('/alerts', wrap(async (req, res) => {
    res.json({ success: true, data: await recentAlerts() });
}));

// Database storage: used vs the quota, what uses it, the biggest accounts (lib/storage.js).
router.get('/storage', wrap(async (req, res) => {
    const settings = await getSettings();
    const report = await storageReport(settings, { fresh: req.query.fresh === '1' });
    checkStorage(settings);
    res.json({ success: true, data: report });
}));

// "Rewrite with AI" for a plan's perks (lib/perksDraft.js): a proposal from the plan's own
// settings, which the admin can use or ignore. Its cost counts towards the monthly AI cap.
const perksLimit = limit({ name: 'admin-perks', windowMs: 60 * 60 * 1000, max: 30, key: (req) => req.userId, message: 'Too many perk rewrites. Try again in a while.', label: 'Perk rewrites (AI)', group: 'Admin', scope: 'account', description: 'AI rewrites of a plan’s perks one admin can ask for in an hour.' });
router.post('/perks-draft', perksLimit, wrap(async (req, res) => {
    const { draftPlan, planFacts, cleanPerks, prompt, SYSTEM } = require('../lib/perksDraft');
    const settings = await getSettings();
    const plans = (Array.isArray(req.body?.plans) ? req.body.plans : []).slice(0, 5).map(draftPlan).filter(Boolean);
    const plan = plans.find((p) => p.id === req.body?.planId);
    if (!plan) return bad(res, 'Unknown plan.');
    const facts = planFacts(plan, plans, settings);
    req.aiLimits = { output: 300, thinking: 0 };
    let text;
    try {
        text = await require('./ai').generate(SYSTEM, [{ role: 'user', parts: [{ text: prompt(facts, plan.perks) }] }], { temperature: 0.4 }, req);
    } catch (err) {
        return bad(res, err.status && err.status < 500 ? err.message : `${err.message || 'The AI is unavailable right now.'} Your perks weren't changed.`, 502);
    } finally {
        const u = req.aiUsage;
        if (u) {
            await recordSpend(u, settings).catch(() => {});
            await AiEvent.create({ user: req.userId, feature: 'adminPerks', credits: 0, model: u.model || undefined, inputTokens: u.inputTokens, outputTokens: u.outputTokens }).catch(() => {});
        }
    }
    const out = cleanPerks(text, facts);
    if (!out.perks.length) return bad(res, "The AI's suggestion didn't match the plan's settings. Try again.", 502);
    res.json({ success: true, data: out });
}));

// What a credit really costs and how many credits accounts really use (the campaign estimate).
router.get('/ai-usage', wrap(async (req, res) => {
    res.json({ success: true, data: await usageBasis(await getSettings()) });
}));

router.get('/ai-spend', wrap(async (req, res) => {
    const settings = await getSettings();
    const now = new Date();
    const state = await pauseState(settings, now);
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const daysIn = Math.round((nextMonth(now) - start) / 864e5);
    const elapsed = Math.max(1 / 24, (now - start) / 864e5);
    // At this month's pace so far: the month's total, and the day the cap would be reached.
    const projected = (state.spent / elapsed) * daysIn;
    const perDay = state.spent / elapsed;
    const capDay = settings.aiSpend.enabled && perDay > 0 && state.spent < settings.aiSpend.cap ? new Date(start.getTime() + (settings.aiSpend.cap / perDay) * 864e5) : null;
    res.json({
        success: true,
        data: { month: monthKey(now), ...settings.aiSpend, spent: state.spent, projected, capDay: capDay && capDay < nextMonth(now) ? capDay : null, paused: state.paused, reason: state.reason, until: state.until },
    });
}));

// ---------- Revenue ----------

// @route GET /api/admin/revenue?days=30 — where the money comes from and how (lib/revenue.js)
router.get('/revenue', wrap(async (req, res) => {
    const days = Math.min(365, Math.max(1, Math.round(Number(req.query.days) || 30)));
    res.json({ success: true, data: await revenueReport({ days, settings: await getSettings() }) });
}));

// @route GET /api/admin/revenue/payments.csv?days=365 — every payment (all time without days)
router.get('/revenue/payments.csv', wrap(async (req, res) => {
    const days = Number(req.query.days) > 0 ? Math.min(3650, Math.round(Number(req.query.days))) : undefined;
    await audit(req, 'revenue.export', null, { days: days || 'all' });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="resumex-payments-${dayKey(Date.now())}.csv"`);
    res.send(await paymentsCsv({ days }));
}));

// ---------- Audit log ----------

router.get('/audit', wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const action = searchText(req.query.action);
    const filter = action ? { action: new RegExp(`^${escapeRe(action)}`) } : {};
    const [total, entries] = await Promise.all([
        AdminLog.countDocuments(filter),
        AdminLog.find(filter).sort({ at: -1 }).skip((page - 1) * 50).limit(50).lean(),
    ]);
    res.json({ success: true, data: { total, page, entries } });
}));

// ---------- Settings (plans, prices, credit costs, free mode) ----------

const settingsPayload = async () => ({ ...(await readSettings()), aiFeatures: AI_FEATURES, appFeatures: APP_FEATURES, planLimits: PLAN_LIMITS, rateLimits: describeLimits(), userCount: await User.countDocuments() });

router.get('/settings', wrap(async (req, res) => {
    res.json({ success: true, data: await settingsPayload() });
}));

// Send only the sections you changed, plus `baseRev` (the `rev` you loaded): a save from
// an out-of-date page is refused with the latest settings, instead of undoing other changes.
router.put('/settings', wrap(async (req, res) => {
    const { baseRev, ...patch } = req.body || {};
    try {
        await updateSettings(patch, req.adminEmail, { baseRev: Number.isInteger(baseRev) ? baseRev : undefined });
    } catch (err) {
        if (err.code === 'conflict') return res.status(409).json({ success: false, code: 'conflict', error: err.message, data: await settingsPayload() });
        throw err;
    }
    await audit(req, 'settings.update', null, patch);
    res.json({ success: true, data: await settingsPayload() });
}));

// ---------- Campaigns ----------

const CAMPAIGN_FIELDS = ['name', 'code', 'description', 'plan', 'creditLimit', 'creditPeriod', 'durationDays', 'maxUses', 'emailDomain', 'expiresAt', 'active', 'features'];
/** Feature switches: known feature keys with true or false only (the rest follow the plan). */
const cleanFeatures = (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).filter(([k, on]) => [...AI_FEATURES, ...APP_FEATURES].some((f) => f.key === k) && typeof on === 'boolean'))
        : {};
const pickCampaign = (body = {}) => {
    const out = {};
    for (const k of CAMPAIGN_FIELDS) if (body[k] !== undefined) out[k] = body[k];
    if (out.plan !== undefined && !PLAN_IDS.includes(out.plan)) out.plan = 'free';
    if (out.creditLimit === '' ) out.creditLimit = null;
    if (out.creditPeriod === '' ) out.creditPeriod = null;
    if (out.expiresAt === '') out.expiresAt = null;
    if (typeof out.emailDomain === 'string') out.emailDomain = out.emailDomain.replace(/^@/, '');
    if (out.features !== undefined) out.features = cleanFeatures(out.features);
    return out;
};
const campaignError = (res, err) => {
    if (err.name === 'ValidationError') return bad(res, Object.values(err.errors)[0].message);
    if (err.code === 11000) return bad(res, 'That code is already used by another campaign.');
    throw err;
};

router.get('/campaigns', wrap(async (req, res) => {
    const [campaigns, settings] = await Promise.all([Campaign.find().sort({ createdAt: -1 }).lean(), getSettings()]);
    // Per campaign: members, members active in the last 7 days, and what their AI has cost.
    const ids = campaigns.map((c) => c._id);
    const members = await User.find({ campaign: { $in: ids } }).select('campaign lastLoginAt').lean();
    const since = Date.now() - 7 * 864e5;
    const campaignOf = new Map(members.map((u) => [String(u._id), String(u.campaign)]));
    const events = members.length ? await AiEvent.find({ user: { $in: members.map((u) => u._id) } }).select('user credits model inputTokens outputTokens').lean() : [];
    const stats = new Map(ids.map((id) => [String(id), { members: 0, active: 0, credits: 0, aiCost: 0 }]));
    for (const u of members) {
        const st = stats.get(String(u.campaign));
        st.members += 1;
        if (u.lastLoginAt && new Date(u.lastLoginAt) > since) st.active += 1;
    }
    for (const e of events) {
        const st = stats.get(campaignOf.get(String(e.user)));
        if (!st) continue;
        st.credits += e.credits || 0;
        st.aiCost += callCost(e, settings.aiPrices);
    }
    res.json({ success: true, data: campaigns.map((c) => ({ ...c, stats: stats.get(String(c._id)) })) });
}));

router.post('/campaigns', wrap(async (req, res) => {
    try {
        const campaign = await Campaign.create(pickCampaign(req.body));
        await audit(req, 'campaign.create', campaign.code, pickCampaign(req.body));
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
        await audit(req, 'campaign.update', campaign.code, pickCampaign(req.body));
        res.json({ success: true, data: campaign });
    } catch (err) {
        campaignError(res, err);
    }
}));

router.delete('/campaigns/:id', wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Campaign not found.', 404);
    // Members keep what they were given; the code just stops working.
    const gone = await Campaign.findByIdAndDelete(req.params.id);
    await audit(req, 'campaign.delete', gone?.code);
    res.json({ success: true });
}));

module.exports = router;
