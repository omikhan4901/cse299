/**
 * Everything stored for an account, in one place, so deleting and exporting an account
 * always cover every collection (add new per-user collections here).
 */
const Resume = require('../models/Resume');
const Usage = require('../models/Usage');
const AiEvent = require('../models/AiEvent');
const CareerProfile = require('../models/CareerProfile');
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const Reminder = require('../models/Reminder');
const BillingEvent = require('../models/BillingEvent');
const Feedback = require('../models/Feedback');

const PER_USER = [Resume, Usage, AiEvent, CareerProfile, Application, Reminder, BillingEvent, Feedback];

/** Deletes everything the account owns (not the User document itself). */
const deleteUserData = (userId) =>
    Promise.all([
        ...PER_USER.map((M) => M.deleteMany({ user: userId })),
        // Payments are financial records: kept for the accounts, but no longer linked to anyone.
        Payment.updateMany({ user: userId }, { $unset: { user: 1 } }),
    ]);

/** What the person can download about themselves. */
async function exportUserData(userId) {
    const [resumes, profile, applications, feedback] = await Promise.all([
        Resume.find({ user: userId }).select('-__v -user').lean(),
        CareerProfile.findOne({ user: userId }).select('-__v -user').lean(),
        Application.find({ user: userId }).select('-__v -user').lean(),
        Feedback.find({ user: userId }).select('-__v -user').lean(),
    ]);
    return { resumes, careerProfile: profile || null, applications, feedback };
}

module.exports = { deleteUserData, exportUserData, PER_USER };
