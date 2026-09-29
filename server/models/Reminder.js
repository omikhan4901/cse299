const mongoose = require('mongoose');

/**
 * Reminder emails already sent (one per application, kind and date), so the scheduled job
 * can run as often as it likes without sending anything twice. Kept 60 days.
 */
const ReminderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    key: { type: String, required: true, unique: true },
    sentAt: { type: Date, default: Date.now, index: { expires: 60 * 864e2 } },
});

module.exports = mongoose.model('Reminder', ReminderSchema);
