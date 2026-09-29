"use client";

import { useRef, useState } from "react";
import { App, Button, Input, Modal } from "antd";
import { FileUp, Sparkles, X, Zap } from "lucide-react";
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
 */
export default function AddAnything({ open, onClose, target, token, onApply, where = "your resume" }) {
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

  const ready = !!file || text.trim().length >= 3;
  return (
    <Modal open={open} onCancel={close} footer={null} width={560} centered destroyOnHidden>
      <div className="pt-1">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-white shadow-md shadow-brand/25">
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Add anything</h2>
            <p className="text-sm text-slate-500">Paste an old CV, describe your work, or say what to change or remove. You check everything first.</p>
          </div>
        </div>
        <Input.TextArea
          className="!mt-4"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={30000}
          autoSize={{ minRows: 6, maxRows: 14 }}
          placeholder={"e.g. “In my third year I built an attendance system with Python and OpenCV that cut roll-call time from 10 minutes to 1.”\n\nOr: “This is my latest CV, use it instead” with a file, or “Remove my old projects”. Bangla or English is fine."}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {file ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              <FileUp size={14} /> <span className="truncate">{file.name}</span>
              <button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
            </span>
          ) : (
            <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              <FileUp size={15} /> Or upload a PDF or Word file
            </button>
          )}
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
          <Button type="primary" loading={busy} disabled={!ready} onClick={analyze} icon={<Sparkles size={15} />}>
            Analyze
            {cost != null ? (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 text-xs">
                <Zap size={11} className="fill-current" /> {cost}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
