"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Modal } from "antd";
import { motion } from "motion/react";
import { EyeOff, ServerOff, TimerOff, Share2, FileDown, FolderOpen, LogOut, CloudUpload, HardDrive } from "lucide-react";

const Point = ({ icon: Icon, title, children }) => (
  <li className="flex gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Icon size={17} /></span>
    <span>
      <span className="block font-semibold text-ink">{title}</span>
      <span className="text-sm text-slate-600">{children}</span>
    </span>
  </li>
);

const Header = ({ title, subtitle }) => (
  <div className="flex items-center gap-3">
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/25"><EyeOff size={20} /></span>
    <div>
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {subtitle ? <p className="text-sm font-normal text-slate-500">{subtitle}</p> : null}
    </div>
  </div>
);

/** Explains exactly what a private session means before it starts. */
export function StartPrivateModal({ open, onCancel, onConfirm, hasStoredDraft }) {
  const [deleteDraft, setDeleteDraft] = useState(false);
  return (
    <Modal open={open} onCancel={onCancel} footer={null} width={500} destroyOnHidden centered title={<Header title="Start a private session?" subtitle="For shared computers or sensitive details" />}>
      <ul className="mt-5 space-y-4">
        <Point icon={ServerOff} title="Nothing is saved">Not to your account, not to our servers and not to this browser.</Point>
        <Point icon={TimerOff} title="Closing the tab erases it">If you close or refresh this page, this resume is gone for good. Download the PDF or save a file to keep it.</Point>
        <Point icon={Share2} title="Autosave and share links are off">The ATS check, PDF download and saving a file still work. You can leave private mode at any time.</Point>
      </ul>
      {hasStoredDraft ? (
        <Checkbox className="!mt-5" checked={deleteDraft} onChange={(e) => setDeleteDraft(e.target.checked)}>
          Also delete the copy of this resume already saved in this browser
        </Checkbox>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" icon={<EyeOff size={15} />} className="!bg-violet-600 hover:!bg-violet-500" onClick={() => onConfirm({ deleteDraft })}>
          Start private session
        </Button>
      </div>
    </Modal>
  );
}

/** Leaving private mode: says where the resume will be kept from now on. */
export function LeavePrivateModal({ open, onCancel, onLeave, isAuthenticated, replacesDraft, onSaveOtherDraft }) {
  return (
    <Modal open={open} onCancel={onCancel} footer={null} width={500} destroyOnHidden centered title={<Header title="Leave private session?" />}>
      <div className="mt-4 flex gap-3 rounded-2xl border border-slate-200 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
          {isAuthenticated ? <CloudUpload size={17} /> : <HardDrive size={17} />}
        </span>
        <p className="text-sm text-slate-600">
          {isAuthenticated ? (
            <>Your resume will be <b className="text-ink">saved to your account</b> under My resumes, and every change will save automatically from now on.</>
          ) : (
            <>Your resume will be <b className="text-ink">kept in this browser</b> so you can come back to it. Create a free account to back it up and open it anywhere.</>
          )}
        </p>
      </div>
      {!isAuthenticated && replacesDraft ? (
        <Alert
          className="!mt-3"
          type="warning"
          showIcon
          title={`This replaces ${replacesDraft}, which is already saved in this browser.`}
          description={<Button size="small" className="!mt-1" icon={<FileDown size={13} />} onClick={onSaveOtherDraft}>Save that one to a file first</Button>}
        />
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>Stay private</Button>
        <Button type="primary" icon={<LogOut size={15} />} onClick={onLeave}>
          {isAuthenticated ? "Save to my account" : "Keep it in this browser"}
        </Button>
      </div>
    </Modal>
  );
}

/** Always-visible reminder while a private session is on. */
export function PrivateBanner({ onSaveFile, onOpenFile, onLeave }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-white md:px-5">
        <p className="flex w-full min-w-0 items-center gap-2 text-sm sm:w-auto sm:flex-1">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <b className="font-semibold">Private session.</b>
          <span className="text-white/85 sm:truncate">Nothing is being saved. Closing this tab erases this resume.</span>
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onSaveFile} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium transition hover:bg-white/25">
            <FileDown size={13} /> Save to file
          </button>
          <button type="button" onClick={onOpenFile} className="hidden items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium transition hover:bg-white/25 sm:inline-flex">
            <FolderOpen size={13} /> Open file
          </button>
          <button type="button" onClick={onLeave} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-50">
            <LogOut size={13} /> Leave private
          </button>
        </div>
      </div>
    </motion.div>
  );
}
