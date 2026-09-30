"use client";

import { useState } from "react";
import { Button, Popover } from "antd";
import { CircleAlert, MessageSquare, Sparkles } from "lucide-react";
import { useBilling } from "../BillingProvider";
import { openFeedback } from "@/lib/reportError";

/** The "Beta" tag by the logo: what's new, known issues and a way to tell us (Admin › Site). */
export default function BetaMenu() {
  const beta = useBilling()?.config?.beta;
  const [open, setOpen] = useState(false);
  if (!beta?.label) return null;
  const content = (
    <div className="w-72 space-y-3 text-sm">
      {beta.whatsNew?.length ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">What&apos;s new</p>
          <ul className="space-y-1.5">
            {beta.whatsNew.map((t) => (
              <li key={t} className="flex gap-2 text-slate-700"><Sparkles size={14} className="mt-0.5 shrink-0 text-brand" /> {t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {beta.knownIssues?.length ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Known issues</p>
          <ul className="space-y-1.5">
            {beta.knownIssues.map((t) => (
              <li key={t} className="flex gap-2 text-slate-700"><CircleAlert size={14} className="mt-0.5 shrink-0 text-amber-500" /> {t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button
        block
        icon={<MessageSquare size={14} />}
        onClick={() => {
          setOpen(false);
          openFeedback();
        }}
      >
        Send feedback
      </Button>
    </div>
  );
  return (
    <Popover content={content} trigger="click" placement="bottomLeft" open={open} onOpenChange={setOpen}>
      <button type="button" className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-brand uppercase ring-1 ring-brand/15 transition hover:bg-brand-100" aria-label="Beta: what's new and feedback">
        Beta
      </button>
    </Popover>
  );
}
