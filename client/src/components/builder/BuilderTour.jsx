"use client";

import { useMemo } from "react";
import { Tour } from "antd";

const STEPS = [
  { title: "Welcome to the ResumeX builder", description: "A quick tour of where everything lives. It takes under a minute, and you can leave any time." },
  { tour: "import", title: "Already have a resume?", description: "Upload your old PDF or Word file and we'll fill in every section for you. Then pick a new design." },
  { tour: "tabs", title: "Content and design", description: "Write your resume under Content. Switch to Design to change the template, colours, font and paper size." },
  { tour: "guide", title: "Not sure what to write?", description: "The guide covers structure, strong bullet points, ATS keywords and common mistakes. The AI assistant follows the same advice." },
  { tour: "sections", title: "Your sections", description: "Open a section to edit it. Empty sections are hidden from the PDF, and you can add more (projects, awards, references…) at the bottom." },
  { tour: "preview", title: "Live PDF preview", description: "This is the real PDF, updated as you type. What you see here is exactly what you download.", placement: "left" },
  { tour: "dock-ai", title: "AI assistant", description: "Ask for rewrites, missing skills for a role or feedback on your bullet points.", placement: "left" },
  { tour: "dock-ats", title: "ATS check", description: "Scores your resume the way applicant tracking systems read it. Paste a job description to see which keywords you're missing.", placement: "left" },
  { tour: "dock-share", title: "Share a link", description: "Publish your resume as a web page anyone can open, with a PDF download.", placement: "left" },
  { tour: "dock-download", title: "Download your PDF", description: "One click, no print dialogs. You're ready to apply!", placement: "left" },
];

const find = (id) => (typeof document === "undefined" ? null : document.querySelector(`[data-tour="${id}"]`));
const visible = (el) => !!el && el.getClientRects().length > 0;

/** A guided walk through the builder. Steps whose target isn't on screen (e.g. the dock on mobile) are skipped. */
export default function BuilderTour({ open, onClose }) {
  const steps = useMemo(
    () =>
      open
        ? STEPS.filter((s) => !s.tour || visible(find(s.tour))).map(({ tour, ...s }) => ({
            ...s,
            target: tour ? () => find(tour) : null,
          }))
        : [],
    [open]
  );
  return <Tour open={open} onClose={onClose} onFinish={onClose} steps={steps} scrollIntoViewOptions={{ block: "center" }} indicatorsRender={(current, total) => <span className="text-xs text-slate-400">{current + 1} / {total}</span>} />;
}
