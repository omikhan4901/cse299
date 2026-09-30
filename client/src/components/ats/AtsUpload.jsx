"use client";

import { useRef, useState } from "react";
import { Button, Input, Upload } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CheckCircle2, FileText, FileUp, Loader2, Plus, RotateCcw, ScanSearch, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/api";
import { analyzeResume } from "@/lib/ats/analyze";
import { resumeFromText, sectionsFound } from "@/lib/ats/fromText";
import AtsReport from "./AtsReport";
import { BuilderLink } from "../BuilderLauncher";

const { TextArea } = Input;
const MAX_MB = 5;
const STEPS = ["Reading your PDF the way an ATS does", "Finding your sections and dates", "Running 30+ checks"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The public ATS checker: upload a resume PDF (and optionally a job description) and get
 * the same report as the builder's ATS check. The server reads the PDF (limited per hour,
 * never stored); the checks run here in the browser. `intro` is the hero text beside it.
 */
export default function AtsUpload({ intro }) {
  const [file, setFile] = useState(null);
  const [job, setJob] = useState("");
  const [showJob, setShowJob] = useState(false);
  const [step, setStep] = useState(-1); // -1 when not scanning
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null); // { message, limit }
  const resultsRef = useRef(null);

  const pick = (f) => {
    setError(null);
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") setError({ message: "That isn't a PDF. Export your resume as a PDF and upload that." });
    else if (f.size > MAX_MB * 1024 * 1024) setError({ message: `That file is over ${MAX_MB} MB. Upload a smaller PDF.` });
    else setFile(f);
    return false; // we upload it ourselves
  };

  const run = async () => {
    if (!file || step >= 0) return;
    setError(null);
    setResult(null);
    setStep(0);
    try {
      const form = new FormData();
      form.append("resume", file);
      const [data] = await Promise.all([api("/ats/scan", { method: "POST", body: form, timeout: 45000 }), sleep(900)]);
      setStep(1);
      const resume = resumeFromText(data.text);
      const sections = sectionsFound(data.text);
      await sleep(650);
      setStep(2);
      const report = analyzeResume({ resume, pdfText: data.text, pageCount: data.pageCount, jobDescription: job, upload: { ...data.layout, sections } });
      await sleep(650);
      setResult({ ...report, pdfText: data.text, withJob: job.trim().length > 40, fileName: file.name });
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError({ message: err.message, limit: err.status === 429 });
    } finally {
      setStep(-1);
    }
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scanning = step >= 0;

  return (
    <>
      <div className="mt-8 grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>{intro}</div>

        <div id="check" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-28px_rgba(15,31,42,.35)]">
          <AnimatePresence mode="wait" initial={false}>
            {scanning ? (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-4" role="status" aria-live="polite">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <FileText size={16} className="text-brand" /> <span className="truncate">{file?.name}</span>
                </p>
                <ul className="mt-5 space-y-4">
                  {STEPS.map((label, i) => (
                    <li key={label} className={`flex items-center gap-3 text-sm transition ${i > step ? "text-slate-300" : "text-ink"}`}>
                      {i < step ? <CheckCircle2 size={18} className="text-green-600" /> : i === step ? <Loader2 size={18} className="animate-spin text-brand" /> : <span className="h-[18px] w-[18px] rounded-full border-2 border-slate-200" />}
                      {label}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {file ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand ring-1 ring-brand-100">
                      <FileText size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · PDF</p>
                    </div>
                    <Button type="text" size="small" icon={<X size={16} />} onClick={() => setFile(null)} aria-label="Remove file" />
                  </div>
                ) : (
                  <Upload.Dragger accept=".pdf,application/pdf" multiple={false} showUploadList={false} beforeUpload={pick} className="!rounded-2xl">
                    <div className="px-4 py-6">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">
                        <FileUp size={22} />
                      </span>
                      <p className="mt-3 font-semibold text-ink">Drop your resume PDF here</p>
                      <p className="mt-1 text-sm text-slate-500">or click to choose a file · up to {MAX_MB} MB</p>
                    </div>
                  </Upload.Dragger>
                )}

                {showJob ? (
                  <TextArea className="!mt-4" rows={5} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the job description to see which keywords you're missing" autoFocus />
                ) : (
                  <button type="button" onClick={() => setShowJob(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                    <Plus size={15} /> Add a job description <span className="font-normal text-slate-400">(recommended)</span>
                  </button>
                )}

                {error ? (
                  <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error.message}
                    {error.limit ? (
                      <p className="mt-1.5 text-red-700/80">
                        Checks inside the builder are unlimited.{" "}
                        <BuilderLink className="font-semibold underline">Open the builder</BuilderLink>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <Button type="primary" size="large" block className="!mt-4" icon={<ScanSearch size={17} />} disabled={!file} onClick={run}>
                  {job.trim() ? "Check against this job" : "Check my resume"}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                  <ShieldCheck size={13} /> Read once, never stored · free, no sign-up
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {result ? (
        <section ref={resultsRef} className="mx-auto mt-14 max-w-3xl scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-label="Your ATS report">
          <p className="mb-5 flex items-center gap-2 text-sm text-slate-500">
            <FileText size={15} className="text-brand" /> ATS report for <b className="truncate font-medium text-ink">{result.fileName}</b>
          </p>
          <AtsReport result={result}>
            <div className="rounded-2xl bg-navy p-5 text-white sm:flex sm:items-center sm:gap-5">
              <div className="flex-1">
                <p className="font-semibold">Fix these in minutes</p>
                <p className="mt-1 text-sm text-white/70">Rebuild it on an ATS-friendly template, then re-check as often as you like. Every fix above tells you what to change.</p>
              </div>
              <BuilderLink className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:bg-brand-50 sm:mt-0">
                Open the builder <ArrowRight size={16} />
              </BuilderLink>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="max-w-md text-xs text-slate-400">
                Based on how ATS parsers extract PDFs and on recruiter guidelines. Every employer configures its ATS differently, so no tool can guarantee a ranking.
              </p>
              <Button icon={<RotateCcw size={14} />} onClick={reset}>
                Check another PDF
              </Button>
            </div>
          </AtsReport>
        </section>
      ) : null}
    </>
  );
}
