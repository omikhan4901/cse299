"use client";

import { useState } from "react";
import { Modal, Input, Button, Collapse, Tooltip } from "antd";
import { motion } from "motion/react";
import { CheckCircle2, AlertTriangle, XCircle, ScanSearch, RotateCcw, FileText, Sparkles, Info, Loader2 } from "lucide-react";
import { renderPdf } from "@/pdf/client";
import { templateById } from "@/pdf/registry";
import { analyzeResume } from "@/lib/ats/analyze";
import { extractPdfText } from "@/lib/ats/extract";
import { api } from "@/lib/api";
import { AI_ENABLED } from "@/lib/config";
import { loadPdfJs } from "./PdfPreview";
import { aiResume } from "./AiModals";

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

function AtsChecker({ resume, token }) {
  const [job, setJob] = useState("");
  const [stage, setStage] = useState(null); // null | rendering | extracting | analysing
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ai, setAi] = useState({ loading: false, data: null, error: null });

  const run = async () => {
    setError(null);
    setAi({ loading: false, data: null, error: null });
    try {
      setStage("rendering");
      const [pdfjs, buffer] = await Promise.all([loadPdfJs(), renderPdf(resume)]);
      setStage("extracting");
      const { text, pageCount } = await extractPdfText(pdfjs, buffer);
      setStage("analysing");
      await new Promise((r) => setTimeout(r, 250));
      setResult({ ...analyzeResume({ resume, pdfText: text, pageCount, template: templateById(resume.template), jobDescription: job }), pdfText: text, withJob: job.trim().length > 40 });
    } catch (err) {
      console.error(err);
      setError("The check couldn't run. Please try again.");
    } finally {
      setStage(null);
    }
  };

  const askAi = async () => {
    setAi({ loading: true, data: null, error: null });
    try {
      const data = await api("/ai/audit", { token, method: "POST", body: { resumeData: aiResume(resume), jobDescription: job } });
      setAi({ loading: false, data: data.analysis, error: null });
    } catch (err) {
      setAi({ loading: false, data: null, error: err.message });
    }
  };

  if (stage) {
    const steps = [
      ["rendering", "Rendering your PDF"],
      ["extracting", "Extracting the text like an ATS"],
      ["analysing", "Running the checks"],
    ];
    const at = steps.findIndex(([id]) => id === stage);
    return (
      <div className="py-10">
        <div className="mx-auto max-w-xs space-y-3">
          {steps.map(([id, label], i) => (
            <motion.div key={id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= at ? 1 : 0.35, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 text-sm">
              {i < at ? <CheckCircle2 size={18} className="text-green-600" /> : i === at ? <Loader2 size={18} className="animate-spin text-brand" /> : <span className="h-[18px] w-[18px] rounded-full border-2 border-slate-200" />}
              <span className={i === at ? "font-medium text-ink" : "text-slate-500"}>{label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

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
            <Button icon={<Sparkles size={14} />} loading={ai.loading} onClick={askAi} disabled={!token}>
              AI suggestions
            </Button>
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
