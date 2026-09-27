const mongoose = require('mongoose');

/** Per-account usage counters, one document per user per UTC day. */
const UsageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // YYYY-MM-DD (UTC)
    ai: { type: Number, default: 0 },
    // Old counters are removed automatically a few days later.
    expiresAt: { type: Date, index: { expires: 0 } },
});

UsageSchema.index({ user: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('Usage', UsageSchema);
