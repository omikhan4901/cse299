const mongoose = require('mongoose');

/**
 * A PDF downloaded with a paid template, reported by the builder. Used for the refund
 * check (a resume already downloaded can't be given back). Kept a year.
 */
const DownloadSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    template: { type: String, required: true },
    tier: { type: String, required: true },
    at: { type: Date, default: Date.now, index: { expires: 365 * 864e2 } },
});
DownloadSchema.index({ user: 1, at: -1 });

module.exports = mongoose.model('Download', DownloadSchema);
