/**
 * The monthly AI spending cap (docs/v2/BETA-PLAN.md, Phase 1). Every AI call adds its real
 * cost (tokens × the model prices in the admin settings) to this month's total. When the
 * total reaches the cap, or an admin pauses AI, AI requests are refused before anything is
 * charged or sent to the model (lib/credits.js), until the next month or a resume.
 * The owner is emailed once per month at the alert level and at the cap.
 */
const AiSpend = require('../models/AiSpend');
const { priceFor } = require('./economics');
const { sendMail, canSendMail } = require('./mailer');
const { superadminEmails } = require('./roles');

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const nextMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

/** The cost of one call in US dollars. */
const callCost = ({ model, inputTokens = 0, outputTokens = 0 }, prices) => {
    const p = priceFor(model, prices || {});
    return (inputTokens * p.input + outputTokens * p.output) / 1e6;
};

/** This month's spend in dollars. */
async function spentThisMonth(now = new Date()) {
    const doc = await AiSpend.findById(monthKey(now)).lean();
    return (doc?.micros || 0) / 1e6;
}

/**
 * Whether AI is paused right now, and why: { paused, reason: 'manual' | 'cap' | null,
 * until (the first of next month for the cap), spent, cap }.
 */
async function pauseState(settings, now = new Date()) {
    const cfg = settings.aiSpend;
    const spent = await spentThisMonth(now);
    if (cfg.paused) return { paused: true, reason: 'manual', until: null, spent, cap: cfg.cap };
    if (cfg.enabled && spent >= cfg.cap) return { paused: true, reason: 'cap', until: nextMonth(now), spent, cap: cfg.cap };
    return { paused: false, reason: null, until: null, spent, cap: cfg.enabled ? cfg.cap : null };
}

const usd = (v) => `$${v.toFixed(2)}`;

/** Emails the owner (super admins) once per month per threshold. Never throws. */
async function alertOnce(month, threshold, spent, settings) {
    const claimed = await AiSpend.updateOne({ _id: month, alerts: { $ne: threshold } }, { $addToSet: { alerts: threshold } });
    if (!claimed.modifiedCount) return;
    // Listed under the admin console's bell (the email is sent below).
    const reachedCap = threshold >= 100;
    require('./alerts').raise(`ai-${month}-${threshold}`, { kind: 'ai', email: false, text: reachedCap ? `AI reached the ${usd(settings.aiSpend.cap)} monthly cap (${usd(spent)}) and is paused for everyone except admins.` : `AI spend is at ${threshold}% of the monthly cap: ${usd(spent)} of ${usd(settings.aiSpend.cap)}.` });
    if (!canSendMail()) return;
    const to = superadminEmails();
    if (!to.length) return;
    const cap = settings.aiSpend.cap;
    const reached = threshold >= 100;
    await sendMail({
        to: to.join(','),
        subject: reached ? `ResumeX: AI paused, the ${usd(cap)} monthly cap is reached` : `ResumeX: AI spend is at ${threshold}% of the monthly cap`,
        text: reached
            ? `AI has cost ${usd(spent)} this month, reaching the cap of ${usd(cap)}. AI features are paused for everyone except admins until the 1st. Raise the cap or resume in Admin > AI costs.`
            : `AI has cost ${usd(spent)} this month, ${threshold}% of the ${usd(cap)} cap. At the cap, AI pauses for everyone except admins. Admin > AI costs shows the details.`,
    }).catch((err) => console.error('AI spend alert email failed:', err.message));
}

/** Adds a finished call's cost to this month, and sends the alerts it crosses. Never throws. */
async function recordSpend(usage, settings, now = new Date()) {
    try {
        if (!usage || (!usage.inputTokens && !usage.outputTokens)) return;
        const micros = Math.round(callCost(usage, settings.aiPrices) * 1e6);
        const month = monthKey(now);
        // Calls finishing together at the start of a month race to create the month's record:
        // the losers get a duplicate-key error, and simply add to the record that now exists.
        const add = { $inc: { micros, calls: 1 } };
        let doc;
        try {
            doc = await AiSpend.findOneAndUpdate({ _id: month }, add, { upsert: true, new: true });
        } catch (err) {
            if (err.code !== 11000) throw err;
            doc = await AiSpend.findOneAndUpdate({ _id: month }, add, { new: true });
        }
        const cfg = settings.aiSpend;
        if (!cfg.enabled || !cfg.cap) return;
        const spent = doc.micros / 1e6;
        for (const threshold of [cfg.alertAt, 100]) {
            if (threshold > 0 && spent >= (cfg.cap * threshold) / 100 && !doc.alerts.includes(threshold)) await alertOnce(month, threshold, spent, settings);
        }
    } catch (err) {
        console.error('Recording AI spend failed:', err.message);
    }
}

module.exports = { monthKey, nextMonth, callCost, spentThisMonth, pauseState, recordSpend };
