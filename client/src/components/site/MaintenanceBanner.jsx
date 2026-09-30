"use client";

import { Wrench } from "lucide-react";
import { useBilling } from "../BillingProvider";

/** Maintenance mode (Admin › Site): a thin bar saying saving is paused and why. */
export default function MaintenanceBanner() {
  const m = useBilling()?.config?.maintenance;
  if (!m) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <Wrench size={15} className="shrink-0 text-amber-600" /> {m.message}
    </div>
  );
}
