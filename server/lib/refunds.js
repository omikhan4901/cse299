/**
 * The refund rule (client/src/app/(site)/refunds/page.js says the same in words):
 * a refund is possible within 14 days of an account's first payment, if since paying it
 * hasn't downloaded a PDF with a paid template, used more than 10 AI credits or added more
 * than 2 applications, and it has never had a refund before (the owner's call: the Career
 * Profile alone doesn't count as use). refundCheck() applies it for the admin console.
 */
const Download = require('../models/Download');
const AiEvent = require('../models/AiEvent');
const Application = require('../models/Application');

const REFUND_WINDOW_DAYS = 14;
const REFUND_MAX_CREDITS = 10;
const REFUND_MAX_APPLICATIONS = 2;

const day = (d) => new Date(d).toISOString().slice(0, 10);

/** Whether the account's latest payment can be refunded under the policy, and why not. Null if it never paid. */
async function refundCheck(user) {
    if (!user?.lastPaidAt) return null;
    const since = new Date(user.lastPaidAt);
    const [paidDownloads, credits, applications] = await Promise.all([
        Download.countDocuments({ user: user._id, at: { $gte: since } }),
        AiEvent.aggregate([{ $match: { user: user._id, at: { $gte: since } } }, { $group: { _id: null, total: { $sum: '$credits' } } }]).then((r) => r[0]?.total || 0),
        Application.countDocuments({ user: user._id, createdAt: { $gte: since } }),
    ]);
    const refunds = user.refundIds?.length || 0;
    const chargebacks = user.chargebackIds?.length || 0;
    const firstPayment = user.firstPaidAt && Math.abs(new Date(user.firstPaidAt) - since) < 60 * 1000;
    const daysSince = (Date.now() - new Date(user.firstPaidAt || since)) / 864e5;
    const reasons = [];
    if (!firstPayment) reasons.push(`Only the first payment is refundable (first paid ${day(user.firstPaidAt)}, latest ${day(since)}).`);
    else if (daysSince > REFUND_WINDOW_DAYS) reasons.push(`More than ${REFUND_WINDOW_DAYS} days since the first payment (${day(user.firstPaidAt)}).`);
    if (refunds) reasons.push(`Already refunded before (${refunds}).`);
    if (chargebacks) reasons.push(`Has ${chargebacks} chargeback${chargebacks > 1 ? 's' : ''}.`);
    if (paidDownloads) reasons.push(`Downloaded ${paidDownloads} PDF${paidDownloads > 1 ? 's' : ''} with a paid template since paying.`);
    if (credits > REFUND_MAX_CREDITS) reasons.push(`Used ${credits} AI credits since paying (the limit is ${REFUND_MAX_CREDITS}).`);
    if (applications > REFUND_MAX_APPLICATIONS) reasons.push(`Added ${applications} applications since paying (the limit is ${REFUND_MAX_APPLICATIONS}).`);
    return {
        firstPaidAt: user.firstPaidAt || null,
        lastPaidAt: user.lastPaidAt,
        daysSinceFirstPayment: Math.floor(daysSince),
        paidDownloads,
        aiCredits: credits,
        applications,
        refunds,
        chargebacks,
        eligible: reasons.length === 0,
        reasons,
    };
}

module.exports = { refundCheck, REFUND_WINDOW_DAYS, REFUND_MAX_CREDITS, REFUND_MAX_APPLICATIONS };
