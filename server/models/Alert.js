const mongoose = require('mongoose');

/**
 * Alerts for the owner (lib/alerts.js): each is claimed once by its id, which says what and
 * when ("storage-70-2026-09"), however many servers notice the same thing; the admin console
 * lists them under the bell.
 */
const AlertSchema = new mongoose.Schema({
    _id: { type: String },
    kind: { type: String },
    text: { type: String },
    at: { type: Date, default: Date.now, index: { expires: 180 * 864e2 } },
});

module.exports = mongoose.model('Alert', AlertSchema);
