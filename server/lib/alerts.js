/**
 * Alerts for the owner (docs/v2/BETA-PLAN.md, Phase 3): AI spend, storage, sign-ups closing,
 * sign-up bursts from one network. Each is raised once by its id (so two servers never send
 * the same one), listed in the admin console's bell, and emailed to the super admins.
 */
const Alert = require('../models/Alert');
const User = require('../models/User');
const { sendMail, canSendMail } = require('./mailer');
const { superadminEmails } = require('./roles');

/** Raises the alert `id` once: stores it and emails the owner. True when this call raised it. Never throws. */
async function raise(id, { kind, subject, text, email = true }) {
    try {
        await Alert.create({ _id: id, kind, text });
    } catch (err) {
        if (err.code !== 11000) console.error('Alert failed:', err.message);
        return false;
    }
    if (email && canSendMail()) {
        const to = superadminEmails();
        if (to.length) await sendMail({ to: to.join(','), subject: `ResumeX: ${subject}`, text }).catch((err) => console.error('Alert email failed:', err.message));
    }
    return true;
}

const day = () => new Date().toISOString().slice(0, 10);

/**
 * After a sign-up: sign-ups nearly full or full (the cap in Credits & access), and a burst
 * of 5 or more in an hour from one network (a script, or a class signing up together).
 */
async function afterSignup(user, settings) {
    try {
        const cap = settings.signups?.cap;
        if (cap != null) {
            const left = cap - (await User.countDocuments());
            if (left <= 0) {
                await raise(`signups-full-${cap}`, { kind: 'signups', subject: 'sign-ups are full', text: `All ${cap} accounts are taken, so sign-ups are closed. Raise the number in Admin > Credits & access to let more people in.` });
            } else if (left <= Math.max(3, Math.ceil(cap * 0.1))) {
                await raise(`signups-closing-${cap}`, { kind: 'signups', subject: `${left} sign-ups left`, text: `Only ${left} of ${cap} places are left before sign-ups close. Admin > Sign-ups shows who joined.` });
            }
        }
        if (user.signupNet) {
            const recent = await User.countDocuments({ signupNet: user.signupNet, createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } });
            if (recent >= 5) {
                await raise(`burst-${user.signupNet}-${day()}`, {
                    kind: 'burst',
                    subject: `${recent} sign-ups from one network in an hour`,
                    text: `${recent} accounts signed up from the same network in the last hour (the latest: ${user.email}). It may be a class signing up together, or one person making accounts for free credits. Admin > Sign-ups shows them with a network count.`,
                });
            }
        }
    } catch (err) {
        console.error('Sign-up alert check failed:', err.message);
    }
}

/** The latest alerts for the console's bell. */
const recentAlerts = (limit = 30) => Alert.find({ kind: { $exists: true } }).sort({ at: -1 }).limit(limit).lean();

module.exports = { raise, afterSignup, recentAlerts };
