"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, Input, Button, App } from "antd";
import { Send, Sparkles, Copy, Upload, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { outlineOf } from "@/lib/ingest/ops";
import ReviewChanges from "../review/ReviewChanges";
import { CreditTooltip } from "../Credits";
import { useBilling } from "../BillingProvider";
import PlanTag from "../billing/PlanTag";

/** "Each message uses 1 credit · 38 left today" */
function CostHint({ feature, verb }) {
  const billing = useBilling();
  const cost = billing?.costOf(feature);
  const usage = billing?.usage;
  if (cost == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <Zap size={11} className="fill-amber-400 text-amber-500" />
      {verb} {cost === 0 ? "is free" : `uses ${cost} credit${cost === 1 ? "" : "s"}`}
      {usage ? ` · ${usage.remaining} left ${usage.period === "month" ? "this month" : "today"}` : ""}
    </span>
  );
}

const { TextArea } = Input;

/** Resume data for the AI: no photo (large and private) and no database fields. */
export function aiResume(resume) {
  const { _id, shortId, isPublic, isMaster, updatedAt, nickname, theme, template, rev, tailoredFor, suggestions, biodata, ...rest } = resume;
  return { ...rest, personal: { ...rest.personal, profilePic: undefined, profilePicSource: undefined, photoCrop: undefined } };
}

/**
 * `onApplyOperations(ops)`: V2, the assistant proposes edits as reviewable changes (none apply on their own).
 * `onOpenAdd()`: opens "Add anything" (or the import): files go there, the assistant takes no attachments.
 */
export function ChatModal({ open, onClose, resume, token, onUseAsSummary, onOpenGuide, onApplyOperations, onOpenAdd, addLabel = "Add anything", draft, onDraftUsed }) {
  const [messages, setMessages] = useState([]);
  const [review, setReview] = useState(null); // index of the message whose changes are being reviewed
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      const first = resume.personal.name?.split(" ")[0];
      setMessages([{ role: "assistant", content: `Hi${first ? ` ${first}` : ""}! I've read your resume. Ask me to rewrite a section, suggest skills for a role, or check your bullet points.` }]);
    }
  }, [open, messages.length, resume.personal.name]);

  // A message handed over from "Add anything": ready to send, not sent.
  useEffect(() => {
    if (!open || !draft) return;
    setInput(draft);
    onDraftUsed?.();
  }, [open, draft, onDraftUsed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      // Leave out the greeting and any error bubbles: they aren't part of the conversation.
      const conversation = next.slice(1).filter((m) => !m.error);
      const propose = onApplyOperations ? { propose: true, outline: outlineOf(resume) } : {};
      const data = await api("/ai/chat", { token, method: "POST", body: { conversation: conversation.map(({ role, content }) => ({ role, content })), fullResume: aiResume(resume), ...propose } });
      setMessages((m) => [...m, { role: "assistant", content: data.response, operations: data.operations?.length ? data.operations : undefined }]);
    } catch (err) {
      if (err.code === "cancelled") {
        // Take the question back out of the chat and into the box, to edit or resend.
        setMessages(messages);
        setInput(text);
      }
      else setMessages((m) => [...m, { role: "assistant", content: err.message, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={<span className="inline-flex items-center gap-2"><Sparkles size={16} className="text-brand" /> AI resume assistant</span>} open={open} onCancel={onClose} footer={null} width={640}>
      {onOpenAdd ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 sm:flex-nowrap">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-brand ring-1 ring-brand-200"><Upload size={15} /></span>
          <p className="min-w-0 flex-1 text-sm text-slate-700">
            <b className="font-semibold text-ink">Have a file, like an old CV?</b> The assistant can&apos;t read attachments. Use {addLabel} to bring it in.
          </p>
          <Button size="small" icon={<Upload size={13} />} onClick={onOpenAdd}>
            {addLabel} <PlanTag feature="parse" />
          </Button>
        </div>
      ) : null}
      <div ref={listRef} className="thin-scroll h-[50vh] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-brand text-white" : m.error ? "bg-red-50 text-red-700" : "bg-white text-ink shadow-sm"}`}>
              {m.content}
              {m.operations ? (
                m.applied ? (
                  <span className="mt-2 block text-xs text-slate-400">{m.applied}</span>
                ) : (
                  <Button size="small" type="primary" className="!mt-2" onClick={() => setReview(i)}>
                    Review {m.operations.length} change{m.operations.length === 1 ? "" : "s"}
                  </Button>
                )
              ) : i > 0 && m.role === "assistant" && !m.error ? (
                <button type="button" className="mt-2 block text-xs font-medium text-brand hover:underline" onClick={() => onUseAsSummary(m.content)}>
                  Use as my “About me”
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? <div className="text-sm text-slate-400">Thinking…</div> : null}
      </div>
      <div className="mt-3 flex gap-2">
        <Input size="large" value={input} onChange={(e) => setInput(e.target.value)} onPressEnter={send} placeholder="e.g. What skills am I missing for a data analyst role?" disabled={loading} />
        <Button size="large" type="primary" icon={<Send size={16} />} onClick={send} loading={loading} />
      </div>
      <ReviewChanges
        open={review !== null}
        title="Changes from the assistant"
        subtitle="Nothing changes until you apply it."
        operations={review !== null ? messages[review]?.operations : []}
        target={resume}
        onApply={(ops) => {
          onApplyOperations(ops);
          setMessages((list) => list.map((m, j) => (j === review ? { ...m, applied: `Applied ${ops.length} change${ops.length === 1 ? "" : "s"}.` } : m)));
          setReview(null);
        }}
        onClose={() => setReview(null)}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <CostHint feature="chat" verb="Each message" />
      {onOpenGuide ? (
        <p className="text-xs text-slate-400">
          Answers follow our{" "}
          <button type="button" onClick={onOpenGuide} className="font-medium text-brand hover:underline">How to write a good resume</button>{" "}
          guide.
        </p>
      ) : null}
      </div>
    </Modal>
  );
}

/** `initialJob` fills in the job text (from a tracked application); `onSave(letter)` keeps the letter there. */
export function CoverLetterModal({ open, onClose, resume, token, initialJob = "", onSave }) {
  const { message } = App.useApp();
  const [job, setJob] = useState(initialJob);
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!job.trim()) return message.warning("Paste the job description first.");
    setLoading(true);
    try {
      const data = await api("/ai/cover-letter", { token, method: "POST", body: { resumeData: aiResume(resume), jobDescription: job } });
      setLetter(data.coverLetter);
    } catch (err) {
      if (err.code !== "upgrade" && err.code !== "cancelled") message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Cover letter writer" open={open} onCancel={onClose} footer={null} width={720}>
      {!letter ? (
        <div>
          <p className="mb-3 text-sm text-slate-500">We&apos;ll write a letter that connects your experience to this job.</p>
          <TextArea rows={8} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the full job description" />
          <CreditTooltip feature="coverLetter">
            <Button type="primary" size="large" block className="!mt-4" loading={loading} onClick={generate}>
              Write my cover letter
            </Button>
          </CreditTooltip>
          <p className="mt-2 text-center"><CostHint feature="coverLetter" verb="A cover letter" /></p>
        </div>
      ) : (
        <div>
          <TextArea value={letter} onChange={(e) => setLetter(e.target.value)} autoSize={{ minRows: 12, maxRows: 22 }} />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setLetter("")}>Start over</Button>
            <Button type={onSave ? "default" : "primary"} icon={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(letter).then(() => message.success("Copied"))}>
              Copy letter
            </Button>
            {onSave ? (
              <Button type="primary" onClick={() => onSave(letter)}>
                Save to this application
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
