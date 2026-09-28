"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Segmented } from "antd";
import { Check, Crown, Minus, Sparkles, Zap } from "lucide-react";
import { formatPrice, useBilling } from "../BillingProvider";
import { previewPrices } from "@/lib/paddle";
import { TEMPLATES, planIncludes } from "@/pdf/registry";
import { BuilderLink } from "@/components/BuilderLauncher";

/**
 * The three plans from the admin settings, with a monthly / yearly switch. With Paddle
 * connected, prices are Paddle's own totals in the visitor's currency, and the buttons
 * open checkout (or switch an existing subscription).
 */
export default function PricingPlans({ config }) {
  const [yearly, setYearly] = useState(false);
  const { plans, currency, freeMode, aiFeatures, appFeatures = [], featureCosts } = config;
  const hasYearly = plans.some((p) => p.yearlyPrice > 0);
  const billing = useBilling();
  const paddle = config.paddle;
  const sub = billing?.subscription;
  // Biggest yearly saving, for the switch's label.
  const saving = Math.max(0, ...plans.filter((p) => p.price > 0 && p.yearlyPrice > 0).map((p) => Math.round((1 - p.yearlyPrice / (p.price * 12)) * 100)));

  // Paddle's formatted totals ({ [priceId]: "€6.49" }): shown exactly as Paddle returns them.
  // (The preview runs in the visitor's browser, so Paddle locates them by IP.)
  const [local, setLocal] = useState({});
  useEffect(() => {
    if (!paddle) return;
    const ids = Object.values(paddle.prices).flatMap((p) => Object.values(p)).filter(Boolean);
    previewPrices(paddle, ids).then(setLocal).catch(() => {}); // falls back to the plan prices
  }, [paddle]);
  const shown = (p) => local[paddle?.prices?.[p.id]?.[yearly ? "year" : "month"]] || formatPrice(yearly ? p.yearlyPrice : p.price, currency);

  // Back from signing up with ?checkout=pro-month: continue to the checkout they picked.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !billing?.config || !billing.usage) return;
    const want = new URLSearchParams(window.location.search).get("checkout");
    const [planId, interval] = String(want || "").split("-");
    if (!planId) return;
    resumed.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-off read of the URL after signing up
    if (interval === "year") setYearly(true);
    billing.checkout(planId, interval === "year" ? "year" : "month");
  }, [billing]);

  return (
    <>
      {freeMode.enabled ? (
        <div className="mx-auto mt-8 flex max-w-2xl items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm text-emerald-900">
          <Sparkles size={18} className="shrink-0 text-emerald-600" />
          <span>
            <b>{freeMode.label}.</b> Every feature is open to everyone right now, with {freeMode.dailyCredits} AI credits a day.
          </span>
        </div>
      ) : null}

      {hasYearly ? (
        <div className="mt-8 flex justify-center">
          <Segmented
            value={yearly ? "yearly" : "monthly"}
            onChange={(v) => setYearly(v === "yearly")}
            options={[{ label: "Monthly", value: "monthly" }, { label: saving > 0 ? `Yearly · save ${saving}%` : "Yearly", value: "yearly" }]}
          />
        </div>
      ) : null}

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const paid = p.price > 0;
          const interval = yearly ? "year" : "month";
          const current = sub?.active && sub.plan === p.id;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl border bg-white p-7 ${p.highlight ? "border-brand shadow-[0_24px_60px_-24px_rgba(0,123,123,.45)] ring-1 ring-brand" : "border-slate-200 shadow-sm"}`}
            >
              {p.highlight ? (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow">
                  <Crown size={12} /> Most popular
                </span>
              ) : null}
              <h2 className="font-display text-xl font-bold text-ink">{p.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-slate-500">{p.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-ink">{shown(p)}</span>
                {paid ? <span className="text-sm text-slate-500">/ {yearly ? "year" : "month"}</span> : null}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-slate-600">
                <Zap size={14} className="fill-amber-400 text-amber-500" /> {p.credits.toLocaleString()} AI credits a {p.creditPeriod}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-600">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand" /> {perk}
                  </li>
                ))}
              </ul>
              {!paid ? (
                <BuilderLink className="mt-7 block rounded-xl border border-slate-300 py-2.5 text-center font-semibold text-ink transition hover:border-brand hover:text-brand">
                  Start for free
                </BuilderLink>
              ) : freeMode.enabled ? (
                <span className="mt-7 block rounded-xl bg-emerald-50 py-2.5 text-center font-semibold text-emerald-700">Free right now</span>
              ) : current && sub.interval === interval ? (
                <div className="mt-7 text-center">
                  <span className="block rounded-xl bg-brand-50 py-2.5 font-semibold text-brand">Your plan</span>
                  <button type="button" onClick={billing.openPortal} className="mt-2 text-sm font-medium text-slate-500 hover:text-brand">
                    Manage billing
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => billing.checkout(p.id, interval)}
                  className={`mt-7 block w-full rounded-xl py-2.5 text-center font-semibold transition ${p.highlight ? "bg-brand text-white hover:bg-brand/90" : "bg-ink text-white hover:bg-ink/90"}`}
                >
                  {current ? `Switch to ${yearly ? "yearly" : "monthly"}` : sub?.active ? `Switch to ${p.name}` : `Get ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {paddle && !freeMode.enabled ? (
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500">
          Prices include VAT or sales tax where it applies. Plans renew automatically; cancel any time. Payments are handled by Paddle. By subscribing you agree to our{" "}
          <Link href="/terms" className="font-medium text-brand hover:underline">Terms</Link> and{" "}
          <Link href="/refunds" className="font-medium text-brand hover:underline">Refund Policy</Link>, including a 14-day refund on your first payment.
        </p>
      ) : null}

      {/* Generated from the plan settings, so it always matches what's actually locked. */}
      <div className="mx-auto mt-14 max-w-5xl overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="p-4 font-display text-base font-bold text-ink">Compare plans</th>
              {plans.map((p) => (
                <th key={p.id} className={`p-4 text-center font-semibold ${p.highlight ? "text-brand" : "text-ink"}`}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="p-4 text-slate-700">AI credits</td>
              {plans.map((p) => (
                <td key={p.id} className="p-4 text-center font-medium text-ink tabular-nums">
                  {freeMode.enabled && p.id === "free" ? `${freeMode.dailyCredits} / day` : `${p.credits.toLocaleString()} / ${p.creditPeriod}`}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 text-slate-700">Resume templates</td>
              {plans.map((p) => (
                <td key={p.id} className="p-4 text-center font-medium text-ink tabular-nums">
                  {freeMode.enabled ? TEMPLATES.length : TEMPLATES.filter((t) => planIncludes(p.id, t, config.templates)).length} of {TEMPLATES.length}
                </td>
              ))}
            </tr>
            {[...appFeatures, ...aiFeatures].map((f) => (
              <tr key={f.key}>
                <td className="p-4">
                  <span className="text-slate-700">{f.name}</span>
                  {featureCosts[f.key] != null && aiFeatures.some((a) => a.key === f.key) ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-400"><Zap size={11} className="fill-amber-400 text-amber-500" /> {featureCosts[f.key]}</span>
                  ) : null}
                </td>
                {plans.map((p) => (
                  <td key={p.id} className="p-4 text-center">
                    {freeMode.enabled || p.features[f.key] ? (
                      <Check size={18} className="mx-auto text-brand" aria-label="Included" />
                    ) : (
                      <Minus size={18} className="mx-auto text-slate-300" aria-label="Not included" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4 text-slate-700">Live PDF builder, PDF download, private mode</td>
              {plans.map((p) => <td key={p.id} className="p-4 text-center"><Check size={18} className="mx-auto text-brand" aria-label="Included" /></td>)}
            </tr>
          </tbody>
        </table>
        {freeMode.enabled ? <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{freeMode.label}: every feature is open to everyone right now.</p> : null}
      </div>

      <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-ink">How credits work</h2>
        <p className="mt-1 text-sm text-slate-600">AI features use credits from your allowance, which refreshes automatically. Credits only work for the AI features your plan includes. The ATS check never uses credits.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {aiFeatures.map((f) => (
            <li key={f.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-700">{f.name}</span>
              <span className="inline-flex items-center gap-1 font-semibold text-ink">
                <Zap size={13} className="fill-amber-400 text-amber-500" /> {featureCosts[f.key]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
