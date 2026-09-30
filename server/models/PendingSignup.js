const mongoose = require('mongoose');

/**
 * A sign-up waiting for its email code (routes/auth.js). No account exists until the code is
 * entered, so an address nobody can read never becomes an account, takes a campaign place
 * or counts towards the sign-up cap. Deleted when used, and on its own after 30 minutes.
 */
const PendingSignupSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true }, // lower case
    typedEmail: { type: String }, // as the person typed it, for the account
    name: { type: String, maxlength: 200 },
    passwordHash: { type: String, select: false },
    campaignCode: { type: String },
    ref: { type: String },
    net: { type: String },
    codeHash: { type: String, select: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, index: { expires: 0 } },
});

module.exports = mongoose.model('PendingSignup', PendingSignupSchema);
