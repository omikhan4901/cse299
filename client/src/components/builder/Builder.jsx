"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Dropdown, Segmented, Tooltip, App, Input, Result, Spin } from "antd";
import {
  Download, Share2, Save, MoreHorizontal, Sparkles, MessageSquare, ScanSearch, Mail, Upload, Crown, FilePlus2, Eraser,
  ZoomIn, ZoomOut, Palette, PenLine, Check, CloudOff, Loader2, Lock, ArrowLeft,
} from "lucide-react";
import { api } from "@/lib/api";
import { AI_ENABLED } from "@/lib/config";
import { normalizeResume, sampleResume, blankResume, toPayload } from "@/lib/resume";
import { templateById, TEMPLATES } from "@/pdf/registry";
import { downloadPdf } from "@/pdf/client";
import { useAuth } from "../AuthProvider";
import { useResumeEditor } from "./useResumeEditor";
import ContentPanel from "./ContentPanel";
import DesignPanel from "./DesignPanel";
import PdfPreview from "./PdfPreview";
import SaveModal from "./SaveModal";
import ShareModal from "./ShareModal";
import { ChatModal, AuditModal, CoverLetterModal, aiResume } from "./AiModals";
import { AI_LOCKED_MESSAGE } from "./ai";
import ActionDock from "./ActionDock";
import { celebrate } from "../celebrate";

const DRAFT_KEY = "resumex:draft";

const readDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? normalizeResume(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

/** Loads the resume to edit (saved, new or local draft) and then mounts the editor. */
export default function Builder() {
  const params = useSearchParams();
  const router = useRouter();
  const { token, loading: authLoading, openAuth } = useAuth();
  const id = params.get("id");
  const isNew = params.get("new");
  const template = params.get("template");
  const [state, setState] = useState({ status: "loading" });
  const openId = useRef(null);
  const markSaved = useCallback((newId) => {
    openId.current = newId;
  }, []);

  useEffect(() => {
    if (id && openId.current === id) return; // the editor just saved this resume and updated the URL
    // ?template=X (from the templates page) applies a design to the new resume or current draft.
    /* eslint-disable react-hooks/set-state-in-effect -- the editor's content follows the URL */
    const withTemplate = (r) => (template && TEMPLATES.some((t) => t.id === template) ? { ...r, template } : r);
    if (isNew || template) {
      const draft = isNew ? null : readDraft();
      if (isNew) localStorage.removeItem(DRAFT_KEY);
      const fresh = draft || normalizeResume(isNew === "blank" ? blankResume() : sampleResume());
      openId.current = null;
      setState({ status: "ready", resume: withTemplate(fresh), key: `new-${Date.now()}`, example: !draft && isNew !== "blank" });
      router.replace("/builder");
      return;
    }
    if (!id) {
      if (state.status === "ready" && !state.resume?._id) return;
      const draft = readDraft();
      setState({ status: "ready", resume: draft || normalizeResume(sampleResume()), key: "draft", example: !draft });
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
  }, [id, isNew, template, token, authLoading]);

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
  return <Editor key={state.key} initial={state.resume} example={state.example} onSaved={markSaved} />;
}

function Editor({ initial, example, onSaved }) {
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
  const [saveOpen, setSaveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiModal, setAiModal] = useState(null);
  const [refiningId, setRefiningId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const payloadJson = useMemo(() => JSON.stringify(toPayload(resume)), [resume]);
  const [savedJson, setSavedJson] = useState(resume._id ? payloadJson : null);
  const dirty = !!resume._id && savedJson !== payloadJson;

  // Unsaved (guest or new) resumes live in localStorage so nothing is lost on refresh.
  useEffect(() => {
    if (resume._id) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(resume));
      } catch {
        /* storage full (large photo) or disabled — the editor still works */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [resume]);

  const saveNow = useCallback(async () => {
    if (!resume._id || !token) return;
    const body = payloadJson;
    setSaving(true);
    try {
      await api(`/resumes/${resume._id}`, { token, method: "PUT", body: JSON.parse(body) });
      setSavedJson(body);
      setSaveError(null);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }, [resume._id, token, payloadJson]);

  // Saved resumes autosave shortly after you stop typing.
  useEffect(() => {
    if (!dirty || !token) return;
    const t = setTimeout(saveNow, 1500);
    return () => clearTimeout(t);
  }, [dirty, token, saveNow]);

  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const handleSave = useCallback(() => {
    if (!isAuthenticated) {
      message.info("Create a free account to save your resume. Your work stays here while you sign up.");
      openAuth("register", "/builder");
      return;
    }
    if (resume._id) saveNow();
    else setSaveOpen(true);
  }, [isAuthenticated, resume._id, saveNow, openAuth, message]);

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

  const createResume = async ({ nickname, isMaster }) => {
    setSaving(true);
    try {
      const { data } = await api("/resumes", { token, method: "POST", body: { ...toPayload(resume), nickname, isMaster } });
      const saved = { ...resume, _id: data._id, shortId: data.shortId, nickname, isMaster, isPublic: data.isPublic };
      setSavedJson(JSON.stringify(toPayload(saved)));
      setResume(saved);
      localStorage.removeItem(DRAFT_KEY);
      onSaved(data._id);
      window.history.replaceState(null, "", `/builder?id=${data._id}`);
      setSaveOpen(false);
      message.success("Saved to your account. Changes now save automatically.");
    } catch (err) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (event) => {
    const origin = event?.currentTarget;
    setDownloading(true);
    try {
      await downloadPdf(resume);
      celebrate(origin);
    } catch (err) {
      console.error(err);
      message.error("Could not create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    if (!isAuthenticated || !resume._id) {
      message.info("Save your resume first to get a shareable link.");
      handleSave();
      return;
    }
    setShareOpen(true);
  };

  const clearExample = () => {
    setResume((r) => ({ ...normalizeResume(blankResume()), template: r.template, theme: r.theme, _id: r._id, shortId: r.shortId, nickname: r.nickname, isMaster: r.isMaster, isPublic: r.isPublic }));
    setShowExample(false);
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
          setResume((r) => ({ ...r, personal: m.personal, summary: m.summary, experience: m.experience, education: m.education, projects: m.projects, certifications: m.certifications, skills: m.skills, languages: m.languages }));
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
      message.error(err.message);
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
    if (!requireAccount()) return;
    if (!resume.summary.trim()) return message.info("Write a few words first, then let AI polish them.");
    const data = await aiCall("summary", "/ai/refine", { resumeText: resume.summary, fullResume: aiResume(resume), sectionType: "summary" });
    if (data) editor.setField("summary", data.refinedText);
  };

  const refineItem = async (itemId, text) => {
    if (!requireAccount()) return;
    if (!text.trim()) return message.info("Write a few points first, then let AI polish them.");
    const data = await aiCall(itemId, "/ai/refine", { resumeText: text, fullResume: aiResume(resume), sectionType: "experience" });
    if (data) editor.updateItem("experience", itemId, { description: data.refinedText });
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
      setResume((r) => ({ ...r, personal: { ...x.personal, profilePic: r.personal.profilePic, profilePicSource: r.personal.profilePicSource, photoCrop: r.personal.photoCrop }, summary: x.summary, experience: x.experience, education: x.education, projects: x.projects, certifications: x.certifications, skills: x.skills, languages: x.languages }));
      setShowExample(false);
      message.success("Imported! Check each section and fix anything we missed.");
    } catch (err) {
      message.error(err.message);
    } finally {
      hide();
    }
  };

  const openAi = (key) => {
    if (!AI_ENABLED) return message.info(AI_LOCKED_MESSAGE);
    if (!requireAccount()) return;
    if (key === "import") document.getElementById("resume-import")?.click();
    else setAiModal(key);
  };

  const saveState = saving ? "saving" : dirty ? "dirty" : resume._id && isAuthenticated ? "saved" : "new";

  const aiItem = (key, icon, label, onClick) => ({
    key,
    icon,
    label: AI_ENABLED ? label : <Tooltip title={AI_LOCKED_MESSAGE} placement="left">{label} <Lock size={11} className="ml-1 inline" /></Tooltip>,
    disabled: !AI_ENABLED,
    onClick,
  });

  const moreMenu = {
    items: [
      { type: "group", label: "AI tools", children: [
        aiItem("chat", <MessageSquare size={15} />, "AI assistant", () => openAi("chat")),
        aiItem("audit", <ScanSearch size={15} />, "ATS check", () => openAi("audit")),
        aiItem("cover", <Mail size={15} />, "Cover letter", () => openAi("cover")),
        aiItem("import", <Upload size={15} />, "Import PDF / DOCX", () => openAi("import")),
      ] },
      { type: "divider" },
      ...(isAuthenticated ? [{ key: "master", icon: <Crown size={15} />, label: "Fill from master profile", onClick: fillFromMaster }] : []),
      { key: "new", icon: <FilePlus2 size={15} />, label: <Link href="/builder?new=blank">Start a blank resume</Link> },
      {
        key: "clear",
        icon: <Eraser size={15} />,
        danger: true,
        label: "Clear all content",
        onClick: () => modal.confirm({ title: "Clear all content?", content: "Every section will be emptied. Your design settings stay.", okText: "Clear", okButtonProps: { danger: true }, onOk: clearExample }),
      },
    ],
  };

  const tpl = templateById(resume.template);
  const status = !isAuthenticated
    ? { icon: <CloudOff size={13} />, text: "Not saved to an account", tone: "text-slate-400" }
    : !resume._id
      ? { icon: <CloudOff size={13} />, text: "Draft — not saved yet", tone: "text-slate-400" }
      : saving
        ? { icon: <Loader2 size={13} className="animate-spin" />, text: "Saving…", tone: "text-slate-500" }
        : saveError
          ? { icon: <CloudOff size={13} />, text: "Save failed — retrying", tone: "text-red-500" }
          : dirty
            ? { icon: <PenLine size={13} />, text: "Unsaved changes", tone: "text-amber-600" }
            : { icon: <Check size={13} />, text: "All changes saved", tone: "text-emerald-600" };

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <input id="resume-import" type="file" accept=".pdf,.docx" className="hidden" onChange={importFile} />

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
          <p className={`flex items-center gap-1 px-1 text-xs ${status.tone}`}>
            {status.icon} {status.text}
          </p>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Tooltip title="Save (Ctrl+S)">
            <Button icon={<Save size={15} />} onClick={handleSave} className={resume._id && !dirty ? "!hidden sm:!inline-flex" : ""}>
              <span className="hidden sm:inline">Save</span>
            </Button>
          </Tooltip>
          <Button icon={<Share2 size={15} />} onClick={handleShare} className="!hidden sm:!inline-flex">
            Share
          </Button>
        </div>
        <Dropdown menu={moreMenu} trigger={["click"]} placement="bottomRight">
          <Button icon={<MoreHorizontal size={16} />} aria-label="More actions" />
        </Dropdown>
        <Button type="primary" icon={<Download size={15} />} loading={downloading} onClick={handleDownload} className="lg:!hidden">
          <span className="hidden sm:inline">Download PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>

      <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
        <Segmented block value={mobileView} onChange={setMobileView} options={[{ label: "Edit", value: "edit" }, { label: "Preview", value: "preview" }]} />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Editor */}
        <aside className={`thin-scroll w-full shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 lg:block lg:w-[460px] xl:w-[500px] ${mobileView === "edit" ? "block" : "hidden"}`}>
          <div className="sticky top-0 z-10 bg-slate-50/95 px-4 pt-4 pb-3 backdrop-blur">
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
              <ContentPanel editor={editor} onRefineSummary={refineSummary} onRefineItem={refineItem} refiningId={refiningId} />
            ) : (
              <DesignPanel resume={resume} onTemplate={(t) => editor.setField("template", t)} setTheme={editor.setTheme} />
            )}
          </div>
        </aside>

        {/* Preview */}
        <section className={`thin-scroll min-w-0 flex-1 overflow-y-auto bg-slate-200/60 lg:block lg:pr-24 ${mobileView === "preview" ? "block" : "hidden"}`} aria-label="Resume preview">
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
          <div className="mx-auto max-w-[900px] overflow-x-auto px-4 py-6 md:px-8">
            <PdfPreview resume={resume} zoom={zoom} onPageCount={setPages} />
          </div>
        </section>
      </div>

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
      />

      <SaveModal open={saveOpen} onCancel={() => setSaveOpen(false)} onSave={createResume} loading={saving} resume={resume} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} resume={resume} onChange={(patch) => setResume((r) => ({ ...r, ...patch }))} />
      {AI_ENABLED ? (
        <>
          <ChatModal open={aiModal === "chat"} onClose={() => setAiModal(null)} resume={resume} token={token} onUseAsSummary={(text) => { editor.setField("summary", text.replace(/^"|"$/g, "")); message.success("Updated your About me"); }} />
          <AuditModal open={aiModal === "audit"} onClose={() => setAiModal(null)} resume={resume} token={token} />
          <CoverLetterModal open={aiModal === "cover"} onClose={() => setAiModal(null)} resume={resume} token={token} />
        </>
      ) : null}
    </div>
  );
}
