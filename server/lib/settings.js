const Settings = require('../models/Settings');

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
    { key: 'premiumTemplates', name: 'All templates', description: 'Every template category, not just the basics.' },
    { key: 'shareLinks', name: 'Share links', description: 'Publish a resume as a web page.' },
];

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
    plans: [
        {
            id: 'free', name: 'Free', tagline: 'Everything you need for your first resume.',
            price: 0, yearlyPrice: 0, credits: 10, creditPeriod: 'day', highlight: false,
            features: { ...allOn, parse: false, coverLetter: false, audit: false, premiumTemplates: false },
            perks: ['Live PDF builder', 'ATS-Optimized and Student templates', 'ATS check with keyword match', '10 AI credits a day'],
        },
        {
            id: 'pro', name: 'Pro', tagline: 'For an active job search.',
            price: 9, yearlyPrice: 72, credits: 300, creditPeriod: 'month', highlight: true,
            features: { ...allOn },
            perks: ['All 50 templates', 'Import your old resume', 'Cover letters and AI rewrites', '300 AI credits a month'],
        },
        {
            id: 'premium', name: 'Premium', tagline: 'For power users and career switchers.',
            price: 19, yearlyPrice: 152, credits: 1000, creditPeriod: 'month', highlight: false,
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
    for (const f of AI_FEATURES) costs[f.key] = Math.round(num(s.featureCosts?.[f.key], DEFAULTS.featureCosts[f.key], { max: 1000 }));
    const featureKeys = [...AI_FEATURES, ...APP_FEATURES].map((f) => f.key);
    const plans = (Array.isArray(s.plans) ? s.plans : DEFAULTS.plans).slice(0, 3).map((p, i) => {
        const d = DEFAULTS.plans[i];
        return {
            id: d.id, // ids are fixed so accounts keep pointing at the right tier
            name: str(p.name, d.name, 40) || d.name,
            tagline: str(p.tagline, d.tagline),
            price: num(p.price, d.price, { max: 100000 }),
            yearlyPrice: num(p.yearlyPrice, d.yearlyPrice, { max: 1000000 }),
            credits: Math.round(num(p.credits, d.credits)),
            creditPeriod: p.creditPeriod === 'day' ? 'day' : 'month',
            highlight: !!p.highlight,
            features: Object.fromEntries(featureKeys.map((k) => [k, p.features?.[k] === undefined ? !!d.features[k] : !!p.features[k]])),
            perks: (Array.isArray(p.perks) ? p.perks : d.perks).map((x) => str(x, '', 120)).filter(Boolean).slice(0, 12),
        };
    });
    return {
        freeMode: {
            enabled: !!s.freeMode.enabled,
            dailyCredits: Math.round(num(s.freeMode.dailyCredits, DEFAULTS.freeMode.dailyCredits)),
            label: str(s.freeMode.label, DEFAULTS.freeMode.label, 80),
        },
        registration: ['open', 'campaign', 'closed'].includes(s.registration) ? s.registration : 'open',
        currency: str(s.currency, 'USD', 8).toUpperCase() || 'USD',
        showPricing: !!s.showPricing,
        featureCosts: costs,
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
    return cache;
}

async function updateSettings(patch, by) {
    const current = await getSettings();
    const next = clean(merge(current, patch));
    const doc = await Settings.findOne({ key: 'global' });
    if (doc) {
        doc.data = next;
        doc.updatedBy = by;
        doc.markModified('data');
        await doc.save();
    } else {
        await Settings.create({ key: 'global', data: next, updatedBy: by });
    }
    cache = next;
    cachedAt = Date.now();
    return next;
}

const planById = (settings, id) => settings.plans.find((p) => p.id === id) || settings.plans[0];

module.exports = { getSettings, updateSettings, planById, AI_FEATURES, APP_FEATURES, DEFAULTS };
