"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Sparkles, Upload, Cloud, PanelsTopLeft, BookOpen, ListChecks, Eye, ScanSearch, MessageSquare, EyeOff, Share2, Download, X, ArrowLeft, ArrowRight, PartyPopper,
} from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to the ResumeX builder",
    description: "A one-minute tour of where everything lives. Use the arrow keys to move, or Esc to leave at any time.",
  },
  { tour: "import", icon: Upload, title: "Already have a resume?", description: "Upload your old PDF or Word file and we'll fill in every section for you. Then pick a fresh design." },
  {
    tour: "status",
    icon: Cloud,
    title: "Your work is kept safe",
    description: (signedIn) =>
      signedIn
        ? "Everything saves to your account automatically, and this line tells you when it's done. Find all your resumes under My resumes."
        : "Your resume is kept in this browser while you work. Create a free account to back it up and open it on any device.",
  },
  { tour: "tabs", icon: PanelsTopLeft, title: "Content and design", description: "Write your resume under Content. Switch to Design to change the template, colours, font and paper size." },
  { tour: "guide", icon: BookOpen, title: "Not sure what to write?", description: "The guide covers structure, strong bullet points, ATS keywords and common mistakes. The AI assistant follows the same advice." },
  { tour: "sections", icon: ListChecks, title: "Your sections", description: "Open a section to edit it. Empty sections are left out of the PDF, and you can add more at the bottom: projects, awards, references and more." },
  { tour: "preview", icon: Eye, title: "Live PDF preview", description: "This is the real PDF, updated as you type. What you see here is exactly what you download." },
  { tour: "dock-ats", icon: ScanSearch, title: "ATS check", description: "Reads your PDF the way applicant tracking systems do and runs 30+ checks. Paste a job description to see which keywords you're missing." },
  { tour: "dock-ai", icon: MessageSquare, title: "AI assistant", description: "Ask for rewrites, skills to add for a role, or feedback on your bullet points. The cover letter writer sits right below it." },
  { tour: "private", icon: EyeOff, title: "Private session", description: "On a shared computer? Turn this on and nothing is saved anywhere. Just remember to download your PDF before you close the tab." },
  { tour: "dock-share", icon: Share2, title: "Share a link", description: "Publish your resume as a web page with a PDF download. Perfect for LinkedIn and emails." },
  { tour: "dock-download", icon: Download, title: "Download your PDF", description: "One click, no print dialogs. You're ready to apply. Good luck!" },
];

const PAD = 8; // space between the spotlight and its target
const GAP = 16; // space between the spotlight and the card
const EDGE = 16; // minimum distance from the window edge
const CARD_W = 380;
const spring = { type: "spring", stiffness: 240, damping: 30, mass: 0.9 };
const slide = {
  enter: (d) => ({ opacity: 0, x: d * 20 }),
  center: { opacity: 1, x: 0 },
};

const find = (id) => document.querySelector(`[data-tour="${id}"]`);
const visible = (el) => !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0;

/** Where the card goes: beside the target where it fits, otherwise inside it (for big targets like the preview). */
function placeCard(rect, card, vw, vh) {
  const w = Math.min(card.w, vw - EDGE * 2);
  const h = card.h;
  if (!rect) return { top: (vh - h) / 2, left: (vw - w) / 2, side: "center" };
  const clampX = (x) => Math.max(EDGE, Math.min(x, vw - w - EDGE));
  const clampY = (y) => Math.max(EDGE, Math.min(y, vh - h - EDGE));
  const midX = rect.left + rect.width / 2 - w / 2;
  const midY = rect.top + rect.height / 2 - h / 2;
  const options = [
    { side: "bottom", fits: rect.bottom + GAP + h <= vh - EDGE, top: rect.bottom + GAP, left: clampX(midX) },
    { side: "left", fits: rect.left - GAP - w >= EDGE, top: clampY(midY), left: rect.left - GAP - w },
    { side: "right", fits: rect.right + GAP + w <= vw - EDGE, top: clampY(midY), left: rect.right + GAP },
    { side: "top", fits: rect.top - GAP - h >= EDGE, top: rect.top - GAP - h, left: clampX(midX) },
  ];
  // Tall, narrow targets (the dock, the editor panel) read better with the card beside them.
  const order = rect.height > rect.width * 1.5 ? ["left", "right", "bottom", "top"] : ["bottom", "left", "right", "top"];
  const pick = order.map((side) => options.find((o) => o.side === side)).find((o) => o.fits);
  if (pick) return pick;
  return { side: "inside", top: clampY(rect.bottom - h - 24), left: clampX(midX) };
}

/** A guided walk through the builder with a moving spotlight. Steps whose target isn't on screen are skipped. */
export default function BuilderTour({ open, onClose, signedIn = false }) {
  const steps = useMemo(() => (open ? STEPS.filter((s) => !s.tour || visible(find(s.tour))) : []), [open]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [rect, setRect] = useState(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  const [cardSize, setCardSize] = useState({ w: CARD_W, h: 230 });
  const cardRef = useRef(null);
  const nextRef = useRef(null);

  const step = steps[index];
  const last = index === steps.length - 1;

  // Start at the beginning each time the tour opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setIndex(0);
  }, [open]);

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = step?.tour ? find(step.tour) : null;
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, bottom: r.bottom + PAD, right: r.right + PAD });
  }, [step]);

  // Bring the target into view, then follow it while the window scrolls or resizes.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = step.tour ? find(step.tour) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    // Measuring the page is the external system this effect syncs with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    const again = setTimeout(measure, 350); // after smooth scrolling settles
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(again);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, measure]);

  // The card's real height decides where it fits.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.target.getBoundingClientRect();
      setCardSize((s) => (Math.abs(s.h - box.height) > 1 ? { w: CARD_W, h: box.height } : s));
    });
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [open, steps.length]);

  const go = useCallback(
    (delta) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= steps.length) return onClose();
      setDirection(delta);
      setIndex(next);
    },
    [index, steps.length, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onClose]);

  useEffect(() => {
    if (open) nextRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  if (typeof document === "undefined") return null;
  const pos = placeCard(rect, cardSize, viewport.w, viewport.h);
  const Icon = last ? PartyPopper : step?.icon || Sparkles;
  const description = typeof step?.description === "function" ? step.description(signedIn) : step?.description;
  const spot = rect || { top: viewport.h / 2, left: viewport.w / 2, width: 0, height: 0 };

  return createPortal(
    <AnimatePresence>
      {open && step ? (
        <motion.div key="tour" className="fixed inset-0 z-[1100]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {/* Blocks clicks on the page while the tour is open. */}
          <div className="absolute inset-0" aria-hidden />
          {/* The spotlight: a moving hole in the dimmed page. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute rounded-2xl"
            initial={false}
            animate={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius: rect ? 16 : 999 }}
            transition={spring}
            style={{ boxShadow: "0 0 0 200vmax rgba(8, 20, 28, 0.66)" }}
          >
            {rect ? (
              <motion.span
                key={index}
                className="absolute inset-0 rounded-2xl ring-2 ring-teal-300"
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: [0, 1, 0.55], scale: [1.08, 1, 1] }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            ) : null}
          </motion.div>

          {/* The card */}
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            className="absolute overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-20px_rgba(0,20,30,0.55)] ring-1 ring-slate-900/5"
            style={{ width: Math.min(CARD_W, viewport.w - EDGE * 2) }}
            initial={{ top: pos.top + 12, left: pos.left, opacity: 0, scale: 0.96 }}
            animate={{ top: pos.top, left: pos.left, opacity: 1, scale: 1 }}
            transition={spring}
          >
            <div className="h-1 w-full bg-slate-100">
              <motion.div className="h-full bg-gradient-to-r from-brand to-teal-400" initial={false} animate={{ width: `${((index + 1) / steps.length) * 100}%` }} transition={spring} />
            </div>
            <button type="button" onClick={onClose} className="absolute top-3.5 right-3.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Close tour">
              <X size={16} />
            </button>
            <div className="p-6 pt-5">
              {/* New content slides in from the direction of travel (no blank gap between steps). */}
              <motion.div key={index} custom={direction} variants={slide} initial="enter" animate="center" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                  <motion.span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-teal-500 text-white shadow-lg shadow-brand/25"
                    initial={{ rotate: -12, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.05 }}
                  >
                    <Icon size={20} />
                  </motion.span>
                  <p className="mt-4 text-xs font-semibold tracking-wide text-brand uppercase">
                    {index === 0 ? "Quick tour" : `Step ${index} of ${steps.length - 1}`}
                  </p>
                  <h2 id="tour-title" className="mt-1 pr-6 font-display text-lg font-bold text-ink">{step.title}</h2>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{description}</p>
              </motion.div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1" aria-hidden>
                  {steps.map((s, i) => (
                    <motion.span
                      key={s.title}
                      className="h-1.5 shrink-0 rounded-full"
                      initial={false}
                      animate={{ width: i === index ? 16 : 5, backgroundColor: i <= index ? "#007B7B" : "#cbd5e1" }}
                      transition={spring}
                    />
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {index > 0 ? (
                    <button type="button" onClick={() => go(-1)} className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
                      <ArrowLeft size={15} /> Back
                    </button>
                  ) : (
                    <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                      Skip
                    </button>
                  )}
                  <motion.button
                    ref={nextRef}
                    type="button"
                    onClick={() => go(1)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm whitespace-nowrap font-semibold text-white shadow-md shadow-brand/25 transition-colors hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
                  >
                    {index === 0 ? "Let\u2019s go" : last ? "Start building" : "Next"} {last ? null : <ArrowRight size={15} />}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
