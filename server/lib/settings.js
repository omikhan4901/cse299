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
    { key: 'parse', name: 'Import resume', description: 'Add an old resume (PDF or Word), pasted text or your own words to a resume or your profile.' },
    { key: 'coverLetter', name: 'Cover letter', description: 'Write a cover letter for a specific job.' },
    { key: 'polish', name: 'AI polish for a job', description: 'Rewrite a tailored resume’s summary and top points in the job’s language, using only your facts.' },
    { key: 'interviewAi', name: 'AI interview prep', description: 'Likely questions for this exact job, with answer outlines built on your own experience.', v2: true },
];

// Non-AI features that plans can switch on or off.
const APP_FEATURES = [
    { key: 'atsCheck', name: 'ATS check', description: 'The ATS score and job keyword match.' },
    { key: 'shareLinks', name: 'Share links', description: 'Publish a resume as a web page.' },
    // V2 (shown on the pricing page only once V2 is on for everyone).
    { key: 'interviewPrep', name: 'Interview prep', description: 'A prep sheet for each interview, from the job and your own experience.', v2: true },
    { key: 'insights', name: 'Search insights', description: 'What your own applications show: interview rate by resume and by kind of role.', v2: true },
];

// Numeric plan limits (V2). null = unlimited; 0 = not included.
const PLAN_LIMITS = [
    { key: 'applications', name: 'Active applications', description: 'Applications being tracked at once (archived and finished ones don\'t count).' },
    { key: 'tailored', name: 'Tailored resumes', description: 'Resumes made for a specific job from the Career Profile.' },
    { key: 'batch', name: 'Jobs per batch', description: 'Jobs that can be tailored for in one go.' },
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
    // V2 (Career Profile, applications, tailoring): hidden from everyone but admins and
    // accounts with v2Preview until switched on here.
    v2: { enabled: false },
    // Job Search Pass (V2): one payment (Paddle's PADDLE_PRICE_PASS) for a plan for some days.
    pass: { enabled: false, plan: 'pro', days: 90 },
    featureCosts: { chat: 1, refine: 1, audit: 2, parse: 3, coverLetter: 2, polish: 2, interviewAi: 3 },
    // What the AI provider charges, in US dollars per million tokens, by model (the name
    // Google reports, e.g. "gemini-2.5-flash"; "default" covers any other). For the AI
    // economics view only: check Google's price list and keep these current.
    aiPrices: {
        default: { input: 0.3, output: 2.5 },
    },
    // Monthly running costs the admin enters (hosting, domain, email…), in the payout
    // currency, for the profit figure in the Revenue view. AI and Paddle fees are measured.
    fixedCosts: [],
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
            features: { ...allOn, parse: false, coverLetter: false, audit: false, polish: false, interviewAi: false, interviewPrep: false, insights: false },
            limits: { applications: 5, tailored: 1, batch: 0 },
            perks: ['Live PDF builder', 'ATS-Optimized and Student templates', 'ATS check with keyword match', '10 AI credits a day'],
        },
        {
            id: 'pro', name: 'Pro', tagline: 'For an active job search.',
            price: 6.99, yearlyPrice: 75.49, credits: 300, creditPeriod: 'month', highlight: true,
            features: { ...allOn },
            limits: { applications: null, tailored: null, batch: 5 },
            perks: ['All 50+ templates', 'Import your old resume', 'Cover letters and AI rewrites', '300 AI credits a month'],
        },
        {
            id: 'premium', name: 'Premium', tagline: 'For power users and career switchers.',
            price: 12.99, yearlyPrice: 140.29, credits: 1000, creditPeriod: 'month', highlight: false,
            features: { ...allOn },
            limits: { applications: null, tailored: null, batch: 15 },
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
            limits: Object.fromEntries(
                PLAN_LIMITS.map(({ key }) => {
                    const v = isObj(p.limits) && key in p.limits ? p.limits[key] : d.limits[key];
                    const n = v === null || v === '' ? null : num(v, d.limits[key], { max: 100000 });
                    return [key, n === null ? null : Math.round(n)];
                })
            ),
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
    const aiPrices = Object.fromEntries(
        Object.entries(isObj(s.aiPrices) ? s.aiPrices : DEFAULTS.aiPrices)
            .filter(([model, v]) => /^[A-Za-z0-9._-]{1,60}$/.test(model) && isObj(v))
            .map(([model, v]) => [model, { input: num(v.input, 0, { max: 1000 }), output: num(v.output, 0, { max: 1000 }) }])
            .slice(0, 30)
    );
    if (!aiPrices.default) aiPrices.default = { ...DEFAULTS.aiPrices.default };
    const fixedCosts = (Array.isArray(s.fixedCosts) ? s.fixedCosts : [])
        .filter(isObj)
        .map((c) => ({ name: String(c.name || '').trim().slice(0, 40), amount: Math.round(num(c.amount, 0, { max: 100000 }) * 100) / 100 }))
        .filter((c) => c.name)
        .slice(0, 20);
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
        v2: { enabled: !!(isObj(s.v2) && s.v2.enabled) },
        pass: {
            enabled: !!(isObj(s.pass) && s.pass.enabled),
            plan: isObj(s.pass) && ['pro', 'premium'].includes(s.pass.plan) ? s.pass.plan : 'pro',
            days: Math.round(num(isObj(s.pass) ? s.pass.days : 90, 90, { min: 1, max: 730 })),
        },
        featureCosts: costs,
        templates: { categories, overrides },
        aiPrices,
        fixedCosts,
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
    if (isObj(patch?.aiPrices)) merged.aiPrices = patch.aiPrices;
    if (Array.isArray(patch?.fixedCosts)) merged.fixedCosts = patch.fixedCosts;
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

module.exports = { getSettings, readSettings, updateSettings, planById, AI_FEATURES, APP_FEATURES, PLAN_LIMITS, PLAN_IDS, DEFAULTS };
