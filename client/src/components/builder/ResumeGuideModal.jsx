"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import { BookOpen, Check, Lightbulb, X } from "lucide-react";
import { RESUME_GUIDE } from "@/content/resumeGuide";

const slug = (text) => text.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Parses the small Markdown subset the guide uses: headings, paragraphs,
 * "-" and "1." lists, "> " callouts and **bold** / *italic* inline.
 */
function parse(markdown) {
  const blocks = [];
  let list = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^- (.*)/);
    const numbered = line.match(/^\d+\. (.*)/);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) blocks.push((list = { type, items: [] }));
      list.items.push((bullet || numbered)[1]);
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3}) (.*)/);
    if (heading) blocks.push({ type: `h${heading[1].length}`, text: heading[2] });
    else if (line.startsWith("> ")) blocks.push({ type: "quote", text: line.slice(2) });
    else blocks.push({ type: "p", text: line });
  }
  return blocks;
}

function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
    ) : part.startsWith("*") && part.length > 2 ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function ListItem({ text }) {
  const example = text.match(/^\*\*(Weak|Strong):\*\* (.*)/);
  if (example) {
    const strong = example[1] === "Strong";
    return (
      <li className={`flex gap-2.5 rounded-lg px-3 py-2 ${strong ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${strong ? "bg-emerald-500" : "bg-rose-400"}`}>
          {strong ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
        </span>
        <span>{example[2]}</span>
      </li>
    );
  }
  return (
    <li className="relative pl-5 before:absolute before:top-[0.6em] before:left-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand">
      <Inline text={text} />
    </li>
  );
}

function Block({ b }) {
  switch (b.type) {
    case "h2":
      return <h2 id={`guide-${slug(b.text)}`} className="mt-10 scroll-mt-4 border-b border-slate-100 pb-2 font-display text-xl font-bold text-ink first:mt-0">{b.text}</h2>;
    case "h3":
      return <h3 className="mt-6 text-[15px] font-semibold text-ink">{b.text}</h3>;
    case "quote":
      return (
        <div className="my-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-ink">
          <Lightbulb size={18} className="shrink-0 text-brand" />
          <span><Inline text={b.text} /></span>
        </div>
      );
    case "ul":
      return (
        <ul className="mt-2.5 space-y-1.5">
          {b.items.map((t, i) => <ListItem key={i} text={t} />)}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-2.5 space-y-2">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">{i + 1}</span>
              <span><Inline text={t} /></span>
            </li>
          ))}
        </ol>
      );
    default:
      return <p className="mt-2.5"><Inline text={b.text} /></p>;
  }
}

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
            {body.map((b, i) => <Block key={i} b={b} />)}
          </div>
        </div>
      </div>
    </Modal>
  );
}
