"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Segmented } from "antd";
import { FileText, Globe, Loader2 } from "lucide-react";

const PdfPreview = dynamic(() => import("../builder/PdfPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center text-slate-400">
      <Loader2 size={22} className="animate-spin" />
    </div>
  ),
});

/**
 * A shared resume, shown in the owner's own template, colours and font (the
 * same PDF they download). The plain web version (`children`, rendered on the
 * server for search engines and screen readers) is one click away.
 */
export default function SharedResumeView({ resume, children }) {
  const [view, setView] = useState("design");
  return (
    <>
      <div className="mb-5 flex justify-center">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "design", label: <span className="inline-flex items-center gap-1.5 px-1"><FileText size={14} /> Resume</span> },
            { value: "web", label: <span className="inline-flex items-center gap-1.5 px-1"><Globe size={14} /> Web version</span> },
          ]}
        />
      </div>
      <div hidden={view !== "design"} className="mx-auto max-w-[860px]">
        <PdfPreview resume={resume} delay={0} />
      </div>
      <div hidden={view !== "web"}>{children}</div>
    </>
  );
}
