const AdminLog = require('../models/AdminLog');

const SECRET_KEYS = /password|secret|token|code/i;
const scrub = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(scrub);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '[hidden]' : scrub(v)]));
};

/** Records an admin action or security event. Never throws; secrets are masked. */
function audit(req, action, target, details) {
    AdminLog.create({
        actor: req.userId,
        actorEmail: req.adminEmail || req.actorEmail,
        action,
        target: target == null ? undefined : String(target),
        details: scrub(details),
        ip: req.ip,
    }).catch((err) => console.error('Audit log failed:', err.message));
}

module.exports = { audit };
