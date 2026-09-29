/**
 * Tailoring (V2, docs/v2/SPEC.md §5.3): a resume for one job, made from the Career Profile
 * by selection, not by AI. Every item and point is scored against the job's keywords (with a
 * small bonus for recent work), the best ones are kept within about one or two pages, the
 * skills the job asks for go first, and the summary that fits best is picked. Free, and
 * the result is a normal resume (every item remembers its profileItemId).
 *
 *   tailor(profile, jobText) → { content, picked, report, category }
 *   include(profile, plan, keyword) → the plan with the profile item/point that has it added
 * Pure; shared by the app and the tests.
 */
import { countAny, jobKeywords, parseDate } from "./ats/analyze.js";
import { normalizeResume, splitBullets, splitList } from "./resume.js";
import { POINTS_FIELD } from "./ingest/ops.js";
import { jobMatch } from "./applications.js";
import { resumeFromProfile } from "./profile.js";

const ACADEMIC = /\b(lecturer|professor|faculty|research (fellow|associate|assistant)|postdoc|teaching assistant|phd)\b/i;

const itemText = (section, it) =>
  Object.entries(it)
    .filter(([k, v]) => k !== "id" && k !== "profileItemId" && k !== POINTS_FIELD[section] && typeof v === "string")
    .map(([, v]) => v)
    .join(" ");

const scoreText = (text, keywords) => keywords.reduce((s, k) => s + (countAny(text, k.aliases) ? k.importance : 0), 0);

/** Years since an item ended (0 for current), from its dates; null when undated. */
function age(it, now) {
  const end = it.endDate || it.endYear || it.date || it.startDate || it.startYear;
  if (!end) return null;
  const d = parseDate(end, now);
  if (!d) return null;
  return d.present ? 0 : Math.max(0, now.getFullYear() + now.getMonth() / 12 - d.value);
}
const recency = (it, now) => {
  const a = age(it, now);
  return a == null ? 0 : a < 1 ? 1 : a < 3 ? 0.6 : a < 6 ? 0.3 : 0;
};

// How much fits: about one page early in a career, two later.
const budgetFor = (profile) => {
  const jobs = profile.experience.length;
  return jobs >= 4 ? { points: 30, perJob: 5, jobs: 6, projects: 3 } : { points: 18, perJob: 4, jobs: 4, projects: 3 };
};

/**
 * Chooses what goes into the resume. Returns a plan:
 *   { select: { [section]: [profile ids] }, points: { [item id]: [points] }, summary, skills }
 */
export function planFor(profileIn, jobText, { now = new Date() } = {}) {
  const profile = normalizeResume(profileIn);
  const keywords = jobKeywords(jobText);
  const academic = ACADEMIC.test(jobText.slice(0, 600));
  const budget = budgetFor(profile);
  const select = {};
  const points = {};

  // Experience: the most relevant jobs, recent ones first among equals; always at least the latest.
  const jobs = profile.experience
    .map((it, i) => ({
      it,
      i,
      // Teaching and research roles count for academic jobs even when the posting names no skills.
      score: scoreText(itemText("experience", it), keywords) * 1.5 + scoreText(it.description, keywords) + recency(it, now) * 2 + (academic && ACADEMIC.test(it.title || "") ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const keptJobs = jobs.filter((j, rank) => rank < budget.jobs && (j.score > 0.5 || rank < 2)).sort((a, b) => a.i - b.i);
  select.experience = keptJobs.map((j) => j.it.id);

  // Points of each kept job: the ones that match first, then the rest, within the budget.
  let left = budget.points;
  for (const j of [...keptJobs].sort((a, b) => b.score - a.score)) {
    const lines = splitBullets(j.it.description).map((line, i) => ({ line, i, score: scoreText(line, keywords) }));
    const take = Math.max(1, Math.min(budget.perJob, left));
    // Matching points first; points that match nothing only to give each job at least two.
    const ranked = [...lines].sort((a, b) => b.score - a.score || a.i - b.i);
    const matching = ranked.filter((l) => l.score > 0).slice(0, take);
    const filler = ranked.filter((l) => l.score === 0).slice(0, Math.max(0, Math.min(2, take) - matching.length));
    const chosen = [...matching, ...filler].sort((a, b) => a.i - b.i);
    points[j.it.id] = chosen.map((c) => c.line);
    left -= chosen.length;
  }

  // Projects: the matching ones (or the best few when there's little work experience).
  const projects = profile.projects
    .map((it, i) => ({ it, i, score: scoreText(`${itemText("projects", it)} ${it.description}`, keywords) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const needProjects = profile.experience.length < 2;
  select.projects = projects.filter((p, rank) => rank < budget.projects && (p.score > 0 || needProjects)).sort((a, b) => a.i - b.i).map((p) => p.it.id);
  for (const id of select.projects) {
    const it = profile.projects.find((p) => p.id === id);
    const lines = splitBullets(it.description);
    if (lines.length > 3) points[id] = lines.map((line, i) => ({ line, i, score: scoreText(line, keywords) })).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 3).sort((a, b) => a.i - b.i).map((c) => c.line);
  }

  // Education always; publications for academic jobs; the rest when they match.
  select.education = profile.education.map((it) => it.id);
  select.publications = academic ? profile.publications.map((it) => it.id) : profile.publications.filter((it) => scoreText(`${itemText("publications", it)} ${it.description}`, keywords) > 0).map((it) => it.id);
  const matching = (section, max) => profile[section].map((it, i) => ({ it, i, score: scoreText(`${itemText(section, it)} ${it[POINTS_FIELD[section]] || ""}`, keywords) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, max).sort((a, b) => a.i - b.i).map((x) => x.it.id);
  select.certifications = matching("certifications", 5);
  select.courses = matching("courses", 4);
  select.awards = academic ? profile.awards.map((it) => it.id) : [...new Set([...matching("awards", 3), ...profile.awards.slice(0, 1).map((it) => it.id)])];
  select.volunteering = profile.experience.length < 2 ? profile.volunteering.map((it) => it.id).slice(0, 2) : matching("volunteering", 1);
  select.references = profile.references.map((it) => it.id);
  select.links = profile.links.map((it) => it.id);

  // Skills: what the job asks for first, then the rest, at most 15.
  const skills = splitList(profile.skills);
  const ranked = skills.map((s, i) => ({ s, i, hit: keywords.some((k) => countAny(s, k.aliases) || k.aliases.some((a) => a.replace(/^=/, "").toLowerCase() === s.toLowerCase())) })).sort((a, b) => b.hit - a.hit || a.i - b.i);
  const skillList = ranked.slice(0, 15).map((x) => x.s).join(", ");

  // The summary that fits the job best.
  const summaries = [profile.summary, ...((profileIn?.summaries || []).map((x) => x?.text) || [])].filter((x) => x?.trim());
  const summary = summaries.map((text, i) => ({ text, i, score: scoreText(text, keywords) })).sort((a, b) => b.score - a.score || a.i - b.i)[0]?.text ?? "";

  return { select, points, summary, skills: skillList, academic };
}

/** A resume's content from a plan. */
export function contentFrom(profile, plan) {
  const content = resumeFromProfile(profile, { select: plan.select, points: plan.points, summary: plan.summary });
  content.skills = plan.skills;
  return content;
}

/** Everything the tailoring screen needs: the resume, what was picked, and the match before and after. */
export function tailor(profileIn, jobText, opts = {}) {
  const profile = normalizeResume(profileIn);
  const plan = planFor(profileIn, jobText, opts);
  const content = contentFrom(profileIn, plan);
  const before = jobMatch(resumeFromProfile(profileIn), jobText);
  const after = jobMatch(content, jobText);
  // Keywords missing from the tailored resume that the profile does have, and where.
  const findable = (after?.missing || []).map((name) => ({ name, at: locate(profile, name, jobText) })).filter((x) => x.at);
  const count = (list) => list.reduce((n, s) => n + (plan.select[s]?.length || 0), 0);
  return {
    plan,
    content,
    category: plan.academic ? "academic" : "ats",
    picked: {
      jobs: [plan.select.experience.length, profile.experience.length],
      points: [Object.entries(plan.points).filter(([id]) => plan.select.experience.includes(Number(id))).reduce((n, [, l]) => n + l.length, 0), plan.select.experience.reduce((n, id) => n + splitBullets(profile.experience.find((e) => e.id === id)?.description).length, 0)],
      projects: [plan.select.projects.length, profile.projects.length],
      other: count(["certifications", "courses", "awards", "publications", "volunteering"]),
    },
    report: { before: before?.score ?? null, after: after?.score ?? null, missing: after?.missing || [], findable },
  };
}

/** Where in the profile a keyword appears: { section, id, point? } (a point when it's in one). */
function locate(profile, name, jobText) {
  const k = jobKeywords(jobText).find((x) => x.name === name);
  if (!k) return null;
  for (const section of ["experience", "projects", "volunteering", "awards", "publications", "certifications", "courses", "education"]) {
    for (const it of profile[section]) {
      const pf = POINTS_FIELD[section];
      const line = pf ? splitBullets(it[pf]).find((l) => countAny(l, k.aliases)) : null;
      if (line) return { section, id: it.id, point: line };
      if (countAny(itemText(section, it), k.aliases)) return { section, id: it.id };
    }
  }
  if (splitList(profile.skills).some((s) => countAny(s, k.aliases))) return { section: "skills" };
  return null;
}

/** The plan with the profile's item or point for `keyword` added ("include" in the report). */
export function include(profileIn, planIn, keyword, jobText) {
  const profile = normalizeResume(profileIn);
  const at = locate(profile, keyword, jobText);
  if (!at) return planIn;
  const plan = structuredClone(planIn);
  if (at.section === "skills") {
    const have = splitList(plan.skills);
    const s = splitList(profile.skills).find((x) => countAny(x, jobKeywords(jobText).find((k) => k.name === keyword)?.aliases || [keyword]));
    if (s && !have.includes(s)) plan.skills = [s, ...have].join(", ");
    return plan;
  }
  plan.select[at.section] ||= [];
  if (!plan.select[at.section].includes(at.id)) {
    // Keep the profile's order.
    plan.select[at.section] = profile[at.section].map((it) => it.id).filter((id) => id === at.id || plan.select[at.section].includes(id));
  }
  if (at.point && POINTS_FIELD[at.section]) {
    const all = splitBullets(profile[at.section].find((it) => it.id === at.id)[POINTS_FIELD[at.section]]);
    const kept = plan.points[at.id] || (plan.select[at.section].includes(at.id) && !planIn.select[at.section]?.includes(at.id) ? [] : all);
    if (!kept.includes(at.point)) plan.points[at.id] = all.filter((l) => l === at.point || kept.includes(l));
  }
  return plan;
}
