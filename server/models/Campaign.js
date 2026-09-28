const mongoose = require('mongoose');

/**
 * A sign-up campaign (e.g. a student cohort). People who register with the
 * code get the campaign's plan and credit allowance for `durationDays`.
 */
const CampaignSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: [/^[A-Z0-9_-]{3,32}$/, 'Codes use 3–32 letters, numbers, - or _'] },
        description: { type: String, trim: true, maxlength: 500, default: '' },
        plan: { type: String, default: 'free' },
        // Credit allowance for campaign members; null keeps the plan's own allowance.
        creditLimit: { type: Number, default: null, min: 0 },
        creditPeriod: { type: String, enum: ['day', 'month', null], default: null },
        durationDays: { type: Number, default: 30, min: 1 },
        maxUses: { type: Number, default: 50, min: 1 },
        uses: { type: Number, default: 0 },
        // Optional: only emails ending in this domain can use the code (e.g. northsouth.edu).
        emailDomain: { type: String, trim: true, lowercase: true, default: '' },
        expiresAt: { type: Date, default: null },
        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Campaign', CampaignSchema);
