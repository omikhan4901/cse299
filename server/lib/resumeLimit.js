/**
 * How many resumes an account may keep: its plan's "Resumes" limit (Admin › Plans; none in
 * free mode), and a hard ceiling for everyone (MAX_RESUMES_PER_ACCOUNT, default 50).
 * Existing resumes are never removed; only new ones are refused. Used by every route that
 * creates resumes (new, duplicate, tailored).
 */
const Resume = require('../models/Resume');
const User = require('../models/User');
const { getSettings } = require('./settings');
const { planLimit, effectivePlanId, USER_FIELDS } = require('./credits');
const { checkStorage } = require('./storage');

const HARD_CAP = () => Number(process.env.MAX_RESUMES_PER_ACCOUNT) || 50;

/**
 * True when `adding` more resumes fit; otherwise sends the refusal (an upgrade prompt when
 * it's the plan's limit) and returns false.
 */
async function roomForResumes(req, res, adding = 1) {
    const [have, user, settings] = await Promise.all([Resume.countDocuments({ user: req.userId }), User.findById(req.userId).select(USER_FIELDS).lean(), getSettings()]);
    checkStorage(settings); // new resumes are what fill the database (throttled, never throws)
    const planMax = planLimit(user, settings, 'resumes');
    if (planMax != null && have + adding > planMax) {
        const plan = settings.plans.find((p) => p.id === effectivePlanId(user));
        const better = settings.plans.find((p) => p.limits.resumes === null || p.limits.resumes > planMax);
        res.status(403).json({
            success: false,
            code: 'upgrade',
            feature: 'resumes',
            plan: better?.id,
            error: `${plan?.name || 'Your'} plan keeps up to ${planMax} resume${planMax === 1 ? '' : 's'}. Delete one to make room${better ? `, or upgrade to ${better.name} for more` : ''}.`,
        });
        return false;
    }
    if (have + adding > HARD_CAP()) {
        res.status(400).json({ success: false, error: `You can keep up to ${HARD_CAP()} resumes. Delete some to make room.` });
        return false;
    }
    return true;
}

module.exports = { roomForResumes };
