"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { renderPdf } from "@/pdf/client";
import { loadPdfJs } from "./builder/PdfPreview";

/**
 * First page of a resume, rendered from its real PDF once the card scrolls
 * into view. Shows the template's sample image until then.
 */
export default function ResumeThumbnail({ resume, fallback, width = 320 }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(null);
  const json = JSON.stringify(resume);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      try {
        const [pdfjs, buffer] = await Promise.all([loadPdfJs(), renderPdf(JSON.parse(json))]);
        const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
        const doc = await task.promise;
        const page = await doc.getPage(1);
        const scale = (width * 2) / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
        task.destroy();
        if (!cancelled) setSrc(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        /* keep the fallback image */
      }
    });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [json, width]);

  return (
    <div ref={ref} className="absolute inset-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <Image src={fallback} alt="" fill sizes="300px" className="object-cover object-top opacity-40 blur-[1px]" />
      )}
    </div>
  );
}
