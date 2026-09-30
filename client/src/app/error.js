"use client";

import { useEffect } from "react";
import { Button } from "antd";
import { RotateCcw, MessageSquare } from "lucide-react";
import { openFeedback, reportError } from "@/lib/reportError";

/** When a page breaks: say so calmly, report it, and offer to try again. */
export default function Error({ error, reset }) {
  useEffect(() => reportError(error), [error]);
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">Something went wrong on this page</h1>
      <p className="mt-2 max-w-md text-slate-600">We&apos;ve been told about it. Your saved work is safe. Try again, or tell us what you were doing.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="primary" icon={<RotateCcw size={15} />} onClick={() => reset()}>Try again</Button>
        <Button icon={<MessageSquare size={15} />} onClick={openFeedback}>Send feedback</Button>
      </div>
    </div>
  );
}
