const express = require('express');
const crypto = require('node:crypto');
const { runReminders } = require('../lib/reminders');
const { endExpiredGrants } = require('../lib/campaignEnd');

/**
 * Jobs run by Cloud Scheduler (not by people). Every request must carry the shared
 * INTERNAL_API_KEY in X-Internal-Key; without the key set, these routes are off.
 *   POST /api/internal/reminders        every few hours: deadline and interview reminders
 *   POST /api/internal/reminders {"digest": true}   weekly: the digest too
 */
const router = express.Router();

router.use((req, res, next) => {
    const key = process.env.INTERNAL_API_KEY;
    const given = String(req.get('x-internal-key') || '');
    const ok = !!key && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
    if (!ok) return res.status(404).json({ success: false, error: 'Not found.' });
    next();
});

router.post('/reminders', async (req, res, next) => {
    try {
        // The same scheduled call tidies accounts whose campaign or admin grants have ended.
        const ended = await endExpiredGrants();
        res.json({ success: true, data: { ...(await runReminders({ digest: req.body?.digest === true })), ended } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
