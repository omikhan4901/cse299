"use client";

import { useState } from "react";
import { PauseCircle, X } from "lucide-react";
import { useBilling } from "../BillingProvider";

export const pausedText = (p) =>
  p?.until
    ? `AI features are paused until ${new Date(p.until).toLocaleDateString(undefined, { day: "numeric", month: "long", timeZone: "UTC" })}.`
    : "AI features are paused for a little while.";

/**
 * Shown when AI is paused (the monthly spending cap is reached, or an admin paused it), so
 * nobody tries an AI action only to be refused. Everything else keeps working. Dismissible
 * for the session.
 */
export default function AiPausedNotice() {
  const billing = useBilling();
  const [hidden, setHidden] = useState(false);
  const paused = billing?.config?.aiPaused;
  if (!paused || hidden) return null;
  return (
    <div role="status" className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 shadow-lg sm:max-w-sm">
      <PauseCircle size={17} className="shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1">{pausedText(paused)} Everything else works as usual.</p>
      <button type="button" aria-label="Dismiss" onClick={() => setHidden(true)} className="shrink-0 text-amber-700 hover:text-amber-900"><X size={15} /></button>
    </div>
  );
}
