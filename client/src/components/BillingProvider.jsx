"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, UPGRADE_NEEDED } from "@/lib/api";
import { CONTACT_EMAIL } from "@/lib/config";
import { useAuth } from "./AuthProvider";
import UpgradeModal from "./billing/UpgradeModal";

/**
 * Plans, prices, credit costs and the signed-in account's credit balance.
 * Everything comes from the admin settings on the server, so changing a price
 * or a cost in /admin shows up here without a deploy.
 */
const BillingContext = createContext(null);

export const CREDITS_CHANGED = "resumex:credits-changed";
/** Call after anything that may have spent credits, to refresh the balance. */
export const notifyCreditsChanged = () => typeof window !== "undefined" && window.dispatchEvent(new Event(CREDITS_CHANGED));

import { PLAN_ORDER, planIncludes, templateById, templateTier } from "@/pdf/registry";

export function BillingProvider({ children }) {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [usage, setUsage] = useState(null);
  // The locked feature someone just tried to use: { feature, what } (shows the upgrade dialog).
  const [upgrade, setUpgrade] = useState(null);

  useEffect(() => {
    api("/billing/plans")
      .then((d) => setConfig(d.data))
      .catch(() => {});
  }, []);

  const refreshUsage = useCallback(() => {
    if (!token) return Promise.resolve();
    return api("/billing/me", { token })
      .then((d) => setUsage(d.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    // Balance is per account: load it on sign-in, forget it on sign-out.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!token) setUsage(null);
    else refreshUsage();
  }, [token, refreshUsage]);

  useEffect(() => {
    let timer;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(refreshUsage, 400);
    };
    window.addEventListener(CREDITS_CHANGED, onChange);
    return () => {
      window.removeEventListener(CREDITS_CHANGED, onChange);
      clearTimeout(timer);
    };
  }, [refreshUsage]);

  // The server is the final word on plans: if it refuses something, explain the upgrade.
  useEffect(() => {
    const onUpgrade = (e) => setUpgrade({ feature: e.detail.feature });
    window.addEventListener(UPGRADE_NEEDED, onUpgrade);
    return () => window.removeEventListener(UPGRADE_NEEDED, onUpgrade);
  }, []);

  const value = useMemo(() => {
    const freeMode = config?.freeMode?.enabled ?? true;
    const planId = usage?.plan?.id || "free";
    const plan = config?.plans?.find((p) => p.id === planId);
    const features = [...(config?.aiFeatures || []), ...(config?.appFeatures || [])];
    // Until the settings load (or while free mode is on) nothing is locked.
    const canUse = (key) => !config || freeMode || !!plan?.features?.[key] || (!plan && !!config.plans?.[0]?.features?.[key]);
    const upgradePlanFor = (key) => config?.plans?.find((p) => p.features?.[key]);
    return {
      config,
      usage,
      refreshUsage,
      freeMode,
      plan,
      costOf: (key) => config?.featureCosts?.[key] ?? null,
      featureInfo: (key) => features.find((f) => f.key === key),
      canUse,
      upgradePlanFor,
      /** The plan that unlocks a feature this account can't use, or null when it's usable. */
      lockFor: (key) => (canUse(key) ? null : upgradePlanFor(key) || { id: "pro", name: "Pro" }),
      /** AI features this account can spend its credits on. */
      usableAiFeatures: () => (config?.aiFeatures || []).filter((f) => canUse(f.key)),
      /** True when the feature can be used; otherwise explains the upgrade and returns false. */
      requireFeature: (key, what) => {
        if (canUse(key)) return true;
        setUpgrade({ feature: key, what });
        return false;
      },
      /** The plan a template needs when this account's plan doesn't include it, or null. */
      templateLock: (id) => {
        if (!config || freeMode) return null;
        const t = templateById(id);
        if (planIncludes(planId, t, config.templates)) return null;
        const need = templateTier(t, config.templates);
        return config.plans?.find((p) => p.id === need) || { id: need, name: need[0].toUpperCase() + need.slice(1) };
      },
      /** How many templates a plan includes. */
      templatesFor: (id, all) => all.filter((t) => planIncludes(id, t, config?.templates)).length,
      /** True when the template can be used; otherwise explains the upgrade and returns false. */
      requireTemplate: (id) => {
        if (!config || freeMode) return true;
        const t = templateById(id);
        if (planIncludes(planId, t, config.templates)) return true;
        const need = templateTier(t, config.templates);
        setUpgrade({ feature: "templates", what: `The ${t.name} template`, plan: config.plans?.find((p) => p.id === need), description: "Every plan includes a set of designs. This one needs a higher plan." });
        return false;
      },
      planRank: (id) => PLAN_ORDER.indexOf(id),
      upgradeHref: (p) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Upgrade to ${p?.name || "a paid plan"}`)}`,
    };
  }, [config, usage, refreshUsage]);

  return (
    <BillingContext.Provider value={value}>
      {children}
      <UpgradeModal request={upgrade} onClose={() => setUpgrade(null)} billing={value} />
    </BillingContext.Provider>
  );
}

export const useBilling = () => useContext(BillingContext);

export const formatPrice = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

export const resetsIn = (iso) => {
  if (!iso) return "";
  const ms = new Date(iso) - Date.now();
  const h = Math.max(0, Math.round(ms / 3600000));
  if (h < 1) return "in under an hour";
  if (h < 48) return `in ${h} hour${h === 1 ? "" : "s"}`;
  return `in ${Math.round(h / 24)} days`;
};
