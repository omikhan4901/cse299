const mongoose = require('mongoose');

/** A Paddle customer, mirrored from Paddle's webhooks, and the account it belongs to. */
const PaddleCustomerSchema = new mongoose.Schema(
    {
        customerId: { type: String, required: true, unique: true }, // ctm_…
        email: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        eventAt: { type: Date, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('PaddleCustomer', PaddleCustomerSchema);
