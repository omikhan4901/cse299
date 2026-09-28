
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

module.exports = { limit, clientIp, retryIn };
