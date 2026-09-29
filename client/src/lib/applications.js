/**
 * The job tracker's rules (V2, docs/v2/SPEC.md §5.4–5.5): statuses, the checklist and its
 * next step, what's due soon, the funnel, and the job match shown as evidence (never as a
 * pass mark). Pure functions, shared by the pages and the server tests.
 */
import { matchChecks } from "./ats/analyze.js";
import { normalizeResume } from "./resume.js";

export const STATUSES = [
  { id: "saved", label: "Saved", tone: "slate" },
  { id: "preparing", label: "Preparing", tone: "sky" },
  { id: "applied", label: "Applied", tone: "brand" },
  { id: "interviewing", label: "Interviewing", tone: "violet" },
  { id: "offer", label: "Offer", tone: "emerald" },
  { id: "rejected", label: "Rejected", tone: "rose" },
  { id: "withdrawn", label: "Withdrawn", tone: "slate" },
  { id: "noResponse", label: "No response", tone: "amber" },
];
/** Still in progress (counts towards the plan's limit). Same list as server/models/Application.js. */
export const ACTIVE = ["saved", "preparing", "applied", "interviewing"];
export const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
export const isActive = (a) => !a?.archived && ACTIVE.includes(a?.status);

const DAY = 864e5;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
/** Whole days from today to a date (negative when past). */
export const daysUntil = (date, now = new Date()) => (date ? Math.round((startOfDay(date) - startOfDay(now)) / DAY) : null);

// After this many days applied with no change, "No response" is suggested.
export const NO_RESPONSE_DAYS = 21;
const ACADEMIC = /\b(lecturer|professor|faculty|research (fellow|associate|assistant)|postdoc|teaching assistant)\b/i;
const ORDER = ["saved", "preparing", "applied", "interviewing", "offer"];
/** Whether an application got as far as `status` (for closed ones, from its history). */
const reached = (a, status) => {
  const want = ORDER.indexOf(status);
  const at = ORDER.indexOf(a.status);
  if (at >= 0) return at >= want;
  if (status === "applied" && a.appliedAt) return true;
  return (a.statusHistory || []).some((h) => ORDER.indexOf(h.status) >= want);
};

/**
 * The checklist for one application: what's worth doing for this kind of job, done or not.
 * Some items tick themselves (a description added, a resume linked, marked as applied).
 */
export function checklistFor(a) {
  const ticked = (k) => !!(a.checklist && (a.checklist instanceof Map ? a.checklist.get(k) : a.checklist[k]));
  const via = a.job?.applyVia || [];
  const items = [
    { key: "description", label: "Add the job description", done: !!a.job?.description?.trim() || !!a.job?.hasDescription || ticked("description"), auto: true },
    { key: "resume", label: "Choose or make the resume for it", done: !!a.resume || !!a.snapshot?.at || ticked("resume"), auto: true },
    { key: "match", label: "Review the job match", done: ticked("match") },
  ];
  if (ACADEMIC.test(a.job?.title || "")) items.push({ key: "publications", label: "List your publications and research", done: ticked("publications") });
  items.push({ key: "coverLetter", label: "Write a cover letter (if they ask for one)", done: !!a.coverLetter?.text?.trim() || ticked("coverLetter"), optional: true });
  if (via.includes("teletalk")) items.push({ key: "fee", label: "Pay the application fee (Teletalk SMS)", done: ticked("fee") });
  if (via.includes("post")) items.push({ key: "posted", label: "Post or hand in the printed application", done: ticked("posted") });
  items.push({ key: "submitted", label: "Submit the application", done: reached(a, "applied") || ticked("submitted"), auto: true });
  if (via.includes("teletalk")) items.push({ key: "admitCard", label: "Download the admit card", done: ticked("admitCard"), after: "applied" });
  items.push({ key: "followUp", label: "Follow up", done: ticked("followUp"), after: "applied" });
  if (a.status === "interviewing" || a.interviews?.length) items.push({ key: "interviewPrep", label: "Prepare for the interview", done: ticked("interviewPrep"), after: "applied" });
  return items;
}

/** The first thing left to do (or null when there's nothing, or it's closed). */
export function nextStep(a) {
  if (!isActive(a)) return null;
  const applied = reached(a, "applied");
  return checklistFor(a).find((i) => !i.done && !i.optional && (!i.after || applied)) || null;
}

/**
 * What needs attention soon across applications, most urgent first:
 * deadlines (next 7 days), follow-ups due, interviews (next 7 days), and "no response?" suggestions.
 */
export function dueItems(apps, now = new Date()) {
  const out = [];
  for (const a of apps || []) {
    if (a.archived) continue;
    const name = [a.job?.title, a.job?.organisation].filter(Boolean).join(" · ") || "Untitled";
    if (a.job?.deadline && ["saved", "preparing"].includes(a.status)) {
      const d = daysUntil(a.job.deadline, now);
      if (d !== null && d >= 0 && d <= 7) out.push({ kind: "deadline", app: a, name, days: d, at: a.job.deadline });
      else if (d !== null && d < 0 && d >= -3) out.push({ kind: "missed", app: a, name, days: d, at: a.job.deadline });
    }
    if (a.followUpAt && isActive(a)) {
      const d = daysUntil(a.followUpAt, now);
      if (d !== null && d <= 0 && !(a.checklist && (a.checklist.followUp || a.checklist.get?.("followUp")))) out.push({ kind: "followUp", app: a, name, days: d, at: a.followUpAt });
    }
    for (const i of a.interviews || []) {
      const d = daysUntil(i.at, now);
      if (d !== null && d >= 0 && d <= 7 && isActive(a)) out.push({ kind: "interview", app: a, name, days: d, at: i.at, detail: i.kind });
    }
    if (a.status === "applied" && a.appliedAt) {
      const last = new Date(Math.max(new Date(a.appliedAt), ...(a.statusHistory || []).map((h) => new Date(h.at))));
      if ((now - last) / DAY >= NO_RESPONSE_DAYS) out.push({ kind: "noResponse", app: a, name, days: Math.floor((now - last) / DAY), at: last });
    }
  }
  const rank = { missed: 0, interview: 1, deadline: 2, followUp: 3, noResponse: 4 };
  return out.sort((x, y) => rank[x.kind] - rank[y.kind] || new Date(x.at) - new Date(y.at));
}

/** Counts for the funnel. "Applied" counts everything that got that far, including later stages. */
export function funnel(apps, now = new Date()) {
  const live = (apps || []).filter((a) => !a.archived);
  const got = (s) => live.filter((a) => reached(a, s)).length;
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  return {
    saved: live.length,
    applied: got("applied"),
    interviewing: got("interviewing"),
    offers: got("offer"),
    thisWeek: live.filter((a) => a.appliedAt && new Date(a.appliedAt) >= weekAgo).length,
    active: live.filter(isActive).length,
  };
}

/**
 * The job match as evidence: which of the job's skills the resume shows, which it doesn't
 * (and whether the profile has them), and the education and experience requirements.
 * `profile` is optional; with it, missing skills the profile does have are pointed out.
 */
export function jobMatch(resumeIn, jobText, profileIn = null) {
  const text = String(jobText || "");
  if (text.trim().length < 40) return null;
  const resume = normalizeResume(resumeIn);
  const { checks, keywords } = matchChecks({ resume, jobDescription: text });
  const hard = keywords.filter((k) => k.kind !== "soft");
  const shown = hard.filter((k) => k.matched).map((k) => k.name);
  const missing = hard.filter((k) => !k.matched).map((k) => k.name);
  let inProfile = [];
  if (profileIn && missing.length) {
    const p = normalizeResume(profileIn);
    const pm = matchChecks({ resume: p, jobDescription: text }).keywords;
    inProfile = missing.filter((name) => pm.find((k) => k.name === name)?.matched);
  }
  const lines = [];
  if (hard.length) {
    lines.push({ ok: shown.length / hard.length >= 0.6, text: `${shown.length} of the ${hard.length} skills the job mentions are in your resume`, items: shown });
    if (missing.length) lines.push({ ok: false, text: `Not found in your resume: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ` and ${missing.length - 8} more` : ""}`, items: missing, inProfile });
  }
  for (const id of ["degree", "years", "title"]) {
    const c = checks.find((x) => x.id === id);
    if (c) lines.push({ ok: c.status === "pass", text: c.detail });
  }
  // The share of the job's keywords (weighted) the resume has: not the ATS check's points,
  // which count 85% as full marks and would show 100% with a skill still missing.
  const coverage = checks.find((c) => c.id === "keywords")?.coverage;
  return { lines, shown, missing, inProfile, score: coverage == null ? null : Math.round(coverage * 100) };
}
