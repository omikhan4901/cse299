"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Modal, Skeleton } from "antd";
import { AlertTriangle, ArrowRight, Crown, EyeOff, FileDown, FilePlus2, FolderOpen, History, LayoutTemplate, UserPlus, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { getBuilderSession } from "@/lib/builderSession";
import { useAuth } from "./AuthProvider";
import { useBilling } from "./BillingProvider";
import { resumeFromProfile } from "@/lib/profile";
import { readDraft, isWorthKeeping, draftLabel, clearDraft, saveToFile } from "./builder/drafts";

const LauncherContext = createContext({ openBuilder: () => {} });
export const useBuilderLauncher = () => useContext(LauncherContext);

/** Something that would be lost by starting a new resume, or null. */
function findRisk() {
  const session = getBuilderSession();
  if (session?.atRisk) return { kind: session.private ? "private" : "unsaved", label: session.label, resume: session.resume };
  const draft = readDraft();
  if (isWorthKeeping(draft)) return { kind: "draft", label: draftLabel(draft), resume: draft };
  return null;
}

/**
 * "Open builder" asks what to work on: the master resume, the one edited last, or a
 * new one. When starting new would lose unsaved work, it says so plainly first.
 */
export function BuilderLauncherProvider({ children }) {
  const router = useRouter();
  const { token, isAuthenticated, openAuth } = useAuth();
  const billing = useBilling();
  const v2 = !!billing?.v2;
  const canProfile = !!billing?.canUse?.("profile");
  // { risk, resumes } — resumes is null while loading
  const [dialog, setDialog] = useState(null);

  const openBuilder = useCallback(() => {
    const risk = findRisk();
    // A visitor with nothing started has nothing to choose between.
    if (!isAuthenticated && !risk) {
      router.push("/builder");
      return;
    }
    setDialog({ risk, resumes: isAuthenticated ? null : [] });
    if (isAuthenticated && token) {
      api("/resumes", { token })
        .then(({ data }) => setDialog((d) => d && { ...d, resumes: data }))
        .catch(() => setDialog((d) => d && { ...d, resumes: [] }));
      // V2: the Career Profile takes the master resume's place here.
      if (v2 && canProfile) {
        api("/profile", { token, quiet: true })
          .then(({ data }) => setDialog((d) => d && { ...d, profile: data }))
          .catch(() => {});
      }
    }
  }, [isAuthenticated, token, router, v2, canProfile]);

  const value = useMemo(() => ({ openBuilder }), [openBuilder]);
  const close = () => setDialog(null);
  const go = (href) => {
    setDialog(null);
    router.push(href);
  };

  const risk = dialog?.risk;
  const resumes = dialog?.resumes;
  const master = v2 ? null : resumes?.find((r) => r.isMaster);
  const profile = dialog?.profile;
  const [making, setMaking] = useState(false);
  const fromProfile = async () => {
    setMaking(true);
    try {
      const first = profile.personal?.name?.trim().split(/\s+/)[0];
      const { data } = await api("/resumes", { token, method: "POST", body: { ...resumeFromProfile(profile), nickname: first ? `${first}'s resume` : "My resume" } });
      go(`/builder?id=${data._id}`);
    } catch {
      go("/career");
    } finally {
      setMaking(false);
    }
  };
  const latest = resumes?.find((r) => r._id !== master?._id);
  const startNew = () => {
    if (risk?.kind === "draft") clearDraft();
    go("/builder?new=1");
  };

  return (
    <LauncherContext.Provider value={value}>
      {children}
      <Modal open={!!dialog} onCancel={close} footer={null} title="What would you like to work on?" width={520} destroyOnHidden>
        {risk ? <RiskNotice risk={risk} isAuthenticated={isAuthenticated} go={go} close={close} openAuth={openAuth} /> : null}

        <div className="mt-4 space-y-2">
          {isAuthenticated && !resumes ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : (
            <>
              {profile ? (
                <Choice icon={<UserRound size={18} />} tone="brand" title={making ? "Making your resume…" : "New resume from my profile"} detail="Everything from your Career Profile, ready to trim for the job." onClick={making ? undefined : fromProfile} />
              ) : null}
              {master ? (
                <Choice icon={<Crown size={18} />} tone="amber" title="Work on my master resume" detail={`${master.nickname} · edited ${timeAgo(master.updatedAt)}`} onClick={() => go(`/builder?id=${master._id}`)} />
              ) : null}
              {latest ? (
                <Choice icon={<History size={18} />} tone="brand" title={`Continue “${latest.nickname}”`} detail={`Your last edited resume · ${timeAgo(latest.updatedAt)}`} onClick={() => go(`/builder?id=${latest._id}`)} />
              ) : null}
            </>
          )}
          <Choice
            icon={<FilePlus2 size={18} />}
            tone={risk ? "red" : "slate"}
            title={risk ? "Start a new resume anyway" : "Start a new resume"}
            detail={
              risk
                ? risk.kind === "unsaved"
                  ? `Your unsaved changes to “${risk.label}” will be lost.`
                  : `${cap(risk.label)} will be deleted. This can't be undone.`
                : "Begin with an example you can edit, or clear it and start blank."
            }
            onClick={startNew}
          />
          {!resumes?.length && !risk ? (
            <Choice icon={<LayoutTemplate size={18} />} tone="slate" title="Pick a template first" detail="Browse 50+ designs, then start with the one you like." onClick={() => go("/templates")} />
          ) : null}
        </div>

        {resumes?.length > 1 ? (
          <Link href="/dashboard" onClick={close} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <FolderOpen size={15} /> All my resumes ({resumes.length})
          </Link>
        ) : null}
      </Modal>
    </LauncherContext.Provider>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function RiskNotice({ risk, isAuthenticated, go, close, openAuth }) {
  const text = {
    private: {
      icon: <EyeOff size={18} />,
      title: "Your private session isn't saved anywhere",
      body: "If you start something else without downloading it, you'll lose it for good.",
    },
    unsaved: {
      icon: <AlertTriangle size={18} />,
      title: `Your latest changes to “${risk.label}” haven't saved yet`,
      body: "You may be offline or signed out. If you leave the builder now, you'll lose them.",
    },
    draft: {
      icon: <AlertTriangle size={18} />,
      title: isAuthenticated ? `${cap(risk.label)} isn't saved to your account` : `${cap(risk.label)} is only stored in this browser`,
      body: isAuthenticated
        ? "Open it and it saves to My resumes automatically. If you start a new one without saving it, you'll lose it."
        : "Starting a new resume replaces it. If you don't save it first, you'll lose it.",
    },
  }[risk.kind];

  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-start gap-2 font-semibold text-amber-900">
        <span className="mt-0.5 shrink-0 text-amber-600">{text.icon}</span>
        {text.title}
      </p>
      <p className="mt-1 pl-7 text-sm text-amber-900/80">{text.body}</p>
      <div className="mt-3 flex flex-wrap gap-2 pl-7">
        {risk.kind === "draft" ? (
          <Button type="primary" size="small" icon={<ArrowRight size={14} />} iconPlacement="end" onClick={() => go("/builder")}>
            {isAuthenticated ? "Open and save it" : "Continue it"}
          </Button>
        ) : (
          <Button type="primary" size="small" onClick={close}>Keep working on it</Button>
        )}
        {risk.kind !== "unsaved" ? (
          <Button size="small" icon={<FileDown size={14} />} onClick={() => saveToFile(risk.resume)}>Save it to a file</Button>
        ) : null}
        {risk.kind === "draft" && !isAuthenticated ? (
          <Button size="small" icon={<UserPlus size={14} />} onClick={() => { close(); openAuth("register", "/builder"); }}>Sign up to keep it</Button>
        ) : null}
      </div>
    </div>
  );
}

const TONES = {
  amber: "bg-amber-100 text-amber-700",
  brand: "bg-brand-50 text-brand",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
};

function Choice({ icon, tone, title, detail, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${tone === "red" ? "border-red-200 hover:border-red-300 hover:bg-red-50/40" : "border-slate-200 hover:border-brand/40 hover:bg-slate-50"}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${tone === "red" ? "text-red-700" : "text-ink"}`}>{title}</span>
        <span className={`block text-sm ${tone === "red" ? "text-red-600/80" : "text-slate-500"}`}>{detail}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
    </button>
  );
}

/**
 * A link to the builder that asks what to work on first (plain navigation for
 * new-tab clicks, and for crawlers).
 */
export function BuilderLink({ children, onClick, ...props }) {
  const { openBuilder } = useBuilderLauncher();
  return (
    <Link
      href="/builder"
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        openBuilder();
      }}
    >
      {children}
    </Link>
  );
}
