const mongoose = require('mongoose');

/**
 * What the AI has cost this month, in millionths of a US dollar (lib/aiSpend.js): one
 * document per month (its id is the month, "2026-09"), added to after every AI call, so the spending cap holds
 * across server instances and restarts. `alerts` lists the thresholds already emailed.
 */
// The month is the id, which the database always keeps unique (a separate unique index may
// not exist yet on a fresh database when the first calls of a month race to create it).
const AiSpendSchema = new mongoose.Schema({
    _id: { type: String },
    micros: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
    alerts: { type: [Number], default: [] },
});

module.exports = mongoose.model('AiSpend', AiSpendSchema);
