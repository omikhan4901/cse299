"use client";

import Link from "next/link";
import { Popover, Progress, Tooltip } from "antd";
import { Crown, Lock, Zap } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useBilling, resetsIn } from "./BillingProvider";

const periodWord = (p) => (p === "month" ? "this month" : "today");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Card shown inside a tooltip for an AI action: what it does and what it costs. */
function CreditCard({ feature, title, description }) {
  const { costOf, featureInfo, usage, canUse, upgradePlanFor } = useBilling() || {};
  const info = featureInfo?.(feature);
  const cost = costOf?.(feature);
  const locked = canUse && !canUse(feature);
  const remaining = usage ? usage.remaining : null;
  const short = usage && cost != null && remaining < cost;
  return (
    <div className="w-64 py-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-white">{title || info?.name}</p>
        {cost != null ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-300/30">
            <Zap size={11} className="fill-amber-300" /> {cost === 0 ? "Free" : plural(cost, "credit")}
          </span>
        ) : null}
      </div>
      {description || info?.description ? <p className="mt-1 text-xs leading-relaxed text-white/70">{description || info?.description}</p> : null}
      {locked ? (
        <p className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[11px] text-amber-200">
          <Lock size={11} /> Included in {upgradePlanFor(feature)?.name || "a paid plan"}
        </p>
      ) : usage ? (
        <p className={`mt-2 border-t border-white/10 pt-2 text-[11px] ${short ? "text-rose-300" : "text-white/60"}`}>
          {short ? "Not enough credits · " : ""}
          {plural(remaining, "credit")} left {periodWord(usage.period)} · refreshes {resetsIn(usage.resetsAt)}
        </p>
      ) : null}
    </div>
  );
}

/** Wraps an AI control with a tooltip showing its credit cost and your balance. */
export function CreditTooltip({ feature, title, description, placement = "top", children }) {
  return (
    <Tooltip
      placement={placement}
      color="#0f1f2a"
      styles={{ root: { maxWidth: 320 }, container: { padding: "10px 12px", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,42,.55)" } }}
      title={<CreditCard feature={feature} title={title} description={description} />}
    >
      {children}
    </Tooltip>
  );
}

/** Credit balance for the top bar, with a breakdown on click. */
export function CreditMeter() {
  const { isAuthenticated } = useAuth();
  const billing = useBilling();
  const usage = billing?.usage;
  if (!isAuthenticated || !usage) return null;
  const pct = usage.limit ? Math.round((usage.remaining / usage.limit) * 100) : 0;
  const tone = pct > 40 ? "#0d9488" : pct > 15 ? "#d97706" : "#dc2626";
  const costs = billing.config?.aiFeatures || [];

  const content = (
    <div className="w-72">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">AI credits</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand">
          {usage.plan?.id !== "free" ? <Crown size={11} /> : null} {usage.plan?.name} plan
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-ink tabular-nums">
        {usage.remaining}
        <span className="text-sm font-medium text-slate-400"> / {usage.limit} left {periodWord(usage.period)}</span>
      </p>
      <Progress percent={pct} showInfo={false} strokeColor={tone} size="small" />
      <p className="text-xs text-slate-500">
        Refreshes {resetsIn(usage.resetsAt)}
        {usage.source === "freeMode" ? " · free during early access" : usage.source === "custom" ? " · custom allowance" : ""}
      </p>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">Cost per use</p>
        <ul className="space-y-1">
          {costs.map((f) => (
            <li key={f.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{f.name}</span>
              <span className="inline-flex items-center gap-1 font-medium text-ink tabular-nums">
                <Zap size={12} className="fill-amber-400 text-amber-500" /> {billing.costOf(f.key)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between text-sm">
            <span className="text-slate-600">ATS check</span>
            <span className="text-xs font-medium text-emerald-600">Always free</span>
          </li>
        </ul>
      </div>
      <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs">
        <Link href="/account" className="font-medium text-brand hover:underline">Usage details</Link>
        <Link href="/pricing" className="font-medium text-brand hover:underline">See plans</Link>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <button
        type="button"
        data-tour="credits"
        className="group inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white pr-3 pl-1.5 text-sm transition hover:border-brand-200 hover:shadow-sm"
        aria-label={`${usage.remaining} of ${usage.limit} AI credits left`}
      >
        <Progress type="circle" percent={pct} size={22} strokeWidth={14} strokeColor={tone} format={() => null} />
        <span className="inline-flex items-center gap-1 font-semibold text-ink tabular-nums">
          <Zap size={13} className="fill-amber-400 text-amber-500" /> {usage.remaining}
          <span className="font-normal text-slate-400">/ {usage.limit}</span>
        </span>
      </button>
    </Popover>
  );
}
