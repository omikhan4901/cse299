"use client";

import { Collapse, Tooltip } from "antd";
import { motion } from "motion/react";
import { CheckCircle2, AlertTriangle, XCircle, FileText } from "lucide-react";

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


export function ScoreRing({ score, tone }) {
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

/**
 * An ATS check's result: score, category bars, keywords, every check with its fix, and
 * the text an ATS reads. Extra content (e.g. AI suggestions, actions) goes in `children`.
 */
export default function AtsReport({ result, children }) {
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
        // Only the first part that needs attention starts open (failures before warnings); the rest is one click away.
        defaultActiveKey={[(result.categories.find((c) => c.checks.some((x) => x.status === "fail")) || result.categories.find((c) => c.checks.some((x) => x.status === "warn")))?.id].filter(Boolean)}
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

      {children}
    </div>
  );
}
