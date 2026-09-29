/**
 * A plan's perks as shown to people. Perks that state an AI credit amount or a number of
 * resumes are left out: those lines come from the plan's real settings (keyPerks and the
 * credits line), so an old perk ("10 AI credits a day") can't contradict them after an
 * admin changes the numbers.
 */
export const perksOf = (plan) => (plan?.perks || []).filter((perk) => !/\d[\d,]*\s+(ai\s+)?(credits?|resumes?)\b/i.test(perk));

/** Lines built from the plan's own limits and features: resumes, and (with V2 on) Profile and Applications. */
export function keyPerks(plan, { v2 = false } = {}) {
  if (!plan) return [];
  const out = [];
  const n = plan.limits?.resumes;
  if (n === null) out.push("Unlimited resumes");
  else if (typeof n === "number") out.push(n === 1 ? "1 resume" : `Up to ${n} resumes`);
  if (v2) {
    const has = (k) => !!plan.features?.[k];
    if (has("profile") && has("applications")) out.push("Career Profile and Applications");
    else if (has("profile")) out.push("Career Profile");
    else if (has("applications")) out.push("Applications");
  }
  return out;
}
