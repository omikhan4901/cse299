/**
 * The most one request of an AI feature can cost, from its limits and the model prices: the
 * browser's copy of server/lib/aiLimits.js worstCase(), so the admin console shows the cost of
 * a change as it's typed. The two must give the same answers (server/test/parity.test.js).
 */
const FIXED_CHARS = {
  chat: 9744 + 2500 + 20000 + 20000, // guide, instructions, resume, outline
  refine: 2500,
  audit: 1000 + 40000,
  parse: 5000 + 30000 + 2000,
  coverLetter: 1200 + 40000,
  polish: 1000 + 20000,
  interviewAi: 2000 + 16000,
};
const PAGE_TOKENS = 560;
const CHARS_PER_TOKEN = 3;

/** The highest input and output prices among the configured models (the safe side). */
export function dearest(prices) {
  const list = Object.values(prices || {});
  return {
    input: Math.max(0, ...list.map((p) => Number(p.input) || 0)),
    output: Math.max(0, ...list.map((p) => Number(p.output) || 0)),
  };
}

/** Worst-case cost of one request of `feature`, in US dollars. */
export function worstCase(feature, settings) {
  const l = settings?.aiLimits?.[feature];
  if (!l) return 0;
  const p = dearest(settings.aiPrices);
  const inputChars = (FIXED_CHARS[feature] || 5000) + l.input * (l.turns || 1);
  const inputTokens = inputChars / CHARS_PER_TOKEN + (l.pages || 0) * PAGE_TOKENS;
  const outputTokens = l.output + (l.thinking || 0);
  return (inputTokens * p.input + outputTokens * p.output) / 1e6;
}

/** Worst case per credit for a feature (null when it costs no credits). */
export const worstPerCredit = (feature, settings) => {
  const credits = settings?.featureCosts?.[feature] || 0;
  return credits ? worstCase(feature, settings) / credits : null;
};
