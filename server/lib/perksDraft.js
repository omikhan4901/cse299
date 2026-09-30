/**
 * "Rewrite with AI" for a plan's perks (Admin › Plans): the facts come from the plan's own
 * settings, the AI only words them, and every line it returns is checked against those facts
 * before the admin sees it. The admin still decides whether to use them.
 */
const CATEGORY_OF = require('../../shared/templates.json');
const { AI_FEATURES, APP_FEATURES, PLAN_IDS } = require('./settings');
const { templateTier } = require('./templates');

// The pricing page states credits and resume counts from the settings (billing/perks.js).
const AUTO_LINE = /\d[\d,]*\s+(ai\s+)?(credits?|resumes?)\b/i;
const MAX_LINES = 5;
// Whole numbers, prices included ("6.99" is one number, so "99" alone isn't a fact).
const NUMBER = /\d+(?:[.,]\d+)*/g;
const MAX_CHARS = 60;

const STYLE_NAMES = { ats: 'ATS-friendly', minimal: 'minimal', creative: 'creative', executive: 'executive', academic: 'academic', student: 'student', twocol: 'two-column' };

const amount = (n) => (n == null ? 'unlimited' : String(n));

/** What a plan gives, in plain words, and the numbers a perk may use. */
function planFacts(plan, plans, settings) {
    const v2 = !!settings.v2?.enabled;
    const features = [...AI_FEATURES, ...APP_FEATURES].filter((f) => plan.features?.[f.key] && (v2 || !f.v2));
    const rank = PLAN_IDS.indexOf(plan.id);
    const templates = Object.keys(CATEGORY_OF).filter((id) => settings.freeMode?.enabled || PLAN_IDS.indexOf(templateTier(id, settings.templates)) <= Math.max(0, rank));
    const styles = [...new Set(templates.map((id) => CATEGORY_OF[id]))].map((c) => STYLE_NAMES[c] || c);
    const lower = [...plans].filter((p) => PLAN_IDS.indexOf(p.id) === rank - 1)[0];
    const extra = lower ? features.filter((f) => !lower.features?.[f.key]) : [];
    const limits = plan.limits || {};
    const lines = [
        `Plan: ${plan.name} (${Number(plan.price) ? `$${plan.price} a month` : 'free'})`,
        `Features: ${features.map((f) => `${f.name} (${f.description})`).join('; ') || 'none'}`,
        `Templates: ${templates.length} of ${Object.keys(CATEGORY_OF).length}${templates.length === Object.keys(CATEGORY_OF).length ? ' (all of them)' : ''}, styles: ${styles.join(', ')}`,
        'Always included for everyone: the live PDF builder, PDF download with no watermark',
        v2 && plan.features?.applications ? `Active applications at once: ${amount(limits.applications)}; tailored resumes: ${amount(limits.tailored)}; jobs tailored for in one go: ${amount(limits.batch)}` : null,
        lower ? `Plan below: ${lower.name}. Added here compared with it: ${extra.map((f) => f.name).join(', ') || 'more credits and resumes only'}` : 'This is the lowest plan.',
    ].filter(Boolean);
    const text = lines.join('\n');
    return { text, numbers: new Set(text.match(NUMBER) || []) };
}

const SYSTEM = `You write the perks list for one plan on a pricing page.

RULES:
1. Use only the facts given. Never add a feature, number, promise or support level that isn't in them.
2. Don't state AI credit amounts or resume counts: the page shows those on its own.
3. ${MAX_LINES} lines at most, each under ${MAX_CHARS} characters, most valuable first. Plain words a student understands, no emojis, no marketing fluff, no full stops at the end.
4. For a paid plan with a plan below it, the first line may be "Everything in <that plan>", then what's added.
5. Reply with the lines only, one per line, no bullets or numbering.`;

/** The prompt for the model. */
const prompt = (facts, current) => `FACTS:\n${facts.text}\n\nCURRENT PERKS (for tone only; they may be wrong):\n${(current || []).filter(Boolean).slice(0, 10).map((p) => String(p).slice(0, 120)).join('\n') || '(none)'}`;

/**
 * The model's lines, cleaned: bullets and end punctuation gone, lines the page would hide or
 * that use a number the facts don't have dropped, at most MAX_LINES.
 */
function cleanPerks(text, facts) {
    const dropped = [];
    const kept = [];
    for (const raw of String(text || '').split('\n')) {
        const line = raw.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').replace(/\*\*/g, '').replace(/[.;,]\s*$/, '').trim();
        if (!line) continue;
        const unknown = (line.match(NUMBER) || []).filter((n) => !facts.numbers.has(n));
        if (AUTO_LINE.test(line) || unknown.length || line.length > MAX_CHARS + 20) dropped.push(line);
        else if (!kept.some((k) => k.toLowerCase() === line.toLowerCase())) kept.push(line);
    }
    return { perks: kept.slice(0, MAX_LINES), dropped };
}

/** A plan from the admin's unsaved editor, reduced to what the facts need. */
function draftPlan(p) {
    if (!p || typeof p !== 'object' || !PLAN_IDS.includes(p.id)) return null;
    const bools = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => typeof v === 'boolean').slice(0, 40));
    const nums = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => v === null || (typeof v === 'number' && Number.isFinite(v))).slice(0, 10).map(([k, v]) => [k, v === null ? null : Math.max(0, Math.round(v))]));
    return {
        id: p.id,
        name: String(p.name || p.id).slice(0, 40),
        price: Math.max(0, Number(p.price) || 0),
        features: bools(p.features),
        limits: nums(p.limits),
        perks: (Array.isArray(p.perks) ? p.perks : []).filter((x) => typeof x === 'string').slice(0, 10),
    };
}

module.exports = { draftPlan, planFacts, cleanPerks, prompt, SYSTEM, AUTO_LINE, MAX_LINES };
