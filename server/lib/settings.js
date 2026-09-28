const Settings = require('../models/Settings');
const { setOverrides } = require('./rateLimit');

/**
 * Everything an admin can tune without a deploy. `getSettings()` always
 * returns a complete object: stored values merged over these defaults, so new
 * options can be added here without migrating the database.
 */

// AI features that cost credits. `key` is used in routes, costs and plan feature flags.
const AI_FEATURES = [
    { key: 'chat', name: 'AI assistant', description: 'Chat about your resume and get tailored advice.' },
    { key: 'refine', name: 'AI rewrite', description: 'Rewrite a summary or a set of bullet points.' },
    { key: 'audit', name: 'AI resume review', description: 'Written feedback from the AI on top of the ATS score.' },
    { key: 'parse', name: 'Import resume', description: 'Read an existing PDF or Word resume into the builder.' },
    { key: 'coverLetter', name: 'Cover letter', description: 'Write a cover letter for a specific job.' },
];

// Non-AI features that plans can switch on or off.
const APP_FEATURES = [
    { key: 'atsCheck', name: 'ATS check', description: 'The ATS score and job keyword match.' },
    { key: 'shareLinks', name: 'Share links', description: 'Publish a resume as a web page.' },
];

// Which plan each template needs: a tier per category, and optional per-template overrides.
// Plans stack (Premium includes Pro templates). A category not listed here needs Pro.
const PLAN_IDS = ['free', 'pro', 'premium'];
const TEMPLATE_CATEGORIES = ['ats', 'minimal', 'creative', 'executive', 'academic', 'student', 'twocol'];

const allOn = Object.fromEntries([...AI_FEATURES, ...APP_FEATURES].map((f) => [f.key, true]));

const DEFAULTS = {
    // While free mode is on, every feature is open to everyone and each account
    // gets `dailyCredits` a day (unless it has its own allowance). Plans and
    // prices are still shown, but nothing is locked.
    freeMode: { enabled: true, dailyCredits: 40, label: 'Free during early access' },
    registration: 'open', // open | campaign | closed
    currency: 'USD',
    showPricing: false,
    featureCosts: { chat: 1, refine: 1, audit: 2, parse: 3, coverLetter: 2 },
    // Admin overrides for rate limits: { [name]: { max, windowMs } } (see lib/rateLimit.js).
    rateLimits: {},
    templates: {
        categories: { ats: 'free', minimal: 'pro', creative: 'pro', executive: 'pro', academic: 'pro', student: 'free', twocol: 'pro' },
        overrides: {},
    },
    plans: [
        {
            id: 'free', name: 'Free', tagline: 'Everything you need for your first resume.',
            price: 0, yearlyPrice: 0, credits: 10, creditPeriod: 'day', highlight: false,
            features: { ...allOn, parse: false, coverLetter: false, audit: false },
            perks: ['Live PDF builder', 'ATS-Optimized and Student templates', 'ATS check with keyword match', '10 AI credits a day'],
        },
        {
            id: 'pro', name: 'Pro', tagline: 'For an active job search.',
            price: 6.99, yearlyPrice: 75.49, credits: 300, creditPeriod: 'month', highlight: true,
            features: { ...allOn },
            perks: ['All 50 templates', 'Import your old resume', 'Cover letters and AI rewrites', '300 AI credits a month'],
        },
        {
            id: 'premium', name: 'Premium', tagline: 'For power users and career switchers.',
            price: 12.99, yearlyPrice: 140.29, credits: 1000, creditPeriod: 'month', highlight: false,
            features: { ...allOn },
            perks: ['Everything in Pro', '1,000 AI credits a month', 'Priority support'],
        },
    ],
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (base, over) => {
    if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
    const out = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = isObj(base[k]) && isObj(v) ? merge(base[k], v) : v;
    return out;
};

const num = (v, fallback, { min = 0, max = 1e7 } = {}) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v, fallback, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);

/** Validates and normalises a full settings object (unknown keys are dropped). */
function clean(input) {
    const s = merge(DEFAULTS, input || {});
    const costs = {};
    const featureCosts = isObj(s.featureCosts) ? s.featureCosts : {};
    for (const f of AI_FEATURES) costs[f.key] = Math.round(num(featureCosts[f.key] ?? DEFAULTS.featureCosts[f.key], DEFAULTS.featureCosts[f.key], { max: 1000 }));
    const featureKeys = [...AI_FEATURES, ...APP_FEATURES].map((f) => f.key);
    // Always exactly the three tiers: a missing or malformed plan falls back to its defaults,
    // so accounts on Pro or Premium never lose their tier because of a partial save.
    const plans = DEFAULTS.plans.map((d, i) => {
        const p = (Array.isArray(s.plans) && isObj(s.plans[i]) && s.plans[i]) || d;
        return {
            id: d.id, // ids are fixed so accounts keep pointing at the right tier
            name: str(p.name, d.name, 40) || d.name,
            tagline: str(p.tagline, d.tagline),
            price: num(p.price, d.price, { max: 100000 }),
            yearlyPrice: num(p.yearlyPrice, d.yearlyPrice, { max: 1000000 }),
            credits: Math.round(num(p.credits, d.credits)),
            creditPeriod: p.creditPeriod === 'day' ? 'day' : 'month',
            highlight: !!p.highlight,
            features: Object.fromEntries(featureKeys.map((k) => [k, !isObj(p.features) || p.features[k] === undefined ? !!d.features[k] : !!p.features[k]])),
            perks: (Array.isArray(p.perks) ? p.perks : d.perks).map((x) => str(x, '', 120)).filter(Boolean).slice(0, 12),
        };
    });
    const freeMode = isObj(s.freeMode) ? s.freeMode : DEFAULTS.freeMode;
    const tpl = isObj(s.templates) ? s.templates : {};
    const categories = Object.fromEntries(
        TEMPLATE_CATEGORIES.map((c) => [c, PLAN_IDS.includes(tpl.categories?.[c]) ? tpl.categories[c] : DEFAULTS.templates.categories[c]])
    );
    const overrides = Object.fromEntries(
        Object.entries(isObj(tpl.overrides) ? tpl.overrides : {})
            .filter(([id, tier]) => /^[A-Za-z0-9_-]{1,40}$/.test(id) && PLAN_IDS.includes(tier))
            .slice(0, 200)
    );
    const rateLimits = Object.fromEntries(
        Object.entries(isObj(s.rateLimits) ? s.rateLimits : {})
            .filter(([name, v]) => /^[a-z0-9-]{1,40}$/.test(name) && isObj(v))
            .map(([name, v]) => [name, { max: Math.round(num(v.max, 1, { min: 1, max: 100000 })), windowMs: Math.round(num(v.windowMs, 60000, { min: 1000, max: 864e5 })) }])
            .slice(0, 100)
    );
    return {
        freeMode: {
            enabled: !!freeMode.enabled,
            dailyCredits: Math.round(num(freeMode.dailyCredits, DEFAULTS.freeMode.dailyCredits)),
            label: str(freeMode.label, DEFAULTS.freeMode.label, 80),
        },
        registration: ['open', 'campaign', 'closed'].includes(s.registration) ? s.registration : 'open',
        currency: str(s.currency, 'USD', 8).toUpperCase() || 'USD',
        showPricing: !!s.showPricing,
        featureCosts: costs,
        templates: { categories, overrides },
        rateLimits,
        plans,
    };
}

let cache = null;
let cachedAt = 0;
const TTL = 30 * 1000;

async function getSettings() {
    if (cache && Date.now() - cachedAt < TTL) return cache;
    const doc = await Settings.findOne({ key: 'global' }).lean();
    cache = clean(doc?.data);
    cachedAt = Date.now();
    setOverrides(cache.rateLimits);
    return cache;
}

/** The settings and their revision, read from the database (not the cache). */
async function readSettings() {
    const doc = await Settings.findOne({ key: 'global' }).lean();
    return { settings: clean(doc?.data), rev: doc?.rev || 0 };
}

/**
 * Saves a partial change. It's merged onto the stored settings (not this server's
 * cached copy, which another instance may have changed since). With `baseRev`, a
 * save made from settings older than the stored ones is refused with a 409.
 */
async function updateSettings(patch, by, { baseRev } = {}) {
    const doc = await Settings.findOne({ key: 'global' });
    const rev = doc?.rev || 0;
    const conflict = () => Object.assign(new Error('Someone else changed the settings since you opened this page.'), { status: 409, code: 'conflict' });
    if (baseRev !== undefined && baseRev !== rev) throw conflict();
    const merged = merge(clean(doc?.data), patch);
    // Template access is saved as a whole, so removing an override really removes it.
    if (isObj(patch?.templates)) merged.templates = patch.templates;
    if (isObj(patch?.rateLimits)) merged.rateLimits = patch.rateLimits;
    const next = clean(merged);
    try {
        if (doc) {
            doc.data = next;
            doc.updatedBy = by;
            doc.rev = rev + 1;
            doc.markModified('data');
            // Only if nobody saved in between.
            doc.$where = rev === 0 ? { rev: { $in: [0, null] } } : { rev };
            await doc.save();
        } else {
            await Settings.create({ key: 'global', data: next, updatedBy: by, rev: 1 });
        }
    } catch (err) {
        if (err.name === 'DocumentNotFoundError' || err.code === 11000) throw conflict();
        throw err;
    }
    cache = next;
    cachedAt = Date.now();
    setOverrides(next.rateLimits);
    return next;
}

// Keep every server instance's copy fresh, so rate-limit changes apply everywhere within ~30s.
setInterval(() => getSettings().catch(() => {}), TTL + 1000).unref();

const planById = (settings, id) => settings.plans.find((p) => p.id === id) || settings.plans[0];

module.exports = { getSettings, readSettings, updateSettings, planById, AI_FEATURES, APP_FEATURES, PLAN_IDS, DEFAULTS };
