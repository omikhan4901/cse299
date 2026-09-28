const mongoose = require('mongoose');
const { contentFields } = require('./resumeContent');

/**
 * The Career Profile (V2): everything true about the person, one per account. Same content
 * shape as a resume, so the builder's editors, the ATS checks and "resume from profile"
 * work on it unchanged. Resumes made from it keep `profileItemId` on each item.
 * Never holds biodata (no NID, parents' names…): see docs/v2/SPEC.md §5.1.
 */
const CareerProfileSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        ...contentFields(),
        // Extra summaries for different kinds of jobs ("Academic", "Industry").
        summaries: [new mongoose.Schema({ id: Number, label: String, text: String }, { _id: false })],
        // The resume it was first made from, if any (for "Start from my master resume").
        createdFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
        rev: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CareerProfile', CareerProfileSchema);
