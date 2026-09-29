/**
 * V2 (Career Profile, applications, tailoring) is shown to admins and preview accounts
 * until an admin switches it on for everyone (settings.v2.enabled). Same rule as
 * canUseV2 in client/src/lib/access.js (checked by the parity test).
 */
const User = require('../models/User');
const { getSettings } = require('./settings');
const { roleOf } = require('../routes/auth');

const hasV2 = (user, settings) => !!user && (!!settings.v2?.enabled || !!user.v2Preview || ['admin', 'superadmin'].includes(roleOf(user)));

/** After `protect`: loads the account (req.account) and the settings (req.settings); 404 when V2 isn't on for it. */
async function requireV2(req, res, next) {
    try {
        const [user, settings] = await Promise.all([User.findById(req.userId).select('email role plan planExpiresAt passPlan passUntil v2Preview').lean(), getSettings()]);
        if (!hasV2(user, settings)) return res.status(404).json({ success: false, error: 'Not found.' });
        req.account = user;
        req.settings = settings;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * After requireV2: the account's plan (or its own switch) must include `feature`, else an
 * upgrade prompt (Career Profile and Applications are paid features).
 */
const requireFeature = (feature, name) => async (req, res, next) => {
    try {
        const { canUse, USER_FIELDS } = require('./credits');
        const [user, settings] = await Promise.all([User.findById(req.userId).select(USER_FIELDS).lean(), req.settings || getSettings()]);
        if (canUse(user, settings, feature)) return next();
        const plan = settings.plans.find((p) => p.features[feature]);
        res.status(403).json({ success: false, code: 'upgrade', feature, plan: plan?.id, error: `${name} is part of the ${plan?.name || 'paid'} plan.` });
    } catch (err) {
        next(err);
    }
};

module.exports = { hasV2, requireV2, requireFeature };
