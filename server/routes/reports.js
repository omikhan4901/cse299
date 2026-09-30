/**
 * What people send us about the product (docs/v2/BETA-PLAN.md, Phase 6):
 *   POST /api/reports/feedback  a message from the Beta menu, with the page and an optional
 *                               screenshot (signed in or not); listed in Admin › Feedback
 *   POST /api/reports/error     an error the site hit in the browser, grouped in Admin › Errors
 * Both are rate limited per account (or per network when signed out).
 */
const express = require('express');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const { limit, clientIp } = require('../lib/rateLimit');
const { validEmail } = require('../lib/email');
const { recordError, pathOnly } = require('../lib/errors');
const { raise } = require('../lib/alerts');
const { getSettings } = require('../lib/settings');

const router = express.Router();
const who = (req) => (req.accountKey ? `u:${req.accountKey}` : clientIp(req));
const SCREENSHOT = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_SCREENSHOT = 400 * 1024;

router.post(
    '/feedback',
    limit({ name: 'feedback', windowMs: 60 * 60 * 1000, max: 10, key: who, message: "Thanks, we've got a lot from you already.", label: 'Feedback messages', group: 'Feedback & errors', scope: 'account', description: 'Messages sent from the Beta menu, per account (or network when signed out).' }),
    async (req, res, next) => {
        try {
            const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
            if (message.length < 3) return res.status(400).json({ success: false, error: 'Please write a few words.' });
            if (message.length > 2000) return res.status(400).json({ success: false, error: 'Please keep it under 2,000 characters.' });
            const shot = req.body?.screenshot;
            if (shot != null && shot !== '' && (typeof shot !== 'string' || shot.length > MAX_SCREENSHOT || !SCREENSHOT.test(shot))) {
                return res.status(400).json({ success: false, error: 'That screenshot is too large or not an image.' });
            }
            const user = req.accountKey ? await User.findById(req.accountKey).select('name email').lean() : null;
            const email = user?.email || (validEmail(req.body?.email) ? validEmail(req.body.email).toLowerCase() : undefined);
            const fb = await Feedback.create({ user: user?._id, email, name: user?.name, message, page: pathOnly(req.body?.page), screenshot: shot || undefined });
            raise(`feedback-${fb._id}`, { kind: 'feedback', email: false, text: `New feedback${user ? ` from ${user.name}` : ''}: "${message.slice(0, 140)}${message.length > 140 ? '…' : ''}"` });
            res.status(201).json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/error',
    limit({ name: 'error-report', windowMs: 60 * 1000, max: 30, key: who, message: 'Too many error reports.', label: 'Error reports from browsers', group: 'Feedback & errors', description: 'Errors the site reports from a browser, per account (or network).' }),
    async (req, res) => {
        const b = req.body || {};
        if (typeof b.message !== 'string' || !b.message.trim()) return res.status(400).json({ success: false, error: 'No error given.' });
        await recordError({ kind: 'browser', message: b.message, where: typeof b.page === 'string' ? b.page : '', stack: typeof b.stack === 'string' ? b.stack : '' }, await getSettings());
        res.status(204).end();
    }
);

module.exports = router;
