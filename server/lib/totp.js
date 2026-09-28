const crypto = require('crypto');

/**
 * Time-based one-time passwords (RFC 6238), compatible with Google
 * Authenticator, Authy, 1Password, etc. 6 digits, 30-second steps, SHA-1.
 * Secrets are stored encrypted (AES-256-GCM) so a database leak alone
 * can't be used to generate codes.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

function base32Decode(str) {
    const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const out = [];
    for (const ch of clean) {
        value = (value << 5) | ALPHABET.indexOf(ch);
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

const STEP = 30;

function hotp(secret, counter) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    return String(code % 1e6).padStart(6, '0');
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));

/**
 * Checks a code, allowing one step of clock drift either way. Returns the
 * matching time step (so callers can refuse to accept it twice) or null.
 */
function verifyTotp(secret, code, { window = 1, now = Date.now() } = {}) {
    const clean = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return null;
    const current = Math.floor(now / 1000 / STEP);
    for (let i = -window; i <= window; i++) {
        const expected = hotp(secret, current + i);
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return current + i;
    }
    return null;
}

const otpauthUrl = (secret, account, issuer = 'ResumeX') =>
    `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;

// ---------- Encryption at rest ----------

// ENCRYPTION_KEY (32+ random characters) is preferred; without it a key is derived from JWT_SECRET.
// Decryption tries both, so adding ENCRYPTION_KEY later doesn't lock anyone out (don't change it once set).
const deriveKey = (material) => crypto.createHash('sha256').update(`resumex-2fa:${material}`).digest();
const keys = () => [process.env.ENCRYPTION_KEY, process.env.JWT_SECRET].filter(Boolean).map(deriveKey);

function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keys()[0], iv);
    const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload) {
    const [iv, tag, data] = String(payload).split('.').map((p) => Buffer.from(p, 'base64'));
    for (const key of keys()) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
        } catch {
            // try the next key
        }
    }
    throw new Error('Could not decrypt the two-factor secret (was ENCRYPTION_KEY changed?).');
}

// ---------- Recovery codes ----------

const hashCode = (code) => crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

/** Ten one-time recovery codes like "7KQ4-M2XP". Only their hashes are stored. */
function generateRecoveryCodes(n = 10) {
    return Array.from({ length: n }, () => {
        const raw = base32Encode(crypto.randomBytes(5)).slice(0, 8);
        return `${raw.slice(0, 4)}-${raw.slice(4)}`;
    });
}

module.exports = { generateSecret, verifyTotp, otpauthUrl, encrypt, decrypt, generateRecoveryCodes, hashCode, hotp };
