"use client";

import Link from "next/link";
import { Modal } from "antd";
import { motion } from "motion/react";
import { Check, Crown, Sparkles, Zap } from "lucide-react";

const price = (amount, currency) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};
const periodWord = (p) => (p === "month" ? "a month" : "a day");
const listNames = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * Explains a locked feature: what it does, which plan has it and what the
 * person's current plan (and its credits) still covers. `billing` is the
 * billing context value, passed in by BillingProvider.
 */
export default function UpgradeModal({ request, onClose, billing }) {
  const feature = request ? billing.featureInfo(request.feature) : null;
  const plan = request ? billing.lockFor(request.feature) || billing.upgradePlanFor(request.feature) : null;
  const currency = billing.config?.currency || "USD";
  const usage = billing.usage;
  const current = billing.plan || billing.config?.plans?.[0];
  const usable = billing.usableAiFeatures();
  const title = request?.what || feature?.name || "This feature";

  return (
    <Modal open={!!request} onCancel={onClose} footer={null} width={480} centered destroyOnHidden>
      {request ? (
        <div className="pt-2">
          <motion.span
            initial={{ scale: 0.6, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30"
          >
            <Crown size={22} />
          </motion.span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink">
            {title} is part of {plan?.name || "a paid plan"}
          </h2>
          {feature?.description ? <p className="mt-1 text-sm text-slate-600">{feature.description}</p> : null}

          {plan?.price != null ? (
            <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink">{plan.name}</p>
                <p className="text-sm text-slate-600">
                  <b className="font-display text-xl text-ink">{price(plan.price, currency)}</b> / month
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                <li className="flex gap-2"><Zap size={15} className="mt-0.5 shrink-0 fill-amber-400 text-amber-500" /> {plan.credits.toLocaleString()} AI credits {periodWord(plan.creditPeriod)}</li>
                {(plan.perks || []).slice(0, 3).map((perk) => (
                  <li key={perk} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-brand" /> {perk}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="flex items-center gap-1.5 font-medium text-ink"><Sparkles size={14} className="text-brand" /> On your {current?.name || "Free"} plan</p>
            {usage ? (
              <p className="mt-1">
                You have <b className="text-ink">{usage.remaining} of {usage.limit} credits</b> left {usage.period === "month" ? "this month" : "today"}.{" "}
                {usable.length ? <>They work for {listNames(usable.map((f) => f.name))}.</> : <>Your plan doesn&apos;t include any AI features yet, so upgrading is the way to use them.</>}
              </p>
            ) : (
              <p className="mt-1">
                {usable.length ? <>A free account gets AI credits for {listNames(usable.map((f) => f.name))}.</> : <>Building, checking and downloading your resume stays free.</>}
              </p>
            )}
            <p className="mt-1">Building, the ATS check and PDF downloads are always free.</p>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href="/pricing" onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
              Compare plans
            </Link>
            <a href={billing.upgradeHref(plan)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark">
              <Crown size={15} /> Get {plan?.name || "a paid plan"}
            </a>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
