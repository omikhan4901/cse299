"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Bell, Briefcase, CalendarClock, Clock3, MessagesSquare, Send } from "lucide-react";
import { dueItems, funnel } from "@/lib/applications";
import { useApplications } from "./useApplications";

const WHEN = (d) => (d === 0 ? "today" : d === 1 ? "tomorrow" : d === -1 ? "yesterday" : d < 0 ? `${-d} days ago` : `in ${d} days`);
const KIND = {
  deadline: { icon: CalendarClock, tone: "text-amber-600 bg-amber-50", text: (i) => `Deadline ${WHEN(i.days)}` },
  missed: { icon: CalendarClock, tone: "text-rose-600 bg-rose-50", text: (i) => `Deadline passed ${WHEN(i.days)}. Applied?` },
  followUp: { icon: Send, tone: "text-brand bg-brand-50", text: () => "Time to follow up" },
  interview: { icon: MessagesSquare, tone: "text-violet-600 bg-violet-50", text: (i) => `${i.detail || "Interview"} ${WHEN(i.days)}` },
  noResponse: { icon: Clock3, tone: "text-slate-500 bg-slate-100", text: (i) => `No news for ${i.days} days. Mark as no response?` },
};

/** The top of the dashboard for V2 accounts: what needs doing now, and how the search is going. */
export default function TodayPanel({ token }) {
  const { apps } = useApplications(token);
  if (!apps) return <div className="mb-8 h-32 animate-pulse rounded-2xl bg-white/70" />;

  if (!apps.length) {
    return (
      <Link href="/applications" className="group mb-8 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-brand-200 hover:shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Briefcase size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Track the jobs you apply to</span>
          <span className="block text-sm text-slate-500">Deadlines, follow-ups and the exact resume you sent, in one place.</span>
        </span>
        <ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand" />
      </Link>
    );
  }

  const due = dueItems(apps).slice(0, 5);
  const f = funnel(apps);
  const stats = [
    ["In progress", f.active],
    ["Applied", f.applied],
    ["Interviews", f.interviewing],
    ["Offers", f.offers],
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-ink">Your search</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {stats.map(([label, n]) => (
            <div key={label}>
              <p className="font-display text-2xl font-bold text-ink tabular-nums">{n}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">{f.thisWeek ? `${f.thisWeek} sent this week.` : "Nothing sent this week yet."}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Bell size={15} className="text-brand" /> Coming up</p>
          <Link href="/applications" className="text-xs font-medium text-brand hover:underline">All applications</Link>
        </div>
        {due.length ? (
          <ul className="mt-3 space-y-1">
            {due.map((i) => {
              const k = KIND[i.kind];
              const Icon = k.icon;
              return (
                <li key={`${i.kind}-${i.app._id}-${i.at}`}>
                  <Link href={`/applications?open=${i.app._id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-50">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${k.tone}`}><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{i.name}</span>
                      <span className="block text-xs text-slate-500">{k.text(i)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Nothing due this week. Nice.</p>
        )}
      </div>
    </motion.div>
  );
}
