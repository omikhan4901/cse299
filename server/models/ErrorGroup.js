const mongoose = require('mongoose');

/**
 * Errors seen in browsers and on the server (Admin › Errors), grouped by what they are (the
 * id is a fingerprint of kind, message and first stack line), with counts and when they were
 * first and last seen. No personal data: messages have emails and numbers masked, pages are
 * paths without their query string.
 */
const ErrorGroupSchema = new mongoose.Schema({
    _id: { type: String },
    kind: { type: String, enum: ['browser', 'server'] },
    message: { type: String, maxlength: 300 },
    where: { type: String, maxlength: 300 },
    stack: { type: String, maxlength: 2000 },
    count: { type: Number, default: 0 },
    // Counts per hour for the last day, to spot spikes: { "2026-09-30T04": 12 }.
    hours: { type: mongoose.Schema.Types.Mixed, default: {} },
    firstAt: { type: Date },
    lastAt: { type: Date, index: true },
    // Deleted 90 days after it last happened (the Privacy Policy says so).
    expireAt: { type: Date, index: { expires: 0 } },
    resolvedAt: { type: Date },
});

module.exports = mongoose.model('ErrorGroup', ErrorGroupSchema);
