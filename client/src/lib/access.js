/**
 * What an account may use, as the browser works it out. The API applies the same
 * rules on its side (server/lib/credits.js canUse, server/lib/templates.js);
 * server/test/parity.test.js checks that the two always agree.
 * Plain functions with no imports, so Node tests can load this file directly.
 */

export const PLAN_ORDER = ["free", "pro", "premium"];
export const FREE_TEMPLATE_CATEGORIES = ["ats", "student"];

/** The plan a template needs, from the admin's template settings (or the defaults before they load). */
export function templateTier(template, access) {
  if (!template) return "free";
  const fallback = FREE_TEMPLATE_CATEGORIES.includes(template.category) ? "free" : "pro";
  return access?.overrides?.[template.id] || access?.categories?.[template.category] || fallback;
}

/** True when a plan includes a template (plans stack: premium > pro > free). */
export function planIncludes(planId, template, access) {
  return PLAN_ORDER.indexOf(templateTier(template, access)) <= Math.max(0, PLAN_ORDER.indexOf(planId));
}

/** Whether an account on `planId` may use a feature. Nothing is locked until settings load, or in free mode. */
export function canUseFeature(config, planId, key, own = null) {
  // The account's own switch (from an admin or a campaign) wins, even over free mode.
  if (typeof own?.[key] === "boolean") return own[key];
  if (!config || config.freeMode?.enabled) return true;
  const plan = config.plans?.find((p) => p.id === planId) || config.plans?.[0];
  return !!plan?.features?.[key];
}

/** Whether an account on `planId` may use a template. */
export function canUseTemplate(config, planId, template) {
  if (!config || config.freeMode?.enabled) return true;
  return planIncludes(planId, template, config.templates);
}

// Which feature each workspace limit belongs to.
const LIMIT_FEATURE = { applications: "applications", tailored: "applications", batch: "applications" };

/**
 * A numeric plan limit (applications, tailored, batch): null = no limit (also in free mode).
 * `own` is the account's own limits; `features` its own feature switches (campaign or admin).
 */
export function planLimit(config, planId, key, own = null, features = null) {
  // The account's own limit (from an admin) wins, even over free mode.
  if (typeof own?.[key] === "number") return own[key];
  if (!config || config.freeMode?.enabled) return null;
  const plan = config.plans?.find((p) => p.id === planId) || config.plans?.[0];
  const v = plan?.limits?.[key];
  // A feature switched on that the plan leaves out: the cheapest plan with it sets the limit.
  const feature = LIMIT_FEATURE[key];
  if (v === 0 && feature && features?.[feature] === true) {
    const lowest = config.plans.find((p) => p.features?.[feature]) || config.plans[config.plans.length - 1];
    const w = lowest?.limits?.[key];
    return w === undefined ? null : w;
  }
  return v === undefined ? null : v;
}

/** Whether an account sees V2 (Career Profile, applications): on for everyone, or admins and preview accounts. */
export function canUseV2(config, user) {
  if (!user) return false;
  return !!config?.v2?.enabled || !!user.v2Preview || user.role === "admin" || user.role === "superadmin";
}

/**
 * "upgrade" (a higher plan, or the same plan billed yearly) or "downgrade" (everything else).
 * Upgrades start now, charged pro rata; downgrades start at the next renewal and the paid-for
 * plan is kept until then. Same rule as the server's changeKind (server/lib/paddle.js).
 */
export function planChangeKind(from, to) {
  const rank = (p) => PLAN_ORDER.indexOf(p);
  return rank(to.plan) > rank(from.plan) || (to.plan === from.plan && to.interval === "year" && from.interval !== "year") ? "upgrade" : "downgrade";
}
