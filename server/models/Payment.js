const mongoose = require('mongoose');

/**
 * A completed Paddle payment, for the admin Revenue and AI economics views. Amounts
 * are in the currency's smallest unit (cents), as Paddle sends them. `earnings` is what
 * reaches the seller after Paddle's fee and tax. Refunds are subtracted as they arrive.
 * Kept when an account is deleted, without the link to it (financial records).
 */
const PaymentSchema = new mongoose.Schema(
    {
        transactionId: { type: String, required: true, unique: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        currency: String,
        total: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        fee: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 },
        refunds: [{ _id: false, id: String, total: Number, earnings: Number, at: Date }],
        billedAt: { type: Date, index: true },
        // A Job Search Pass purchase, and whether its days were added (once, however often Paddle retries).
        kind: { type: String, enum: ['subscription', 'pass'], default: 'subscription' },
        // Where the money comes from (the admin Revenue view):
        type: { type: String, enum: ['new', 'renewal', 'change', 'pass', 'other'], default: 'other' }, // first purchase, renewal, plan change…
        subscriptionId: { type: String, index: true },
        priceId: String,
        plan: String, // pro | premium (from the price), or null for a price we don't sell
        interval: String, // month | year
        country: String, // the buyer's billing country (ISO code), from Paddle
        source: String, // the upgrade prompt that led to the checkout ("feature:polish", "pricing"…)
        campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }, // the campaign the account joined with
        passApplied: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', PaymentSchema);
