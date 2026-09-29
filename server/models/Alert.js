const mongoose = require('mongoose');

/**
 * Alerts already sent, so each goes out once however many servers notice the same thing.
 * The id says what and when ("storage-70-2026-09"); inserting it claims the alert.
 */
const AlertSchema = new mongoose.Schema({
    _id: { type: String },
    at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Alert', AlertSchema);
