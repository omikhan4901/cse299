const mongoose = require('mongoose');

/**
 * A job someone is applying to (V2 tracker, docs/v2/SPEC.md §5.4). Statuses move
 * saved → preparing → applied → interviewing → offer, or end as rejected, withdrawn or
 * noResponse; each change is recorded. When it's marked applied, the resume it was sent
 * with is frozen in `snapshot`, so the history stays true whatever happens to the resume.
 */
const STATUSES = ['saved', 'preparing', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'noResponse'];
// Still in progress (these count towards a plan's "active applications" limit).
const ACTIVE = ['saved', 'preparing', 'applied', 'interviewing'];

const str = (max) => ({ type: String, default: '', maxlength: max, trim: true });

const ApplicationSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        job: {
            title: str(200),
            organisation: str(200),
            url: str(1000),
            description: { type: String, default: '', maxlength: 30000 },
            keywords: { type: [String], default: undefined },
            deadline: { type: Date },
            location: str(120),
            jobType: str(40),
            salary: str(120),
            applyVia: { type: [String], default: undefined },
            email: str(200),
        },
        status: { type: String, enum: STATUSES, default: 'saved', index: true },
        statusHistory: [{ _id: false, status: { type: String, enum: STATUSES }, at: Date }],
        appliedAt: Date,
        followUpAt: Date,
        interviews: [{ _id: false, id: Number, at: Date, kind: str(80), notes: str(2000) }],
        // The resume prepared for it, and the exact copy sent (frozen when marked applied).
        resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
        snapshot: {
            content: mongoose.Schema.Types.Mixed,
            nickname: String,
            template: String,
            theme: mongoose.Schema.Types.Mixed,
            at: Date,
        },
        coverLetter: { text: { type: String, default: '', maxlength: 20000 }, at: Date },
        contacts: [{ _id: false, id: Number, name: str(120), role: str(120), email: str(200), phone: str(60), notes: str(1000) }],
        links: [{ _id: false, id: Number, label: str(120), url: str(1000) }],
        // Checklist items ticked by hand: { [key]: when }.
        checklist: { type: Map, of: Date, default: undefined },
        notes: { type: String, default: '', maxlength: 5000 },
        archived: { type: Boolean, default: false },
        rev: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const Application = mongoose.model('Application', ApplicationSchema);
module.exports = Application;
module.exports.STATUSES = STATUSES;
module.exports.ACTIVE = ACTIVE;
