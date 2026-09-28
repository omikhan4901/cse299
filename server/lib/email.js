/**
 * Email helpers shared by sign-up, login, password reset and the admin console.
 */

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// No spaces or control characters (MongoDB rejects a regex with a null byte in it).
const EMAIL_RE = /^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]{2,}$/;

/** The trimmed email if it looks like one (a string of sane length), else null. */
const validEmail = (email) => (typeof email === 'string' && email.trim().length <= 254 && EMAIL_RE.test(email.trim()) ? email.trim() : null);

/**
 * Matches an email case-insensitively, so accounts created before emails were
 * lowercased are still found. Only call it with a validEmail() result.
 */
const emailQuery = (email) => new RegExp(`^${escapeRe(String(email).trim())}$`, 'i');

/** Text safe to put in a search regex: a string with control characters removed. */
const searchText = (q) => (typeof q === 'string' ? q.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 200) : '');

module.exports = { escapeRe, validEmail, emailQuery, searchText };
