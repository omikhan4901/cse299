const mongoose = require('mongoose');

/**
 * One AI request, for the admin console's usage stats and AI economics. Kept 180 days.
 * Requests that failed after the model answered (e.g. an unreadable reply) are kept too,
 * with ok: false and no credits, because the tokens were still paid for.
 */
const AiEventSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    feature: { type: String, index: true },
    credits: { type: Number, default: 0 },
    ok: { type: Boolean, default: true },
    // What the model was paid for: input (prompt) and output (answer + thinking) tokens.
    model: String,
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    at: { type: Date, default: Date.now, index: { expires: 180 * 864e2 } },
});

module.exports = mongoose.model('AiEvent', AiEventSchema);
