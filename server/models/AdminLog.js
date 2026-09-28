const mongoose = require('mongoose');

/** Audit trail of admin actions and security events. Kept for two years. */
const AdminLogSchema = new mongoose.Schema({
    at: { type: Date, default: Date.now, index: { expires: 2 * 365 * 864e2 } },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String },
    action: { type: String, index: true },
    target: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);
