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
        // Goes up by one on every save, so a save from an out-of-date admin page is refused.
        rev: { type: Number, default: 0 },
    },
    { timestamps: true, minimize: false }
);

module.exports = mongoose.model('Settings', SettingsSchema);
