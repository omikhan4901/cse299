/**
 * Reminder and digest emails for tracked applications (V2, docs/v2/SPEC.md §5.5). Run by
 * Cloud Scheduler through POST /api/internal/reminders:
 *   - reminders (every run): a deadline tomorrow or today, an interview in the next day;
 *   - digest (weekly, { digest: true }): what's coming up this week, and the search so far.
 * Each person can turn either off (Account settings, or the link in every email). Nothing is
 * sent twice (Reminder records), and nothing goes to accounts without V2.
 */
const jwt = require('jsonwebtoken');
const Application = require('../models/Application');
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const mailer = require('./mailer');
const { getSettings } = require('./settings');
const { hasV2 } = require('./v2');

const DAY = 864e5;
const ACTIVE = Application.ACTIVE;
const startOfDay = (d) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
};
const daysUntil = (d, now) => Math.round((startOfDay(d) - startOfDay(now)) / DAY);
const nameOf = (a) => [a.job?.title, a.job?.organisation].filter(Boolean).join(' at ') || 'An application';
const when = (d) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);
const appUrl = () => (process.env.APP_URL || process.env.CLIENT_ORIGIN || 'https://resumex.cc').split(',')[0].replace(/\/$/, '');

/** A link that turns one kind of email off, without signing in. */
function unsubscribeUrl(userId, kind) {
    const token = jwt.sign({ sub: String(userId), kind, purpose: 'unsubscribe' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '180d' });
    const api = (process.env.API_URL || `${appUrl()}/api`).replace(/\/$/, '');
    return `${api}/auth/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** What needs a reminder now: deadlines today or tomorrow (not yet applied), interviews within a day. */
function remindersFor(apps, now) {
    const out = [];
    for (const a of apps) {
        if (a.archived || !ACTIVE.includes(a.status)) continue;
        if (a.job?.deadline && ['saved', 'preparing'].includes(a.status)) {
            const d = daysUntil(a.job.deadline, now);
            if (d === 0 || d === 1) out.push({ key: `${a._id}:deadline:${startOfDay(a.job.deadline).toISOString().slice(0, 10)}`, text: `Deadline ${when(d)}: ${nameOf(a)}`, id: a._id });
        }
        for (const i of a.interviews || []) {
            const hours = (new Date(i.at) - now) / 36e5;
            if (i.at && hours >= 0 && hours <= 24) out.push({ key: `${a._id}:interview:${new Date(i.at).toISOString()}`, text: `${i.kind || 'Interview'} ${when(daysUntil(i.at, now))}: ${nameOf(a)}`, id: a._id });
        }
    }
    return out;
}

/** The week ahead and the search so far, for the weekly digest (null when there's nothing to say). */
function digestFor(apps, now) {
    const live = apps.filter((a) => !a.archived);
    const active = live.filter((a) => ACTIVE.includes(a.status));
    if (!active.length) return null;
    const week = [];
    for (const a of active) {
        const d = a.job?.deadline && ['saved', 'preparing'].includes(a.status) ? daysUntil(a.job.deadline, now) : null;
        if (d !== null && d >= 0 && d <= 7) week.push({ at: a.job.deadline, text: `Deadline ${when(d)}: ${nameOf(a)}` });
        for (const i of a.interviews || []) {
            const di = i.at ? daysUntil(i.at, now) : null;
            if (di !== null && di >= 0 && di <= 7) week.push({ at: i.at, text: `${i.kind || 'Interview'} ${when(di)}: ${nameOf(a)}` });
        }
        if (a.followUpAt && daysUntil(a.followUpAt, now) <= 7 && !(a.checklist && (a.checklist.followUp || a.checklist.get?.('followUp')))) week.push({ at: a.followUpAt, text: `Follow up: ${nameOf(a)}` });
    }
    week.sort((x, y) => new Date(x.at) - new Date(y.at));
    const applied = live.filter((a) => a.appliedAt).length;
    const interviewing = live.filter((a) => a.status === 'interviewing' || (a.statusHistory || []).some((h) => h.status === 'interviewing')).length;
    return { week, active: active.length, applied, interviewing };
}

const email = ({ greeting, lines, footer, unsubscribe }) => {
    const text = `${greeting}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n${footer}\n\nOpen your applications: ${appUrl()}/applications\n\nDon't want these emails? ${unsubscribe}`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0f1f2a;max-width:520px">
<p>${esc(greeting)}</p>
<ul style="padding-left:18px">${lines.map((l) => `<li style="margin:6px 0">${esc(l)}</li>`).join('')}</ul>
<p style="color:#475569">${esc(footer)}</p>
<p><a href="${appUrl()}/applications" style="display:inline-block;background:#007b7b;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Open your applications</a></p>
<p style="font-size:12px;color:#94a3b8">Don't want these emails? <a href="${unsubscribe}" style="color:#94a3b8">Turn them off</a>.</p></div>`;
    return { text, html };
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Sends what's due. Returns counts, for the scheduler's log. */
async function runReminders({ digest = false, now = new Date() } = {}) {
    if (!mailer.canSendMail()) return { skipped: 'email is not set up (SMTP_URL)' };
    const settings = await getSettings();
    const userIds = await Application.distinct('user', { archived: { $ne: true }, status: { $in: ACTIVE } });
    const stats = { users: 0, reminders: 0, digests: 0, failed: 0 };
    for (const userId of userIds) {
        const user = await User.findById(userId).select('name email role plan planExpiresAt passPlan passUntil v2Preview banned emailPrefs').lean();
        if (!user || user.banned || !hasV2(user, settings)) continue;
        const apps = await Application.find({ user: userId }).select('-snapshot -coverLetter -job.description').lean();
        const first = (user.name || '').trim().split(/\s+/)[0] || 'there';
        stats.users++;
        try {
            if (user.emailPrefs?.reminders !== false) {
                const due = [];
                for (const r of remindersFor(apps, now)) {
                    // Claim it first, so two runs at once can't both send it.
                    try {
                        await Reminder.create({ user: userId, key: r.key });
                        due.push(r);
                    } catch (err) {
                        if (err.code !== 11000) throw err;
                    }
                }
                if (due.length) {
                    const { text, html } = email({ greeting: `Hi ${first}, a quick reminder:`, lines: due.map((d) => d.text), footer: 'Good luck!', unsubscribe: unsubscribeUrl(userId, 'reminders') });
                    await mailer.sendMail({ to: user.email, subject: due.length === 1 ? due[0].text : `${due.length} things due soon`, text, html });
                    stats.reminders += due.length;
                }
            }
            if (digest && user.emailPrefs?.digest !== false) {
                const d = digestFor(apps, now);
                const week = startOfDay(now).toISOString().slice(0, 10);
                if (d && (await Reminder.create({ user: userId, key: `${userId}:digest:${week}` }).then(() => true, (err) => (err.code === 11000 ? false : Promise.reject(err))))) {
                    const lines = d.week.length ? d.week.map((w) => w.text) : ['Nothing due this week.'];
                    const { text, html } = email({ greeting: `Hi ${first}, here's your week:`, lines, footer: `${d.active} in progress · ${d.applied} applied · ${d.interviewing} with interviews so far.`, unsubscribe: unsubscribeUrl(userId, 'digest') });
                    await mailer.sendMail({ to: user.email, subject: d.week.length ? `Your week: ${d.week.length} thing${d.week.length === 1 ? '' : 's'} coming up` : 'Your job search this week', text, html });
                    stats.digests++;
                }
            }
        } catch (err) {
            stats.failed++;
            console.error(`Reminder email to ${userId} failed:`, err.message);
        }
    }
    return stats;
}

module.exports = { runReminders, remindersFor, digestFor, unsubscribeUrl };
