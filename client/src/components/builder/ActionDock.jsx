"use client";

import { Tooltip } from "antd";
import { motion } from "motion/react";
import {
  Palette, PenLine, BookOpen, ZoomIn, ZoomOut, Maximize2, MessageSquare, ScanSearch, Mail, Upload, Save, Share2, Download, Loader2, Lock, Check,
} from "lucide-react";
import { AI_LOCKED_MESSAGE } from "./ai";

function DockButton({ title, onClick, children, className = "", disabled, badge, tour }) {
  return (
    <Tooltip title={title} placement="left">
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.1 }}
        whileTap={disabled ? undefined : { scale: 0.92 }}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        aria-label={title}
        data-tour={tour}
      >
        {children}
        {badge}
      </motion.button>
    </Tooltip>
  );
}

const Divider = () => <div className="my-1 h-px w-7 bg-slate-200" />;

/**
 * The floating toolbar on the right of the preview (desktop). Mirrors the
 * original ResumeX builder: editing, view, AI tools, then save/share/download.
 */
export default function ActionDock({
  tab, onTab, zoom, onZoom, aiEnabled, onAi, saveState, onSave, onShare, onDownload, downloading, onHelp,
}) {
  const lock = aiEnabled ? null : (
    <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200">
      <Lock size={9} className="text-slate-500" />
    </span>
  );
  const aiTitle = (label) => (aiEnabled ? label : `${label} — ${AI_LOCKED_MESSAGE}`);

  return (
    <div className="pointer-events-none absolute top-1/2 right-4 z-30 hidden -translate-y-1/2 lg:block [@media(max-height:860px)]:origin-right [@media(max-height:860px)]:scale-[0.85]">
      <motion.nav
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}
        className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-[28px] bg-white/90 p-2.5 shadow-[0_12px_40px_rgba(15,31,42,0.14)] ring-1 ring-slate-900/5 backdrop-blur-xl"
        aria-label="Builder actions"
        data-tour="dock"
      >
        <DockButton title="Edit content" onClick={() => onTab("content")} className={tab === "content" ? "bg-brand-50 text-brand" : "text-slate-500 hover:bg-slate-100"}>
          <PenLine size={19} />
        </DockButton>
        <DockButton title="Templates, colours & fonts" onClick={() => onTab("design")} className={tab === "design" ? "bg-brand-50 text-brand" : "text-slate-500 hover:bg-slate-100"}>
          <Palette size={19} />
        </DockButton>
        <DockButton title="How to write a good resume" onClick={onHelp} className="text-slate-500 hover:bg-amber-50 hover:text-amber-600">
          <BookOpen size={18} />
        </DockButton>

        <Divider />
        <DockButton title="Zoom in" onClick={() => onZoom(Math.min(2, +(zoom + 0.1).toFixed(1)))} className="text-slate-500 hover:bg-slate-100">
          <ZoomIn size={18} />
        </DockButton>
        <Tooltip title="Reset zoom" placement="left">
          <button type="button" onClick={() => onZoom(1)} className="text-[11px] font-semibold text-slate-400 tabular-nums hover:text-ink">
            {Math.round(zoom * 100)}%
          </button>
        </Tooltip>
        <DockButton title="Zoom out" onClick={() => onZoom(Math.max(0.5, +(zoom - 0.1).toFixed(1)))} className="text-slate-500 hover:bg-slate-100">
          <ZoomOut size={18} />
        </DockButton>
        {zoom !== 1 ? (
          <DockButton title="Fit to width" onClick={() => onZoom(1)} className="text-slate-500 hover:bg-slate-100">
            <Maximize2 size={16} />
          </DockButton>
        ) : null}

        <Divider />
        <DockButton title={aiTitle("AI assistant")} tour="dock-ai" onClick={() => onAi("chat")} className="bg-gradient-to-br from-teal-50 to-brand-100 text-brand shadow-sm" badge={lock}>
          <MessageSquare size={18} />
        </DockButton>
        <DockButton title="ATS check" tour="dock-ats" onClick={() => onAi("audit")} className="bg-violet-50 text-violet-600 shadow-sm">
          <ScanSearch size={18} />
        </DockButton>
        <DockButton title={aiTitle("Cover letter")} onClick={() => onAi("cover")} className="bg-pink-50 text-pink-600 shadow-sm" badge={lock}>
          <Mail size={18} />
        </DockButton>
        <DockButton title={aiTitle("Import PDF / DOCX")} onClick={() => onAi("import")} className="bg-amber-50 text-amber-600 shadow-sm" badge={lock}>
          <Upload size={18} />
        </DockButton>

        <Divider />
        <DockButton
          title={saveState === "dirty" ? "Save changes (Ctrl+S)" : saveState === "saved" ? "All changes saved" : "Save (Ctrl+S)"}
          onClick={onSave}
          className={saveState === "dirty" ? "text-amber-600 ring-2 ring-amber-300 hover:bg-amber-50" : "text-slate-500 hover:bg-slate-100"}
          badge={
            saveState === "saved" ? (
              <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                <Check size={10} strokeWidth={3} />
              </span>
            ) : saveState === "dirty" ? (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500 ring-2 ring-white" />
            ) : null
          }
        >
          {saveState === "saving" ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        </DockButton>
        <DockButton title="Share link" tour="dock-share" onClick={onShare} className="text-brand hover:bg-brand-50">
          <Share2 size={18} />
        </DockButton>
        <Tooltip title="Download PDF" placement="left">
          <motion.button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="relative mt-1 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-[0_10px_24px_rgba(0,42,58,0.35)]"
            aria-label="Download PDF"
            data-download-button
            data-tour="dock-download"
          >
            <span className="absolute inset-0 animate-[dock-glow_2.8s_ease-in-out_infinite] rounded-full" />
            {downloading ? <Loader2 size={22} className="animate-spin" /> : <Download size={22} />}
          </motion.button>
        </Tooltip>
      </motion.nav>
    </div>
  );
}
