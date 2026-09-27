const Usage = require('../models/Usage');
const User = require('../models/User');

/**
 * Rate limiting.
 *
 * - `limit()` is a fixed-window counter kept in memory: cheap, and good enough
 *   for burst control (login attempts, requests per minute). With several server
 *   instances each keeps its own count.
 * - `aiQuota()` is the per-account daily AI allowance. It is stored in MongoDB,
 *   so it survives restarts and is shared by every instance.
 */

const buckets = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.reset <= now) buckets.delete(key);
}, 60 * 1000).unref();

const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

const retryIn = (seconds) =>
    seconds >= 3600 ? `${Math.ceil(seconds / 3600)} hour${seconds >= 7200 ? 's' : ''}`
    : seconds >= 60 ? `${Math.ceil(seconds / 60)} minute${seconds >= 120 ? 's' : ''}`
    : `${seconds} second${seconds === 1 ? '' : 's'}`;

/**
 * Express middleware allowing `max` requests per `windowMs` for each key.
 * `key(req)` returns the identity to count (user id, IP, email…) or null to skip.
 */
function limit({ name, windowMs, max, key, message }) {
    return (req, res, next) => {
        const id = key(req);
        if (!id) return next();
        const now = Date.now();
        const k = `${name}:${id}`;
        let b = buckets.get(k);
        if (!b || b.reset <= now) {
            b = { count: 0, reset: now + windowMs };
            buckets.set(k, b);
        }
        b.count += 1;
        if (b.count > max) {
            const seconds = Math.max(1, Math.ceil((b.reset - now) / 1000));
            res.set('Retry-After', String(seconds));
            return res.status(429).json({ success: false, error: `${message} Try again in ${retryIn(seconds)}.` });
        }
        next();
    };
}

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

// --- AI allowance per account ---

const AI_PER_MINUTE = () => num(process.env.AI_RATE_PER_MINUTE, 8);
const AI_DAILY_FREE = () => num(process.env.AI_DAILY_LIMIT, 40);
const AI_DAILY_PRO = () => num(process.env.AI_DAILY_LIMIT_PRO, 300);

const today = () => new Date().toISOString().slice(0, 10); // UTC day
const nextUtcMidnight = () => {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d;
};

const isPro = (user) => user?.plan === 'pro' && (!user.planExpiresAt || user.planExpiresAt > new Date());

async function dailyLimitFor(userId) {
    const user = await User.findById(userId).select('plan planExpiresAt').lean();
    return isPro(user) ? AI_DAILY_PRO() : AI_DAILY_FREE();
}

async function aiUsage(userId) {
    const [doc, max] = await Promise.all([Usage.findOne({ user: userId, day: today() }).lean(), dailyLimitFor(userId)]);
    const used = doc?.ai || 0;
    return { used, limit: max, remaining: Math.max(0, max - used), resetsAt: nextUtcMidnight().toISOString() };
}

const aiBurst = limit({
    name: 'ai-minute',
    windowMs: 60 * 1000,
    max: AI_PER_MINUTE(),
    key: (req) => req.userId,
    message: "You're sending AI requests very quickly.",
});

/**
 * Charges `cost` AI credits to the signed-in account for today, refusing the
 * request once the daily allowance is used up. Requests that end in an error
 * (bad input, AI provider down) are refunded, so only answers count.
 */
function aiQuota(cost = 1) {
    return [
        aiBurst,
        async (req, res, next) => {
            try {
                const max = await dailyLimitFor(req.userId);
                const day = today();
                let doc;
                try {
                    // Atomic: only increments while there is room; the upsert collides
                    // (duplicate key) when today's document exists but is full.
                    doc = await Usage.findOneAndUpdate(
                        { user: req.userId, day, ai: { $lte: max - cost } },
                        { $inc: { ai: cost }, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * 864e5) } },
                        { upsert: true, new: true }
                    );
                } catch (err) {
                    if (err.code !== 11000) throw err;
                    doc = null;
                }
                if (!doc) {
                    const seconds = Math.ceil((nextUtcMidnight() - Date.now()) / 1000);
                    res.set('Retry-After', String(seconds));
                    res.set('X-RateLimit-Limit', String(max));
                    res.set('X-RateLimit-Remaining', '0');
                    return res.status(429).json({
                        success: false,
                        error: `You've used all ${max} AI requests for today. Your allowance resets in ${retryIn(seconds)}.`,
                    });
                }
                res.set('X-RateLimit-Limit', String(max));
                res.set('X-RateLimit-Remaining', String(Math.max(0, max - doc.ai)));
                res.on('finish', () => {
                    if (res.statusCode >= 400) Usage.updateOne({ user: req.userId, day }, { $inc: { ai: -cost } }).catch(() => {});
                });
                next();
            } catch (err) {
                next(err);
            }
        },
    ];
}

module.exports = { limit, clientIp, aiQuota, aiUsage, isPro };
