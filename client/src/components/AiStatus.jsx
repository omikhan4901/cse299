"use client";

import { useEffect, useState } from "react";
import { App, Button } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Sparkles } from "lucide-react";
import { subscribeAi } from "@/lib/aiActivity";

// What to say as an AI request drags on. Imports read a whole PDF, so they get longer.
const STAGES = {
  normal: [
    { after: 6000, title: "Still working on it…", body: "The AI is taking a little longer than usual." },
    { after: 18000, title: "The AI service is busy right now", body: "We're retrying automatically. If it can't finish, you won't be charged." },
    { after: 34000, title: "Almost out of time", body: "If there's no answer in a few more seconds, we'll stop. You won't be charged." },
  ],
  import: [
    { after: 15000, title: "Reading your resume…", body: "Longer files can take up to a minute." },
    { after: 45000, title: "The AI service is busy right now", body: "We're retrying automatically. If it can't finish, you won't be charged." },
    { after: 85000, title: "Almost out of time", body: "If there's no answer in a few more seconds, we'll stop. You won't be charged." },
  ],
};

const LABELS = {
  "/ai/refine": "Improving your text",
  "/ai/chat": "Writing a reply",
  "/ai/audit": "Reviewing your resume",
  "/ai/cover-letter": "Writing your cover letter",
  "/ai/parse": "Importing your resume",
};

/**
 * A calm status card for slow AI requests: nothing for the first few seconds, then what's
 * happening, how long we'll keep trying, that a failure costs nothing, and a way to cancel.
 */
export default function AiStatus() {
  const { message } = App.useApp();
  const [active, setActive] = useState([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeAi(setActive), []);
  useEffect(() => {
    if (!active.length) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active.length]);

  const req = active[0]; // the oldest one
  const elapsed = req ? now - req.startedAt : 0;
  const stages = STAGES[req?.path === "/ai/parse" ? "import" : "normal"];
  const stage = req ? [...stages].reverse().find((s) => elapsed >= s.after) : null;
  const left = req ? Math.max(0, Math.ceil((req.budgetMs - elapsed) / 1000)) : 0;
  const progress = req ? Math.min(100, (elapsed / req.budgetMs) * 100) : 0;

  const cancel = () => {
    req.cancel();
    message.info("Cancelled. You weren't charged for this.");
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[1100] flex justify-center px-4">
      <AnimatePresence>
        {stage ? (
          <motion.div
            key="ai-status"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
          >
            <div className="flex items-start gap-3 p-4">
              <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
                <Sparkles size={16} />
                <Loader2 size={36} strokeWidth={1.5} className="absolute inset-0 m-auto animate-spin text-brand/40" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{LABELS[req.path] || "Working with AI"}</p>
                <p className="mt-0.5 font-semibold text-ink">{stage.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{stage.body}</p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {left > 0 ? `We'll keep trying for up to ${left} more second${left === 1 ? "" : "s"}.` : "Finishing up…"}
                </p>
              </div>
              <Button size="small" onClick={cancel}>
                Cancel
              </Button>
            </div>
            <div className="h-1 bg-slate-100" aria-hidden>
              <div className="h-full bg-brand/60 transition-[width] duration-500 ease-linear" style={{ width: `${progress}%` }} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
