/**
 * How many resumes an account may keep: its plan's "Resumes" limit (Admin › Plans; none in
 * free mode), and a hard ceiling for everyone (MAX_RESUMES_PER_ACCOUNT, default 50).
 * Existing resumes are never removed; only new ones are refused. Used by every route that
 * creates resumes (new, duplicate, tailored).
 *
 * The check before creating can be raced (five "New resume" clicks at once all see room),
 * so the routes also call keptWithinLimit() after creating: resumes past the limit, in the
 * order they were made, are removed again and refused, so exactly the allowed number stay.
 */
const Resume = require('../models/Resume');
const User = require('../models/User');
const { getSettings } = require('./settings');
const { planLimit, effectivePlanId, USER_FIELDS } = require('./credits');
const { checkStorage } = require('./storage');

const HARD_CAP = () => Number(process.env.MAX_RESUMES_PER_ACCOUNT) || 50;

async function limitsFor(req) {
    const [have, user, settings] = await Promise.all([Resume.countDocuments({ user: req.userId }), User.findById(req.userId).select(USER_FIELDS).lean(), getSettings()]);
    return { have, user, settings, planMax: planLimit(user, settings, 'resumes') };
}

function refuse(res, { user, settings, planMax }, overPlan) {
    if (overPlan) {
        const plan = settings.plans.find((p) => p.id === effectivePlanId(user));
        const better = settings.plans.find((p) => p.limits.resumes === null || p.limits.resumes > planMax);
        return res.status(403).json({
            success: false,
            code: 'upgrade',
            feature: 'resumes',
            plan: better?.id,
            error: `${plan?.name || 'Your'} plan keeps up to ${planMax} resume${planMax === 1 ? '' : 's'}. Delete one to make room${better ? `, or upgrade to ${better.name} for more` : ''}.`,
        });
    }
    return res.status(400).json({ success: false, error: `You can keep up to ${HARD_CAP()} resumes. Delete some to make room.` });
}

/**
 * True when `adding` more resumes fit; otherwise sends the refusal (an upgrade prompt when
 * it's the plan's limit) and returns false.
 */
async function roomForResumes(req, res, adding = 1) {
    const ctx = await limitsFor(req);
    checkStorage(ctx.settings); // new resumes are what fill the database (throttled, never throws)
    if (ctx.planMax != null && ctx.have + adding > ctx.planMax) {
        refuse(res, ctx, true);
        return false;
    }
    if (ctx.have + adding > HARD_CAP()) {
        refuse(res, ctx, false);
        return false;
    }
    return true;
}

/**
 * After creating `createdIds`: when racing requests took the account past its limit, the
 * resumes beyond it (by creation order) are deleted again and this request is refused.
 * True when everything created may stay.
 */
async function keptWithinLimit(req, res, createdIds) {
    const ctx = await limitsFor(req);
    const max = Math.min(ctx.planMax ?? Infinity, HARD_CAP());
    if (ctx.have <= max) return true;
    // The oldest `max` stay (ObjectIds sort by creation); anything of ours after them goes.
    const keep = new Set((await Resume.find({ user: req.userId }).select('_id').sort({ _id: 1 }).limit(max).lean()).map((r) => String(r._id)));
    const extra = createdIds.map(String).filter((id) => !keep.has(id));
    if (!extra.length) return true;
    await Resume.deleteMany({ _id: { $in: extra }, user: req.userId });
    refuse(res, ctx, ctx.planMax != null && ctx.planMax <= HARD_CAP());
    return false;
}

module.exports = { roomForResumes, keptWithinLimit };
