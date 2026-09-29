"use client";

import { useEffect, useRef, useState } from "react";
import { App, Button, Input, Modal, Skeleton } from "antd";
import { AlertTriangle, ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { splitBullets } from "@/lib/resume";

const Flag = ({ tokens }) =>
  tokens?.length ? (
    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" /> Check this: {tokens.join(", ")} {tokens.length === 1 ? "isn’t" : "aren’t"} in what you wrote. Keep it only if it&apos;s true.
    </p>
  ) : null;

/**
 * "Improve with AI" (Rewrite mode, V2 §5.2): the rewrite is shown next to the original and
 * only replaces it when the person says so; anything that looks new is pointed out. For
 * work points, "Make one stronger" switches to Strengthen, which asks instead of inventing.
 */
export function RewriteModal({ rewrite, onUse, onClose, onStrengthen }) {
  if (!rewrite) return null;
  const lines = rewrite.kind === "item" ? splitBullets(rewrite.before) : [];
  return (
    <Modal open onCancel={onClose} footer={null} width={640} centered destroyOnHidden title={<span className="inline-flex items-center gap-2"><Sparkles size={16} className="text-brand" /> AI rewrite</span>}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-xs font-medium text-slate-400">Yours</p>
          <p className="text-sm whitespace-pre-line text-slate-600">{rewrite.before}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <p className="mb-1 text-xs font-medium text-brand-dark">Rewritten</p>
          <p className="text-sm whitespace-pre-line text-ink">{rewrite.after}</p>
        </div>
      </div>
      <Flag tokens={rewrite.unverified} />
      {onStrengthen && lines.length ? (
        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><TrendingUp size={15} className="text-brand" /> Make a point stronger</p>
          <p className="text-xs text-slate-500">The AI asks a few questions and writes the point from your answers.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lines.map((l) => (
              <button key={l} type="button" onClick={() => onStrengthen(l)} className="max-w-full truncate rounded-full border border-slate-200 px-2.5 py-1 text-left text-xs text-slate-600 transition hover:border-brand hover:text-brand">
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Keep mine</Button>
        <Button type="primary" onClick={() => onUse(rewrite.after)}>Use the rewrite</Button>
      </div>
    </Modal>
  );
}

/** Strengthen: questions first, then one point written only from the answers. */
export function StrengthenModal({ point, token, onUse, onClose }) {
  const { message } = App.useApp();
  // The latest onClose, without re-asking the questions every time the builder re-renders.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!point) return;
    // Asked once per point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestions(null);
    setResult(null);
    setAnswers({});
    api("/ai/strengthen", { token, method: "POST", body: { text: point } })
      .then((d) => setQuestions(d.questions))
      .catch((err) => {
        if (err.code !== "upgrade" && err.code !== "cancelled") message.error(err.message);
        close.current();
      });
  }, [point, token, message]);

  const write = async () => {
    setBusy(true);
    try {
      const d = await api("/ai/strengthen", { token, method: "POST", body: { text: point, answers: questions.map((q, i) => ({ q, a: answers[i] || "" })) } });
      setResult(d);
    } catch (err) {
      if (err.code !== "upgrade" && err.code !== "cancelled") message.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!point} onCancel={onClose} footer={null} width={560} centered destroyOnHidden title={<span className="inline-flex items-center gap-2"><TrendingUp size={16} className="text-brand" /> Make it stronger</span>}>
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{point}</p>
      {!questions ? (
        <Skeleton active paragraph={{ rows: 3 }} title={false} className="!mt-4" />
      ) : !result ? (
        <>
          <p className="mt-4 text-sm text-slate-500">Answer what you can. Skip anything that doesn&apos;t apply: nothing is added that you don&apos;t say.</p>
          <div className="mt-3 space-y-3">
            {questions.map((q, i) => (
              <label key={q} className="block">
                <span className="mb-1 block text-sm font-medium text-ink">{q}</span>
                <Input value={answers[i] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={busy} disabled={!Object.values(answers).some((v) => v?.trim())} onClick={write} icon={<ArrowRight size={15} />} iconPlacement="end">
              Write it
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-2 text-sm text-ink">{result.text}</p>
          <Flag tokens={result.unverified} />
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setResult(null)}>Change answers</Button>
            <Button type="primary" onClick={() => onUse(result.text)}>Use this point</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
