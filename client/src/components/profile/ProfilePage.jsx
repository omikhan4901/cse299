"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Result, Skeleton } from "antd";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CircleUserRound, CloudOff, FilePlus2, Loader2, Sparkles, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { normalizeResume } from "@/lib/resume";
import { profileFromResume, profileHealth, resumeFromProfile } from "@/lib/profile";
import { applyOperations } from "@/lib/ingest/ops";
import { AI_ENABLED } from "@/lib/config";
import AddAnything from "../review/AddAnything";
import PlanTag from "../billing/PlanTag";
import { useAuth } from "../AuthProvider";
import { useBilling } from "../BillingProvider";
import ContentPanel from "../builder/ContentPanel";
import { useResumeEditor } from "../builder/useResumeEditor";
import { useProfile } from "./useProfile";
import { timeAgo } from "@/lib/time";

/** /career: the Career Profile (V2). Everything true about the person; every resume starts here. */
export default function ProfilePage() {
  const { token, user, loading: authLoading, openAuth } = useAuth();
  const billing = useBilling();
  const store = useProfile(token, { enabled: !!billing?.v2 });

  if (!authLoading && !token) {
    return (
      <Result
        icon={<CircleUserRound size={48} className="mx-auto text-brand" />}
        title="Log in to see your Career Profile"
        extra={<Button type="primary" onClick={() => openAuth("login", "/career")}>Log in</Button>}
      />
    );
  }
  if (user && billing?.config && !billing.v2) {
    return <Result status="404" title="Not available yet" subTitle="This part of ResumeX isn't open yet." extra={<Link href="/dashboard"><Button>My resumes</Button></Link>} />;
  }
  if (store.error) {
    return <Result status="warning" title="We couldn't load your profile" subTitle={store.error.message} extra={<Button onClick={store.load}>Try again</Button>} />;
  }
  if (store.profile === undefined) {
    return (
      <div className="container-x py-10">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Skeleton.Node active className="!h-96 !w-full lg:col-span-2" />
          <Skeleton.Node active className="!h-64 !w-full" />
        </div>
      </div>
    );
  }
  if (store.profile === null) return <StartProfile token={token} store={store} />;
  return <Editor token={token} store={store} />;
}

// ---- First visit ----

function StartProfile({ token, store }) {
  const { message } = App.useApp();
  const [resumes, setResumes] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    api("/resumes", { token })
      .then((d) => setResumes(d.data))
      .catch(() => setResumes([]));
  }, [token]);
  const source = resumes?.find((r) => r.isMaster) || resumes?.[0];

  const create = async (from) => {
    setBusy(from ? "from" : "blank");
    try {
      let content = profileFromResume({});
      if (from) {
        const { data } = await api(`/resumes/${from._id}`, { token });
        content = profileFromResume(data);
      }
      const data = await store.save(content, from ? { createdFrom: from._id } : {});
      store.setProfile(data);
      message.success(from ? `Profile made from “${from.nickname}”` : "Profile created");
    } catch (err) {
      if (err.code === "conflict") return store.load();
      message.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container-x flex flex-1 items-center justify-center py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-600 text-white shadow-lg shadow-brand/25">
          <UserRound size={22} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">Your Career Profile</h1>
        <p className="mt-2 text-slate-600">Everything true about your career, in one place. Every resume you make starts here, so you only type things once.</p>
        <div className="mt-7 space-y-3">
          {resumes === null ? (
            <Skeleton.Button active block className="!h-16" />
          ) : source ? (
            <Choice
              primary
              title={`Start from “${source.nickname}”`}
              detail={`Copies its content. The resume itself stays as it is. Edited ${timeAgo(source.updatedAt)}.`}
              loading={busy === "from"}
              onClick={() => create(source)}
            />
          ) : null}
          <Choice title="Start from scratch" detail="An empty profile to fill in." loading={busy === "blank"} onClick={() => create(null)} />
        </div>
      </motion.div>
    </div>
  );
}

function Choice({ title, detail, onClick, loading, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${primary ? "border-brand-200 bg-brand-50/50 hover:border-brand" : "border-slate-200 hover:border-slate-300"}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-slate-500">{detail}</span>
      </span>
      {loading ? <Loader2 size={18} className="animate-spin text-brand" /> : <ArrowRight size={18} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand" />}
    </button>
  );
}

// ---- Editing ----

const SAVE_DELAY = 1200;

function Editor({ token, store }) {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const editor = useResumeEditor(() => normalizeResume(store.profile));
  const { resume: profile, setResume } = editor;
  const [status, setStatus] = useState("saved"); // saved | pending | saving | error
  const summaries = useRef(store.profile.summaries || []);
  const baseline = useRef(profile);
  const saving = useRef(false);
  const latest = useRef(profile);
  const [making, setMaking] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    latest.current = profile;
  });

  const saveNow = useCallback(async () => {
    if (saving.current) return;
    const snapshot = latest.current;
    if (snapshot === baseline.current) return;
    saving.current = true;
    setStatus("saving");
    try {
      await store.save({ ...snapshot, summaries: summaries.current });
      baseline.current = snapshot;
      // Typed while this was saving: that goes out next.
      setStatus(latest.current === snapshot ? "saved" : "pending");
    } catch (err) {
      if (err.code === "conflict") {
        setStatus("error");
        modal.confirm({
          title: "Your profile changed in another tab",
          content: "Someone (probably you, somewhere else) saved a newer version. Which one do you want to keep?",
          okText: "Load the newer version",
          cancelText: "Keep this one",
          onOk: () => {
            const latest = normalizeResume(err.data);
            store.adoptRev(err.data?.rev);
            summaries.current = err.data?.summaries || [];
            baseline.current = latest;
            setResume(latest);
            setStatus("saved");
          },
          onCancel: () => {
            store.adoptRev(err.data?.rev);
            setStatus("pending");
          },
        });
      } else {
        setStatus("error");
        message.error(err.message);
      }
    } finally {
      saving.current = false;
    }
  }, [store, modal, message, setResume]);

  // A save that finished with newer edits waiting sends them straight after.
  useEffect(() => {
    if (status !== "pending" || saving.current || latest.current === baseline.current) return undefined;
    const t = setTimeout(saveNow, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [status, saveNow]);

  // Autosave a moment after typing stops.
  useEffect(() => {
    if (profile === baseline.current) return undefined;
    setStatus((s) => (s === "saving" ? s : "pending"));
    const t = setTimeout(saveNow, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [profile, saveNow]);

  // Back in this tab: pick up a newer copy saved elsewhere (only when nothing is unsaved here).
  useEffect(() => {
    const onFocus = async () => {
      if (document.visibilityState !== "visible" || saving.current || profile !== baseline.current) return;
      const known = store.rev.current;
      try {
        const { data } = await api("/profile", { token });
        if (data && data.rev > known && profile === baseline.current) {
          const latest = normalizeResume(data);
          store.adoptRev(data.rev);
          summaries.current = data.summaries || [];
          baseline.current = latest;
          setResume(latest);
        }
      } catch {
        // Offline for a moment: the next focus tries again.
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [profile, store, token, setResume]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const warn = (e) => {
      if (status === "pending" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const health = useMemo(() => profileHealth(profile), [profile]);

  const makeResume = async () => {
    setMaking(true);
    try {
      const first = profile.personal.name.trim().split(/\s+/)[0];
      const { data } = await api("/resumes", { token, method: "POST", body: { ...resumeFromProfile(profile), nickname: first ? `${first}'s resume` : "My resume" } });
      router.push(`/builder?id=${data._id}`);
    } catch (err) {
      message.error(err.message);
      setMaking(false);
    }
  };

  return (
    <div className="container-x py-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Career Profile</h1>
          <p className="mt-1 text-slate-500">Everything true about your career. Resumes pick what each job needs.</p>
        </div>
        <div className="flex items-center gap-4">
          <SaveStatus status={status} onRetry={saveNow} />
          {AI_ENABLED ? (
            <Button icon={<Sparkles size={15} />} onClick={() => setAdding(true)}>
              Add anything <PlanTag feature="parse" />
            </Button>
          ) : null}
        </div>
      </div>
      <AddAnything open={adding} onClose={() => setAdding(false)} target={profile} token={token} where="your profile" onApply={(ops) => setResume((p) => applyOperations(p, ops))} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ContentPanel editor={editor} />
        <aside className="order-first space-y-4 lg:sticky lg:top-24 lg:order-none">
          <HealthCard health={health} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="font-semibold text-ink">Make a resume</p>
            <p className="mt-1 text-sm text-slate-500">A new resume with everything from your profile. Trim it for the job in the builder.</p>
            <Button type="primary" block className="!mt-4" icon={<FilePlus2 size={16} />} loading={making} onClick={makeResume}>
              New resume from profile
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SaveStatus({ status, onRetry }) {
  const content = {
    saved: [<Check key="i" size={14} />, "Saved", "text-slate-400"],
    pending: [<span key="i" className="h-1.5 w-1.5 rounded-full bg-amber-400" />, "Unsaved changes", "text-slate-500"],
    saving: [<Loader2 key="i" size={14} className="animate-spin" />, "Saving…", "text-slate-500"],
    error: [<CloudOff key="i" size={14} />, "Not saved", "text-red-500"],
  }[status];
  return (
    <AnimatePresence mode="wait">
      <motion.span key={status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`inline-flex items-center gap-1.5 text-sm ${content[2]}`}>
        {content[0]} {content[1]}
        {status === "error" ? <button type="button" onClick={onRetry} className="ml-1 font-medium text-brand hover:underline">Retry</button> : null}
      </motion.span>
    </AnimatePresence>
  );
}

function HealthCard({ health }) {
  const [all, setAll] = useState(false);
  const shown = all ? health.todo : health.todo.slice(0, 3);
  const tone = health.score >= 80 ? "text-emerald-500" : health.score >= 50 ? "text-brand" : "text-amber-500";
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100" />
          <motion.circle
            cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className={tone}
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: c * (1 - health.score / 100) }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div>
          <p className="font-display text-2xl font-bold text-ink">{health.score}%</p>
          <p className="text-sm text-slate-500">Profile strength</p>
        </div>
      </div>
      {shown.length ? (
        <ul className="mt-4 space-y-2">
          {shown.map((t) => (
            <li key={t.id} className="flex gap-2 text-sm">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-brand" />
              <span className="min-w-0">
                <span className="block text-slate-700">{t.label}</span>
                {t.detail ? <span className="line-clamp-2 block text-xs text-slate-400">{t.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Looking complete. Keep it current as things change.</p>
      )}
      {health.todo.length > 3 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-xs font-medium text-brand hover:underline">
          {all ? "Show less" : `See all ${health.todo.length}`}
        </button>
      ) : null}
    </div>
  );
}
