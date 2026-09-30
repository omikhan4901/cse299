/**
 * What a campaign could cost in AI, before it's created (Admin › Campaigns), for the
 * campaign's length:
 * - likely: members use about as many credits a month as accounts really do (measured by
 *   GET /admin/ai-usage, else an assumption), never more than their allowance, at what a
 *   credit really costs (measured, else a typical share of the worst case);
 * - worst: every member uses every credit on the dearest feature, as far as the AI rate
 *   limit lets them;
 * - atMost: the worst case, but no more than the monthly AI cap can let through.
 */
import { worstPerCredit } from "./aiCost.js";

/** Until there's data: the credits an account uses in a month (most use few or none). */
export const ASSUMED_CREDITS_PER_MONTH = 25;
/** Until there's data: a typical request is about a third of the biggest one allowed. */
export const TYPICAL_SHARE_OF_WORST = 0.35;
const MONTH_DAYS = 30.44;

/** Allowance periods a window of `days` can touch (credits reset per calendar day or month). */
export function periodsIn(days, period) {
  const d = Math.max(1, Math.round(Number(days) || 1));
  // A month-based allowance: a window of d days touches at most floor((d - 1) / 28) + 2 calendar months.
  return period === "day" ? d : Math.floor((d - 1) / 28) + 2;
}

/** Allowance periods a member can expect: members join on different days, so a monthly
 * allowance resets on average d / 30.44 times during d days. */
export function expectedPeriods(days, period) {
  const d = Math.max(1, Math.round(Number(days) || 1));
  return period === "day" ? d : Math.min(periodsIn(d, period), 1 + d / MONTH_DAYS);
}

/**
 * Calendar months the campaign can spend in: from now until the last member's plan ends
 * (the code's expiry, or now if it has none, plus the plan's days). The AI cap is monthly.
 */
export function monthsSpanned(days, expiresAt, now = new Date()) {
  const d = Math.max(1, Math.round(Number(days) || 1));
  const lastJoin = expiresAt && new Date(expiresAt) > now ? new Date(expiresAt) : now;
  const end = new Date(lastJoin.getTime() + d * 864e5);
  return (end.getUTCFullYear() * 12 + end.getUTCMonth()) - (now.getUTCFullYear() * 12 + now.getUTCMonth()) + 1;
}

/** The credits each member gets per period, as the server decides it (lib/credits.js allowanceFor). */
export function memberAllowance(c, settings) {
  if (c.creditLimit != null) return { credits: Number(c.creditLimit) || 0, period: c.creditPeriod || "day" };
  const plan = settings.plans.find((p) => p.id === c.plan) || settings.plans[0];
  if (plan.id === "free" && settings.freeMode?.enabled) return { credits: settings.freeMode.dailyCredits, period: "day" };
  return { credits: plan.credits, period: plan.creditPeriod };
}

/** The AI features members can use: the campaign's switch, else free mode, else the plan. */
export function memberAiFeatures(c, settings, aiFeatures) {
  const plan = settings.plans.find((p) => p.id === c.plan) || settings.plans[0];
  return aiFeatures.filter((f) => {
    const own = c.features?.[f.key];
    if (typeof own === "boolean") return own;
    return settings.freeMode?.enabled || !!plan.features?.[f.key];
  });
}

/**
 * { likely, worst, atMost, … } in US dollars. `basis` is GET /admin/ai-usage (measured cost
 * per credit, credits per account, AI requests a minute); `spend` is GET /admin/ai-spend.
 */
export function campaignEstimate(c, settings, aiFeatures, basis = {}, spend = null, now = new Date()) {
  const { credits, period } = memberAllowance(c, settings);
  const days = Math.max(1, Math.round(Number(c.durationDays) || 1));
  const periods = periodsIn(days, period);
  const allowed = memberAiFeatures(c, settings, aiFeatures).filter((f) => settings.featureCosts?.[f.key]);
  let perCredit = 0;
  let feature = null;
  let sum = 0;
  for (const f of allowed) {
    const v = worstPerCredit(f.key, settings) || 0;
    sum += v;
    if (v > perCredit) [perCredit, feature] = [v, f];
  }
  const places = Math.max(0, Number(c.maxUses) || 0);

  // Worst: every credit, unless the per-minute AI limit can't even get through them.
  const maxPerRequest = Math.max(0, ...allowed.map((f) => settings.featureCosts[f.key]));
  const rateCredits = basis?.aiPerMinute ? basis.aiPerMinute * 1440 * days * maxPerRequest : Infinity;
  const worstCredits = Math.min(credits * periods, rateCredits);
  const worst = places * worstCredits * perCredit;

  // Likely: real use per month (capped by the allowance), at a real or typical credit cost.
  const measuredUse = basis?.creditsPerAccount;
  const measuredCost = basis?.perCredit;
  const monthlyAllowance = period === "day" ? credits * MONTH_DAYS : credits;
  const usePerMonth = allowed.length ? Math.min(monthlyAllowance, measuredUse ?? ASSUMED_CREDITS_PER_MONTH) : 0;
  const typicalPerCredit = measuredCost ?? (allowed.length ? (sum / allowed.length) * TYPICAL_SHARE_OF_WORST : 0);
  const likelyCredits = Math.min(credits * expectedPeriods(days, period), usePerMonth * (days / MONTH_DAYS));
  const likely = places * likelyCredits * typicalPerCredit;
  // One allowance for everyone (a month's, or a day's), for the breakdown.
  const onePeriod = { worst: places * Math.min(credits, rateCredits) * perCredit, likely: places * Math.min(credits, period === "day" ? usePerMonth / MONTH_DAYS : usePerMonth) * typicalPerCredit };

  // At most: the AI cap pauses all AI for the month once reached (it covers the whole site).
  const capOn = !!spend?.enabled;
  const capLeft = capOn ? Math.max(0, spend.cap - spend.spent) : null;
  const capMonths = monthsSpanned(days, c.expiresAt, now);
  const capBound = capOn ? capLeft + spend.cap * (capMonths - 1) : Infinity;
  const atMost = Math.min(worst, capBound);

  return {
    likely,
    worst,
    atMost,
    capped: atMost < worst,
    capLeft,
    capMonths,
    capBound,
    onePeriod,
    expected: expectedPeriods(days, period),
    days,
    // A month's credits come all at once, so a short campaign still gets all of them.
    short: period === "month" && days < 28,
    dailyEquivalent: Math.max(1, Math.round(credits / MONTH_DAYS)),
    rateLimited: rateCredits < credits * periods,
    perCredit,
    typicalPerCredit,
    usePerMonth,
    measured: { use: measuredUse != null, cost: measuredCost != null },
    credits,
    period,
    periods,
    feature,
    places,
    aiPerMinute: basis?.aiPerMinute || null,
  };
}
