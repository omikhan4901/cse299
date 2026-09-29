"use client";

import { useMemo, useState } from "react";
import { App, Button, Checkbox, Modal } from "antd";
import { CheckCircle2, Copy, MessagesSquare, CircleAlert, Sparkles } from "lucide-react";
import { prepFor, prepText } from "@/lib/interview";
import { jobName } from "./ui";

function Block({ title, hint, children }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/**
 * Interview prep for one application (V2.1): made from the job and the person's own
 * experience, with no AI. The resume that was sent is used when there is one, so the
 * evidence matches what the interviewers have in front of them.
 */
export default function InterviewPrep({ open, onClose, app, profile, resume, onPrepared, prepared }) {
  const { message } = App.useApp();
  const [allQuestions, setAllQuestions] = useState(false);
  const [done, setDone] = useState({});
  const sent = !!app?.snapshot?.content;
  const prep = useMemo(
    () => (open ? prepFor({ job: app?.job, source: sent ? app.snapshot.content : profile || resume || {}, sent }) : null),
    [open, app, profile, resume, sent]
  );
  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prepText(prep, app.job));
      message.success("Copied");
    } catch {
      message.error("Couldn't copy. Select the text instead.");
    }
  };
  const questions = allQuestions ? prep?.questions || [] : (prep?.questions || []).slice(0, 5);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={640}
      centered
      destroyOnHidden
      title={<span className="inline-flex items-center gap-2"><MessagesSquare size={17} className="text-brand" /> Interview prep</span>}
      styles={{ body: { maxHeight: "min(70vh, 680px)", overflowY: "auto", overscrollBehavior: "contain" } }}
      classNames={{ body: "thin-scroll -mx-6 px-6" }}
      footer={
        prep ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button icon={<Copy size={14} />} onClick={copy}>Copy as text</Button>
            {prepared ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} /> Marked as prepared</span>
            ) : (
              <Button type="primary" onClick={() => { onPrepared?.(); onClose(); }}>I&apos;m prepared</Button>
            )}
          </div>
        ) : null
      }
    >
      {!prep ? (
        <p className="py-6 text-center text-sm text-slate-500">Add the job title or the job description first.</p>
      ) : (
        <div className="pb-1">
          <p className="text-sm text-slate-500">
            {jobName(app)} · {prep.family.label}. {sent ? "Built from the resume you sent, so it matches what they're reading." : "Built from your Career Profile."}
          </p>

          {prep.focus.length ? (
            <Block title="What they'll look for" hint="The skills the job stresses most, and where you've shown them.">
              <ul className="space-y-2">
                {prep.focus.map((f) => (
                  <li key={f.name} className="flex gap-2.5">
                    {f.gap ? <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-500" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />}
                    <div className="min-w-0 text-sm">
                      <span className="font-medium text-ink">{f.name}</span>
                      <p className="text-slate-600">
                        {f.evidence ? <>“{f.evidence.text}” <span className="text-slate-400">· {f.evidence.where}</span></> : f.listed ? "In your skills. Have one example ready." : "Not on your resume. Be honest about your level, and say how you'd learn it."}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Block>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Add the job description to see which of your experience fits what they&apos;re looking for.</p>
          )}

          {prep.stories.length ? (
            <Block title="Stories to have ready" hint="For each: the situation, what you did, and the result.">
              <ul className="space-y-2">
                {prep.stories.map((s) => (
                  <li key={s.text} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    {s.text} <span className="text-slate-400">· {s.where}</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          <Block title="Likely questions">
            <ul className="space-y-2.5">
              {questions.map((q) => (
                <li key={q.q} className="text-sm">
                  <p className="font-medium text-ink">{q.q}</p>
                  {q.tip ? <p className="text-slate-500">{q.tip}</p> : null}
                </li>
              ))}
            </ul>
            {prep.questions.length > 5 ? (
              <button type="button" onClick={() => setAllQuestions((v) => !v)} className="mt-2 text-sm font-medium text-brand hover:underline">
                {allQuestions ? "Show fewer" : `Show all ${prep.questions.length}`}
              </button>
            ) : null}
          </Block>

          <Block title="Questions to ask them">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {prep.ask.map((q) => <li key={q}>{q}</li>)}
            </ul>
          </Block>

          <Block title="Before you go">
            <ul className="space-y-1.5">
              {prep.checklist.map((c) => (
                <li key={c}>
                  <Checkbox checked={!!done[c]} onChange={(e) => setDone((d) => ({ ...d, [c]: e.target.checked }))}>
                    <span className={done[c] ? "text-slate-400 line-through" : "text-slate-700"}>{c}</span>
                  </Checkbox>
                </li>
              ))}
            </ul>
          </Block>

          <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400"><Sparkles size={12} /> Made from your own experience and the job text. Nothing here is invented.</p>
        </div>
      )}
    </Modal>
  );
}
