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
export function canUseFeature(config, planId, key) {
  if (!config || config.freeMode?.enabled) return true;
  const plan = config.plans?.find((p) => p.id === planId) || config.plans?.[0];
  return !!plan?.features?.[key];
}

/** Whether an account on `planId` may use a template. */
export function canUseTemplate(config, planId, template) {
  if (!config || config.freeMode?.enabled) return true;
  return planIncludes(planId, template, config.templates);
}
