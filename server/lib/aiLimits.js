/**
 * Limits on every AI feature (docs/v2/BETA-PLAN.md, Phase 1), editable in Admin › Credits &
 * access. They bound what one request can cost, so the monthly cap and campaign estimates
 * are exact rather than guesses:
 *   input     characters of the person's text (the assistant: per message)
 *   turns     the assistant: messages of the conversation kept
 *   pages     imports: pages of a file
 *   output    tokens the answer may use
 *   thinking  tokens the model may spend thinking first (billed like output; 0 = none)
 * Typed text over the limit is refused before the model is called (and refunded); stored
 * texts (a job description) are trimmed to it instead.
 */

const DEFAULT_LIMITS = {
    chat: { input: 1500, turns: 10, output: 1500, thinking: 0 },
    refine: { input: 3000, output: 800, thinking: 0 },
    audit: { input: 6000, output: 1500, thinking: 512 },
    parse: { input: 20000, pages: 6, output: 8192, thinking: 1024 },
    coverLetter: { input: 6000, output: 1200, thinking: 0 },
    polish: { input: 8000, output: 3000, thinking: 512 },
    interviewAi: { input: 8000, output: 4000, thinking: 512 },
};
const BOUNDS = { input: [200, 50000], turns: [2, 40], pages: [1, 20], output: [256, 32768], thinking: [0, 16384] };

// What every request of a feature sends besides the person's input, at most, in characters
// (instructions, the resume or its outline, the guide), for the worst-case cost.
const FIXED_CHARS = {
    chat: 9744 + 2500 + 20000 + 20000, // guide, instructions, resume, outline
    refine: 2500,
    audit: 1000 + 40000,
    parse: 5000 + 30000 + 2000,
    coverLetter: 1200 + 40000,
    polish: 1000 + 20000,
    interviewAi: 2000 + 16000,
};
const PAGE_TOKENS = 560; // a PDF page sent as a file (Gemini's rate), plus a margin
// Characters per token, conservatively (English is about 4; Bangla and code use more tokens).
const CHARS_PER_TOKEN = 3;

const num = (v, [min, max], fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Validated limits for every feature (unknown fields dropped, out-of-range values clamped). */
function cleanLimits(input, features) {
    const src = input && typeof input === 'object' ? input : {};
    return Object.fromEntries(
        features.map((f) => {
            const d = DEFAULT_LIMITS[f] || { input: 5000, output: 2000, thinking: 0 };
            const given = src[f] && typeof src[f] === 'object' ? src[f] : {};
            return [f, Object.fromEntries(Object.keys(d).map((k) => [k, num(given[k] ?? d[k], BOUNDS[k], d[k])]))];
        })
    );
}

/** The highest input and output prices among the configured models (the safe side). */
function dearest(prices) {
    const list = Object.values(prices || {});
    return {
        input: Math.max(0, ...list.map((p) => Number(p.input) || 0)),
        output: Math.max(0, ...list.map((p) => Number(p.output) || 0)),
    };
}

/** The most one request of a feature can cost, in US dollars, with these limits and prices. */
function worstCase(feature, settings) {
    const l = settings.aiLimits?.[feature];
    if (!l) return 0;
    const p = dearest(settings.aiPrices);
    const inputChars = (FIXED_CHARS[feature] || 5000) + l.input * (l.turns || 1);
    const inputTokens = inputChars / CHARS_PER_TOKEN + (l.pages || 0) * PAGE_TOKENS;
    const outputTokens = l.output + (l.thinking || 0);
    return (inputTokens * p.input + outputTokens * p.output) / 1e6;
}

/** Worst case per credit for each feature: { [feature]: { request, perCredit } }. */
function worstCases(settings) {
    return Object.fromEntries(
        Object.keys(settings.aiLimits || {}).map((f) => {
            const request = worstCase(f, settings);
            const credits = settings.featureCosts?.[f] || 0;
            return [f, { request, perCredit: credits ? request / credits : null }];
        })
    );
}

/** The generation settings a feature's limits add to a model call. */
const generationLimits = (l) => (l ? { maxOutputTokens: l.output + (l.thinking || 0), thinkingConfig: { thinkingBudget: l.thinking || 0 } } : {});

module.exports = { DEFAULT_LIMITS, cleanLimits, worstCase, worstCases, generationLimits, dearest };
