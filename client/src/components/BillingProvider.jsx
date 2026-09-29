"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, SETTINGS_CHANGED, UPGRADE_NEEDED } from "@/lib/api";
import { CONTACT_EMAIL } from "@/lib/config";
import { App } from "antd";
import { useAuth } from "./AuthProvider";
import { openCheckout } from "@/lib/paddle";
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

import { PLAN_ORDER, templateById, templateTier } from "@/pdf/registry";
import { canUseFeature, canUseTemplate, canUseV2, planLimit } from "@/lib/access";

const LIMIT_KEYS = ["applications", "tailored", "batch"];
/** "feature:polish", "limit:applications" or "template": where an upgrade prompt came from. */
const sourceOf = (request) => {
  const key = String(request?.feature || "").replace(/[^a-z0-9_.-]/gi, "").slice(0, 40);
  if (!key) return "prompt";
  if (key === "templates") return "template";
  return LIMIT_KEYS.includes(key) ? `limit:${key}` : `feature:${key}`;
};

export function BillingProvider({ children }) {
  const { token, user, openAuth } = useAuth();
  const { message, modal } = App.useApp();
  const [config, setConfig] = useState(null);
  const [usage, setUsage] = useState(null);
  // The locked feature someone just tried to use: { feature, what } (shows the upgrade dialog).
  const [upgrade, setUpgrade] = useState(null);

  // Plans, locks and costs come from the admin settings. Reload them when the page
  // comes back into view, every minute, and straight after an admin saves, so a
  // change in /admin shows up without a full reload.
  const refreshConfig = useCallback(
    () =>
      api("/billing/plans")
        .then((d) => setConfig(d.data))
        .catch(() => {}),
    []
  );
  useEffect(() => {
    refreshConfig();
    const onVisible = () => document.visibilityState === "visible" && refreshConfig();
    const timer = setInterval(onVisible, 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(SETTINGS_CHANGED, refreshConfig);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(SETTINGS_CHANGED, refreshConfig);
    };
  }, [refreshConfig]);

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

  // An admin may change the plan or credits while this page is open: re-check on return.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && refreshUsage();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshUsage]);

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

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // The server is the final word on plans: if it refuses something, explain the upgrade.
  useEffect(() => {
    const onUpgrade = (e) => {
      const { feature, plan, template } = e.detail;
      // The server knows best: refresh the local copy of the plans, then explain.
      refreshConfig();
      setUpgrade({
        feature,
        what: template ? "That template" : undefined,
        plan: plan ? configRef.current?.plans?.find((p) => p.id === plan) : undefined,
        description: template ? "This design needs a higher plan. Your previous template was kept." : undefined,
      });
    };
    window.addEventListener(UPGRADE_NEEDED, onUpgrade);
    return () => window.removeEventListener(UPGRADE_NEEDED, onUpgrade);
  }, [refreshConfig]);

  // Steps towards paying, for the admin Revenue funnel (which prompt, whether checkout opened).
  const track = useCallback(
    (kind, source, plan) => {
      if (token && source) api("/billing/event", { token, method: "POST", body: { kind, source, ...(plan ? { plan } : {}) } }).catch(() => {});
    },
    [token]
  );
  useEffect(() => {
    if (upgrade) track("prompt", sourceOf(upgrade));
  }, [upgrade, track]);

  /**
   * Starts paying for a plan: Paddle's checkout, or a plan switch when there's already a
   * subscription (a second checkout would charge twice). Signed-out visitors sign up first
   * and come back to the checkout. Without Paddle set up, it falls back to email.
   */
  const checkout = useCallback(
    async (planId, interval = "month", source = "pricing") => {
      const cfg = config?.paddle;
      const plan = config?.plans?.find((p) => p.id === planId);
      const name = plan?.name || "a paid plan";
      if (!cfg?.prices?.[planId]?.[interval]) {
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Upgrade to ${name}`)}`;
        return;
      }
      if (!token) {
        openAuth("register", `/pricing?checkout=${planId}-${interval}`);
        return;
      }
      const sub = usage?.subscription;
      if (sub?.active) {
        if (sub.plan === planId && sub.interval === interval) {
          message.info(`You're already on ${name}.`);
          return;
        }
        modal.confirm({
          title: `Switch to ${name}, billed ${interval === "year" ? "yearly" : "monthly"}?`,
          content: "Your subscription changes straight away. You're charged, or credited, the difference for the rest of this billing period.",
          okText: "Switch plan",
          onOk: async () => {
            try {
              await api("/billing/change-plan", { token, method: "POST", body: { plan: planId, interval } });
              await refreshUsage();
              message.success(`You're now on ${name}.`);
            } catch (err) {
              message.error(err.message);
            }
          },
        });
        return;
      }
      try {
        track("checkout", source, planId);
        await openCheckout(cfg, { priceId: cfg.prices[planId][interval], email: user?.email, userId: user?.id, source });
      } catch (err) {
        message.error(err.message);
      }
    },
    [config, token, user, usage, openAuth, message, modal, refreshUsage, track]
  );

  /** Buys the Job Search Pass: one payment, adds its days to the account. */
  const checkoutPass = useCallback(async () => {
    const cfg = config?.paddle;
    if (!cfg?.prices?.pass || !config?.pass) return;
    if (!token) {
      openAuth("register", "/pricing");
      return;
    }
    try {
      await openCheckout(cfg, { priceId: cfg.prices.pass, email: user?.email, userId: user?.id });
    } catch (err) {
      message.error(err.message);
    }
  }, [config, token, user, openAuth, message]);

  /** Opens Paddle's customer portal: payment method, invoices, cancelling. */
  const openPortal = useCallback(async () => {
    try {
      const { url } = await api("/billing/portal", { token, method: "POST" });
      window.location.href = url;
    } catch (err) {
      message.error(err.message);
    }
  }, [token, message]);

  const value = useMemo(() => {
    const freeMode = config?.freeMode?.enabled ?? true;
    const planId = usage?.plan?.id || "free";
    const plan = config?.plans?.find((p) => p.id === planId);
    const features = [...(config?.aiFeatures || []), ...(config?.appFeatures || [])];
    // Until the settings load (or while free mode is on) nothing is locked.
    const canUse = (key) => canUseFeature(config, planId, key);
    const upgradePlanFor = (key) => config?.plans?.find((p) => p.features?.[key]);
    return {
      config,
      usage,
      refreshUsage,
      refreshConfig,
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
        const t = templateById(id);
        if (canUseTemplate(config, planId, t)) return null;
        const need = templateTier(t, config.templates);
        return config.plans?.find((p) => p.id === need) || { id: need, name: need[0].toUpperCase() + need.slice(1) };
      },
      /** How many templates a plan includes. */
      templatesFor: (id, all) => all.filter((t) => canUseTemplate(config && { ...config, freeMode: { enabled: false } }, id, t)).length,
      /** True when the template can be used; otherwise explains the upgrade and returns false. */
      requireTemplate: (id) => {
        const t = templateById(id);
        if (canUseTemplate(config, planId, t)) return true;
        const need = templateTier(t, config.templates);
        setUpgrade({ feature: "templates", what: `The ${t.name} template`, plan: config.plans?.find((p) => p.id === need), description: "Every plan includes a set of designs. This one needs a higher plan." });
        return false;
      },
      planRank: (id) => PLAN_ORDER.indexOf(id),
      /** V2 (Career Profile, applications) is visible to this account. */
      v2: canUseV2(config, user),
      /** A numeric plan limit (applications, tailored, batch); null = unlimited. */
      limitOf: (key) => planLimit(config, planId, key),
      /** True when one more is allowed (`count` already used); otherwise explains the upgrade. */
      requireLimit: (key, count, what) => {
        const max = planLimit(config, planId, key);
        if (max === null || count < max) return true;
        const better = config?.plans?.find((p) => PLAN_ORDER.indexOf(p.id) > PLAN_ORDER.indexOf(planId) && (p.limits?.[key] === null || p.limits?.[key] > max));
        setUpgrade({ feature: key, what, plan: better, description: max === 0 ? "Your plan doesn't include this." : `Your plan includes ${max}. Upgrade for more.` });
        return false;
      },
      checkout,
      checkoutPass,
      /** Where an upgrade prompt came from, as a label for the Revenue view. */
      sourceOf,
      openPortal,
      /** True when paying goes through Paddle (otherwise upgrades are by email). */
      canCheckout: !!config?.paddle,
      subscription: usage?.subscription || null,
    };
  }, [config, usage, user, refreshUsage, refreshConfig, checkout, checkoutPass, openPortal]);

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
