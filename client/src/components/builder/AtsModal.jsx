"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Modal, Input, Button, Collapse, Tooltip } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, XCircle, ScanSearch, RotateCcw, FileText, Sparkles, Info, Loader2 } from "lucide-react";
import { renderPdf } from "@/pdf/client";
import { templateById } from "@/pdf/registry";
import { analyzeResume } from "@/lib/ats/analyze";
import { extractPdfText } from "@/lib/ats/extract";
import { api } from "@/lib/api";
import { AI_ENABLED } from "@/lib/config";
import { loadPdfJs } from "./PdfPreview";
import { aiResume } from "./AiModals";
import { CreditTooltip } from "../Credits";
import PlanTag from "../billing/PlanTag";
import { useBilling } from "../BillingProvider";

const { TextArea } = Input;

const TONES = {
  green: { ring: "#16a34a", text: "text-green-700", bg: "bg-green-50" },
  teal: { ring: "#0d9488", text: "text-teal-700", bg: "bg-teal-50" },
  amber: { ring: "#d97706", text: "text-amber-700", bg: "bg-amber-50" },
  red: { ring: "#dc2626", text: "text-red-700", bg: "bg-red-50" },
};
const STATUS = {
  pass: { icon: CheckCircle2, color: "text-green-600" },
  warn: { icon: AlertTriangle, color: "text-amber-500" },
  fail: { icon: XCircle, color: "text-red-500" },
};
const barColor = (s) => (s >= 85 ? "bg-green-500" : s >= 70 ? "bg-teal-500" : s >= 50 ? "bg-amber-500" : "bg-red-500");

export default function AtsModal({ open, onClose, resume, token }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title={<span className="inline-flex items-center gap-2"><ScanSearch size={17} className="text-brand" /> ATS check</span>} destroyOnHidden centered>
      <AtsChecker resume={resume} token={token} />
    </Modal>
  );
}

function ScoreRing({ score, tone }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <motion.circle
          cx="60" cy="60" r={r} fill="none" stroke={TONES[tone].ring} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="font-display text-4xl font-extrabold text-ink" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring" }}>
          {score}
        </motion.span>
        <span className="text-[11px] text-slate-400">out of 100</span>
      </div>
    </div>
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The scan's stages: what each one does, how long it shows, and what it reports. */
function scanSteps(withJob) {
  return [
    { label: "Rendering your resume to PDF", ms: 1100, found: (r) => `${plural(r.stats.pages, "page")} · ${r.template.name} template` },
    { label: "Extracting text like an ATS parser", ms: 1300, found: (r) => `${r.stats.words.toLocaleString()} words, ${r.stats.characters.toLocaleString()} characters read` },
    { label: "Detecting section headings", ms: 1000, found: (r) => (r.stats.sections.length ? `Found ${r.stats.sections.join(", ")}` : "No standard headings found") },
    { label: "Verifying contact details", ms: 750, found: (r) => `${r.stats.contact} of 4 contact fields present` },
    { label: "Analysing bullet points", ms: 1300, found: (r) => (r.stats.bullets ? `${plural(r.stats.bullets, "point")} · ${r.stats.actionVerbs} action verbs · ${r.stats.quantified} with numbers` : "No bullet points to analyse") },
    ...(withJob
      ? [
          { label: "Extracting keywords from the job", ms: 1100, found: (r) => `${plural(r.stats.keywords, "keyword")} weighted by importance` },
          { label: "Matching keywords to your resume", ms: 1000, found: (r) => `${r.stats.matched} of ${r.stats.keywords} matched` },
        ]
      : [{ label: "Reviewing skills and experience", ms: 900, found: (r) => `${plural(r.stats.skills, "skill")} · ${plural(r.stats.roles, "role")}` }]),
    { label: "Scoring every check", ms: 850, found: (r) => `${r.counts.pass + r.counts.warn + r.counts.fail} checks scored` },
  ];
}

function ScanProgress({ scan, template }) {
  const { steps, at, result } = scan;
  const total = steps.reduce((s, x) => s + x.ms, 0);
  const elapsed = steps.slice(0, at).reduce((s, x) => s + x.ms, 0);
  const target = at >= steps.length ? 100 : Math.round(((elapsed + steps[at].ms) / total) * 100);
  const [now, setNow] = useState(scan.stepStartedAt);

  // Tick the percentage along within the current step (it never runs ahead of it).
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(id);
  }, []);
  const current = steps[at];
  const within = current ? Math.min(1, Math.max(0, (now - scan.stepStartedAt) / current.ms)) : 1;
  const percent = at >= steps.length ? 100 : Math.min(99, Math.round(((elapsed + within * current.ms) / total) * 100));

  return (
    <div className="grid gap-8 py-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <div className="relative mx-auto w-40 sm:w-full">
        <div className="relative aspect-[1/1.414] overflow-hidden rounded-lg bg-white shadow-[0_18px_50px_rgba(15,31,42,0.18)] ring-1 ring-slate-900/5">
          <Image src={`/templates/${template.id}.jpg`} alt="" fill sizes="180px" className="object-cover object-top opacity-80 saturate-50" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.07)_1px,transparent_1px)] bg-[length:100%_10px]" />
          <motion.div
            className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-brand/25 to-transparent"
            initial={{ top: "-15%" }}
            animate={{ top: ["-15%", "100%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
          >
            <div className="absolute inset-x-0 top-1/2 h-px bg-brand shadow-[0_0_12px_2px_rgba(79,70,229,0.7)]" />
          </motion.div>
        </div>
        <motion.span
          className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-lg"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          <ScanSearch size={17} />
        </motion.span>
      </div>

      <div>
        <p className="text-xs font-semibold tracking-wider text-brand uppercase">ResumeX ATS engine</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h3 className="font-display text-xl font-bold text-ink">{at >= steps.length ? "Scan complete" : "Scanning your resume…"}</h3>
          <span className="font-display text-2xl font-extrabold text-ink tabular-nums">{percent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-brand to-violet-500 transition-[width] ease-linear"
            style={{ width: `${target}%`, transitionDuration: `${at >= steps.length ? 300 : steps[at].ms}ms` }}
          >
            <span className="absolute inset-0 animate-[shine_1.6s_linear_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] bg-[length:50%_100%] bg-no-repeat" />
          </div>
        </div>
        <ol className="mt-5 space-y-2.5">
          {steps.map((step, i) => {
            const done = i < at;
            const active = i === at;
            return (
              <motion.li key={step.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: done || active ? 1 : 0.4, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-3 text-sm">
                <span className="mt-0.5">
                  {done ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="block">
                      <CheckCircle2 size={18} className="text-green-600" />
                    </motion.span>
                  ) : active ? (
                    <Loader2 size={18} className="animate-spin text-brand" />
                  ) : (
                    <span className="block h-[18px] w-[18px] rounded-full border-2 border-slate-200" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className={active ? "font-medium text-ink" : done ? "text-slate-700" : "text-slate-400"}>{step.label}</span>
                  <AnimatePresence>
                    {done && result ? (
                      <motion.span initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="block text-xs text-slate-500">
                        {step.found(result)}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function AtsChecker({ resume, token }) {
  const [job, setJob] = useState("");
  const [scan, setScan] = useState(null); // { steps, at, result } while the scan animation runs
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ai, setAi] = useState({ loading: false, data: null, error: null });
  const runId = useRef(0);
  const billing = useBilling();
  useEffect(() => () => void runId.current++, []);

  const run = async () => {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    setError(null);
    setResult(null);
    setAi({ loading: false, data: null, error: null });
    const withJob = job.trim().length > 40;
    const steps = scanSteps(withJob);
    setScan({ steps, at: 0, result: null, stepStartedAt: performance.now() });

    // The real work (render, extract, analyse) takes a second or two; the steps
    // below reveal what it found one at a time.
    const work = (async () => {
      const [pdfjs, buffer] = await Promise.all([loadPdfJs(), renderPdf(resume)]);
      const { text, pageCount } = await extractPdfText(pdfjs, buffer);
      const template = templateById(resume.template);
      return { ...analyzeResume({ resume, pdfText: text, pageCount, template, jobDescription: job }), pdfText: text, withJob, template };
    })();

    try {
      for (let i = 0; i < steps.length; i++) {
        if (!alive()) return;
        setScan((s) => ({ ...s, at: i, stepStartedAt: performance.now() }));
        const [done] = await Promise.all([work, sleep(steps[i].ms)]);
        if (!alive()) return;
        setScan((s) => ({ ...s, result: done }));
      }
      const done = await work;
      if (!alive()) return;
      setScan((s) => ({ ...s, at: steps.length }));
      await sleep(550);
      if (alive()) setResult(done);
    } catch (err) {
      console.error(err);
      if (alive()) setError("The check couldn't run. Please try again.");
    } finally {
      if (alive()) setScan(null);
    }
  };

  const askAi = async () => {
    if (billing && !billing.requireFeature("audit", "AI suggestions")) return;
    setAi({ loading: true, data: null, error: null });
    try {
      const data = await api("/ai/audit", { token, method: "POST", body: { resumeData: aiResume(resume), jobDescription: job } });
      setAi({ loading: false, data: data.analysis, error: null });
    } catch (err) {
      setAi({ loading: false, data: null, error: err.code === "cancelled" ? null : err.message });
    }
  };

  if (scan) return <ScanProgress scan={scan} template={templateById(resume.template)} />;

  if (!result) {
    return (
      <div>
        <p className="text-sm text-slate-600">
          We render your real PDF, read it back the way applicant tracking systems do, and run 30+ checks on parsing, content and — if you paste a job description — keyword match.
        </p>
        <TextArea className="!mt-4" rows={7} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the job description (recommended) — or leave empty for a general check" />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <Button type="primary" size="large" block className="!mt-4" icon={<ScanSearch size={17} />} onClick={run}>
          {job.trim() ? "Check against this job" : "Run a general ATS check"}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Info size={12} /> Runs on your device. No AI and no account needed.
        </p>
      </div>
    );
  }

  const tone = TONES[result.grade.tone];
  const order = { fail: 0, warn: 1, pass: 2 };
  const keywords = result.keywords || [];
  const matched = keywords.filter((k) => k.matched);
  const missing = keywords.filter((k) => !k.matched);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <ScoreRing score={result.score} tone={result.grade.tone} />
        <div className="flex-1">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ${tone.bg} ${tone.text}`}>{result.grade.label}</span>
          <p className="mt-1 text-sm text-slate-500">{result.withJob ? "ATS score for this job" : "General ATS score — paste a job description for keyword matching"}</p>
          <div className="mt-3 space-y-2">
            {result.categories.map((c, i) => (
              <div key={c.id}>
                <div className="flex justify-between text-xs">
                  <Tooltip title={c.description}>
                    <span className="font-medium text-slate-700">{c.label}</span>
                  </Tooltip>
                  <span className="text-slate-500 tabular-nums">{c.score}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <motion.div className={`h-full rounded-full ${barColor(c.score)}`} initial={{ width: 0 }} animate={{ width: `${c.score}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-green-600" /> {result.counts.pass} passed</span>
            <span className="inline-flex items-center gap-1"><AlertTriangle size={13} className="text-amber-500" /> {result.counts.warn} to improve</span>
            <span className="inline-flex items-center gap-1"><XCircle size={13} className="text-red-500" /> {result.counts.fail} failed</span>
          </p>
        </div>
      </div>

      {keywords.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Missing keywords <span className="font-normal text-slate-400">({missing.length})</span></p>
            <div className="flex flex-wrap gap-1.5">
              {missing.length ? missing.map((k) => (
                <Tooltip key={k.name} title={k.importance >= 1.5 ? "The job stresses this — add it if you have it" : k.importance < 1 ? "Nice to have" : "Mentioned in the job"}>
                  <span className={`rounded-md px-2 py-0.5 text-xs ring-1 ${k.importance >= 1.5 ? "bg-red-50 font-semibold text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{k.name}</span>
                </Tooltip>
              )) : <span className="text-sm text-slate-500">None — great coverage.</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Matched <span className="font-normal text-slate-400">({matched.length})</span></p>
            <div className="flex flex-wrap gap-1.5">
              {matched.map((k) => (
                <span key={k.name} className="rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-800 ring-1 ring-green-200">{k.name}</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Collapse
        size="small"
        defaultActiveKey={result.categories.filter((c) => c.checks.some((x) => x.status !== "pass")).map((c) => c.id)}
        items={result.categories.map((c) => ({
          key: c.id,
          label: <span className="font-medium">{c.label} <span className="font-normal text-slate-400">· {c.score}/100</span></span>,
          children: (
            <ul className="space-y-2.5">
              {[...c.checks].sort((a, b) => order[a.status] - order[b.status]).map((ch) => {
                const S = STATUS[ch.status];
                return (
                  <li key={ch.id} className="flex gap-2.5">
                    <S.icon size={17} className={`mt-0.5 shrink-0 ${S.color}`} />
                    <div>
                      <p className="text-sm font-medium text-ink">{ch.label}</p>
                      <p className="text-sm text-slate-600">{ch.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ),
        }))}
      />

      <details className="group rounded-xl border border-slate-200 p-3 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <FileText size={15} /> See what an ATS reads from your PDF
        </summary>
        <pre className="thin-scroll mt-3 max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-600">{result.pdfText}</pre>
      </details>

      {AI_ENABLED ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600"><b className="text-ink">Want rewrite ideas?</b> Get an AI opinion — it isn&apos;t part of the score.</p>
            <CreditTooltip feature="audit">
              <Button icon={<Sparkles size={14} />} loading={ai.loading} onClick={askAi} disabled={!token}>
                AI suggestions <PlanTag feature="audit" />
              </Button>
            </CreditTooltip>
          </div>
          {!token ? <p className="mt-2 text-xs text-slate-500">Log in to use AI suggestions.</p> : null}
          {ai.error ? <p className="mt-2 text-sm text-red-600">{ai.error}</p> : null}
          {ai.data ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {[...(ai.data.improvements || []), ...(ai.data.strengths || []).map((s) => `Strength: ${s}`)].map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="max-w-md text-xs text-slate-400">
          Based on how ATS parsers extract PDFs and on recruiter guidelines. Every employer configures its ATS differently, so no tool can guarantee a ranking.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => setResult(null)}>Change job</Button>
          <Button type="primary" icon={<RotateCcw size={14} />} onClick={run}>
            Check again
          </Button>
        </div>
      </div>
    </div>
  );
}
