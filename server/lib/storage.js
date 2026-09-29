/**
 * Database storage (docs/v2/BETA-PLAN.md, Phase 2): MongoDB Atlas M0 holds 512 MB and has no
 * backups, so the admin sees how much is used, by what and by whom, and the owner gets an
 * email when it passes the alert level (Admin › Credits & access › Storage). Photos are
 * the big items, so they are shrunk in the browser and capped on the server.
 */
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const Resume = require('../models/Resume');
const CareerProfile = require('../models/CareerProfile');
const Application = require('../models/Application');
const User = require('../models/User');
const { sendMail, canSendMail } = require('./mailer');
const { superadminEmails } = require('./roles');

const MB = 1024 * 1024;
const bytesOf = (doc) => Buffer.byteLength(JSON.stringify(doc));
const photoBytes = (doc) => ['profilePic', 'profilePicSource'].reduce((n, k) => n + (typeof doc?.personal?.[k] === 'string' ? doc.personal[k].length : 0), 0);

/** Used and total bytes (data plus indexes, as Atlas counts them); null when the database won't say. */
async function usage(settings) {
    const quota = (settings.storage?.quotaMb || 512) * MB;
    try {
        const s = await mongoose.connection.db.stats();
        const used = (Number(s.dataSize) || 0) + (Number(s.indexSize) || 0);
        return { used, quota, pct: Math.round((used / quota) * 1000) / 10 };
    } catch {
        return { used: null, quota, pct: null };
    }
}

let cached = null;
/**
 * The full picture for the admin: usage, bytes per kind of record (and how much of it is
 * photos), and the accounts using the most. Recounted at most every 10 minutes.
 */
async function storageReport(settings, { fresh = false } = {}) {
    if (!fresh && cached && Date.now() - cached.at < 10 * 60 * 1000) return { ...cached.report, usage: await usage(settings) };
    const perUser = new Map();
    const add = (user, n) => user && perUser.set(String(user), (perUser.get(String(user)) || 0) + n);
    const kinds = {};
    const count = async (name, model, fields = '') => {
        const k = (kinds[name] = { count: 0, bytes: 0, photos: 0 });
        for await (const doc of model.find({}, fields).lean().cursor()) {
            const n = bytesOf(doc);
            k.count += 1;
            k.bytes += n;
            k.photos += photoBytes(doc) + photoBytes(doc.snapshot?.content);
            add(doc.user, n);
        }
    };
    await count('resumes', Resume);
    await count('profiles', CareerProfile);
    await count('applications', Application);
    const top = [...perUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const users = await User.find({ _id: { $in: top.map(([id]) => id) } }).select('name email').lean();
    const report = {
        kinds,
        biggest: top.map(([id, bytes]) => ({ id, bytes, ...(users.find((u) => String(u._id) === id) || { name: '(deleted)', email: '' }) })),
        accounts: perUser.size,
        countedAt: new Date().toISOString(),
    };
    cached = { at: Date.now(), report };
    return { ...report, usage: await usage(settings) };
}

/** Claims an alert id; true for the first caller only. */
async function claim(id) {
    try {
        await Alert.create({ _id: id });
        return true;
    } catch (err) {
        if (err.code === 11000) return false;
        throw err;
    }
}

let lastCheck = 0;
/**
 * Emails the owner once a month when storage passes the alert level, and again at 90%.
 * Cheap and throttled (once an hour per server); call it after things that add data. Never throws.
 */
async function checkStorage(settings, { force = false } = {}) {
    try {
        if (!force && Date.now() - lastCheck < 60 * 60 * 1000) return null;
        lastCheck = Date.now();
        const u = await usage(settings);
        if (u.pct == null) return u;
        const month = new Date().toISOString().slice(0, 7);
        const level = [90, settings.storage?.alertAt ?? 70].filter((l) => l > 0 && u.pct >= l).sort((a, b) => b - a)[0];
        if (!level || !(await claim(`storage-${level}-${month}`)) || !canSendMail()) return u;
        const to = superadminEmails();
        if (to.length) {
            await sendMail({
                to: to.join(','),
                subject: `ResumeX: the database is ${Math.round(u.pct)}% full`,
                text: `The database uses ${(u.used / MB).toFixed(0)} MB of ${(u.quota / MB).toFixed(0)} MB (${u.pct}%). When it's full, saving stops working. Admin > Overview > Storage shows what uses the space and the biggest accounts.`,
            }).catch((err) => console.error('Storage alert email failed:', err.message));
        }
        return u;
    } catch (err) {
        console.error('Storage check failed:', err.message);
        return null;
    }
}

module.exports = { storageReport, checkStorage, usage, claim };
