"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BellRing, CircleUserRound, IdCard, SquareKanban, Ticket, Wand2 } from "lucide-react";
import { Stagger, StaggerItem, Reveal } from "./motion";
import { formatPrice, useBilling } from "./BillingProvider";

const ease = [0.22, 1, 0.36, 1];

const POINTS = [
  { icon: CircleUserRound, title: "One Career Profile", text: "Everything you've done, written once. Every resume picks from it, and edits can flow back." },
  { icon: SquareKanban, title: "Every application on one board", text: "Saved to offer, with deadlines, interviews and the exact resume you sent." },
  { icon: Wand2, title: "A resume for each job, in seconds", text: "Paste the circular and get a resume that leads with what it asks for. Free, and nothing is made up." },
  { icon: BellRing, title: "Never miss a deadline", text: "Email reminders, a weekly digest and one-click calendar export." },
  { icon: IdCard, title: "Biodata when it's asked for", text: "Formal biodata templates. Personal details stay in that one CV and are never shared." },
];

const COLUMNS = [
  { name: "Saved", dot: "bg-slate-400", cards: [["Lecturer, CSE", "Due tomorrow", true], ["Product Analyst", "BRAC"]] },
  { name: "Applied", dot: "bg-brand", cards: [["Software Engineer", "Pathao"]] },
  { name: "Interview", dot: "bg-violet-500", cards: [["Backend Engineer", "Thu, 11:00", true]] },
];

/** The board-and-meter picture beside the list: plain markup, animated on scroll. */
function Picture() {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand/30 via-teal-400/10 to-transparent blur-2xl" />
      <div className="relative rounded-3xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur sm:p-5">
        <div className="grid grid-cols-3 gap-2.5">
          {COLUMNS.map((c, ci) => (
            <div key={c.name} className="rounded-2xl bg-white/[0.05] p-2">
              <p className="flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wider text-white/60 uppercase">
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} /> {c.name}
              </p>
              <div className="mt-2 space-y-2">
                {c.cards.map(([title, sub, hot], i) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease, delay: 0.2 + ci * 0.15 + i * 0.1 }}
                    className="rounded-xl bg-white p-2.5 shadow-sm"
                  >
                    <p className="truncate text-[11px] font-semibold text-ink">{title}</p>
                    <p className={`mt-0.5 truncate text-[10px] ${hot ? "font-medium text-rose-600" : "text-slate-500"}`}>{sub}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease, delay: 0.7 }}
          className="relative mt-4 rounded-2xl bg-white p-4 shadow-xl shadow-black/20 sm:-mr-8 sm:ml-10"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-teal-600 text-white"><Wand2 size={15} /></span>
            <p className="text-sm font-semibold text-ink">Tailored for Backend Engineer</p>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-base text-slate-400 line-through decoration-slate-300">46%</span>
            <span className="font-display text-2xl font-bold text-ink">82%</span>
            <span className="text-xs text-slate-500">keyword coverage</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand to-teal-500"
              initial={{ width: "46%" }}
              whileInView={{ width: "82%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease, delay: 1 }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Node.js", "PostgreSQL", "REST APIs"].map((k) => (
              <span key={k} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-dark ring-1 ring-brand-200">{k}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * The V2 job-search tools on the home page. Shown only once V2 is switched on for
 * everyone (or to accounts that can already preview it), so the site never promises
 * something a visitor can't open yet.
 */
export default function JobSearchShowcase() {
  const billing = useBilling();
  const config = billing?.config;
  if (!config || !(config.v2?.enabled || billing.v2)) return null;
  const pass = config.pass;
  const passPlan = pass && config.plans?.find((p) => p.id === pass.plan)?.name;

  return (
    <section className="relative overflow-hidden bg-navy py-20 text-white">
      <div className="bg-grid absolute inset-0 opacity-[0.15]" />
      <div aria-hidden className="animate-blob absolute -top-32 -left-20 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
      <div aria-hidden className="animate-blob absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-teal-400/15 blur-3xl" style={{ animationDelay: "-7s" }} />
      <div className="container-x relative grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-200 ring-1 ring-white/15">New · Job search</span>
            <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Your whole job search, in one place</h2>
            <p className="mt-3 max-w-xl text-white/70">More than a resume builder: keep your career in one profile, track every application, and send each job a resume made for it.</p>
          </Reveal>
          <Stagger as="ul" className="mt-8 space-y-4" gap={0.08}>
            {POINTS.map((p) => (
              <StaggerItem as="li" key={p.title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-teal-200 ring-1 ring-white/10">
                  <p.icon size={19} />
                </span>
                <span>
                  <span className="block font-semibold">{p.title}</span>
                  <span className="block text-sm leading-relaxed text-white/65">{p.text}</span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="mt-9 flex flex-wrap items-center gap-3" delay={0.1}>
            <Link href="/career" className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-navy shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-50">
              Start my Career Profile <ArrowRight size={18} className="transition group-hover:translate-x-1" />
            </Link>
            <Link href="/applications" className="inline-flex items-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white/85 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white">
              Track my applications
            </Link>
          </Reveal>
          {pass && passPlan ? (
            <Reveal delay={0.15}>
              <Link href="/pricing" className="mt-5 inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white">
                <Ticket size={15} className="text-teal-200" />
                Job hunting for a while? {passPlan} for {pass.days} days{pass.price != null ? `, ${formatPrice(pass.price, config.currency)}` : ""}, one payment.
                <ArrowRight size={14} />
              </Link>
            </Reveal>
          ) : null}
        </div>
        <Picture />
      </div>
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
