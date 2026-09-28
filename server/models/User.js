const mongoose = require('mongoose');

// Define the User Schema
const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true, // Email must be unique
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please add a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,  
        select: false  
    },
    // Plan tier (ids from the admin settings: free | pro | premium). Paid plans end at planExpiresAt (null = no end).
    plan: { type: String, enum: ['free', 'pro', 'premium'], default: 'free' },
    planExpiresAt: { type: Date },
    // "paddle" while the plan comes from a Paddle subscription (so ending it only undoes that).
    planSource: { type: String },
    paddleCustomerId: { type: String, index: true, sparse: true },
    // Payments and refunds (from Paddle's webhooks), for the refund check in the admin console.
    firstPaidAt: { type: Date },
    lastPaidAt: { type: Date },
    refundIds: { type: [String], default: undefined }, // Paddle adjustment ids of full refunds
    chargebackIds: { type: [String], default: undefined },
    // Custom AI credit allowance (set by an admin or a campaign); null uses the plan's.
    creditLimit: { type: Number, default: null, min: 0 },
    creditPeriod: { type: String, enum: ['day', 'month', null], default: null },
    // When the custom allowance ends (campaign allowances last `durationDays`); empty = no end.
    creditLimitExpiresAt: { type: Date },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    // Sees V2 (Career Profile, applications) before it's switched on for everyone.
    v2Preview: { type: Boolean, default: false },
    banned: { type: Boolean, default: false },
    bannedReason: { type: String, default: '' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    lastLoginAt: { type: Date },
    // Set once the owner proves they receive email at this address (required for super admins).
    emailVerifiedAt: { type: Date },
    emailCode: { type: String, select: false },
    emailCodeExpires: { type: Date, select: false },
    emailCodeAttempts: { type: Number, default: 0, select: false },
    // Two-factor authentication (TOTP). Secrets are AES-GCM encrypted; recovery codes are hashed.
    twoFactor: {
        enabled: { type: Boolean, default: false },
        secret: { type: String, select: false },
        pendingSecret: { type: String, select: false },
        lastStep: { type: Number, default: 0, select: false },
        recoveryCodes: { type: [String], default: undefined, select: false },
        enabledAt: { type: Date },
    },
    // Bumped on password change/reset; tokens carrying an older version stop working.
    sessionVersion: { type: Number, default: 0 },
    passwordChangedAt: { type: Date },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Export the model
module.exports = mongoose.model('User', UserSchema);
