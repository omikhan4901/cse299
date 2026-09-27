"use client";

import { fileNameFor } from "@/lib/resume";

let worker = null;
let workerBroken = false;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (!worker) {
    try {
      worker = new Worker(new URL("./pdf.worker.js", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => {
        const job = pending.get(data.id);
        if (!job) return;
        pending.delete(data.id);
        if (data.error) job.reject(new Error(data.error));
        else job.resolve(data.buffer);
      };
      worker.onerror = (e) => {
        // The worker failed to load: fall back to rendering on the main thread.
        workerBroken = true;
        worker = null;
        for (const [id, job] of pending) {
          pending.delete(id);
          job.fallback();
        }
        e.preventDefault?.();
      };
    } catch {
      workerBroken = true;
      return null;
    }
  }
  return worker;
}

async function renderOnMainThread(resume, fontBase) {
  const { renderResumeToBuffer } = await import("./render");
  return renderResumeToBuffer(resume, fontBase);
}

/** Renders the resume PDF and resolves with its bytes (ArrayBuffer). */
export function renderPdf(resume) {
  const fontBase = `${window.location.origin}/fonts`;
  // Structured clone drops functions/undefined; JSON keeps it predictable.
  const plain = JSON.parse(JSON.stringify(resume));
  const w = getWorker();
  if (!w) return renderOnMainThread(plain, fontBase);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, fallback: () => renderOnMainThread(plain, fontBase).then(resolve, reject) });
    w.postMessage({ id, resume: plain, fontBase });
  });
}

/** Renders and downloads the resume as a PDF file. */
export async function downloadPdf(resume) {
  const buffer = await renderPdf(resume);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(resume);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
