const AdminLog = require('../models/AdminLog');

const SECRET_KEYS = /password|secret|token|code/i;
const scrub = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(scrub);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '[hidden]' : scrub(v)]));
};

/** Records an admin action or security event. Never throws; secrets are masked. */
// Awaited by callers, so the entry is written before the response goes out (on Cloud Run,
// work left running after a response can be paused, or lost when the instance stops).
// A failed write is logged, never thrown.
function audit(req, action, target, details) {
    return AdminLog.create({
        actor: req.userId,
        actorEmail: req.adminEmail || req.actorEmail,
        action,
        target: target == null ? undefined : String(target),
        details: scrub(details),
        ip: req.ip,
    }).catch((err) => console.error('Audit log failed:', err.message));
}

module.exports = { audit };
