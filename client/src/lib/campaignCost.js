/**
 * What a campaign could cost in AI, before it's created (Admin › Campaigns): places ×
 * credits per member for the campaign's length × the worst cost of a credit among the AI
 * features members can use. Worst case assumes every member uses every credit on the
 * dearest feature; the typical case is a quarter of that. Covers the campaign period only.
 */
import { worstPerCredit } from "./aiCost.js";

/** Allowance periods a window of `days` can touch (credits reset per calendar day or month). */
export function periodsIn(days, period) {
  const d = Math.max(1, Math.round(Number(days) || 1));
  // A month-based allowance: a window of d days touches at most floor((d - 1) / 28) + 2 calendar months.
  return period === "day" ? d : Math.floor((d - 1) / 28) + 2;
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

/** { worst, typical, perCredit, credits, periods, feature } in US dollars. */
export function campaignEstimate(c, settings, aiFeatures) {
  const { credits, period } = memberAllowance(c, settings);
  const periods = periodsIn(c.durationDays, period);
  const allowed = memberAiFeatures(c, settings, aiFeatures);
  let perCredit = 0;
  let feature = null;
  for (const f of allowed) {
    const v = worstPerCredit(f.key, settings) || 0;
    if (v > perCredit) [perCredit, feature] = [v, f];
  }
  const places = Math.max(0, Number(c.maxUses) || 0);
  const worst = places * credits * periods * perCredit;
  return { worst, typical: worst * 0.25, perCredit, credits, period, periods, feature, places };
}
