"use client";

import { useRef, useState } from "react";
import { App, Button, Input, Modal } from "antd";
import { FileUp, MessageCircle, Sparkles, X, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { isRemoval, outlineOf } from "@/lib/ingest/ops";
import { useBilling, notifyCreditsChanged } from "../BillingProvider";
import ReviewChanges from "./ReviewChanges";

/**
 * "Add anything" (V2 Phase 0): paste an old CV, a LinkedIn About or a few sentences about
 * your work, or upload a PDF/DOCX. The AI files it in the right places as reviewable
 * changes (server/lib/ingest.js); nothing changes until the person applies them.
 *
 *   target   the resume or profile content it's added to (its outline goes to the AI, so
 *            follow-ups like "I forgot to mention…" land on the right item)
 *   onApply(operations)
 *   onAskAssistant(text)  given where the AI assistant is (the builder): then this needs a
 *            file (an import) and the text is a note about it; a message on its own is
 *            handed to the assistant instead. Without it (the profile), text alone works.
 */
export default function AddAnything({ open, onClose, target, token, onApply, onAskAssistant, where = "your resume" }) {
  const { message } = App.useApp();
  const billing = useBilling();
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null); // { operations, skipped }
  const input = useRef(null);
  const cost = billing?.costOf("parse");

  const close = () => {
    setReview(null);
    onClose();
  };

  const analyze = async () => {
    if (billing && !billing.requireFeature("parse", "Adding from text or a file")) return;
    setBusy(true);
    try {
      let body;
      if (file) {
        body = new FormData();
        body.append("resumeFile", file);
        body.append("outline", JSON.stringify(outlineOf(target)));
        if (text.trim()) body.append("text", text.trim());
      } else {
        body = { text: text.trim(), outline: outlineOf(target) };
      }
      const data = await api("/ai/ingest", { token, method: "POST", body, timeout: file ? 120000 : undefined });
      notifyCreditsChanged();
      setReview({ operations: data.operations, skipped: data.skipped });
    } catch (err) {
      notifyCreditsChanged();
      if (err.code !== "upgrade" && err.code !== "cancelled") message.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async (ops) => {
    await onApply(ops);
    setText("");
    setFile(null);
    setReview(null);
    onClose();
    message.success(`${ops.some(isRemoval) ? "Made" : "Added"} ${ops.length} change${ops.length === 1 ? "" : "s"}`);
  };

  if (review) {
    const found = review.operations.length;
    const removing = review.operations.some(isRemoval);
    return (
      <ReviewChanges
        open={open}
        title={!found ? "Nothing new to add" : removing ? `${found} change${found === 1 ? "" : "s"} to ${where}` : `I found ${found} thing${found === 1 ? "" : "s"} to add`}
        subtitle={review.skipped ? `${review.skipped} already in ${where}, so left out.` : removing ? "Tick what to keep. Nothing changes until you apply." : `Tick what to add to ${where}.`}
        operations={review.operations}
        target={target}
        applyLabel="Add"
        onApply={apply}
        onClose={close}
      />
    );
  }

  const fileOnly = !!onAskAssistant;
  const ready = fileOnly ? !!file : !!file || text.trim().length >= 3;
  const pick = (
    <input
      ref={input}
      type="file"
      accept=".pdf,.docx"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f && f.size > 10 * 1024 * 1024) return message.error("That file is over 10 MB.");
        if (f) setFile(f);
      }}
    />
  );
  const chip = file ? (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
      <FileUp size={14} /> <span className="truncate">{file.name}</span>
      <button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
    </span>
  ) : null;
  const analyzeButton = (
    <Button type="primary" loading={busy} disabled={!ready} onClick={analyze} icon={<Sparkles size={15} />}>
      Analyze
      {cost != null ? (
        <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 text-xs">
          <Zap size={11} className="fill-current" /> {cost}
        </span>
      ) : null}
    </Button>
  );

  return (
    <Modal open={open} onCancel={close} footer={null} width={560} centered destroyOnHidden>
      <div className="pt-1">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-white shadow-md shadow-brand/25">
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Add anything</h2>
            <p className="text-sm text-slate-500">
              {fileOnly ? "Bring in an old CV or any document about your work. You check everything first." : "Paste an old CV, describe your work, or say what to change or remove. You check everything first."}
            </p>
          </div>
        </div>

        {fileOnly ? (
          <>
            {pick}
            {file ? (
              <div className="mt-4">{chip}</div>
            ) : (
              <button type="button" onClick={() => input.current?.click()} className="mt-4 flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center transition hover:border-brand hover:bg-brand-50/40">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand"><FileUp size={18} /></span>
                <span className="text-sm font-semibold text-ink">Choose a PDF or Word file</span>
                <span className="text-xs text-slate-500">Up to 10 MB</span>
              </button>
            )}
            <Input.TextArea
              className="!mt-3"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              autoSize={{ minRows: 2, maxRows: 5 }}
              placeholder={"Note (optional), e.g. “This is my previous resume, use it instead”"}
            />
            {!file && text.trim() ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 sm:flex-nowrap">
                <MessageCircle size={16} className="shrink-0 text-brand" />
                <p className="min-w-0 flex-1 text-sm text-slate-700">No file? To add or change something by writing it, ask the AI assistant.</p>
                <Button size="small" onClick={() => { const t = text.trim(); setText(""); onClose(); onAskAssistant(t); }}>Ask the assistant</Button>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end">{analyzeButton}</div>
          </>
        ) : (
          <>
            <Input.TextArea
              className="!mt-4"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={billing?.config?.aiLimits?.parse?.input || 30000}
              showCount={text.length > (billing?.config?.aiLimits?.parse?.input || 30000) * 0.8}
              autoSize={{ minRows: 6, maxRows: 14 }}
              placeholder={"e.g. “In my third year I built an attendance system with Python and OpenCV that cut roll-call time from 10 minutes to 1.”\n\nOr: “This is my latest CV, use it instead” with a file, or “Remove my old projects”. Bangla or English is fine."}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {chip || (
                <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                  <FileUp size={15} /> Or upload a PDF or Word file
                </button>
              )}
              {pick}
              {analyzeButton}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
