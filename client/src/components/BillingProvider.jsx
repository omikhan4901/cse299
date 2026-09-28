"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";

/**
 * Plans, prices, credit costs and the signed-in account's credit balance.
 * Everything comes from the admin settings on the server, so changing a price
 * or a cost in /admin shows up here without a deploy.
 */
const BillingContext = createContext(null);

export const CREDITS_CHANGED = "resumex:credits-changed";
/** Call after anything that may have spent credits, to refresh the balance. */
export const notifyCreditsChanged = () => typeof window !== "undefined" && window.dispatchEvent(new Event(CREDITS_CHANGED));

// Templates open to everyone when plans are enforced (the rest need "premiumTemplates").
export const FREE_TEMPLATE_CATEGORIES = ["ats", "student"];

export function BillingProvider({ children }) {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [usage, setUsage] = useState(null);

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

  const value = useMemo(() => {
    const freeMode = config?.freeMode?.enabled ?? true;
    const planId = usage?.plan?.id || "free";
    const plan = config?.plans?.find((p) => p.id === planId);
    const features = [...(config?.aiFeatures || []), ...(config?.appFeatures || [])];
    return {
      config,
      usage,
      refreshUsage,
      freeMode,
      plan,
      costOf: (key) => config?.featureCosts?.[key] ?? null,
      featureInfo: (key) => features.find((f) => f.key === key),
      // Until the settings load (or while free mode is on) nothing is locked.
      canUse: (key) => !config || freeMode || !!plan?.features?.[key] || (!plan && !!config.plans?.[0]?.features?.[key]),
      upgradePlanFor: (key) => config?.plans?.find((p) => p.features?.[key]),
    };
  }, [config, usage, refreshUsage]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
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
