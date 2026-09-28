"use client";

import Link from "next/link";
import { ArrowRight, Crown } from "lucide-react";
import { useBilling } from "../BillingProvider";

/**
 * "Use this template" on a template page. When plans are enforced and the
 * template needs a paid plan, says so up front instead of after sign-up.
 */
export default function TemplateCta({ template, premium }) {
  const billing = useBilling();
  const plan = premium ? billing?.lockFor("premiumTemplates") : null;
  const button = "group inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold shadow-lg transition hover:-translate-y-0.5";
  if (!plan) {
    return (
      <Link href={`/builder?template=${template.id}`} className={`${button} bg-brand text-white shadow-brand/25`}>
        Use this template <ArrowRight size={18} className="transition group-hover:translate-x-1" />
      </Link>
    );
  }
  return (
    <div className="w-full">
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <Crown size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-amber-950">
          <b>{template.name} is a {plan.name} template.</b> On the free plan you can use every ATS-friendly and student template. Everything else, including the ATS check and PDF downloads, is free.
        </p>
      </div>
      <button type="button" onClick={() => billing.requireFeature("premiumTemplates", `The ${template.name} template`)} className={`${button} bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-amber-500/25`}>
        <Crown size={18} /> Get {plan.name} to use it
      </button>
    </div>
  );
}
