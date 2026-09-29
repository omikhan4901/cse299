const mongoose = require('mongoose');

/**
 * A completed Paddle payment, for the AI economics view (revenue per paying user). Amounts
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
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', PaymentSchema);
