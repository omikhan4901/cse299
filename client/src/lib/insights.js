/**
 * Outcome insights (V2.2, docs/v2/SPEC.md §10): what the person's own applications show,
 * worded as observations, never advice, and only once there's enough history for the
 * numbers to mean something. No AI; computed from the tracker.
 *
 *   insightsFor(apps, { now, min }) → { ready: false, sent, need } or
 *     { ready: true, sent, interviews, offers, heardBack, interviewRate, medianDaysToInterview,
 *       waiting, byResume: [...], byRole: [...] }
 * Pure; shared by the app and the tests.
 */
import { familyFor } from "./interview.js";

export const MIN_SENT = 8; // applications sent before any rate is shown
export const MIN_GROUP = 3; // applications in a group before it's compared
const DAY = 86400000;
const LATER = ["interviewing", "offer"];

const history = (a) => (a.statusHistory || []).map((h) => ({ status: h.status, at: new Date(h.at) })).filter((h) => !Number.isNaN(h.at.getTime()));

/** When it was sent, or null if it never was. */
function sentAt(a) {
  if (a.appliedAt) return new Date(a.appliedAt);
  const h = history(a).find((x) => ["applied", ...LATER].includes(x.status));
  if (h) return h.at;
  return ["applied", ...LATER].includes(a.status) ? new Date(a.updatedAt || a.createdAt || Date.now()) : null;
}
const gotInterview = (a) => LATER.includes(a.status) || history(a).some((h) => LATER.includes(h.status)) || (a.interviews || []).length > 0;
const gotOffer = (a) => a.status === "offer" || history(a).some((h) => h.status === "offer");
const heardBack = (a) => gotInterview(a) || a.status === "rejected";

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Groups with at least MIN_GROUP sent, best interview rate first. */
function groups(sent, keyOf, labelOf) {
  const by = new Map();
  for (const a of sent) {
    const key = keyOf(a);
    if (!key) continue;
    if (!by.has(key)) by.set(key, { key, label: labelOf(a), sent: 0, interviews: 0 });
    const g = by.get(key);
    g.sent += 1;
    if (gotInterview(a)) g.interviews += 1;
  }
  return [...by.values()]
    .filter((g) => g.sent >= MIN_GROUP)
    .sort((a, b) => b.interviews / b.sent - a.interviews / a.sent || b.sent - a.sent);
}

export function insightsFor(apps, { now = new Date(), min = MIN_SENT } = {}) {
  const sent = (apps || []).filter((a) => sentAt(a));
  if (sent.length < min) return { ready: false, sent: sent.length, need: min };

  const interviews = sent.filter(gotInterview).length;
  const days = sent
    .map((a) => {
      const start = sentAt(a);
      const first = history(a).find((h) => LATER.includes(h.status));
      return first ? Math.max(0, Math.round((first.at - start) / DAY)) : null;
    })
    .filter((d) => d !== null);
  const waiting = sent.filter((a) => a.status === "applied" && !a.archived && (now - sentAt(a)) / DAY >= 21).length;

  // Which version was sent: the frozen copy's name, else the linked resume.
  const byResume = groups(sent, (a) => (a.snapshot?.nickname ? `n:${a.snapshot.nickname}` : a.resume ? `r:${a.resume}` : null), (a) => a.snapshot?.nickname || "A resume");
  const byRole = groups(sent, (a) => familyFor(a.job || {}).id, (a) => familyFor(a.job || {}).label);

  return {
    ready: true,
    sent: sent.length,
    interviews,
    offers: sent.filter(gotOffer).length,
    heardBack: sent.filter(heardBack).length,
    interviewRate: Math.round((interviews / sent.length) * 100),
    medianDaysToInterview: days.length >= MIN_GROUP ? median(days) : null,
    waiting,
    // Comparisons only mean something when there are at least two groups to compare.
    byResume: byResume.length >= 2 ? byResume.slice(0, 3) : [],
    byRole: byRole.length >= 2 ? byRole.slice(0, 3) : [],
  };
}
