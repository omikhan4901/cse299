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
    // Billing plan. "pro" raises limits (e.g. the daily AI allowance) until planExpiresAt.
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    planExpiresAt: { type: Date },
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
