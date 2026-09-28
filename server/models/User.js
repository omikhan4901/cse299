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
    // Custom AI credit allowance (set by an admin or a campaign); null uses the plan's.
    creditLimit: { type: Number, default: null, min: 0 },
    creditPeriod: { type: String, enum: ['day', 'month', null], default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    banned: { type: Boolean, default: false },
    bannedReason: { type: String, default: '' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    lastLoginAt: { type: Date },
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
