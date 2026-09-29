/**
 * The network an address belongs to (IPv4 /24, IPv6 /48), as a salted hash: enough to see
 * several sign-ups coming from one place (Admin › Sign-ups, farm alerts) without keeping
 * anyone's IP address.
 */
const crypto = require('crypto');

function networkPrefix(ip) {
    const s = String(ip || '').replace(/^::ffff:/, '');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return s.split('.').slice(0, 3).join('.');
    if (s.includes(':')) {
        // Expand "::" so the first three groups are real groups.
        const [head, tail = ''] = s.split('::');
        const h = head ? head.split(':') : [];
        const t = tail ? tail.split(':') : [];
        const groups = s.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
        return groups.slice(0, 3).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':');
    }
    return '';
}

/** A short hash of the address's network, or '' when there's no address. */
function networkOf(ip) {
    const prefix = networkPrefix(ip);
    if (!prefix) return '';
    return crypto.createHmac('sha256', `${process.env.JWT_SECRET || ''}:network`).update(prefix).digest('hex').slice(0, 16);
}

/** A marketing tag from a link (?ref= or utm_source), kept short and plain. */
const cleanRef = (v) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) : '');

module.exports = { networkOf, networkPrefix, cleanRef };
