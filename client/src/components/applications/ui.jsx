"use client";

import { CalendarClock } from "lucide-react";
import { daysUntil, statusOf } from "@/lib/applications";

/** Status colours: one quiet tone per status, used for dots, chips and column headers. */
export const TONE = {
  slate: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700", ring: "border-slate-200" },
  sky: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700", ring: "border-sky-200" },
  brand: { dot: "bg-brand", chip: "bg-brand-50 text-brand-dark", ring: "border-brand-200" },
  violet: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700", ring: "border-violet-200" },
  emerald: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", ring: "border-emerald-200" },
  rose: { dot: "bg-rose-400", chip: "bg-rose-50 text-rose-700", ring: "border-rose-200" },
  amber: { dot: "bg-amber-400", chip: "bg-amber-50 text-amber-800", ring: "border-amber-200" },
};

export function StatusChip({ status, className = "" }) {
  const s = statusOf(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[s.tone].chip} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${TONE[s.tone].dot}`} /> {s.label}
    </span>
  );
}

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** "Due in 3 days" / "Due today" / "Closed 2 days ago", coloured by urgency. */
export function DeadlineChip({ deadline, open = true }) {
  if (!deadline) return null;
  const d = daysUntil(deadline);
  const text = !open ? `Deadline ${fmt(deadline)}` : d < 0 ? `Deadline passed · ${fmt(deadline)}` : d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : d <= 14 ? `Due in ${d} days` : `Due ${fmt(deadline)}`;
  const tone = !open ? "text-slate-400" : d < 0 ? "text-slate-400" : d <= 2 ? "text-rose-600" : d <= 7 ? "text-amber-600" : "text-slate-500";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
      <CalendarClock size={12} /> {text}
    </span>
  );
}

export const jobName = (a) => a.job?.title || a.job?.organisation || "Untitled";
