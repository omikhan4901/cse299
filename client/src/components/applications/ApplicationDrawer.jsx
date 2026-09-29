"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Checkbox, Drawer, Dropdown, Input, Modal, Select, Skeleton, Tooltip } from "antd";
import { AlertTriangle, Archive, ArrowRight, CheckCircle2, ChevronDown, Download, ExternalLink, FileCheck2, FilePlus2, MoreHorizontal, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { api } from "@/lib/api";
import { checklistFor, jobMatch, nextStep, STATUSES } from "@/lib/applications";
import { normalizeResume, toHref, newId } from "@/lib/resume";
import { resumeFromProfile } from "@/lib/profile";
import { AI_ENABLED } from "@/lib/config";
import { useBilling } from "../BillingProvider";
import { CoverLetterModal } from "../builder/AiModals";
import PdfPreview from "../builder/PdfPreview";
import { downloadPdf } from "@/pdf/client";
import { StatusChip } from "./ui";
import TailorModal from "./TailorModal";
import InterviewPrep from "./InterviewPrep";
import PlanTag from "../billing/PlanTag";
import { CreditTooltip } from "../Credits";
import { Cost } from "./ui";

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Section({ title, children, action }) {
  return (
    <section className="border-t border-slate-100 py-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One application in full: next step, resume sent, job match, dates, people, notes. Saves as you go. */
export default function ApplicationDrawer({ id, store, token, onClose }) {
  const { message, modal } = App.useApp();
  const [full, setFull] = useState(null);
  // The latest onClose, so a parent re-render (e.g. after each save) doesn't reload the drawer.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!id) return;
    // A fresh full copy each time it opens (the list leaves out the heavy parts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFull(null);
    api(`/applications/${id}`, { token })
      .then(({ data }) => setFull(data))
      .catch((err) => {
        message.error(err.message);
        close.current();
      });
  }, [id, token, message]);

  /** Saves a change; `local` is how it should look meanwhile (for fields stored differently). */
  const save = useCallback(
    (patch, local) => {
      setFull((f) => (f ? { ...f, ...(local || patch), job: { ...f.job, ...(local || patch).job } } : f));
      return store
        .update(full._id, patch, { local })
        .then((data) => setFull((f) => (f ? { ...f, ...data } : f)))
        .catch((err) => {
          if (err.code === "conflict") {
            store.adopt(err.data);
            setFull(err.data);
            message.warning("This application was changed in another tab. You're seeing the latest version now.");
          } else if (err.code !== "upgrade") message.error(err.message);
        });
    },
    [full, store, message]
  );

  const remove = () =>
    modal.confirm({
      title: "Delete this application?",
      content: "Its notes, dates and the copy of the resume you sent go with it. This can't be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await store.remove(full._id);
        onClose();
      },
    });

  return (
    <Drawer open={!!id} onClose={onClose} width={560} closable={false} destroyOnHidden styles={{ body: { padding: "20px 24px" } }} rootClassName="max-sm:[&_.ant-drawer-content-wrapper]:!w-full">
      {!full ? <Skeleton active paragraph={{ rows: 10 }} /> : <Body a={full} save={save} token={token} onClose={onClose} onDelete={remove} setFull={setFull} />}
    </Drawer>
  );
}

function Body({ a, save, token, onClose, onDelete, setFull }) {
  const { message } = App.useApp();
  const router = useRouter();
  const billing = useBilling();
  const [title, setTitle] = useState(a.job.title);
  const [org, setOrg] = useState(a.job.organisation);
  const [notes, setNotes] = useState(a.notes || "");
  const [description, setDescription] = useState(a.job.description || "");
  const [allSteps, setAllSteps] = useState(false);
  const [showJob, setShowJob] = useState(!a.job.description);
  const [resumes, setResumes] = useState(null);
  const [resume, setResume] = useState(null); // the linked resume's content, for the match and cover letter
  const [profile, setProfile] = useState(undefined);
  const [sentOpen, setSentOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [tailoring, setTailoring] = useState(false);

  useEffect(() => {
    api("/resumes", { token }).then((d) => setResumes(d.data)).catch(() => setResumes([]));
    api("/profile", { token }).then((d) => setProfile(d.data)).catch(() => setProfile(null));
  }, [token]);
  useEffect(() => {
    if (!a.resume) return;
    api(`/resumes/${a.resume}`, { token }).then((d) => setResume(normalizeResume(d.data))).catch(() => setResume(null));
  }, [a.resume, token]);

  const steps = checklistFor(a);
  const step = nextStep(a);
  const tick = (key, value = true) => save({ checklist: { [key]: value } }, { checklist: { ...(a.checklist || {}), [key]: value ? new Date().toISOString() : undefined } });
  const match = useMemo(() => (resume && a.job.description ? jobMatch(resume, a.job.description, profile || null, { ignore: [a.job.organisation] }) : null), [resume, a.job.description, profile, a.job.organisation]);

  const doStep = (s) => {
    if (s.key === "description") return setShowJob(true);
    if (s.key === "submitted") return save({ status: "applied" });
    if (s.key === "resume") return document.getElementById("app-resume")?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (s.key === "interviewPrep") return openPrep();
    tick(s.key);
  };

  // After an offer: the job isn't in the Career Profile yet (spec §8, "Got the job?").
  const same = (x, y) => String(x || "").trim().toLowerCase() === String(y || "").trim().toLowerCase();
  const offerNotInProfile = a.status === "offer" && profile && (a.job.title || a.job.organisation) && !profile.experience?.some((e) => same(e.company, a.job.organisation) && same(e.title, a.job.title));
  const [adding, setAdding] = useState(false);
  const addToProfile = async () => {
    setAdding(true);
    const item = {
      id: newId(), title: a.job.title || "", company: a.job.organisation || "", location: a.job.location || "",
      startDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }), endDate: "Present", description: "",
    };
    try {
      const { data } = await api("/profile", { token, method: "PUT", body: { experience: [item, ...(profile.experience || [])], baseRev: profile.rev } });
      setProfile(data);
      message.success("Added to your Career Profile");
    } catch (err) {
      message.error(err.code === "conflict" ? "Your profile changed in another tab. Open it and add the job there." : err.message);
      if (err.code === "conflict") api("/profile", { token }).then((d) => setProfile(d.data)).catch(() => {});
    } finally {
      setAdding(false);
    }
  };

  const openPrep = () => {
    if (billing && !billing.requireFeature("interviewPrep", "Interview prep")) return;
    setPrepOpen(true);
  };

  const makeFromProfile = async () => {
    setMaking(true);
    try {
      const name = [a.job.title, a.job.organisation].filter(Boolean).join(" · ") || "Application";
      const { data } = await api("/resumes", { token, method: "POST", body: { ...resumeFromProfile(profile), nickname: name.slice(0, 120) } });
      await save({ resume: data._id });
      router.push(`/builder?id=${data._id}`);
    } catch (err) {
      message.error(err.message);
      setMaking(false);
    }
  };

  const list = (key, blank) => ({
    items: a[key] || [],
    add: () => save({ [key]: [...(a[key] || []), { id: newId(), ...blank }] }),
    set: (i, patch) => save({ [key]: a[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) }),
    del: (i) => save({ [key]: a[key].filter((_, j) => j !== i) }),
  });
  const interviews = list("interviews", { at: null, kind: "", notes: "" });
  const contacts = list("contacts", { name: "", role: "", email: "", phone: "" });

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input variant="borderless" value={title} placeholder="Job title" onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== a.job.title && save({ job: { title } })} className="!px-0 font-display !text-xl !font-bold !text-ink" />
          <Input variant="borderless" value={org} placeholder="Organisation" onChange={(e) => setOrg(e.target.value)} onBlur={() => org !== a.job.organisation && save({ job: { organisation: org } })} className="!px-0 !text-slate-500" />
        </div>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "archive", icon: <Archive size={14} />, label: a.archived ? "Unarchive" : "Archive", onClick: () => save({ archived: !a.archived }) },
              { key: "delete", icon: <Trash2 size={14} />, label: "Delete", danger: true, onClick: onDelete },
            ],
          }}
        >
          <Button type="text" icon={<MoreHorizontal size={18} />} aria-label="More" />
        </Dropdown>
        <Button type="text" icon={<X size={18} />} aria-label="Close" onClick={onClose} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select
          value={a.status}
          onChange={(status) => save({ status })}
          variant="filled"
          popupMatchSelectWidth={false}
          options={STATUSES.map((s) => ({ value: s.id, label: <StatusChip status={s.id} /> }))}
          labelRender={() => <StatusChip status={a.status} />}
        />
        {a.archived ? <span className="text-xs text-slate-400">Archived</span> : null}
        {a.job.url ? (
          <a href={toHref(a.job.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
            Job post <ExternalLink size={13} />
          </a>
        ) : null}
      </div>

      {step ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3">
          <ArrowRight size={18} className="shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-brand-dark">Next step</p>
            <p className="font-semibold text-ink">{step.label}</p>
          </div>
          <Button type="primary" size="small" onClick={() => doStep(step)}>
            {step.key === "submitted" ? "Mark as applied" : step.key === "interviewPrep" ? <>Open prep <PlanTag feature="interviewPrep" /></> : step.auto ? "Do it" : "Done"}
          </Button>
        </div>
      ) : null}

      {offerNotInProfile ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1 text-sm text-slate-700"><b className="font-semibold text-ink">Got the job?</b> Add it to your Career Profile so your next resume starts with it.</p>
          <Button size="small" loading={adding} onClick={addToProfile}>Add to profile</Button>
        </div>
      ) : null}

      <button type="button" onClick={() => setAllSteps((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand">
        All steps ({steps.filter((s) => s.done).length}/{steps.length}) <ChevronDown size={13} className={allSteps ? "rotate-180" : ""} />
      </button>
      {allSteps ? (
        <ul className="mt-2 space-y-1.5">
          {steps.map((s) => (
            <li key={s.key}>
              <Tooltip title={s.auto ? "Ticks itself when it's done" : null}>
                <Checkbox checked={s.done} disabled={s.auto} onChange={(e) => tick(s.key, e.target.checked)}>
                  <span className={s.done ? "text-slate-400 line-through" : "text-slate-700"}>{s.label}</span>
                </Checkbox>
              </Tooltip>
            </li>
          ))}
        </ul>
      ) : null}

      <Section title="Resume">
        <div id="app-resume">
          {a.snapshot?.at ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
              <FileCheck2 size={18} className="shrink-0 text-emerald-600" />
              <p className="min-w-0 flex-1 text-sm text-slate-700">
                <b className="font-semibold">Resume sent:</b> {a.snapshot.nickname} · {fmt(a.snapshot.at)}
              </p>
              <Button size="small" onClick={() => setSentOpen(true)}>View exact copy</Button>
            </div>
          ) : null}
          <div className={`flex flex-wrap items-center gap-2 ${a.snapshot?.at ? "mt-3" : ""}`}>
            <Select
              className="min-w-56 flex-1"
              placeholder="Choose the resume for this job"
              loading={!resumes}
              value={a.resume || undefined}
              allowClear
              onChange={(v) => save({ resume: v || null })}
              options={(resumes || []).map((r) => ({ value: r._id, label: r.nickname }))}
            />
            {a.resume ? (
              <Link href={`/builder?id=${a.resume}`}><Button icon={<ExternalLink size={14} />}>Open</Button></Link>
            ) : profile && !a.job.description ? (
              <Button icon={<FilePlus2 size={14} />} loading={making} onClick={makeFromProfile}>From my profile</Button>
            ) : null}
          </div>
          {a.job.description && (profile || a.resume) ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button type={a.resume ? "default" : "primary"} icon={<Wand2 size={15} />} onClick={() => setTailoring(true)}>
                {a.resume ? "Tailor a version for this job" : "Tailor a resume for this job"}
              </Button>
              <span className="text-xs text-slate-400">Free, no AI credits</span>
            </div>
          ) : null}
          {a.snapshot?.at && a.resume ? (
            <button type="button" className="mt-2 text-xs text-slate-400 hover:text-brand" onClick={() => api(`/applications/${a._id}/snapshot`, { token, method: "POST" }).then((d) => setFull(d.data)).then(() => message.success("Sent copy replaced with the current version"))}>
              Sent a newer version? Replace the copy
            </button>
          ) : null}
        </div>
      </Section>

      {a.job.description ? (
        <Section title="Job match" action={match && !a.checklist?.match ? <Button size="small" type="link" className="!px-0" onClick={() => tick("match")}>Mark as reviewed</Button> : null}>
          {!a.resume ? (
            <p className="text-sm text-slate-500">Choose a resume to see how it matches this job.</p>
          ) : !match ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : (
            <ul className="space-y-2">
              {match.lines.map((l) => (
                <li key={l.text} className="flex gap-2 text-sm">
                  {l.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />}
                  <span className="text-slate-700">
                    {l.text}
                    {l.inProfile?.length ? <span className="block text-xs text-brand-dark">In your profile: {l.inProfile.join(", ")}. Add them if they fit.</span> : null}
                  </span>
                </li>
              ))}
              {match.score != null ? <li className="pt-1 text-xs text-slate-400">Keyword coverage {match.score}%. A guide, not a pass mark.</li> : null}
            </ul>
          )}
          {/* Only when tailoring would help: the profile has skills this resume leaves out. */}
          {match && match.score != null && match.score < 70 && match.inProfile?.length ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5">
              <Wand2 size={16} className="shrink-0 text-brand" />
              <p className="min-w-0 flex-1 text-sm text-slate-700">
                Your profile has {match.inProfile.slice(0, 3).join(", ")}. A tailored version puts {match.inProfile.length === 1 ? "it" : "them"} first.
              </p>
              <Button size="small" type="primary" onClick={() => setTailoring(true)}>Tailor</Button>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section title="Dates">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Deadline</span>
            <Input type="date" value={toDateInput(a.job.deadline)} onChange={(e) => save({ job: { deadline: e.target.value || null } })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Follow up on</span>
            <Input type="date" value={toDateInput(a.followUpAt)} onChange={(e) => save({ followUpAt: e.target.value || null })} />
          </label>
        </div>
        {a.appliedAt ? <p className="mt-2 text-xs text-slate-400">Applied {fmt(a.appliedAt)}</p> : null}
        {interviews.items.map((iv, i) => (
          <div key={iv.id} className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input type="datetime-local" value={iv.at ? new Date(new Date(iv.at).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ""} onChange={(e) => interviews.set(i, { at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            <Input placeholder="Interview (e.g. Technical)" defaultValue={iv.kind} onBlur={(e) => e.target.value !== iv.kind && interviews.set(i, { kind: e.target.value })} />
            <Button type="text" icon={<X size={14} />} aria-label="Remove interview" onClick={() => interviews.del(i)} />
          </div>
        ))}
        <div className="mt-2 flex flex-wrap items-center gap-x-4">
          <Button type="link" size="small" className="!px-0" icon={<Plus size={14} />} onClick={interviews.add}>Add an interview</Button>
          {a.status === "interviewing" || interviews.items.length ? (
            <Button type="link" size="small" className="!px-0" onClick={openPrep}>
              Prepare for it <PlanTag feature="interviewPrep" />
            </Button>
          ) : null}
        </div>
      </Section>

      <Section title="People">
        {contacts.items.map((c, i) => (
          <div key={c.id} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input placeholder="Name" defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && contacts.set(i, { name: e.target.value })} />
            <Input placeholder="Email or phone" defaultValue={c.email || c.phone} onBlur={(e) => (e.target.value.includes("@") ? contacts.set(i, { email: e.target.value, phone: "" }) : contacts.set(i, { phone: e.target.value, email: "" }))} />
            <Button type="text" icon={<X size={14} />} aria-label="Remove contact" onClick={() => contacts.del(i)} />
          </div>
        ))}
        <Button type="link" size="small" className="!px-0" icon={<Plus size={14} />} onClick={contacts.add}>Add a contact</Button>
      </Section>

      <Section
        title="Cover letter"
        action={AI_ENABLED ? (
          <CreditTooltip feature="coverLetter">
            <Button size="small" type="link" className="!px-0" icon={<Sparkles size={13} />} onClick={() => {
              if (!resume) return message.info("Choose a resume first: the letter is written from it.");
              if (billing && !billing.requireFeature("coverLetter", "The cover letter writer")) return;
              setCoverOpen(true);
            }}>
              Write with AI <Cost feature="coverLetter" /> <PlanTag feature="coverLetter" />
            </Button>
          </CreditTooltip>
        ) : null}
      >
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 10 }}
          placeholder="Paste or write the cover letter you sent (optional)"
          defaultValue={a.coverLetter?.text || ""}
          key={a.coverLetter?.at || "empty"}
          onBlur={(e) => e.target.value !== (a.coverLetter?.text || "") && save({ coverLetter: { text: e.target.value } })}
        />
      </Section>

      <Section title="Notes">
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 10 }} placeholder="Anything worth remembering" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (a.notes || "") && save({ notes })} />
      </Section>

      <Section title="Job description" action={a.job.description ? <button type="button" onClick={() => setShowJob((v) => !v)} className="text-xs font-medium text-brand">{showJob ? "Hide" : "Show"}</button> : null}>
        {showJob ? (
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 18 }} placeholder="Paste the job description: it powers the job match and the checklist" value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => description !== (a.job.description || "") && save({ job: { description } })} />
        ) : (
          <p className="line-clamp-3 text-sm text-slate-500">{a.job.description}</p>
        )}
      </Section>

      <InterviewPrep open={prepOpen} onClose={() => setPrepOpen(false)} app={a} profile={profile} resume={resume} token={token} prepared={!!a.checklist?.interviewPrep} onPrepared={() => tick("interviewPrep")} onAi={(prepAi) => setFull((f) => (f ? { ...f, prepAi } : f))} />
      <TailorModal open={tailoring} onClose={() => setTailoring(false)} apps={[a]} token={token} />
      <SentCopy open={sentOpen} onClose={() => setSentOpen(false)} snapshot={a.snapshot} />
      {coverOpen && resume ? (
        <CoverLetterModal
          open
          onClose={() => setCoverOpen(false)}
          resume={resume}
          token={token}
          initialJob={a.job.description || [a.job.title, a.job.organisation].filter(Boolean).join(" at ")}
          onSave={(text) => {
            save({ coverLetter: { text } }, { coverLetter: { text, at: new Date().toISOString() } });
            setCoverOpen(false);
            message.success("Saved to this application");
          }}
        />
      ) : null}
    </div>
  );
}

/** The resume exactly as it was sent, frozen when the application was marked applied. */
function SentCopy({ open, onClose, snapshot }) {
  const resume = useMemo(() => (snapshot?.content ? normalizeResume({ ...snapshot.content, nickname: snapshot.nickname, template: snapshot.template, theme: snapshot.theme }) : null), [snapshot]);
  return (
    <Modal open={open && !!resume} onCancel={onClose} footer={null} width={760} centered destroyOnHidden title={resume ? `Sent ${fmt(snapshot.at)} · ${snapshot.nickname}` : null}>
      {resume ? (
        <>
          <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-slate-100 p-3">
            <PdfPreview resume={resume} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="primary" icon={<Download size={15} />} onClick={() => downloadPdf(resume)}>Download this copy</Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
