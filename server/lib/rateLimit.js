
/**
 * Rate limiting.
 *
 * - `limit()` is a fixed-window counter kept in memory: cheap, and good enough
 *   for burst control (requests per minute). With several server instances each
 *   keeps its own count, so the limits that matter (sign-up, login, reset, codes,
 *   AI bursts) pass `shared: true` and count in the database instead (one small
 *   document per key and window), falling back to memory if the database is down.
 * - Every limit registers itself in a catalogue with a label and description, so
 *   the admin console can list them and change `max` / `windowMs` without a
 *   deploy (stored in the settings as `rateLimits`, applied through setOverrides).
 * The per-account AI credit allowance lives in lib/credits.js (stored in MongoDB).
 */

const buckets = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.reset <= now) buckets.delete(key);
}, 60 * 1000).unref();

const catalog = new Map();
let overrides = {};

/** Admin changes from the settings: { [name]: { max, windowMs } }. */
const setOverrides = (next) => {
    overrides = next && typeof next === 'object' ? next : {};
};

/** Every limit with its defaults, for the admin console. */
const describeLimits = () => [...catalog.values()];

const retryIn = (seconds) =>
    seconds >= 3600 ? `${Math.ceil(seconds / 3600)} hour${seconds >= 7200 ? 's' : ''}`
    : seconds >= 60 ? `${Math.ceil(seconds / 60)} minute${seconds >= 120 ? 's' : ''}`
    : `${seconds} second${seconds === 1 ? '' : 's'}`;

/**
 * Express middleware allowing `max` requests per `windowMs` for each key.
 * `key(req)` returns the identity to count (user id, IP, email…) or null to skip.
 * `label`, `group`, `scope` and `description` describe it in the admin console;
 * `min` is the lowest `max` an admin may set (so the console can't lock itself out).
 */
/** This instance's count for `k` in the current window: { count, reset }. */
function countInMemory(k, window, now) {
    let b = buckets.get(k);
    if (!b || b.reset <= now || b.reset - now > window) {
        b = { count: 0, reset: now + window };
        buckets.set(k, b);
    }
    b.count += 1;
    return b;
}

/** The count across every instance, from the database (fixed windows aligned to the clock). */
async function countShared(k, window, now) {
    const RateCount = require('../models/RateCount');
    const start = Math.floor(now / window) * window;
    const doc = await RateCount.findOneAndUpdate(
        { _id: `${k}:${start}` },
        { $inc: { n: 1 }, $setOnInsert: { expireAt: new Date(start + window + 60_000) } },
        { upsert: true, new: true }
    ).lean();
    return { count: doc.n, reset: start + window };
}

function limit({ name, windowMs, max, key, message, label, group = 'Other', scope = 'ip', description = '', min = 1, shared = false }) {
    if (!catalog.has(name)) catalog.set(name, { name, label: label || name, group, scope, description, windowMs, max, min, shared });
    return async (req, res, next) => {
        const id = key(req);
        if (!id) return next();
        const o = overrides[name];
        const window = o?.windowMs || windowMs;
        const allowed = Math.max(min, o?.max || max);
        const now = Date.now();
        const k = `${name}:${id}`;
        let b;
        if (shared) {
            // Two first requests racing to create the window's document: the loser just counts again.
            b = await countShared(k, window, now)
                .catch((err) => (err.code === 11000 ? countShared(k, window, now) : Promise.reject(err)))
                .catch(() => countInMemory(k, window, now));
        } else {
            b = countInMemory(k, window, now);
        }
        if (b.count > allowed) {
            const seconds = Math.max(1, Math.ceil((b.reset - now) / 1000));
            res.set('Retry-After', String(seconds));
            return res.status(429).json({ success: false, error: `${message} Try again in ${retryIn(seconds)}.` });
        }
        next();
    };
}

const crypto = require('crypto');

/**
 * The visitor's IP. Pages rendered by the Next.js server (share links, invite
 * pages) call the API from Vercel's IPs, so that server forwards the visitor's
 * IP in X-Client-IP together with the shared INTERNAL_API_KEY; only then is
 * the header trusted.
 */
function clientIp(req) {
    const key = process.env.INTERNAL_API_KEY;
    const sent = req.get?.('x-internal-key');
    if (key && sent && sent.length === key.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(key))) {
        const forwarded = String(req.get('x-client-ip') || '').split(',')[0].trim();
        if (forwarded) return `fwd:${forwarded}`;
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** Clears every counter (tests only). */
const resetLimits = async () => {
    buckets.clear();
    await require('../models/RateCount').deleteMany({}).catch(() => {});
};

module.exports = { limit, clientIp, retryIn, setOverrides, describeLimits, resetLimits };
