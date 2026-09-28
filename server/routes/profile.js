const express = require('express');
const mongoose = require('mongoose');
const CareerProfile = require('../models/CareerProfile');
const Resume = require('../models/Resume');
const { protect } = require('./auth');
const { limit } = require('../lib/rateLimit');
const { requireV2 } = require('../lib/v2');
const { CONTENT_KEYS, pick } = require('../lib/resumeInput');

/**
 * The Career Profile (V2, docs/v2/SPEC.md §5.1): one per account, saved with the same
 * revision check as resumes, so another tab's newer save is never overwritten silently.
 */
const router = express.Router();

const perAccount = limit({ name: 'profile', windowMs: 60 * 1000, max: 120, key: (req) => req.userId, message: 'Too many requests.', label: 'Career Profile requests', group: 'Career Profile', scope: 'account', description: 'Opening and autosaving the Career Profile.' });

router.use(protect, perAccount, requireV2);

const MAX_ITEMS = 200; // per section: far more than anyone needs, stops runaway documents
const LISTS = ['experience', 'education', 'projects', 'certifications', 'volunteering', 'awards', 'publications', 'courses', 'references', 'links', 'customSections'];

/** The editable content, validated. Returns { data } or { error }. */
function readBody(body) {
    const data = pick(body, CONTENT_KEYS);
    for (const key of LISTS) {
        if (data[key] === undefined) continue;
        if (!Array.isArray(data[key])) return { error: `${key} must be a list.` };
        if (data[key].length > MAX_ITEMS) return { error: `You can keep up to ${MAX_ITEMS} entries in ${key}.` };
    }
    if (body.summaries !== undefined) {
        if (!Array.isArray(body.summaries) || body.summaries.length > 10) return { error: 'You can keep up to 10 summaries.' };
        data.summaries = body.summaries
            .filter((s) => s && typeof s === 'object')
            .map((s) => ({ id: Number.isFinite(Number(s.id)) ? Number(s.id) : Date.now(), label: String(s.label || '').trim().slice(0, 40), text: String(s.text || '').slice(0, 3000) }));
    }
    return { data };
}

const conflict = (res, profile) => res.status(409).json({ success: false, code: 'conflict', error: 'Your profile was changed in another tab or device.', data: profile });

// @route GET /api/profile — the account's Career Profile (null until it's created)
router.get('/', async (req, res, next) => {
    try {
        res.json({ success: true, data: await CareerProfile.findOne({ user: req.userId }).lean() });
    } catch (err) {
        next(err);
    }
});

// @route PUT /api/profile — create or save it. Send `baseRev` (the rev you loaded; 0 or none
// when creating). `createdFrom` (a resume id) is only read when creating.
router.put('/', async (req, res, next) => {
    try {
        const { data, error } = readBody(req.body || {});
        if (error) return res.status(400).json({ success: false, error });
        const baseRev = req.body?.baseRev;
        const existing = await CareerProfile.findOne({ user: req.userId });
        if (!existing) {
            if (Number.isInteger(baseRev) && baseRev > 0) return res.status(409).json({ success: false, code: 'conflict', error: 'Your profile was deleted in another tab or device.', data: null });
            const from = req.body?.createdFrom;
            if (from && mongoose.isValidObjectId(from) && (await Resume.exists({ _id: from, user: req.userId }))) data.createdFrom = from;
            try {
                const created = await CareerProfile.create({ ...data, user: req.userId, rev: 1 });
                return res.status(201).json({ success: true, data: created });
            } catch (err) {
                // Two tabs creating it at once: the other one won.
                if (err.code === 11000) return conflict(res, await CareerProfile.findOne({ user: req.userId }).lean());
                throw err;
            }
        }
        const rev = existing.rev || 0;
        if (baseRev !== undefined && baseRev !== rev) return conflict(res, existing);
        existing.set(data);
        existing.rev = rev + 1;
        existing.$where = { rev };
        try {
            await existing.save();
        } catch (err) {
            if (err.name === 'DocumentNotFoundError') return conflict(res, await CareerProfile.findOne({ user: req.userId }).lean());
            throw err;
        }
        res.json({ success: true, data: existing });
    } catch (err) {
        if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ success: false, error: 'Some profile details are in the wrong format.' });
        next(err);
    }
});

// @route DELETE /api/profile — start over (resumes made from it keep their content)
router.delete('/', async (req, res, next) => {
    try {
        await CareerProfile.deleteOne({ user: req.userId });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
