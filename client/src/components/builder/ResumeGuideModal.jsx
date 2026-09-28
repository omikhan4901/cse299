"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import { BookOpen, X } from "lucide-react";
import { Block, Inline, parseMarkdown as parse, slugify as slug } from "../Markdown";
import { RESUME_GUIDE } from "@/content/resumeGuide";

/**
 * "How to Write a Good Resume". The text lives in shared/resume-guide.md, which
 * the AI assistant also reads before answering, so both give the same advice.
 */
export default function ResumeGuideModal({ open, onClose }) {
  const blocks = useMemo(() => parse(RESUME_GUIDE), []);
  const title = blocks.find((b) => b.type === "h1")?.text;
  const intro = blocks.find((b) => b.type === "p")?.text;
  const body = blocks.filter((b) => b.type !== "h1" && b.text !== intro);
  const sections = body.filter((b) => b.type === "h2");
  const [active, setActive] = useState(sections[0] && slug(sections[0].text));
  const scroller = useRef(null);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    let current = sections[0] && slug(sections[0].text);
    for (const s of sections) {
      const h = el.querySelector(`#guide-${slug(s.text)}`);
      if (h && h.getBoundingClientRect().top - top < 80) current = slug(s.text);
    }
    setActive(current);
  };

  const jump = (id) => {
    scroller.current?.querySelector(`#guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={980} centered title={null} closeIcon={<X size={18} />} styles={{ body: { padding: 0 } }}>
      <div className="flex h-[min(84vh,780px)] flex-col">
        <header className="border-b border-slate-100 px-6 pt-5 pb-4 pr-14">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <BookOpen size={19} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
              <p className="text-xs text-slate-500">The same guide our AI assistant follows when it answers your questions.</p>
            </div>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <nav className="hidden w-60 shrink-0 border-r border-slate-100 p-4 md:block" aria-label="Guide sections">
            <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Contents</p>
            {sections.map((s) => {
              const id = slug(s.text);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => jump(id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${active === id ? "bg-brand-50 font-medium text-brand" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {s.text}
                </button>
              );
            })}
          </nav>
          <div ref={scroller} onScroll={onScroll} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6 text-[14.5px] leading-relaxed text-slate-600 md:px-8">
            {intro ? <p className="mb-8 rounded-xl bg-slate-50 p-4 text-slate-700"><Inline text={intro} /></p> : null}
            {body.map((b, i) => <Block key={i} b={b} idPrefix="guide-" />)}
          </div>
        </div>
      </div>
    </Modal>
  );
}
