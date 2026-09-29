"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Checkbox, Modal, Skeleton } from "antd";
import { motion } from "motion/react";
import { ArrowRight, Plus, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import { contentFrom, include, tailor } from "@/lib/tailor";
import { jobMatch } from "@/lib/applications";
import { templatesIn } from "@/pdf/registry";
import { useBilling, notifyCreditsChanged } from "../BillingProvider";
import { AI_ENABLED } from "@/lib/config";
import { jobName } from "./ui";

/**
 * Tailor (V2, docs/v2/SPEC.md §5.3): a resume for each chosen job, picked from the Career
 * Profile by relevance (no AI, no credits). One job shows what was picked and the match
 * before and after, with one-click "include" for skills the profile has; several jobs are
 * made in one go (plan's batch size).
 */
export default function TailorModal({ open, onClose, apps, token, onDone }) {
  const billing = useBilling();
  const [profile, setProfile] = useState(undefined);
  const [resumes, setResumes] = useState(null);

  useEffect(() => {
    if (!open) return;
    api("/profile", { token }).then((d) => setProfile(d.data)).catch(() => setProfile(null));
    api("/resumes", { token }).then((d) => setResumes(d.data)).catch(() => setResumes([]));
  }, [open, token]);

  const tailoredCount = resumes?.filter((r) => r.tailoredFor).length || 0;
  const templateFor = (category) => {
    if (category !== "academic") return "Classic";
    return templatesIn("academic").find((t) => !billing?.templateLock(t.id))?.id || "Classic";
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={600} centered destroyOnHidden>
      {profile === undefined || !resumes ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !profile ? (
        <div className="py-4 text-center">
          <h2 className="font-display text-lg font-bold text-ink">Set up your Career Profile first</h2>
          <p className="mt-1 text-sm text-slate-500">Tailored resumes are picked from everything in your profile.</p>
          <Button type="primary" className="!mt-5" href="/career">Go to my profile</Button>
        </div>
      ) : apps.length === 1 ? (
        <One app={apps[0]} profile={profile} token={token} templateFor={templateFor} tailoredCount={tailoredCount} onDone={onDone} onClose={onClose} />
      ) : (
        <Many apps={apps} profile={profile} token={token} templateFor={templateFor} tailoredCount={tailoredCount} onDone={onDone} onClose={onClose} />
      )}
    </Modal>
  );
}

const nicknameFor = (a) => [a.job?.title, a.job?.organisation].filter(Boolean).join(" · ").slice(0, 120) || "Tailored resume";

function Meter({ before, after }) {
  if (after == null) return null;
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">Keyword coverage for this job</p>
      <div className="mt-1 flex items-baseline gap-2">
        {before != null && before !== after ? <span className="font-display text-lg text-slate-400 line-through decoration-slate-300">{before}%</span> : null}
        <span className="font-display text-3xl font-bold text-ink">{after}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-teal-500" initial={{ width: `${before ?? 0}%` }} animate={{ width: `${after}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">A guide to how well the resume speaks the job&apos;s language, not a pass mark.</p>
    </div>
  );
}

function One({ app, profile, token, templateFor, tailoredCount, onDone, onClose }) {
  const { message } = App.useApp();
  const router = useRouter();
  const billing = useBilling();
  const text = app.job?.description || "";
  const first = useMemo(() => tailor(profile, text), [profile, text]);
  const [plan, setPlan] = useState(first.plan);
  const [busy, setBusy] = useState(false);
  const content = useMemo(() => contentFrom(profile, plan), [profile, plan]);
  const after = useMemo(() => jobMatch(content, text), [content, text]);
  const findable = first.report.findable.filter((f) => after?.missing.includes(f.name));
  const notInProfile = (after?.missing || []).filter((m) => !first.report.findable.some((f) => f.name === m));

  const create = async () => {
    if (billing && !billing.requireLimit("tailored", tailoredCount, "More tailored resumes")) return;
    setBusy(true);
    try {
      const { data } = await api("/applications/tailored", { token, method: "POST", body: { items: [{ application: app._id, nickname: nicknameFor(app), template: templateFor(first.category), content }] } });
      onDone?.(data);
      message.success("Tailored resume ready");
      router.push(`/builder?id=${data[0].resume}`);
    } catch (err) {
      if (err.code !== "upgrade") message.error(err.message);
      setBusy(false);
    }
  };

  const p = first.picked;
  return (
    <div className="pt-1">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-white shadow-md shadow-brand/25"><Wand2 size={18} /></span>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">Tailored for {jobName(app)}</h2>
      <p className="text-sm text-slate-500">
        Picked from your profile: {p.jobs[0]} of {p.jobs[1]} jobs, {p.points[0]} of {p.points[1]} points{p.projects[1] ? `, ${p.projects[0]} of ${p.projects[1]} projects` : ""}. The skills this job asks for come first.
      </p>
      <div className="mt-4">
        <Meter before={first.report.before} after={after?.score ?? null} />
      </div>
      {findable.length ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">In your profile, not on this resume yet</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {findable.map((f) => (
              <button key={f.name} type="button" onClick={() => setPlan((pl) => include(profile, pl, f.name, text))} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-dark transition hover:border-brand">
                <Plus size={12} /> {f.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {notInProfile.length ? (
        <p className="mt-3 text-xs text-slate-500">
          Not in your profile: {notInProfile.slice(0, 8).join(", ")}. If you have {notInProfile.length === 1 ? "it" : "them"}, add {notInProfile.length === 1 ? "it" : "them"} to your profile first; tailoring never makes things up.
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="primary" loading={busy} icon={<ArrowRight size={15} />} iconPlacement="end" onClick={create}>
          Create and open
        </Button>
      </div>
    </div>
  );
}

function Many({ apps, profile, token, templateFor, tailoredCount, onDone, onClose }) {
  const { message } = App.useApp();
  const billing = useBilling();
  const results = useMemo(() => apps.map((a) => ({ a, t: tailor(profile, a.job?.description || "") })), [apps, profile]);
  const [picked, setPicked] = useState(() => new Set(apps.map((a) => a._id)));
  const [busy, setBusy] = useState(false);
  const [polish, setPolish] = useState(false);
  const [progress, setProgress] = useState(null);
  const perJob = billing?.costOf("polish") ?? null;
  const canPolish = AI_ENABLED && perJob != null && billing?.canUse("polish");
  const chosen = results.filter((r) => picked.has(r.a._id));
  const batch = billing?.limitOf("batch");

  const create = async () => {
    if (billing && batch !== null && chosen.length > batch) {
      billing.requireLimit("batch", chosen.length, "Tailoring more jobs at once");
      return;
    }
    if (billing && !billing.requireLimit("tailored", tailoredCount + chosen.length - 1, "More tailored resumes")) return;
    setBusy(true);
    try {
      const { data } = await api("/applications/tailored", {
        token,
        method: "POST",
        body: { items: chosen.map(({ a, t }) => ({ application: a._id, nickname: nicknameFor(a), template: templateFor(t.category), content: t.content })) },
      });
      if (polish && canPolish) {
        // One polish request per resume: each is charged on its own, and any that fails is refunded.
        let ok = 0;
        for (const [i, r] of data.entries()) {
          setProgress(`Polishing ${i + 1} of ${data.length}…`);
          try {
            await api("/ai/polish", { token, method: "POST", body: { resumeId: r.resume, store: true } });
            ok++;
          } catch (err) {
            if (err.code === "credits" || err.code === "upgrade" || err.code === "cancelled") break;
          }
        }
        notifyCreditsChanged();
        message.info(ok === data.length ? "Polish suggestions are waiting in each resume." : `${ok} of ${data.length} polished; the rest weren't charged.`, 6);
      }
      onDone?.(data);
      message.success(`${data.length} tailored resume${data.length === 1 ? "" : "s"} ready`);
      onClose();
    } catch (err) {
      if (err.code !== "upgrade") message.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-1">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-white shadow-md shadow-brand/25"><Wand2 size={18} /></span>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">Tailor resumes for {apps.length} jobs</h2>
      <p className="text-sm text-slate-500">One resume per job, picked from your profile. Free, and you can fine-tune each in the builder.</p>
      <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {results.map(({ a, t }) => (
          <li key={a._id}>
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${picked.has(a._id) ? "border-brand-200 bg-brand-50/40" : "border-slate-200"}`}>
              <Checkbox checked={picked.has(a._id)} onChange={() => setPicked((s) => (s.has(a._id) ? new Set([...s].filter((x) => x !== a._id)) : new Set([...s, a._id])))} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{jobName(a)}</span>
                <span className="block text-xs text-slate-500">{a.job?.organisation}</span>
              </span>
              {t.report.after != null ? <span className="text-sm font-semibold text-brand tabular-nums">{t.report.after}%</span> : null}
            </label>
          </li>
        ))}
      </ul>
      {canPolish ? (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
          <Checkbox checked={polish} onChange={(e) => setPolish(e.target.checked)} className="!mt-0.5" />
          <span className="text-sm">
            <span className="font-medium text-ink">Also polish each with AI</span>
            <span className="block text-xs text-slate-500">
              {perJob} credit{perJob === 1 ? "" : "s"} each, {perJob * chosen.length} in all{billing?.usage ? `. You have ${billing.usage.remaining}` : ""}. Suggestions wait in each resume for you to review.
            </span>
          </span>
        </label>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{progress || (batch != null ? `Your plan tailors up to ${batch} at once.` : "")}</p>
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={busy} disabled={!chosen.length} onClick={create}>
            Create {chosen.length} resume{chosen.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
