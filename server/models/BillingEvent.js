const mongoose = require('mongoose');

/**
 * Steps towards paying, for the admin Revenue funnel: an upgrade prompt was shown, or a
 * checkout was opened, and from where ("feature:polish", "limit:applications", "pricing"…).
 * No content, just the step. Kept for about 13 months.
 */
const BillingEventSchema = new mongoose.Schema({
    kind: { type: String, enum: ['prompt', 'checkout'], required: true },
    source: { type: String, required: true, maxlength: 60 },
    plan: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    at: { type: Date, default: Date.now, index: { expires: 400 * 86400 } },
});

module.exports = mongoose.model('BillingEvent', BillingEventSchema);
