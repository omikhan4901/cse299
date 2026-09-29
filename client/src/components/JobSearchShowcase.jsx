"use client";

import Link from "next/link";
import { ArrowRight, BellRing, CircleUserRound, SquareKanban, Wand2 } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./motion";
import { useBilling } from "./BillingProvider";

const POINTS = [
  { icon: CircleUserRound, title: "One Career Profile", text: "Write your experience once. Every resume picks from it, and improvements can flow back." },
  { icon: Wand2, title: "A resume for each job", text: "Paste the job circular and get a resume that leads with what it asks for. Nothing is made up." },
  { icon: SquareKanban, title: "Every application in one place", text: "Saved to offer on one board, with the exact resume you sent to each job." },
  { icon: BellRing, title: "Never miss a deadline", text: "Email reminders for deadlines and interviews, and one-click calendar export." },
];

/**
 * The V2 job-search tools on the home page, in the same style as the feature cards above.
 * Shown only once V2 is switched on for everyone (or to accounts that can already preview
 * it), so the site never promises something a visitor can't open yet.
 */
export default function JobSearchShowcase() {
  const billing = useBilling();
  const config = billing?.config;
  if (!config || !(config.v2?.enabled || billing.v2)) return null;

  return (
    <section className="container-x border-t border-slate-100 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-wider text-brand uppercase">Job search</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Your whole job search, in one place</h2>
        <p className="mt-3 text-slate-600">Keep your career in one profile, send each job a resume made for it, and track every application.</p>
      </Reveal>
      <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" gap={0.07}>
        {POINTS.map((f) => (
          <StaggerItem key={f.title} className="group rounded-2xl border border-slate-200 p-6 transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand transition duration-300 group-hover:scale-110 group-hover:rotate-6">
              <f.icon size={21} />
            </span>
            <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{f.text}</p>
          </StaggerItem>
        ))}
      </Stagger>
      <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/career" className="group inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition hover:-translate-y-0.5 hover:bg-brand-dark">
          Start my Career Profile <ArrowRight size={18} className="transition group-hover:translate-x-1" />
        </Link>
        <Link href="/applications" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-ink transition hover:-translate-y-0.5 hover:border-brand-200 hover:text-brand hover:shadow-md">
          Track my applications
        </Link>
      </Reveal>
      {config.showPricing ? (
        <p className="mt-4 text-center text-sm text-slate-500">
          Free to start. <Link href="/pricing" className="font-medium text-brand hover:underline">Pro and Premium</Link> add more tracked jobs, tailored resumes and tailoring in bulk.
        </p>
      ) : null}
    </section>
  );
}

const FAQ = [
  { q: "What is the Career Profile?", a: "One place for everything true about your career: every job, project and skill. Resumes are made from it, so you write things once. It replaces the master resume." },
  { q: "How does tailoring work?", a: "Paste the job circular and ResumeX picks the jobs, points and skills from your profile that match it, with the skills the job asks for first. It's free, uses no AI and never adds anything that isn't in your profile." },
  { q: "Can I track my applications?", a: "Yes. Save each job, follow it from saved to offer on a board, and keep deadlines, interviews, contacts and the exact resume you sent. You can get email reminders and add dates to your calendar." },
  { q: "Can I make a biodata?", a: "Yes. Choose a biodata template and fill in the personal details it asks for. They are kept in that one CV only: never in your profile, never sent to AI and never shown on share links." },
];

/** Extra About-page questions for the job-search tools, shown on the same terms as the showcase. */
export function JobSearchFaq() {
  const billing = useBilling();
  const config = billing?.config;
  if (!config || !(config.v2?.enabled || billing.v2)) return null;
  return FAQ.map((f) => (
    <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-ink">
        {f.q}
        <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 leading-relaxed text-slate-600">{f.a}</p>
    </details>
  ));
}
