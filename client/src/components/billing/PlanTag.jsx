"use client";

import { Crown } from "lucide-react";
import { useBilling } from "../BillingProvider";

/**
 * A small "PRO" style tag shown on a control whose feature this account's plan
 * doesn't include, so it's clear before anyone clicks. Renders nothing when the
 * feature is usable (including whenever free mode is on).
 */
export default function PlanTag({ feature, locked, className = "" }) {
  const billing = useBilling();
  const plan = locked !== undefined ? (locked ? billing?.upgradePlanFor(feature) || { name: "Pro" } : null) : billing?.lockFor(feature);
  if (!plan) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-1.5 py-px text-[10px] leading-4 font-bold tracking-wide text-amber-950 uppercase shadow-sm ${className}`}>
      <Crown size={9} strokeWidth={2.5} /> {plan.name}
    </span>
  );
}
