const mongoose = require('mongoose');

/** One successful AI request, for the admin console's usage stats. Kept 180 days. */
const AiEventSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    feature: { type: String, index: true },
    credits: { type: Number, default: 0 },
    at: { type: Date, default: Date.now, index: { expires: 180 * 864e2 } },
});

module.exports = mongoose.model('AiEvent', AiEventSchema);
