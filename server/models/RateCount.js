const mongoose = require('mongoose');

/**
 * Shared rate-limit counters (lib/rateLimit.js, `shared: true`): one document per limit, key
 * and time window, so the limits that matter hold across server instances. Removed by the
 * database shortly after their window ends.
 */
const RateCountSchema = new mongoose.Schema({
    _id: { type: String },
    n: { type: Number, default: 0 },
    expireAt: { type: Date, index: { expires: 0 } },
});

module.exports = mongoose.model('RateCount', RateCountSchema);
