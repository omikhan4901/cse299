
/**
 * Rate limiting.
 *
 * - `limit()` is a fixed-window counter kept in memory: cheap, and good enough
 *   for burst control (login attempts, requests per minute). With several server
 *   instances each keeps its own count.
 * The per-account AI credit allowance lives in lib/credits.js (stored in MongoDB).
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

module.exports = { limit, clientIp, retryIn };
