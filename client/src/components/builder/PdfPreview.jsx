"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { renderPdf } from "@/pdf/client";

let pdfjsPromise = null;
export function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Live preview: renders the real PDF (the exact file that gets downloaded)
 * and paints each page onto a canvas. Updates are debounced while typing and
 * the previous pages stay visible until the new ones are ready.
 */
export default function PdfPreview({ resume, zoom = 1, onPageCount, delay = 450 }) {
  const containerRef = useRef(null);
  const pagesRef = useRef(null);
  const versionRef = useRef(0);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [renderedKey, setRenderedKey] = useState(null);
  const [error, setError] = useState(null);
  const [width, setWidth] = useState(0);

  // Track the available width so pages are rendered at a crisp resolution.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const json = JSON.stringify(resume);
  const renderKey = `${json}|${width}|${zoom}`;
  const updating = status !== "loading" && renderedKey !== renderKey;

  useEffect(() => {
    if (!width) return;
    const version = ++versionRef.current;
    const timer = setTimeout(async () => {
      try {
        const [pdfjs, buffer] = await Promise.all([loadPdfJs(), renderPdf(JSON.parse(json))]);
        if (version !== versionRef.current) return;
        const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
        const doc = await task.promise;
        const pageWidth = Math.min(width, 900) * zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvases = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (pageWidth / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(pageWidth)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          canvas.className = "block rounded-sm bg-white shadow-[0_8px_30px_rgba(15,31,42,0.12)] ring-1 ring-slate-900/5";
          canvas.setAttribute("aria-label", `Resume page ${n}`);
          await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
          if (version !== versionRef.current) return;
          canvases.push(canvas);
        }
        task.destroy();
        if (version !== versionRef.current || !pagesRef.current) return;
        pagesRef.current.replaceChildren(...canvases);
        onPageCount?.(canvases.length);
        setError(null);
        setStatus("ready");
        setRenderedKey(`${json}|${width}|${zoom}`);
      } catch (err) {
        if (version !== versionRef.current) return;
        console.error(err);
        setError(err.message || "Could not render the preview.");
        setStatus("error");
        setRenderedKey(`${json}|${width}|${zoom}`);
      }
    }, status === "loading" ? 0 : delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, width, zoom]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div ref={pagesRef} className="flex flex-col items-center gap-6" />
      {status === "loading" ? (
        <div className="flex aspect-[1/1.414] w-full max-w-[900px] items-center justify-center rounded-sm bg-white shadow-sm">
          <Loader2 className="animate-spin text-brand" size={28} />
        </div>
      ) : null}
      {updating && status !== "error" ? (
        <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-xs text-white">
          <Loader2 className="animate-spin" size={12} /> Updating
        </div>
      ) : null}
      {status === "error" ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Preview failed: {error}
        </div>
      ) : null}
    </div>
  );
}
