const mongoose = require('mongoose');

/**
 * Feedback from the beta (Admin › Feedback): what someone wrote, on which page, an optional
 * screenshot (a small JPEG), and what the admin did with it (seen, fixed, a reply by email).
 */
const FeedbackSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        email: { type: String, maxlength: 200 },
        name: { type: String, maxlength: 120 },
        message: { type: String, required: true, maxlength: 2000 },
        page: { type: String, maxlength: 300 },
        screenshot: { type: String },
        status: { type: String, enum: ['new', 'seen', 'fixed'], default: 'new', index: true },
        replies: [{ _id: false, text: { type: String, maxlength: 4000 }, at: Date, by: String }],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Feedback', FeedbackSchema);
