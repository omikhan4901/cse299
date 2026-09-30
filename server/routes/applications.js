const express = require('express');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const Resume = require('../models/Resume');
const { protect } = require('./auth');
const { limit } = require('../lib/rateLimit');
const { requireV2, requireFeature } = require('../lib/v2');
const { roomForResumes } = require('../lib/resumeLimit');
const { lockedByUser } = require('../lib/userLock');
const { planLimit } = require('../lib/credits');
const { fetchPageText, FetchError } = require('../lib/safeFetch');
const { CONTENT_KEYS, pick } = require('../lib/resumeInput');
const { templateAllowed } = require('../lib/templates');
const { STATUSES, ACTIVE } = Application;

/**
 * The job tracker (V2, docs/v2/SPEC.md §5.4). Saves use the same revision check as
 * resumes. A plan can limit how many applications are active at once (admin setting).
 */
const router = express.Router();

const perAccount = limit({ name: 'applications', windowMs: 60 * 1000, max: 120, key: (req) => req.userId, message: 'Too many requests.', label: 'Application requests', group: 'Applications', scope: 'account', description: 'Opening, adding and saving tracked applications.' });
const fetchByUser = limit({ name: 'job-fetch', windowMs: 60 * 60 * 1000, max: 30, key: (req) => req.userId, message: "You've read a lot of job links. Paste the job text instead for now.", label: 'Job links read', group: 'Applications', scope: 'account', description: 'Job pages fetched from a link people paste (the server opens the page).' });

router.use(protect, perAccount, requireV2, requireFeature('applications', 'Applications'));

const MAX_APPLICATIONS = 500;
const APPLY_VIA = ['teletalk', 'bdjobs', 'email', 'post', 'online'];
const isActive = (a) => !a.archived && ACTIVE.includes(a.status);

const s = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const date = (v) => {
    if (v === null || v === '') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getFullYear() > 2100 ? undefined : d;
};
const safeUrl = (v) => {
    const u = s(v, 1000);
    return /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(u) && !/^(javascript|data|vbscript):/i.test(u) ? u : '';
};
const list = (v, max, map) => (Array.isArray(v) ? v.slice(0, max).filter((x) => x && typeof x === 'object').map(map) : undefined);
const idOf = (x) => (Number.isFinite(Number(x.id)) ? Number(x.id) : Date.now() + Math.floor(Math.random() * 1000));

/** The editable fields, cleaned. Returns { data } or { error }. */
function readBody(body = {}) {
    const data = {};
    if (body.job !== undefined) {
        // Only the job fields sent are changed (a save of the title keeps the description).
        const j = body.job && typeof body.job === 'object' ? body.job : {};
        const clean = {
            title: () => s(j.title, 200), organisation: () => s(j.organisation, 200), url: () => safeUrl(j.url), description: () => s(j.description, 30000),
            keywords: () => (Array.isArray(j.keywords) ? j.keywords.map((k) => s(k, 60)).filter(Boolean).slice(0, 50) : []),
            location: () => s(j.location, 120), jobType: () => s(j.jobType, 40), salary: () => s(j.salary, 120), email: () => s(j.email, 200),
            applyVia: () => (Array.isArray(j.applyVia) ? [...new Set(j.applyVia.filter((x) => APPLY_VIA.includes(x)))] : []),
        };
        data.job = Object.fromEntries(Object.keys(clean).filter((k) => j[k] !== undefined).map((k) => [k, clean[k]()]));
        if (j.deadline !== undefined) {
            const d = date(j.deadline);
            if (d === undefined) return { error: "That deadline isn't a valid date." };
            data.job.deadline = d;
        }
    }
    if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return { error: 'Unknown status.' };
        data.status = body.status;
    }
    if (body.followUpAt !== undefined) {
        const d = date(body.followUpAt);
        if (d === undefined) return { error: "That follow-up date isn't valid." };
        data.followUpAt = d;
    }
    const interviews = list(body.interviews, 20, (x) => ({ id: idOf(x), at: date(x.at) || undefined, kind: s(x.kind, 80), notes: s(x.notes, 2000) }));
    if (interviews) data.interviews = interviews;
    const contacts = list(body.contacts, 20, (x) => ({ id: idOf(x), name: s(x.name, 120), role: s(x.role, 120), email: s(x.email, 200), phone: s(x.phone, 60), notes: s(x.notes, 1000) }));
    if (contacts) data.contacts = contacts;
    const links = list(body.links, 20, (x) => ({ id: idOf(x), label: s(x.label, 120), url: safeUrl(x.url) }));
    if (links) data.links = links;
    if (body.checklist !== undefined) {
        if (!body.checklist || typeof body.checklist !== 'object' || Array.isArray(body.checklist)) return { error: 'Checklist must be an object.' };
        data.checklist = Object.entries(body.checklist)
            .filter(([k]) => /^[a-zA-Z]{1,40}$/.test(k))
            .slice(0, 30);
    }
    if (body.notes !== undefined) data.notes = s(body.notes, 5000);
    if (body.archived !== undefined) data.archived = body.archived === true;
    if (body.coverLetter !== undefined) data.coverLetter = { text: s(body.coverLetter?.text, 20000), at: new Date() };
    if (body.resume !== undefined) {
        if (body.resume !== null && !mongoose.isValidObjectId(body.resume)) return { error: 'Resume not found.' };
        data.resume = body.resume;
    }
    return { data };
}

/** Refuses one more active application when the plan's limit is reached. */
async function underLimit(req, res, { except } = {}) {
    const max = planLimit(req.account, req.settings, 'applications');
    if (max === null) return true;
    const active = await Application.countDocuments({ user: req.userId, archived: { $ne: true }, status: { $in: ACTIVE }, ...(except ? { _id: { $ne: except } } : {}) });
    if (active < max) return true;
    const better = req.settings.plans.find((p) => p.id !== req.account.plan && (p.limits?.applications === null || p.limits?.applications > max));
    res.status(403).json({ success: false, code: 'upgrade', feature: 'applications', error: `Your plan tracks up to ${max} active application${max === 1 ? '' : 's'}. Archive or close one, or upgrade${better ? ` to ${better.name}` : ''} for more.` });
    return false;
}

/** The resume's content as it is now, frozen onto the application. */
async function snapshotOf(userId, resumeId) {
    const r = await Resume.findOne({ _id: resumeId, user: userId }).lean();
    if (!r) return null;
    const { _id, user, shortId, isPublic, isMaster, rev, createdAt, updatedAt, __v, template, theme, nickname, ...content } = r;
    // The cropped photo is what was sent; the original it was cut from isn't needed (storage).
    if (content.personal) content.personal = { ...content.personal, profilePicSource: undefined, photoCrop: undefined };
    return { content, nickname, template, theme, at: new Date() };
}

async function findOwned(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(404).json({ success: false, error: 'Application not found.' });
        return null;
    }
    const app = await Application.findOne({ _id: req.params.id, user: req.userId });
    if (!app) res.status(404).json({ success: false, error: 'Application not found.' });
    return app;
}

const conflict = (res, app) => res.status(409).json({ success: false, code: 'conflict', error: 'This application was changed in another tab or device.', data: app });
const invalid = (res, err, next) => (err.name === 'ValidationError' || err.name === 'CastError' ? res.status(400).json({ success: false, error: 'Some details are in the wrong format.' }) : next(err));

// @route GET /api/applications — all of them, without the heavy parts
router.get('/', async (req, res, next) => {
    try {
        const data = await Application.find({ user: req.userId }).select('-snapshot.content -coverLetter.text -prepAi.data').sort({ updatedAt: -1 }).lean();
        // Just whether there is a job text (the text itself is only sent with one application).
        for (const a of data) {
            a.job = { ...a.job, hasDescription: !!a.job?.description?.trim() };
            delete a.job.description;
        }
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/applications/fetch — the text of a job page, for capture in the browser
router.post('/fetch', fetchByUser, async (req, res, next) => {
    try {
        res.json({ success: true, data: await fetchPageText(req.body?.url) });
    } catch (err) {
        if (err instanceof FetchError) return res.status(400).json({ success: false, code: err.code, error: err.message });
        next(err);
    }
});

// @route POST /api/applications/tailored — create tailored resumes (made in the browser from
// the profile, lib/tailor.js), one per application, and link each to its application.
// Body: { items: [{ application, nickname, template, content }] }. Plan limits: how many
// tailored resumes in all, and how many in one go (batch).
router.post('/tailored', async (req, res, next) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (!items.length || items.length > 30) return res.status(400).json({ success: false, error: 'Choose between 1 and 30 jobs.' });
        const upgrade = (feature, error) => res.status(403).json({ success: false, code: 'upgrade', feature, error });
        if (items.length > 1) {
            const batch = planLimit(req.account, req.settings, 'batch');
            if (batch !== null && items.length > batch) return upgrade('batch', batch ? `Your plan tailors up to ${batch} jobs at once.` : 'Tailoring several jobs at once is part of a paid plan.');
        }
        const max = planLimit(req.account, req.settings, 'tailored');
        if (max !== null) {
            const have = await Resume.countDocuments({ user: req.userId, tailoredFor: { $exists: true } });
            if (have + items.length > max) return upgrade('tailored', `Your plan includes ${max} tailored resume${max === 1 ? '' : 's'}${have ? ` and you've made ${have}` : ''}. Upgrade for more.`);
        }
        const ids = items.map((i) => i?.application);
        if (!ids.every((id) => mongoose.isValidObjectId(id))) return res.status(400).json({ success: false, error: 'Application not found.' });
        const apps = await Application.find({ _id: { $in: ids }, user: req.userId });
        if (apps.length !== new Set(ids.map(String)).size) return res.status(400).json({ success: false, error: 'Application not found.' });
        if (!(await roomForResumes(req, res, items.length))) return;

        const created = [];
        for (const item of items) {
            const content = pick(item.content || {}, CONTENT_KEYS);
            const template = typeof item.template === 'string' && templateAllowed(req.account, req.settings, item.template) ? item.template : undefined;
            const resume = await Resume.create({ ...content, nickname: s(item.nickname, 120) || 'Tailored resume', ...(template ? { template } : {}), tailoredFor: item.application, user: req.userId });
            const app = apps.find((a) => String(a._id) === String(item.application));
            app.resume = resume._id;
            app.rev = (app.rev || 0) + 1;
            await app.save();
            created.push({ application: app._id, resume: resume._id, rev: app.rev });
        }
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        invalid(res, err, next);
    }
});

// @route POST /api/applications — track a new one
router.post('/', lockedByUser(async (req, res, next) => {
    try {
        const { data, error } = readBody(req.body);
        if (error) return res.status(400).json({ success: false, error });
        if (!data.job?.title && !data.job?.organisation) return res.status(400).json({ success: false, error: 'Add at least the job title or the organisation.' });
        if ((await Application.countDocuments({ user: req.userId })) >= MAX_APPLICATIONS) return res.status(400).json({ success: false, error: `You can keep up to ${MAX_APPLICATIONS} applications. Delete some old ones to make room.` });
        const status = data.status || 'saved';
        if (ACTIVE.includes(status) && !data.archived && !(await underLimit(req, res))) return;
        if (data.resume && !(await Resume.exists({ _id: data.resume, user: req.userId }))) return res.status(400).json({ success: false, error: 'Resume not found.' });
        const now = new Date();
        const app = new Application({ ...data, checklist: Object.fromEntries((data.checklist || []).filter(([, v]) => v).map(([k]) => [k, now])), user: req.userId, status, statusHistory: [{ status, at: now }], rev: 1 });
        if (['applied', 'interviewing', 'offer'].includes(status)) app.appliedAt = now;
        if (status === 'applied' && data.resume) app.snapshot = await snapshotOf(req.userId, data.resume);
        await app.save();
        // Racing requests can all pass the check above: one past the limit (in creation order) is undone.
        const max = ACTIVE.includes(status) && !data.archived ? planLimit(req.account, req.settings, 'applications') : null;
        if (max != null && (await Application.countDocuments({ user: req.userId, archived: { $ne: true }, status: { $in: ACTIVE }, _id: { $lte: app._id } })) > max) {
            await Application.deleteOne({ _id: app._id });
            return underLimit(req, res, { except: app._id });
        }
        res.status(201).json({ success: true, data: app });
    } catch (err) {
        invalid(res, err, next);
    }
}));

// @route GET /api/applications/:id — everything, including the job text and the copy sent
router.get('/:id', async (req, res, next) => {
    try {
        const app = await findOwned(req, res);
        if (app) res.json({ success: true, data: app });
    } catch (err) {
        next(err);
    }
});

// @route PUT /api/applications/:id — save changes (send baseRev)
router.put('/:id', async (req, res, next) => {
    try {
        const app = await findOwned(req, res);
        if (!app) return;
        const { data, error } = readBody(req.body);
        if (error) return res.status(400).json({ success: false, error });
        const rev = app.rev || 0;
        if (req.body.baseRev !== undefined && req.body.baseRev !== rev) return conflict(res, app);
        if (data.resume && !(await Resume.exists({ _id: data.resume, user: req.userId }))) return res.status(400).json({ success: false, error: 'Resume not found.' });

        const wasActive = isActive(app);
        const { checklist, job, ...rest } = data;
        const prevStatus = app.status;
        app.set(rest);
        for (const [k, v] of Object.entries(job || {})) app.set(`job.${k}`, v);
        if (checklist) {
            const now = new Date();
            const next = new Map(app.checklist || []);
            for (const [k, v] of checklist) {
                if (v && !next.has(k)) next.set(k, now);
                if (!v) next.delete(k);
            }
            app.checklist = next;
        }
        // Coming back into progress (reopened or unarchived) counts towards the plan's limit again.
        if (!wasActive && isActive(app) && !(await underLimit(req, res, { except: app._id }))) return;
        if (data.status && data.status !== prevStatus) {
            const now = new Date();
            app.statusHistory.push({ status: data.status, at: now });
            if (['applied', 'interviewing', 'offer'].includes(data.status) && !app.appliedAt) app.appliedAt = now;
            // What was sent is frozen the moment it's marked applied (once).
            if (data.status === 'applied' && app.resume && !app.snapshot?.at) app.snapshot = await snapshotOf(req.userId, app.resume);
        }
        app.rev = rev + 1;
        app.$where = { rev };
        try {
            await app.save();
        } catch (err) {
            if (err.name === 'DocumentNotFoundError') return conflict(res, await Application.findById(app._id).lean());
            throw err;
        }
        res.json({ success: true, data: app });
    } catch (err) {
        invalid(res, err, next);
    }
});

// @route POST /api/applications/:id/snapshot — replace the copy sent with the linked resume as it is now
router.post('/:id/snapshot', async (req, res, next) => {
    try {
        const app = await findOwned(req, res);
        if (!app) return;
        if (!app.resume) return res.status(400).json({ success: false, error: 'Choose the resume you sent first.' });
        const snap = await snapshotOf(req.userId, app.resume);
        if (!snap) return res.status(400).json({ success: false, error: 'That resume no longer exists.' });
        app.snapshot = snap;
        app.rev = (app.rev || 0) + 1;
        await app.save();
        res.json({ success: true, data: app });
    } catch (err) {
        next(err);
    }
});

// @route DELETE /api/applications/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const app = await findOwned(req, res);
        if (!app) return;
        await app.deleteOne();
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
