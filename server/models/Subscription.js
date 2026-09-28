const mongoose = require('mongoose');

/**
 * A Paddle subscription, mirrored from Paddle's webhooks (lib/paddleEvents.js).
 * Paddle is the source of truth; this copy decides the account's plan.
 */
const SubscriptionSchema = new mongoose.Schema(
    {
        subscriptionId: { type: String, required: true, unique: true }, // sub_…
        customerId: { type: String, required: true, index: true }, // ctm_…
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        status: { type: String, required: true }, // active | trialing | past_due | paused | canceled
        priceId: { type: String, required: true },
        productId: { type: String },
        plan: { type: String, enum: ['pro', 'premium', null], default: null }, // null: a price we don't sell
        interval: { type: String },
        currentPeriodEnd: { type: Date },
        scheduledChange: { action: String, effectiveAt: Date },
        // When the event this copy came from happened: older deliveries are ignored.
        eventAt: { type: Date, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Subscription', SubscriptionSchema);
