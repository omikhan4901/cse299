"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, Input, Button } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ScanSearch, RotateCcw, Sparkles, Info, Loader2 } from "lucide-react";
import { renderPdf } from "@/pdf/client";
import { templateById } from "@/pdf/registry";
import { analyzeResume } from "@/lib/ats/analyze";
import { extractPdfText } from "@/lib/ats/extract";
import { api } from "@/lib/api";
import { AI_ENABLED } from "@/lib/config";
import { loadPdfJs } from "./PdfPreview";
import { CreditTooltip } from "../Credits";
import { aiResume, ReadsFirst } from "./AiModals";
import PlanTag from "../billing/PlanTag";
import AtsReport from "../ats/AtsReport";
import ResumeThumbnail from "../ResumeThumbnail";
import { useBilling } from "../BillingProvider";

const { TextArea } = Input;

export default function AtsModal({ open, onClose, resume, token }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title={<span className="inline-flex items-center gap-2"><ScanSearch size={17} className="text-brand" /> ATS check</span>} destroyOnHidden centered
      // The report scrolls inside the dialog, so it never fills the screen.
      styles={{ body: { maxHeight: "min(72vh, 720px)", overflowY: "auto", overscrollBehavior: "contain" }, container: { paddingBottom: 12 } }}
      classNames={{ body: "thin-scroll -mx-6 px-6" }}>
      <AtsChecker resume={resume} token={token} />
    </Modal>
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

function ScanProgress({ scan, template, resume }) {
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
          {/* The person's own first page (the template's sample until it has rendered). */}
          <div className="absolute inset-0 opacity-80 saturate-50"><ResumeThumbnail resume={resume} fallback={`/templates/${template.id}.jpg`} width={180} /></div>
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

  if (scan) return <ScanProgress scan={scan} template={templateById(resume.template)} resume={resume} />;

  if (!result) {
    return (
      <div>
        <p className="text-sm text-slate-600">
          We render your real PDF, read it back the way applicant tracking systems do, and run 30+ checks on parsing, content and — if you paste a job description — keyword match.
        </p>
        <TextArea className="!mt-4" rows={7} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the job description (recommended) — or leave empty for a general check" />
        <ReadsFirst text={job} feature="audit" what="The AI review reads" />
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

  return (
    <AtsReport result={result}>
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

      <div className="sticky bottom-0 -mb-px flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white pt-4 pb-1">
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
    </AtsReport>
  );
}
