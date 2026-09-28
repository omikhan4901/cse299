"use client";

import { useState } from "react";
import Link from "next/link";
import { Segmented } from "antd";
import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { formatPrice } from "../BillingProvider";
import { CONTACT_EMAIL } from "@/lib/config";

/** The three plans from the admin settings, with a monthly / yearly switch. */
export default function PricingPlans({ config }) {
  const [yearly, setYearly] = useState(false);
  const { plans, currency, freeMode, aiFeatures, featureCosts } = config;
  const hasYearly = plans.some((p) => p.yearlyPrice > 0);

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
            options={[{ label: "Monthly", value: "monthly" }, { label: "Yearly · save more", value: "yearly" }]}
          />
        </div>
      ) : null}

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const price = yearly ? p.yearlyPrice : p.price;
          const paid = p.price > 0;
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
                <span className="font-display text-4xl font-extrabold text-ink">{formatPrice(price, currency)}</span>
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
                <Link href="/builder" className="mt-7 block rounded-xl border border-slate-300 py-2.5 text-center font-semibold text-ink transition hover:border-brand hover:text-brand">
                  Start for free
                </Link>
              ) : freeMode.enabled ? (
                <span className="mt-7 block rounded-xl bg-emerald-50 py-2.5 text-center font-semibold text-emerald-700">Free right now</span>
              ) : (
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Upgrade to ${p.name}`)}`}
                  className={`mt-7 block rounded-xl py-2.5 text-center font-semibold transition ${p.highlight ? "bg-brand text-white hover:bg-brand/90" : "bg-ink text-white hover:bg-ink/90"}`}
                >
                  Get {p.name}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-ink">How credits work</h2>
        <p className="mt-1 text-sm text-slate-600">AI features use credits from your allowance, which refreshes automatically. The ATS check never uses credits.</p>
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
