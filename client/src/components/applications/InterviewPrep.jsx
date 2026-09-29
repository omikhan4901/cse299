"use client";

import { useMemo, useState } from "react";
import { App, Button, Checkbox, Modal, Segmented, Skeleton } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronDown, Copy, MessagesSquare, CircleAlert, Quote, RotateCw, Sparkles, Zap } from "lucide-react";
import { aiPrepText, prepFor, prepText } from "@/lib/interview";
import { api } from "@/lib/api";
import { AI_ENABLED } from "@/lib/config";
import { useBilling } from "../BillingProvider";
import { CreditTooltip } from "../Credits";
import PlanTag from "../billing/PlanTag";
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

function Checklist({ items }) {
  const [done, setDone] = useState({});
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c}>
          <Checkbox checked={!!done[c]} onChange={(e) => setDone((d) => ({ ...d, [c]: e.target.checked }))}>
            <span className={done[c] ? "text-slate-400 line-through" : "text-slate-700"}>{c}</span>
          </Checkbox>
        </li>
      ))}
    </ul>
  );
}

/** A line from their own resume, with where it's from. */
function Evidence({ line, label }) {
  return (
    <p className="mt-1.5 flex gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-600">
      <Quote size={13} className="mt-0.5 shrink-0 text-slate-400" />
      <span>
        {label ? <span className="text-slate-400">{label} </span> : null}
        {line.text} <span className="text-slate-400">· {line.where}</span>
      </span>
    </p>
  );
}

const cost = (n) => (n == null ? null : (
  <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 text-xs">
    <Zap size={11} className="fill-current" /> {n}
  </span>
));

const TYPE = { role: "About the work", behavioural: "Behavioural", situational: "Situational", motivation: "Motivation" };
const FROM = { sent: "the resume you sent", resume: "your resume for this job", profile: "your Career Profile" };

/** One likely question: the question first, the rest on a click. */
function QuestionCard({ q, open, onToggle }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-3 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{q.question}</span>
          <span className="mt-0.5 block text-xs text-slate-400">{TYPE[q.type] || "About the work"}</span>
        </span>
        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="border-t border-slate-100 px-3 pt-2 pb-3 text-sm">
              {q.why ? <p className="text-slate-500">They&apos;re checking: {q.why}</p> : null}
              {q.outline?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                  {q.outline.map((o) => <li key={o}>{o}</li>)}
                </ul>
              ) : null}
              {q.use ? <Evidence line={q.use} label="Build on:" /> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

/** The AI sheet for this job (server/lib/interviewAi.js), styled here. */
function AiSheet({ data }) {
  const [open, setOpen] = useState(0);
  const [all, setAll] = useState(false);
  const questions = all ? data.questions : data.questions.slice(0, 5);
  return (
    <div>
      {data.summary ? <p className="text-sm leading-relaxed text-slate-700">{data.summary}</p> : null}

      {data.focus?.length ? (
        <Block title="What they'll probe" hint="And how to talk about each, from your own work.">
          <ul className="space-y-3">
            {data.focus.map((f) => (
              <li key={f.skill} className="flex gap-2.5">
                {f.evidence ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-500" />}
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-ink">{f.skill}</span>
                  {f.why ? <p className="text-slate-500">{f.why}</p> : null}
                  {f.evidence ? <Evidence line={f.evidence} /> : null}
                  {f.talk ? <p className="mt-1.5 text-slate-700">{f.talk}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      <Block title="Likely questions" hint="Open one to see what they're checking and what to cover.">
        <ul className="space-y-2">
          {questions.map((q, i) => (
            <QuestionCard key={q.question} q={q} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </ul>
        {data.questions.length > 5 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-sm font-medium text-brand hover:underline">
            {all ? "Show fewer" : `Show all ${data.questions.length}`}
          </button>
        ) : null}
      </Block>

      {data.gaps?.length ? (
        <Block title="If they ask about a gap" hint="Things the job asks for that your resume doesn't show yet.">
          <ul className="space-y-2">
            {data.gaps.map((g) => (
              <li key={g.gap} className="text-sm">
                <span className="font-medium text-ink">{g.gap}</span>
                <p className="text-slate-600">{g.answer || "Be honest about your level, and say how you'd learn it."}</p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {data.ask?.length ? (
        <Block title="Questions to ask them">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {data.ask.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </Block>
      ) : null}

      {data.prepare?.length ? (
        <Block title="Before you go">
          <Checklist items={data.prepare} />
        </Block>
      ) : null}
    </div>
  );
}

/** The free sheet, made in the browser from the job and their own experience (lib/interview.js). */
function QuickSheet({ prep }) {
  const [allQuestions, setAllQuestions] = useState(false);
  const questions = allQuestions ? prep.questions : prep.questions.slice(0, 5);
  return (
    <div>
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
        <Checklist items={prep.checklist} />
      </Block>
    </div>
  );
}

/**
 * Interview prep for one application. The quick sheet is free and made in the browser from
 * the job and the person's own experience. "Make it specific" asks the AI once for a sheet
 * for this exact job (credits, shown up front); it's kept on the application.
 * The resume that was sent is used when there is one, so the evidence matches what the
 * interviewers have in front of them.
 */
export default function InterviewPrep({ open, onClose, app, profile, resume, onPrepared, prepared, token, onAi }) {
  const { message } = App.useApp();
  const billing = useBilling();
  const [making, setMaking] = useState(false);
  const [view, setView] = useState(null); // "ai" | "quick"; null = the AI sheet when there is one
  const sent = !!app?.snapshot?.content;
  const prep = useMemo(
    () => (open ? prepFor({ job: app?.job, source: sent ? app.snapshot.content : profile || resume || {}, sent }) : null),
    [open, app, profile, resume, sent]
  );
  if (!open) return null;

  const ai = app?.prepAi?.data?.questions?.length ? app.prepAi : null;
  const shown = view || (ai ? "ai" : "quick");
  const price = billing?.costOf("interviewAi");
  const canAsk = AI_ENABLED && (app?.job?.description || "").trim().length >= 80;
  const hasSource = sent || !!profile || !!resume;

  const make = async () => {
    if (billing && !billing.requireFeature("interviewAi", "AI interview prep")) return;
    setMaking(true);
    setView("ai");
    try {
      const { data } = await api("/ai/interview-prep", { token, method: "POST", body: { applicationId: app._id } });
      onAi?.(data);
    } catch (err) {
      if (err.code !== "upgrade" && err.code !== "cancelled") message.error(err.message);
      setView(null);
    } finally {
      setMaking(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown === "ai" && ai ? aiPrepText(ai.data, app.job) : prepText(prep, app.job));
      message.success("Copied");
    } catch {
      message.error("Couldn't copy. Select the text instead.");
    }
  };

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
            <Button icon={<Copy size={14} />} onClick={copy} disabled={making}>Copy as text</Button>
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

          {ai || making ? (
            <Segmented
              className="mt-4"
              value={shown}
              onChange={setView}
              options={[{ value: "ai", label: <span className="inline-flex items-center gap-1.5"><Sparkles size={13} /> For this job</span> }, { value: "quick", label: "Quick sheet" }]}
            />
          ) : canAsk && hasSource ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-nowrap">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand"><Sparkles size={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Make it specific to this job</p>
                <p className="text-xs text-slate-500">The questions this interviewer is likely to ask, with answers built on your own work.</p>
              </div>
              <CreditTooltip feature="interviewAi">
                <Button type="primary" onClick={make}>
                  Make it {cost(price)} <PlanTag feature="interviewAi" className="ml-1" />
                </Button>
              </CreditTooltip>
            </div>
          ) : null}

          <div className="mt-5">
            {shown === "ai" && making ? (
              <div>
                <p className="mb-3 text-sm text-slate-500">Reading the job and your experience. This can take up to a minute.</p>
                <Skeleton active paragraph={{ rows: 7 }} />
              </div>
            ) : shown === "ai" && ai ? (
              <>
                <AiSheet data={ai.data} />
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={12} /> Made {new Date(ai.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} from {FROM[ai.from] || "your resume"}. Quotes are your own words
                    {ai.data.dropped ? "; lines naming things you haven't done were left out." : "."}
                  </span>
                  {canAsk ? (
                    <CreditTooltip feature="interviewAi" title="Make it again">
                      <button type="button" onClick={make} className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-brand">
                        <RotateCw size={12} /> Make again · <Zap size={11} className="fill-amber-400 text-amber-500" /> {price}
                      </button>
                    </CreditTooltip>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <QuickSheet prep={prep} />
                <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400"><Sparkles size={12} /> Free, no AI credits. Made from your own experience and the job text; nothing here is invented.</p>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
