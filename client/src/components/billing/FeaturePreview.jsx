"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, Copy, FileText, Lightbulb, Link2, Quote, Sparkles, Upload, Wand2 } from "lucide-react";

/**
 * What a locked feature looks like in use, shown in the upgrade dialog: a small, looping
 * replay of the real screen with example data (docs: the person should *see* what they'd
 * get). Built from the site's own markup, not illustrations. With reduced motion, the
 * finished state is shown still.
 */

/** Steps 0..total, one every `ms`, holding the last for `hold` ms, then again. `cycle` counts the loops. */
function useTimeline(total, { ms = 850, hold = 2600 } = {}) {
  const still = useReducedMotion();
  const [t, setT] = useState({ step: 0, cycle: 0 });
  useEffect(() => {
    if (still) return;
    const id = setTimeout(() => setT((x) => (x.step >= total ? { step: 0, cycle: x.cycle + 1 } : { ...x, step: x.step + 1 })), t.step >= total ? hold : ms);
    return () => clearTimeout(id);
  }, [t, total, ms, hold, still]);
  return still ? { step: total, cycle: 0, still: true } : { ...t, still: false };
}

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3 } };
const Card = ({ className = "", children, ...rest }) => (
  <motion.div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} {...rest}>
    {children}
  </motion.div>
);
const Bar = ({ w, className = "" }) => <span className={`block h-1.5 rounded-full bg-slate-200 ${className}`} style={{ width: w }} />;

/** Words appearing one after another, like text being written. */
function Typed({ text, delay = 0, cycle, still, className = "" }) {
  const words = text.split(" ");
  return (
    <p key={cycle} className={className}>
      {words.map((w, i) => (
        <motion.span key={i} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + i * 0.045, duration: 0.15 }}>
          {w}{" "}
        </motion.span>
      ))}
    </p>
  );
}

const Chip = ({ children, tone = "slate" }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone === "brand" ? "bg-brand-50 text-brand-dark" : tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
    {children}
  </span>
);

// ---------------------------------------------------------------- scenes

function PrepScene({ ai }) {
  const { step } = useTimeline(6);
  const qs = ["How do you stop a payout being paid twice?", "Tell me about a release that went wrong.", "Why do you want to work on payments here?"];
  return (
    <div>
      <div className="flex items-center gap-2">
        <Chip>Backend Engineer · Nagad</Chip>
        {ai ? <Chip tone="brand"><Sparkles size={11} /> For this job</Chip> : <Chip tone="brand">Software and engineering</Chip>}
      </div>
      <div className="mt-2.5 space-y-1.5">
        {qs.map((q, i) =>
          step >= 1 ? (
            <Card key={q} {...fade} transition={{ duration: 0.3, delay: i * 0.12 }} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{q}</p>
                <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${i === 0 && step >= 2 ? "rotate-180" : ""}`} />
              </div>
              <AnimatePresence initial={false}>
                {i === 0 && step >= 2 ? (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <p className="mt-1.5 text-[11.5px] text-slate-500">They&apos;re checking: how you keep money-moving code correct.</p>
                    <ul className="mt-1 space-y-0.5 text-[11.5px] text-slate-700">
                      {["Idempotency keys on every payout", "A unique constraint as the last guard"].map((o, j) =>
                        step >= 3 + j ? <motion.li key={o} {...fade} className="flex gap-1.5"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" />{o}</motion.li> : null
                      )}
                    </ul>
                    {step >= 5 ? (
                      <motion.p {...fade} className="mt-1.5 flex gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                        <Quote size={11} className="mt-0.5 shrink-0 text-slate-400" /> Build on: Rebuilt the payout service, cutting settlement from 2 days to 4 hours
                      </motion.p>
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </Card>
          ) : null
        )}
      </div>
    </div>
  );
}

function InsightsScene() {
  const { step } = useTimeline(4);
  const rows = [
    { label: "Tailored for the job", pct: 38, tone: "bg-brand" },
    { label: "Same resume every time", pct: 12, tone: "bg-slate-400" },
  ];
  return (
    <div>
      <p className="text-[12px] font-semibold text-ink">Interview rate by resume</p>
      <p className="text-[11px] text-slate-500">From your own 21 applications</p>
      <div className="mt-3 space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.label}>
            <div className="flex justify-between text-[11.5px] text-slate-600">
              <span>{r.label}</span>
              <span className="font-semibold text-ink tabular-nums">{step >= 1 + i ? `${r.pct}%` : ""}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-white ring-1 ring-slate-200">
              <motion.div className={`h-full rounded-full ${r.tone}`} initial={false} animate={{ width: step >= 1 + i ? `${r.pct * 2}%` : "0%" }} transition={{ duration: 0.7, ease: "easeOut" }} />
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {step >= 3 ? (
          <Card {...fade} className="mt-3 flex items-center gap-2 px-3 py-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand"><Lightbulb size={13} /></span>
            <p className="text-[12px] text-slate-700"><b className="font-semibold text-ink">3× more interviews</b> when you tailored the resume.</p>
          </Card>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CoverScene() {
  const { step, cycle, still } = useTimeline(2, { hold: 5200 });
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>For: Backend Engineer · Nagad</Chip>
        <Chip tone="brand">Node.js</Chip>
        <Chip tone="brand">PostgreSQL</Chip>
      </div>
      <Card className="mt-2.5 px-3.5 py-3">
        {step >= 1 ? (
          <>
            <Typed cycle={cycle} still={still} className="text-[12px] text-slate-500" text="Dear Hiring Team," />
            <Typed
              cycle={cycle}
              still={still}
              delay={0.3}
              className="mt-1.5 text-[12px] leading-relaxed text-slate-700"
              text="At Pathao I rebuilt the rider payout service in Node.js and PostgreSQL, cutting settlement from two days to four hours. Nagad moves money for millions, and that is the work I want to do next."
            />
          </>
        ) : (
          <div className="space-y-2 py-1"><Bar w="30%" /><Bar w="95%" /><Bar w="88%" /><Bar w="60%" /></div>
        )}
      </Card>
    </div>
  );
}

function PolishScene() {
  const { step } = useTimeline(5);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-ink">Polish for Backend Engineer · Nagad</p>
        <span className="text-[11px] text-slate-500 tabular-nums">
          Job match <b className={`font-semibold ${step >= 4 ? "text-brand" : "text-ink"}`}>{step >= 4 ? "84%" : "62%"}</b>
        </span>
      </div>
      <Card className="mt-2.5 px-3 py-2">
        <p className={`text-[12.5px] transition-colors ${step >= 1 ? "text-slate-400 line-through decoration-rose-300" : "text-slate-700"}`}>Worked on the payment system using Node.js and Redis</p>
        <AnimatePresence>
          {step >= 2 ? (
            <motion.p {...fade} className="mt-1 rounded-md bg-brand-50 px-2 py-1 text-[12.5px] font-medium text-brand-dark">
              Built payment services in Node.js with Redis caching
            </motion.p>
          ) : null}
        </AnimatePresence>
        {step >= 3 ? (
          <motion.div {...fade} className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">Only your facts, in the job&apos;s words</span>
            <span className="flex gap-1.5">
              <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">Skip</span>
              <motion.span animate={step >= 4 ? { scale: [1, 1.08, 1] } : {}} className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-[11px] font-semibold text-white"><Check size={11} /> Accept</motion.span>
            </span>
          </motion.div>
        ) : null}
      </Card>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Node.js", "Payment services", "Redis"].map((k, i) => (
          <motion.span key={k} animate={{ opacity: step >= 4 ? 1 : 0.45 }} transition={{ delay: i * 0.1 }}>
            <Chip tone={step >= 4 ? "green" : "slate"}>{step >= 4 ? <Check size={10} /> : null}{k}</Chip>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function ImportScene() {
  const { step } = useTimeline(5);
  const found = ["3 jobs and 12 points", "BSc, North South University", "9 skills and 2 projects"];
  return (
    <div>
      <Card className="flex items-center gap-2.5 px-3 py-2">
        <span className="grid size-8 place-items-center rounded-lg bg-rose-50 text-rose-500"><FileText size={15} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-ink">old-resume.pdf</p>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <motion.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: step >= 1 ? "100%" : "8%" }} transition={{ duration: 0.9 }} />
          </div>
        </div>
        {step >= 2 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Upload size={15} className="text-slate-400" />}
      </Card>
      <ul className="mt-2.5 space-y-1.5">
        {found.map((f, i) =>
          step >= 2 + (i > 0 ? 1 : 0) ? (
            <motion.li key={f} {...fade} transition={{ duration: 0.3, delay: i * 0.15 }} className="flex items-center gap-2 text-[12.5px] text-slate-700">
              <Check size={14} className="text-emerald-500" /> {f}
            </motion.li>
          ) : null
        )}
      </ul>
      {step >= 4 ? (
        <motion.span {...fade} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white">
          Review 14 changes <ArrowRight size={13} />
        </motion.span>
      ) : null}
    </div>
  );
}

function AuditScene() {
  const { step } = useTimeline(4);
  const r = 30;
  const c = 2 * Math.PI * r;
  const notes = ["Lead your Pathao points with results", "Name your target role", "Move Skills above Projects"];
  return (
    <div className="flex gap-4">
      <div className="relative grid size-[76px] shrink-0 place-items-center">
        <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <motion.circle cx="38" cy="38" r={r} fill="none" stroke="#0d9488" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} initial={false} animate={{ strokeDashoffset: step >= 1 ? c * (1 - 0.78) : c }} transition={{ duration: 1, ease: "easeOut" }} />
        </svg>
        <span className="font-display text-xl font-bold text-ink tabular-nums">{step >= 1 ? 78 : "–"}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[12px] font-semibold text-ink">What to fix first</p>
        {notes.map((n, i) =>
          step >= 2 + (i > 0 ? 1 : 0) ? (
            <Card key={n} {...fade} transition={{ duration: 0.3, delay: i * 0.12 }} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-md bg-amber-50 text-[10px] font-bold text-amber-700">{i + 1}</span>
              <p className="truncate text-[12px] text-slate-700">{n}</p>
            </Card>
          ) : null
        )}
      </div>
    </div>
  );
}

function ChatScene() {
  const { step } = useTimeline(4);
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <span className="max-w-[75%] rounded-2xl rounded-br-md bg-brand px-3 py-1.5 text-[12px] text-white">How do I make my summary stronger?</span>
      </div>
      {step === 1 ? (
        <span className="inline-flex gap-1 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
          {[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-slate-400" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.12 }} />)}
        </span>
      ) : null}
      {step >= 2 ? (
        <motion.p {...fade} className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3 py-1.5 text-[12px] text-slate-700 ring-1 ring-slate-200">
          Lead with your biggest result. Here&apos;s a version from what you wrote:
        </motion.p>
      ) : null}
      {step >= 3 ? (
        <Card {...fade} className="px-3 py-2">
          <p className="text-[10.5px] font-semibold tracking-wide text-slate-400 uppercase">Proposed change · Summary</p>
          <p className="mt-0.5 text-[12px] text-slate-700">Backend engineer who cut payout settlement from 2 days to 4 hours at Pathao.</p>
          <div className="mt-1.5 flex gap-1.5">
            <motion.span animate={step >= 4 ? { scale: [1, 1.08, 1] } : {}} className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">Apply</motion.span>
            <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">Skip</span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function RefineScene() {
  const { step, cycle, still } = useTimeline(3, { hold: 3600 });
  return (
    <div>
      <Card className="px-3 py-2">
        <p className="text-[10.5px] font-semibold tracking-wide text-slate-400 uppercase">You wrote</p>
        <p className="mt-0.5 text-[12.5px] text-slate-600">responsible for handling customer complaints and made weekly reports in excel</p>
      </Card>
      <div className="my-1.5 flex justify-center text-brand"><Wand2 size={15} /></div>
      <Card className={`px-3 py-2 transition-colors ${step >= 1 ? "border-brand-200" : ""}`}>
        <p className="text-[10.5px] font-semibold tracking-wide text-brand uppercase">Rewritten</p>
        {step >= 1 ? (
          <Typed cycle={cycle} still={still} className="mt-0.5 text-[12.5px] font-medium text-ink" text="Resolved customer complaints and built weekly Excel reports for the team" />
        ) : (
          <div className="mt-1.5 space-y-1.5"><Bar w="90%" /><Bar w="55%" /></div>
        )}
      </Card>
      {step >= 3 ? <motion.p {...fade} className="mt-2 flex items-center gap-1.5 text-[11.5px] text-emerald-700"><CheckCircle2 size={13} /> Nothing added that you didn&apos;t write</motion.p> : null}
    </div>
  );
}

function ShareScene() {
  const { step } = useTimeline(4);
  const url = "resumex.app/r/nusrat-jahan";
  return (
    <div className="relative">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
          <span className="flex gap-1">{["bg-rose-300", "bg-amber-300", "bg-emerald-300"].map((c) => <span key={c} className={`size-2 rounded-full ${c}`} />)}</span>
          <span className="flex min-w-0 flex-1 items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200">
            <Link2 size={11} className="shrink-0" /> <span className="truncate">{step >= 1 ? url : ""}</span>
          </span>
        </div>
        <div className="px-4 py-3">
          {step >= 2 ? (
            <motion.div {...fade}>
              <p className="font-display text-[15px] font-bold text-ink">Nusrat Jahan</p>
              <p className="text-[11.5px] text-brand">Software Engineer · Dhaka</p>
              <div className="mt-2 space-y-1.5"><Bar w="92%" /><Bar w="80%" /><Bar w="64%" /></div>
            </motion.div>
          ) : (
            <div className="space-y-2 py-1"><Bar w="40%" /><Bar w="25%" /><Bar w="85%" /></div>
          )}
        </div>
      </Card>
      <AnimatePresence>
        {step >= 3 ? (
          <motion.span {...fade} className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1 text-[11.5px] font-medium text-white shadow-md">
            <Copy size={11} /> Link copied
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TemplatesScene({ template }) {
  const { step } = useTimeline(3, { ms: 1400, hold: 1400 });
  const ids = [...new Set([template, "Harbor", "Nordic", "Aria", "Sunset", "Executive"].filter(Boolean))].slice(0, 4);
  const center = step % ids.length; // the template asked about comes first
  return (
    <div className="relative flex h-[164px] items-center justify-center">
      {ids.map((id, i) => {
        const off = ((i - center + ids.length + 1) % ids.length) - 1; // -1, 0, 1, (2 = hidden behind)
        return (
          <motion.img
            key={id}
            src={`/templates/${id}.jpg`}
            alt=""
            className="absolute h-[156px] w-[112px] rounded-md border border-slate-200 bg-white object-cover object-top shadow-md"
            animate={{ x: off * 92, scale: off === 0 ? 1 : 0.86, rotate: off * 4, opacity: Math.abs(off) > 1 ? 0 : off === 0 ? 1 : 0.75, zIndex: off === 0 ? 2 : 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
          />
        );
      })}
    </div>
  );
}

function TailorScene() {
  const { step } = useTimeline(4);
  const jobs = [
    { job: "Backend · Nagad", pct: 84 },
    { job: "Data Analyst · BRAC", pct: 79 },
    { job: "Platform · ShopUp", pct: 81 },
  ];
  return (
    <div className="flex items-center gap-3">
      <Card className="w-[112px] shrink-0 px-3 py-2.5">
        <p className="text-[11px] font-semibold text-ink">Career Profile</p>
        <p className="text-[10.5px] text-slate-500">4 jobs · 22 points</p>
        <div className="mt-2 space-y-1.5"><Bar w="90%" /><Bar w="70%" /><Bar w="80%" /><Bar w="50%" /></div>
      </Card>
      <ArrowRight size={16} className="shrink-0 text-slate-300" />
      <div className="min-w-0 flex-1 space-y-1.5">
        {jobs.map((j, i) =>
          step >= 1 + i ? (
            <Card key={j.job} {...fade} className="flex items-center gap-2 px-2.5 py-1.5">
              <FileText size={14} className="shrink-0 text-brand" />
              <p className="min-w-0 flex-1 truncate text-[12px] text-slate-700">{j.job}</p>
              <span className="rounded-full bg-emerald-50 px-1.5 text-[11px] font-semibold text-emerald-700 tabular-nums">{j.pct}%</span>
            </Card>
          ) : null
        )}
        {step >= 4 ? <motion.p {...fade} className="text-[11px] text-slate-500">One resume per job, picked from your profile.</motion.p> : null}
      </div>
    </div>
  );
}

function BoardScene() {
  const { step } = useTimeline(4);
  const cols = [
    { name: "Applied", tone: "bg-brand", cards: ["Nagad", "BRAC Bank", "Robi"] },
    { name: "Interviewing", tone: "bg-violet-500", cards: ["ShopUp", "bKash"] },
    { name: "Offer", tone: "bg-emerald-500", cards: ["Pathao"] },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map((c, ci) => (
        <div key={c.name} className="rounded-xl bg-white/70 p-1.5 ring-1 ring-slate-200">
          <p className="flex items-center gap-1 px-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase"><span className={`size-1.5 rounded-full ${c.tone}`} /> {c.name}</p>
          <div className="mt-1.5 space-y-1">
            {c.cards.map((n, i) =>
              step >= 1 + Math.min(ci + i, 3) ? (
                <Card key={n} {...fade} className="px-2 py-1.5">
                  <p className="truncate text-[11.5px] font-medium text-ink">{n}</p>
                  <Bar w="70%" className="mt-1" />
                </Card>
              ) : null
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const SCENES = {
  interviewPrep: () => <PrepScene />,
  interviewAi: () => <PrepScene ai />,
  insights: () => <InsightsScene />,
  coverLetter: () => <CoverScene />,
  polish: () => <PolishScene />,
  parse: () => <ImportScene />,
  audit: () => <AuditScene />,
  chat: () => <ChatScene />,
  refine: () => <RefineScene />,
  shareLinks: () => <ShareScene />,
  templates: (r) => <TemplatesScene template={r.template} />,
  resumes: () => <TemplatesScene template="Classic" />,
  tailored: () => <TailorScene />,
  batch: () => <TailorScene />,
  applications: () => <BoardScene />,
  profile: () => <ImportScene />,
};

export const hasPreview = (feature) => !!SCENES[feature];

/** The preview for an upgrade request ({ feature, template? }), or nothing when there's none. */
export default function FeaturePreview({ request }) {
  const scene = SCENES[request?.feature];
  if (!scene) return null;
  return (
    <div aria-hidden="true">
      <div className="relative h-[216px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 pt-4">
        {scene(request)}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-slate-50" />
      </div>
      <p className="mt-1.5 text-right text-[10.5px] text-slate-400">Example with sample details</p>
    </div>
  );
}

