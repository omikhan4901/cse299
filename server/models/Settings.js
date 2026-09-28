const mongoose = require('mongoose');

/**
 * App-wide settings edited from the admin console (plans, prices, credit
 * costs, free mode…). Stored as a single document; see lib/settings.js for
 * the defaults and how partial updates are merged.
 */
const SettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'global', unique: true },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
        updatedBy: { type: String },
    },
    { timestamps: true, minimize: false }
);

module.exports = mongoose.model('Settings', SettingsSchema);
