"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Crown } from "lucide-react";
import { useBilling } from "../BillingProvider";
import FeaturePreview from "./FeaturePreview";

/**
 * A whole part of the site the account's plan doesn't include (Career Profile, Applications):
 * what it does, shown with the animated previews of the real screens, and one clear next step.
 *
 *   feature   the plan feature (for the upgrade dialog and the plan tag)
 *   scenes    [{ feature: previewKey, title, text }] — two to four previews
 */
export default function LockedArea({ feature, title, intro, scenes }) {
  const billing = useBilling();
  const plan = billing?.upgradePlanFor?.(feature);
  return (
    <div className="container-x py-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-dark">
          <Crown size={12} /> Part of {plan?.name || "a paid plan"}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-slate-600">{intro}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => billing?.requireFeature(feature)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark"
          >
            <Crown size={16} /> {billing?.paymentsOpen ? `Get ${plan?.name || "it"}` : "See what's included"}
          </button>
          <Link href="/dashboard" className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 font-semibold text-ink transition hover:border-brand hover:text-brand">
            Back to my resumes
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
        {scenes.map((s, i) => (
          <motion.section
            key={s.feature}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <FeaturePreview request={{ feature: s.feature }} />
            <h2 className="mt-3 font-semibold text-ink">{s.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.text}</p>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
