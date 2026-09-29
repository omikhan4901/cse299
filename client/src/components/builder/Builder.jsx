"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Dropdown, Segmented, Tooltip, App, Input, Modal, Result, Spin } from "antd";
import { AnimatePresence } from "motion/react";
import {
  Download, Share2, Save, MoreHorizontal, Sparkles, MessageSquare, ScanSearch, Mail, Upload, Crown, Eraser,
  ZoomIn, ZoomOut, Palette, PenLine, Check, CloudOff, Loader2, Lock, ArrowLeft, BookOpen, Compass, EyeOff, FileDown, FolderOpen, FileWarning, LogIn, UserRound, Wand2,
} from "lucide-react";
import { api } from "@/lib/api";
import { setBuilderSession } from "@/lib/builderSession";
import { AI_ENABLED } from "@/lib/config";
import { normalizeResume, sampleResume, blankResume, toPayload, withContentOf, splitBullets } from "@/lib/resume";
import { templateById, TEMPLATES } from "@/pdf/registry";
import { downloadPdf } from "@/pdf/client";
import { useAuth } from "../AuthProvider";
import { useResumeEditor } from "./useResumeEditor";
import ContentPanel from "./ContentPanel";
import DesignPanel from "./DesignPanel";
import PdfPreview from "./PdfPreview";
import { StartPrivateModal, LeavePrivateModal, PrivateBanner } from "./PrivateSession";
import { readDraft, writeDraft, clearDraft, isWorthKeeping, isUntouchedSample, hasRealContent, defaultNickname, draftLabel, saveToFile } from "./drafts";
import ShareModal from "./ShareModal";
import { ChatModal, CoverLetterModal, aiResume } from "./AiModals";
import AtsModal from "./AtsModal";
import TemplateGallery from "./TemplateGallery";
import BuilderTour from "./BuilderTour";
import { CreditMeter, CreditTooltip } from "../Credits";
import { useBilling } from "../BillingProvider";
import PlanTag from "../billing/PlanTag";
import ResumeGuideModal from "./ResumeGuideModal";
import { AI_LOCKED_MESSAGE } from "./ai";
import ActionDock from "./ActionDock";
import { celebrate } from "../celebrate";
import { useProfileSync } from "../profile/useProfileSync";
import AddAnything from "../review/AddAnything";
import ReviewChanges from "../review/ReviewChanges";
import { RewriteModal, StrengthenModal } from "./RewriteReview";
import { applyOperations } from "@/lib/ingest/ops";

/** Loads the resume to edit (saved, new or local draft) and then mounts the editor. */
export default function Builder() {
  const params = useSearchParams();
  const router = useRouter();
  const { token, loading: authLoading, openAuth } = useAuth();
  const id = params.get("id");
  const isNew = params.get("new");
  const template = params.get("template");
  const priv = params.get("private");
  const [state, setState] = useState({ status: "loading" });
  // Set when the person has decided what to do with an unsaved draft before starting a new resume.
  const [newConfirmed, setNewConfirmed] = useState(false);
  const openId = useRef(null);
  const markSaved = useCallback((newId) => {
    openId.current = newId;
  }, []);

  useEffect(() => {
    if (id && openId.current === id) return; // the editor just saved this resume and updated the URL
    // ?template=X (from the templates page) applies a design to the new resume or current draft.
    /* eslint-disable react-hooks/set-state-in-effect -- the editor's content follows the URL */
    const withTemplate = (r) => (template && TEMPLATES.some((t) => t.id === template) ? { ...r, template } : r);
    if (priv) {
      // Private session: starts empty and stores nothing. A draft already in this browser is left alone.
      if (state.status === "ready" && state.private) return; // e.g. logging in mid-session must not wipe it
      openId.current = null;
      setState({ status: "ready", resume: withTemplate(normalizeResume(blankResume())), key: `private-${Date.now()}`, private: true });
      return;
    }
    if (isNew || template) {
      const draft = readDraft();
      // Never replace unsaved work without asking.
      if (isNew && !newConfirmed && isWorthKeeping(draft)) {
        setState({ status: "confirm-new", draft });
        return;
      }
      const keep = isNew ? null : draft;
      if (isNew) clearDraft();
      const fresh = keep || normalizeResume(isNew === "blank" ? blankResume() : sampleResume());
      openId.current = null;
      setState({ status: "ready", resume: withTemplate(fresh), key: `new-${Date.now()}`, example: !keep && isNew !== "blank" });
      setNewConfirmed(false);
      router.replace("/builder");
      return;
    }
    if (!id) {
      if (state.status === "ready" && !state.resume?._id) return;
      const draft = readDraft();
      setState({ status: "ready", resume: draft || normalizeResume(sampleResume()), key: "draft", example: !draft || isUntouchedSample(draft) });
      return;
    }
    if (authLoading) return;
    if (!token) {
      setState({ status: "login" });
      return;
    }
    setState({ status: "loading" });
    api(`/resumes/${id}`, { token })
      .then(({ data }) => {
        openId.current = id;
        setState({ status: "ready", resume: normalizeResume(data), key: id });
      })
      .catch((err) => setState({ status: "error", error: err.message }));
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, template, token, authLoading, priv, newConfirmed]);

  if (state.status === "confirm-new") {
    return (
      <Result
        icon={<FileWarning size={48} className="mx-auto text-amber-500" />}
        title="You have an unsaved resume in this browser"
        subTitle={
          token
            ? `${draftLabel(state.draft)} isn't in your account yet. Open it and it will be saved to My resumes automatically, or start a new one and discard it.`
            : `${draftLabel(state.draft)} is only stored in this browser. Starting a new resume will replace it.`
        }
        extra={[
          <Button key="keep" type="primary" onClick={() => router.replace("/builder")}>{token ? "Open and save it" : "Keep editing it"}</Button>,
          <Button key="file" icon={<FileDown size={15} />} onClick={() => saveToFile(state.draft)}>Save it to a file</Button>,
          <Button key="new" danger onClick={() => setNewConfirmed(true)}>Discard it and start new</Button>,
        ]}
      />
    );
  }
  if (state.status === "login") {
    return (
      <Result
        icon={<Lock size={48} className="mx-auto text-brand" />}
        title="Log in to open this resume"
        subTitle="This resume is saved to an account."
        extra={<Button type="primary" onClick={() => openAuth("login", `/builder?id=${id}`)}>Log in</Button>}
      />
    );
  }
  if (state.status === "error") {
    return (
      <Result
        status="warning"
        title="We couldn't open that resume"
        subTitle={state.error}
        extra={[
          <Link key="d" href="/dashboard"><Button type="primary">My resumes</Button></Link>,
          <Link key="n" href="/builder?new=1"><Button>Start a new one</Button></Link>,
        ]}
      />
    );
  }
  if (state.status !== "ready") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-slate-500">
        <Spin size="large" />
        <p className="text-sm">Loading your resume… the first load can take a moment while the server wakes up.</p>
      </div>
    );
  }
  return <Editor key={state.key} initial={state.resume} example={state.example} onSaved={markSaved} startPrivate={!!state.private} />;
}

function Editor({ initial, example, onSaved, startPrivate = false }) {
  const { token, isAuthenticated, openAuth } = useAuth();
  const { message, modal } = App.useApp();
  const editor = useResumeEditor(initial);
  const { resume, setResume } = editor;

  const [tab, setTab] = useState("content");
  const [mobileView, setMobileView] = useState("edit");
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState(1);
  const [showExample, setShowExample] = useState(!!example);
  const [downloading, setDownloading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiModal, setAiModal] = useState(null);
  // AI rewrite waiting for approval, a point being strengthened, AI polish proposals to review.
  const [rewrite, setRewrite] = useState(null);
  const [strengthen, setStrengthen] = useState(null);
  const [polishReview, setPolishReview] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  // Private session: no autosave, no browser draft, no sharing. Only for resumes that aren't saved to an account.
  const [privateMode, setPrivateMode] = useState(startPrivate);
  // { type: "start", hasStoredDraft } or { type: "leave", replaces, other }
  const [privateDialog, setPrivateDialog] = useState(null);

  // The builder fills the window and its panels scroll on their own, so the page itself never needs to.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, []);
  // /builder?check=ats (from the ATS checker page) opens the ATS check straight away.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("check") !== "ats") return;
    url.searchParams.delete("check");
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAiModal("audit");
  }, []);
  const [refiningId, setRefiningId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // The account session ended (e.g. it expired): saving waits until the person logs in again.
  const [sessionExpired, setSessionExpired] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const creating = useRef(false);
  // The saved revision this editor started from. Saves send it, so an edit made in another
  // tab or device in the meantime is never overwritten without asking (see the dialog below).
  const revRef = useRef(initial.rev ?? 0);
  // The server's newer copy, when a save found one.
  const [conflict, setConflict] = useState(null);
  // One save at a time: a second save sent while the first is on its way would carry the
  // same revision and be refused as if another tab had saved (edits made meanwhile are
  // saved as soon as the first one finishes).
  const inFlight = useRef(false);
  // A save whose answer never came (timeout, dropped connection): it may have been saved.
  const unconfirmed = useRef(null);

  const payloadJson = useMemo(() => JSON.stringify(toPayload(resume)), [resume]);
  const [initialJson] = useState(payloadJson);
  const edited = payloadJson !== initialJson;
  const [savedJson, setSavedJson] = useState(resume._id ? payloadJson : null);
  const dirty = !!resume._id && savedJson !== payloadJson;

  // The account was suspended while this page was open: saving can't work, so stop retrying.
  const [suspended, setSuspended] = useState(false);
  const onSaveFailed = useCallback(
    (err) => {
      setSaveError(err.message);
      if (err.status === 401) setSessionExpired(true);
      if (err.code === "banned") {
        setSuspended(true);
        message.error(err.message, 10);
      }
    },
    [message]
  );
  const onSaveSucceeded = useCallback(() => {
    setSaveError(null);
    setSessionExpired(false);
  }, []);

  // Resumes that aren't in an account live in this browser so nothing is lost on refresh.
  // (The untouched example isn't stored, and private sessions store nothing.)
  useEffect(() => {
    if (resume._id || privateMode || (showExample && !edited)) return;
    const t = setTimeout(() => writeDraft(resume), 400);
    return () => clearTimeout(t);
  }, [resume, privateMode, showExample, edited]);

  const saveNow = useCallback(async () => {
    if (!resume._id || !token || conflict || inFlight.current) return;
    const body = payloadJson;
    inFlight.current = true;
    setSaving(true);
    try {
      const { data } = await api(`/resumes/${resume._id}`, { token, method: "PUT", body: { ...JSON.parse(body), baseRev: revRef.current } });
      revRef.current = data.rev ?? revRef.current + 1;
      unconfirmed.current = null;
      setSavedJson(body);
      onSaveSucceeded();
    } catch (err) {
      if (err.code === "conflict" && err.data) {
        // Not a real conflict if the "other version" is this tab's own save, e.g. one whose
        // answer was lost: take its revision and carry on without asking.
        const theirs = JSON.stringify(toPayload(normalizeResume(err.data)));
        if (theirs === body || theirs === unconfirmed.current) {
          revRef.current = err.data.rev ?? revRef.current;
          unconfirmed.current = null;
          if (theirs === body) setSavedJson(body);
          else setRetryTick((n) => n + 1); // save the newer edits on top
          setSaveError(null);
        } else {
          setConflict(err.data);
          setSaveError(null);
        }
      }
      // The plan doesn't include the chosen template (e.g. the rules changed): go back to the
      // saved design, which the upgrade dialog explains, instead of retrying forever.
      else if (err.code === "upgrade") {
        const savedTemplate = savedJson ? JSON.parse(savedJson).template : "Classic";
        setResume((r) => ({ ...r, template: savedTemplate || "Classic" }));
      } else {
        if (!err.status) unconfirmed.current = body; // no answer: it may have reached the server
        onSaveFailed(err);
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [resume._id, token, conflict, payloadJson, savedJson, setResume, onSaveFailed, onSaveSucceeded]);

  /** Replaces what's in the editor with a copy from the server (it counts as saved). */
  const takeServerCopy = useCallback(
    (data) => {
      const next = normalizeResume(data);
      revRef.current = data.rev ?? 0;
      setSavedJson(JSON.stringify(toPayload(next)));
      setResume(next);
    },
    [setResume]
  );

  // Back to this tab after working elsewhere: if the resume was saved since and nothing here is
  // unsaved, switch to the newer copy now, so this tab can't later save old content over it.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty || saving || !!conflict;
  }, [dirty, saving, conflict]);
  useEffect(() => {
    if (!resume._id || !token) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible" || dirtyRef.current) return;
      busy = true;
      try {
        const { data } = await api(`/resumes/${resume._id}`, { token });
        // Still nothing typed while it loaded?
        if ((data.rev ?? 0) > revRef.current && !dirtyRef.current) {
          takeServerCopy(data);
          message.info("Updated with changes saved in another tab.");
        }
      } catch {
        // Offline or signed out: the next save reports it.
      } finally {
        busy = false;
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [resume._id, token, takeServerCopy, message]);

  /** Adds this resume to the account. Edits made while the request is in flight are kept and saved next. */
  const createResume = useCallback(
    async ({ nickname, isMaster = false }, { auto = false } = {}) => {
      if (creating.current || !token) return;
      creating.current = true;
      const snapshot = resume;
      setSaving(true);
      try {
        const { data } = await api("/resumes", { token, method: "POST", body: { ...toPayload(snapshot), nickname, isMaster } });
        const ids = { _id: data._id, shortId: data.shortId, nickname, isMaster, isPublic: data.isPublic };
        revRef.current = data.rev ?? 0;
        setSavedJson(JSON.stringify(toPayload({ ...snapshot, ...ids })));
        setResume((r) => ({ ...r, ...ids }));
        clearDraft();
        onSaved(data._id);
        window.history.replaceState(null, "", `/builder?id=${data._id}`);
        onSaveSucceeded();
        message.success(auto ? "Saved to My resumes. Every change now saves automatically." : "Saved to My resumes.");
      } catch (err) {
        if (err.code === "upgrade") setResume((r) => ({ ...r, template: "Classic" })); // saved on the next try
        else {
          onSaveFailed(err);
          if (!auto) message.error(err.message);
        }
      } finally {
        creating.current = false;
        setSaving(false);
      }
    },
    [resume, token, setResume, onSaved, message, onSaveFailed, onSaveSucceeded]
  );

  // Saved resumes autosave shortly after you stop typing.
  useEffect(() => {
    if (!dirty || !token || sessionExpired || suspended || conflict || saving) return;
    const t = setTimeout(saveNow, 1500);
    return () => clearTimeout(t);
  }, [dirty, token, saveNow, sessionExpired, suspended, conflict, saving, retryTick]);

  // Signed in: a new resume goes into the account as soon as it has content, so it can't get lost.
  const wantsAccountCopy = isAuthenticated && !!token && !resume._id && !privateMode && !sessionExpired && !suspended && hasRealContent(resume) && (!showExample || edited);
  useEffect(() => {
    if (!wantsAccountCopy) return;
    const t = setTimeout(() => createResume({ nickname: defaultNickname(resume) }, { auto: true }), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed by content changes and retries
  }, [wantsAccountCopy, payloadJson, retryTick]);

  // A failed save really does retry (until the session has expired, which needs a new login).
  useEffect(() => {
    if (!saveError || sessionExpired || suspended) return;
    const t = setTimeout(() => setRetryTick((n) => n + 1), 8000);
    return () => clearTimeout(t);
  }, [saveError, sessionExpired, suspended, retryTick]);

  // Tells the "Open builder" dialog what's open here, so it can warn before unsaved work is lost.
  useEffect(() => {
    setBuilderSession({
      id: resume._id || null,
      label: resume._id ? resume.nickname || "this resume" : draftLabel(resume),
      private: privateMode,
      atRisk: privateMode ? isWorthKeeping(resume) : !!resume._id && (dirty || !!conflict || suspended || sessionExpired),
      resume,
    });
    return () => setBuilderSession(null);
  }, [resume, privateMode, dirty, conflict, suspended, sessionExpired]);

  const needsLogin = sessionExpired || (!!resume._id && !token);
  const logInAgain = () => openAuth("login", `${window.location.pathname}${window.location.search}`);

  useEffect(() => {
    const warn = (e) => {
      if (dirty || privateMode) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, privateMode]);

  const startPrivateSession = () => setPrivateDialog({ type: "start", hasStoredDraft: !resume._id && isWorthKeeping(readDraft()) });
  const confirmStartPrivate = ({ deleteDraft }) => {
    if (deleteDraft) clearDraft();
    setPrivateMode(true);
    setPrivateDialog(null);
    message.success(deleteDraft ? "Private session on, and the copy in this browser is deleted." : "Private session on. Nothing is being saved.");
  };
  const endPrivateSession = () => {
    const other = readDraft();
    // Warn only when a *different* resume would be overwritten in this browser.
    const replaces = isWorthKeeping(other) && (other.personal.name || "") !== (resume.personal.name || "") ? draftLabel(other) : null;
    setPrivateDialog({ type: "leave", replaces, other });
  };
  const confirmLeavePrivate = () => {
    setPrivateMode(false);
    setPrivateDialog(null);
    window.history.replaceState(null, "", "/builder");
    if (isAuthenticated) {
      if (hasRealContent(resume)) createResume({ nickname: defaultNickname(resume) });
      else message.info("Private session ended. Your resume will save to your account once you add something.");
    } else {
      writeDraft(resume);
      message.success("Private session ended. Your resume is kept in this browser.");
    }
  };
  const openFromFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error("too large");
      const data = JSON.parse(await file.text());
      if (data?.app !== "resumex" || !data.resume) throw new Error("not a resume file");
      setResume((r) => ({ ...normalizeResume(data.resume), _id: r._id, shortId: r.shortId, nickname: r.nickname, isMaster: r.isMaster, isPublic: r.isPublic }));
      setShowExample(false);
      message.success("Resume opened from file");
    } catch {
      message.error("That isn't a ResumeX file. Choose a .resumex.json file you saved earlier.");
    }
  };

  const handleSave = useCallback(() => {
    if (privateMode) {
      message.info("This is a private session, so nothing is saved. Use “Save to file” to keep a copy on your device, or leave private mode.");
      return;
    }
    if (!isAuthenticated) {
      message.info("Create a free account to save your resume. Your work stays here while you sign up.");
      openAuth("register", "/builder");
      return;
    }
    if (needsLogin) return logInAgain();
    if (resume._id) saveNow();
    else createResume({ nickname: defaultNickname(resume) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, resume, saveNow, createResume, openAuth, message, privateMode, needsLogin]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  const handleDownload = async (event) => {
    const origin = event?.currentTarget;
    setDownloading(true);
    try {
      await downloadPdf(resume);
      celebrate(origin);
      // Recorded for the refund policy (only paid templates count; the server decides which).
      if (token) api("/billing/download", { token, method: "POST", body: { template: resume.template } }).catch(() => {});
    } catch (err) {
      console.error(err);
      message.error("Could not create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    if (privateMode) {
      message.info("Share links need the resume to be saved to your account, so they aren't available in a private session.");
      return;
    }
    if (!resume.isPublic && !allowed("shareLinks", "Sharing a link to your resume")) return;
    if (!isAuthenticated || !resume._id) {
      message.info("Save your resume first to get a shareable link.");
      handleSave();
      return;
    }
    // Save pending edits first, so the shared page shows the current template and colours.
    if (dirty) saveNow();
    setShareOpen(true);
  };

  const clearExample = () => {
    setResume((r) => ({ ...normalizeResume(blankResume()), template: r.template, theme: r.theme, _id: r._id, shortId: r.shortId, nickname: r.nickname, isMaster: r.isMaster, isPublic: r.isPublic }));
    setShowExample(false);
  };

  // Clears straight away, with a few seconds to undo instead of an "are you sure?" dialog.
  const clearAllContent = () => {
    const snapshot = resume;
    const hadExample = showExample;
    clearExample();
    const key = "clear-undo";
    message.open({
      key,
      type: "info",
      duration: 8,
      content: (
        <span className="inline-flex items-center gap-3">
          All content cleared.
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setResume(snapshot);
              setShowExample(hadExample);
              message.destroy(key);
            }}
          >
            Undo
          </Button>
        </span>
      ),
    });
  };

  const fillFromMaster = async () => {
    try {
      const { data } = await api("/resumes", { token });
      const summary = data.find((r) => r.isMaster);
      if (!summary) return message.warning('No master profile yet. Save a resume with "Use as my master profile" ticked.');
      if (summary._id === resume._id) return message.info("This resume is your master profile.");
      const { data: master } = await api(`/resumes/${summary._id}`, { token });
      modal.confirm({
        title: `Fill from "${master.nickname}"?`,
        content: "This replaces the content of this resume with your master profile. Your template and colours stay the same.",
        okText: "Replace content",
        onOk: () => {
          const m = normalizeResume(master);
          setResume((r) => withContentOf(r, m));
          setShowExample(false);
          message.success("Filled from your master profile");
        },
      });
    } catch (err) {
      message.error(err.message);
    }
  };

  const aiCall = async (key, path, body) => {
    setRefiningId(key);
    try {
      return await api(path, { token, method: "POST", body });
    } catch (err) {
      // Plan locks show the upgrade dialog instead, and a cancel is confirmed by the AI status card.
      if (err.code !== "upgrade" && err.code !== "cancelled") message.error(err.message);
      return null;
    } finally {
      setRefiningId(null);
    }
  };

  const requireAccount = () => {
    if (isAuthenticated) return true;
    openAuth("register", "/builder");
    return false;
  };

  const refineSummary = async () => {
    if (!allowed("refine", "AI rewrite")) return;
    if (!requireAccount()) return;
    if (!resume.summary.trim()) return message.info("Write a few words first, then let AI polish them.");
    const data = await aiCall("summary", "/ai/refine", { resumeText: resume.summary, fullResume: aiResume(resume), sectionType: "summary" });
    // Shown next to the original; it only replaces it when the person says so.
    if (data) setRewrite({ kind: "summary", before: resume.summary, after: data.refinedText, unverified: data.unverified });
  };

  const refineItem = async (itemId, text) => {
    if (!allowed("refine", "AI rewrite")) return;
    if (!requireAccount()) return;
    if (!text.trim()) return message.info("Write a few points first, then let AI polish them.");
    const data = await aiCall(itemId, "/ai/refine", { resumeText: text, fullResume: aiResume(resume), sectionType: "experience" });
    if (data) setRewrite({ kind: "item", itemId, before: text, after: data.refinedText, unverified: data.unverified });
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const form = new FormData();
    form.append("resumeFile", file);
    const hide = message.loading("Reading your resume…", 0);
    try {
      const { extractedData } = await api("/ai/parse", { token, method: "POST", body: form, timeout: 120000 });
      const x = normalizeResume(extractedData);
      setResume((r) => withContentOf(r, x, { keepPhoto: true }));
      setShowExample(false);
      message.success("Imported! Check each section and fix anything we missed.");
    } catch (err) {
      if (err.code !== "upgrade" && err.code !== "cancelled") message.error(err.message);
    } finally {
      hide();
    }
  };

  // V2: rewrite a tailored resume's summary and top points for its job (proposals to review).
  const runPolish = async () => {
    if (!allowed("polish", "AI polish")) return;
    if (!requireAccount()) return;
    try {
      const { data: app } = await api(`/applications/${resume.tailoredFor}`, { token });
      const data = await aiCall("polish", "/ai/polish", { resume: aiResume(resume), jobDescription: app.job?.description || "" });
      if (data) setPolishReview({ operations: data.operations, stored: false });
    } catch (err) {
      message.error(err.message);
    }
  };
  const clearSuggestions = () => {
    setResume((r) => ({ ...r, suggestions: undefined }));
    if (resume._id) api(`/resumes/${resume._id}`, { token, method: "PUT", body: { suggestions: null } }).catch(() => {});
  };

  const billing = useBilling();
  // V2: the Career Profile replaces the "master resume" for accounts that have V2.
  const profileSync = useProfileSync({ token, resume, setResume, enabled: isAuthenticated && !!billing?.v2 });
  // Plan locks (only when free mode is off in the admin settings). Locked controls carry a
  // plan tag, and using one explains the upgrade instead of failing.
  const FEATURE_OF = { audit: "atsCheck", chat: "chat", cover: "coverLetter", import: "parse" };
  const FEATURE_NAME = { audit: "The ATS check", chat: "The AI assistant", cover: "The cover letter writer", import: "Importing a resume" };
  const allowed = (feature, what) => !billing || billing.requireFeature(feature, what);
  // The plan a template needs, when this account's plan doesn't include it (admins set this per category and template).
  const templateLocked = (id) => billing?.templateLock(id) || null;
  const pickTemplate = (id) => {
    if (billing && !billing.requireTemplate(id)) return false;
    editor.setField("template", id);
    // A biodata template shows the biodata details: switch them on and point to where they're filled in.
    if (billing?.v2 && templateById(id).biodata && !resume.biodata?.enabled) {
      setResume((r) => ({ ...r, biodata: { ...r.biodata, enabled: true } }));
      message.info("Fill in the biodata details under “Biodata details” in Content. They stay in this resume only.", 6);
    }
    return true;
  };
  // A locked template chosen before the plans loaded (e.g. from /templates/<name>): keep the
  // previous design and explain, rather than letting it through.
  const requestedTemplate = useRef(initial.template);
  useEffect(() => {
    if (!billing?.config || !templateLocked(requestedTemplate.current) || resume._id) return;
    const locked = requestedTemplate.current;
    requestedTemplate.current = null;
    editor.setField("template", "Classic");
    billing.requireTemplate(locked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing?.config]);

  const openAi = (key) => {
    if (FEATURE_OF[key] && !allowed(FEATURE_OF[key], FEATURE_NAME[key])) return;
    // The ATS check is rule-based and runs locally, so it works without AI or an account.
    if (key === "audit") return setAiModal("audit");
    if (!AI_ENABLED) return message.info(AI_LOCKED_MESSAGE);
    if (!requireAccount()) return;
    // V2: "Add anything" merges into the resume after review, instead of replacing it.
    if (key === "import") {
      if (billing?.v2) setAiModal("add");
      else document.getElementById("resume-import")?.click();
    } else setAiModal(key);
  };

  const saveState = saving ? "saving" : dirty ? "dirty" : resume._id && isAuthenticated ? "saved" : "new";

  const aiItem = (key, icon, label, onClick) => ({
    key,
    icon,
    label: AI_ENABLED ? <span className="inline-flex items-center gap-1.5">{label} <PlanTag feature={{ chat: "chat", cover: "coverLetter", import: "parse" }[key]} /></span> : <Tooltip title={AI_LOCKED_MESSAGE} placement="left">{label} <Lock size={11} className="ml-1 inline" /></Tooltip>,
    disabled: !AI_ENABLED,
    onClick,
  });

  const moreMenu = {
    items: [
      { key: "ats", icon: <ScanSearch size={15} />, label: <span className="inline-flex items-center gap-1.5">ATS check <PlanTag feature="atsCheck" /></span>, onClick: () => openAi("audit") },
      { key: "file-save", icon: <FileDown size={15} />, label: "Save to file", onClick: () => saveToFile(resume) },
      { key: "file-open", icon: <FolderOpen size={15} />, label: "Open file", onClick: () => document.getElementById("resume-open-file")?.click() },
      ...(!resume._id ? [{ key: "private", icon: <EyeOff size={15} />, label: privateMode ? "Leave private session" : "Private session", onClick: privateMode ? endPrivateSession : startPrivateSession }] : []),
      { key: "guide", icon: <BookOpen size={15} />, label: "How to write a good resume", onClick: () => setGuideOpen(true) },
      { type: "group", label: "AI tools", children: [
        aiItem("chat", <MessageSquare size={15} />, "AI assistant", () => openAi("chat")),
        aiItem("cover", <Mail size={15} />, "Cover letter", () => openAi("cover")),
        aiItem("import", <Upload size={15} />, billing?.v2 ? "Add anything" : "Import PDF / DOCX", () => openAi("import")),
        ...(billing?.v2 && resume.tailoredFor ? [aiItem("polish", <Wand2 size={15} />, "Polish for this job", runPolish)] : []),
      ] },
      { type: "divider" },
      ...(profileSync.items.length ? profileSync.items : isAuthenticated ? [{ key: "master", icon: <Crown size={15} />, label: "Fill from master profile", onClick: fillFromMaster }] : []),
      {
        key: "clear",
        icon: <Eraser size={15} />,
        danger: true,
        label: "Clear all content",
        onClick: clearAllContent,
      },
    ],
  };

  const tpl = templateById(resume.template);
  const status = privateMode
    ? { icon: <EyeOff size={13} />, text: "Private session · nothing is saved", tone: "text-violet-600" }
    : !isAuthenticated
      ? { icon: <CloudOff size={13} />, text: "Saved in this browser only", tone: "text-slate-400" }
      : suspended
        ? { icon: <CloudOff size={13} />, text: "Account suspended · changes aren't saved", tone: "text-red-500" }
      : needsLogin
        ? { icon: <LogIn size={13} />, text: "Signed out · log in to keep saving", tone: "text-red-500", action: "login" }
        : conflict
          ? { icon: <FileWarning size={13} />, text: "Changed in another tab · choose a version", tone: "text-amber-600" }
        : saving
          ? { icon: <Loader2 size={13} className="animate-spin" />, text: resume._id ? "Saving…" : "Saving to your account…", tone: "text-slate-500" }
          : saveError
            ? { icon: <CloudOff size={13} />, text: "Couldn't save · retrying", tone: "text-red-500", action: "retry" }
            : !resume._id
              ? { icon: <CloudOff size={13} />, text: "Saves to your account once you start editing", tone: "text-slate-400" }
              : dirty
                ? { icon: <PenLine size={13} />, text: "Unsaved changes", tone: "text-amber-600" }
                : { icon: <Check size={13} />, text: "All changes saved", tone: "text-emerald-600" };

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <input id="resume-import" type="file" accept=".pdf,.docx" className="hidden" onChange={importFile} />
      <input id="resume-open-file" type="file" accept=".json,application/json" className="hidden" onChange={openFromFile} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 md:px-5">
        {isAuthenticated ? (
          <Tooltip title="My resumes">
            <Link href="/dashboard" className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 sm:block" aria-label="Back to my resumes">
              <ArrowLeft size={18} />
            </Link>
          </Tooltip>
        ) : null}
        <div className="min-w-0 flex-1">
          {resume._id ? (
            <Input variant="borderless" value={resume.nickname} onChange={(e) => editor.setField("nickname", e.target.value)} className="!px-1 !text-[15px] !font-semibold" aria-label="Resume name" />
          ) : (
            <p className="truncate px-1 text-[15px] font-semibold text-ink">{resume.personal.name ? `${resume.personal.name}'s resume` : "Untitled resume"}</p>
          )}
          <p className={`inline-flex items-center gap-1 px-1 text-xs ${status.tone}`} data-tour="status">
            {status.icon} {status.text}
            {status.action ? (
              <button type="button" onClick={() => (status.action === "login" ? logInAgain() : handleSave())} className="ml-1 font-semibold underline underline-offset-2">
                {status.action === "login" ? "Log in" : "Try now"}
              </button>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Tooltip title="Save (Ctrl+S)">
            <Button icon={<Save size={15} />} onClick={handleSave} className={resume._id && !dirty ? "!hidden sm:!inline-flex" : ""}>
              <span className="hidden sm:inline">Save</span>
            </Button>
          </Tooltip>
          <Button icon={<Share2 size={15} />} onClick={handleShare} className="!hidden sm:!inline-flex">
            Share {resume.isPublic ? null : <PlanTag feature="shareLinks" />}
          </Button>
        </div>
        <div className="hidden sm:block">
          <CreditMeter />
        </div>
        <CreditTooltip
          feature="parse"
          title={billing?.v2 ? "Add anything" : "Import your resume"}
          description={billing?.v2 ? "Paste an old CV or describe your work, or upload a PDF or Word file. It's added in the right places after you check it." : "Upload an existing PDF or Word resume and we'll fill in every section for you."}
          placement="bottom"
        >
          <Button icon={<Upload size={15} />} onClick={() => openAi("import")} data-tour="import">
            <span className="hidden md:inline">{billing?.v2 ? "Add anything" : "Import resume"}</span>
            <PlanTag feature="parse" />
          </Button>
        </CreditTooltip>
        <Tooltip title="Take a quick tour of the builder">
          <Button
            icon={<Compass size={15} />}
            onClick={() => {
              setTab("content");
              setMobileView("edit");
              setTourOpen(true);
            }}
            className="!hidden sm:!inline-flex"
          >
            <span className="hidden xl:inline">Take a tour</span>
          </Button>
        </Tooltip>
        {/* On desktop everything else lives in the dock, so these sit in the toolbar and the "more" menu is mobile-only. */}
        <div className="hidden items-center gap-2 lg:flex">
          {profileSync.items.length ? (
            <Dropdown menu={{ items: profileSync.items }} trigger={["click"]}>
              <Button icon={<UserRound size={15} />}>
                <span className="hidden xl:inline">Profile</span>
              </Button>
            </Dropdown>
          ) : isAuthenticated ? (
            <Tooltip title="Fill this resume from your master profile">
              <Button icon={<Crown size={15} />} onClick={fillFromMaster}>
                <span className="hidden xl:inline">Fill from master</span>
              </Button>
            </Tooltip>
          ) : null}
          {privateMode ? (
            <Tooltip title="Private session is on. Click to leave it and keep your resume.">
              <Button data-tour="private" icon={<EyeOff size={15} />} onClick={endPrivateSession} className="!border-violet-300 !bg-violet-50 !text-violet-700 hover:!border-violet-400">
                <span className="hidden xl:inline">Private: on</span>
              </Button>
            </Tooltip>
          ) : !resume._id ? (
            <Tooltip title="Work without saving anything to your account, our servers or this browser">
              <Button data-tour="private" icon={<EyeOff size={15} />} onClick={startPrivateSession}>
                <span className="hidden xl:inline">Private</span>
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip title="Empty every section (you can undo)">
            <Button danger icon={<Eraser size={15} />} onClick={clearAllContent} aria-label="Clear all content">
              <span className="hidden xl:inline">Clear</span>
            </Button>
          </Tooltip>
        </div>
        <Dropdown menu={moreMenu} trigger={["click"]} placement="bottomRight">
          <Button icon={<MoreHorizontal size={16} />} aria-label="More actions" className="lg:!hidden" />
        </Dropdown>
        <Button type="primary" icon={<Download size={15} />} loading={downloading} onClick={handleDownload} className="lg:!hidden">
          <span className="hidden sm:inline">Download PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {privateMode ? (
          <PrivateBanner
            key="private"
            onSaveFile={() => saveToFile(resume)}
            onOpenFile={() => document.getElementById("resume-open-file")?.click()}
            onLeave={endPrivateSession}
          />
        ) : null}
      </AnimatePresence>

      <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
        <Segmented block value={mobileView} onChange={setMobileView} options={[{ label: "Edit", value: "edit" }, { label: "Preview", value: "preview" }]} />
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Editor */}
        <aside className={`thin-scroll w-full shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 lg:block lg:w-[460px] xl:w-[500px] ${mobileView === "edit" ? "block" : "hidden"}`}>
          <div className="sticky top-0 z-10 bg-slate-50/95 px-4 pt-4 pb-3 backdrop-blur" data-tour="tabs">
            <Segmented
              block
              value={tab}
              onChange={setTab}
              options={[
                { value: "content", label: <span className="inline-flex items-center gap-1.5"><PenLine size={14} /> Content</span> },
                { value: "design", label: <span className="inline-flex items-center gap-1.5"><Palette size={14} /> Design</span> },
              ]}
            />
          </div>
          <div className="px-4 pb-10">
            {privateMode ? (
              <p className="mb-3 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900/80">
                <EyeOff size={14} className="mt-0.5 shrink-0 text-violet-600" />
                AI features send your text to our AI provider only to answer; it isn&apos;t kept. Everything else stays on this page.
              </p>
            ) : null}
            {showExample && tab === "content" ? (
              <div className="mb-3 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3.5">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
                <div className="flex-1 text-sm text-ink">
                  <p className="font-medium">This is example content.</p>
                  <p className="text-slate-600">Edit it section by section, or start from an empty page.</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="small" type="primary" onClick={clearExample}>Start empty</Button>
                    <Button size="small" type="text" onClick={() => setShowExample(false)}>Keep example</Button>
                  </div>
                </div>
              </div>
            ) : null}
            {tab === "content" ? (
              <>
              {resume.suggestions?.operations?.length ? (
                <div className="mb-3 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3">
                  <Wand2 size={17} className="shrink-0 text-brand" />
                  <p className="min-w-0 flex-1 text-sm text-ink">AI polish has {resume.suggestions.operations.length} suggestion{resume.suggestions.operations.length === 1 ? "" : "s"} for this job.</p>
                  <Button size="small" type="text" onClick={clearSuggestions}>Dismiss</Button>
                  <Button size="small" type="primary" onClick={() => setPolishReview({ operations: resume.suggestions.operations, stored: true })}>Review</Button>
                </div>
              ) : null}
              <ContentPanel editor={editor} onRefineSummary={refineSummary} onRefineItem={refineItem} refiningId={refiningId} onHelp={() => setGuideOpen(true)} biodata={!!billing?.v2 || !!resume.biodata?.enabled} />
              </>
            ) : (
              <DesignPanel resume={resume} onTemplate={pickTemplate} isLocked={templateLocked} setTheme={editor.setTheme} onBrowse={setGallery} onHelp={() => setGuideOpen(true)} />
            )}
          </div>
        </aside>

        {/* Preview */}
        <section className={`thin-scroll min-w-0 flex-1 overflow-auto bg-slate-200/60 lg:block lg:pr-24 ${mobileView === "preview" ? "block" : "hidden"}`} aria-label="Resume preview" data-tour="preview">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-100/90 px-4 py-2 text-xs text-slate-500 backdrop-blur">
            <span>
              <b className="font-medium text-slate-700">{tpl.name}</b> · {resume.theme.pageSize === "LETTER" ? "US Letter" : "A4"} · {pages} page{pages === 1 ? "" : "s"}
              {pages > 2 ? <span className="ml-2 text-amber-600">Most resumes should fit on 1–2 pages</span> : null}
            </span>
            <span className="flex items-center gap-1 lg:hidden">
              <Button size="small" type="text" icon={<ZoomOut size={14} />} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))} aria-label="Zoom out" />
              <button type="button" className="w-11 text-center tabular-nums hover:text-ink" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <Button size="small" type="text" icon={<ZoomIn size={14} />} onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))} aria-label="Zoom in" />
            </span>
          </div>
          <div className="px-4 py-6 md:px-8">
            <PdfPreview resume={resume} zoom={zoom} onPageCount={setPages} />
          </div>
        </section>

        <ActionDock
          tab={tab}
          onTab={(t) => {
            setTab(t);
            setMobileView("edit");
          }}
          zoom={zoom}
          onZoom={setZoom}
          aiEnabled={AI_ENABLED}
          onAi={openAi}
          saveState={saveState}
          onSave={handleSave}
          onShare={handleShare}
          onDownload={handleDownload}
          downloading={downloading}
          onHelp={() => setGuideOpen(true)}
          lockFor={(key) => (billing ? billing.lockFor(key) : null)}
          shareLocked={!resume.isPublic && !!billing?.lockFor("shareLinks")}
        />
      </div>


      <StartPrivateModal open={privateDialog?.type === "start"} hasStoredDraft={privateDialog?.hasStoredDraft} onCancel={() => setPrivateDialog(null)} onConfirm={confirmStartPrivate} />
      <LeavePrivateModal
        open={privateDialog?.type === "leave"}
        isAuthenticated={isAuthenticated}
        replacesDraft={privateDialog?.replaces}
        onSaveOtherDraft={() => saveToFile(privateDialog.other)}
        onCancel={() => setPrivateDialog(null)}
        onLeave={confirmLeavePrivate}
      />
      {profileSync.dialog}
      <RewriteModal
        rewrite={rewrite}
        onClose={() => setRewrite(null)}
        onStrengthen={(point) => setStrengthen({ itemId: rewrite.itemId, point })}
        onUse={(text) => {
          if (rewrite.kind === "summary") editor.setField("summary", text);
          else editor.updateItem("experience", rewrite.itemId, { description: text });
          setRewrite(null);
        }}
      />
      <StrengthenModal
        point={strengthen?.point}
        token={token}
        onClose={() => setStrengthen(null)}
        onUse={(text) => {
          // Replace that one point in the job (the rewrite dialog stays for the others).
          const item = resume.experience.find((e) => e.id === strengthen.itemId);
          if (item) editor.updateItem("experience", item.id, { description: splitBullets(item.description).map((l) => (l === strengthen.point ? text : l)).join("\n") });
          setRewrite(null);
          setStrengthen(null);
          message.success("Point updated");
        }}
      />
      <ReviewChanges
        open={!!polishReview}
        title="Polished for this job"
        subtitle="Your facts in the job's language. Tick what to use."
        operations={polishReview?.operations}
        target={resume}
        applyLabel="Use"
        onApply={(ops) => {
          setResume((r) => applyOperations(r, ops));
          if (polishReview.stored) clearSuggestions();
          setPolishReview(null);
        }}
        onClose={() => setPolishReview(null)}
      />
      <AddAnything
        open={aiModal === "add"}
        onClose={() => setAiModal(null)}
        target={resume}
        token={token}
        onApply={(ops) => {
          setResume((r) => applyOperations(r, ops));
          setShowExample(false);
        }}
      />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} resume={resume} onChange={(patch) => setResume((r) => ({ ...r, ...patch }))} />
      <TemplateGallery
        open={!!gallery}
        initialCategory={gallery}
        current={resume.template}
        onClose={() => setGallery(null)}
        isLocked={templateLocked}
        onPick={(t) => {
          if (pickTemplate(t)) message.success(`Switched to ${templateById(t).name}`);
        }}
      />
      <Modal
        open={!!conflict}
        title="This resume was changed somewhere else"
        closable={false}
        mask={{ closable: false }}
        keyboard={false}
        footer={null}
      >
        <p className="text-slate-600">
          It was saved from another tab or device{conflict?.updatedAt ? ` at ${new Date(conflict.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}, after you opened it here. Which version do you want to keep?
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => {
              takeServerCopy(conflict);
              setConflict(null);
              message.success("Showing the latest saved version.");
            }}
          >
            Use the other version
          </Button>
          <Button
            onClick={() => {
              setConflict(null);
              createResume({ nickname: `${resume.nickname || "Resume"} (my copy)`.slice(0, 120) });
            }}
          >
            Save mine as a copy
          </Button>
          <Button
            type="primary"
            onClick={() => {
              revRef.current = conflict.rev ?? revRef.current;
              setConflict(null);
            }}
          >
            Keep mine
          </Button>
        </div>
      </Modal>
      <ResumeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <BuilderTour open={tourOpen} onClose={() => setTourOpen(false)} signedIn={isAuthenticated} />
      <AtsModal open={aiModal === "audit"} onClose={() => setAiModal(null)} resume={resume} token={token} />
      {AI_ENABLED ? (
        <>
          <ChatModal open={aiModal === "chat"} onClose={() => setAiModal(null)} resume={resume} token={token} onApplyOperations={billing?.v2 ? (ops) => setResume((r) => applyOperations(r, ops)) : undefined} onOpenGuide={() => setGuideOpen(true)} onUseAsSummary={(text) => { editor.setField("summary", text.replace(/^"|"$/g, "")); message.success("Updated your About me"); }} />
          <CoverLetterModal open={aiModal === "cover"} onClose={() => setAiModal(null)} resume={resume} token={token} />
        </>
      ) : null}
    </div>
  );
}
