/**
 * The Career Profile (V2) and the resumes made from it. Pure functions, shared by the
 * pages and the server tests.
 *
 * A profile has the same content shape as a resume. A resume made from it copies the
 * items it needs and remembers each one's `profileItemId`, so the two can be synced later
 * with reviewable operations (the same format and review screen as the import):
 *   pullUpdates(resume, profile)   → operations on the resume ("3 updates from your profile")
 *   saveToProfile(resume, profile) → operations on the profile (keep good rewrites)
 * Items made before that link existed are matched by what they are (same employer, school…).
 */
import { CONTENT_KEYS, EMPTY_ITEMS, LIST_SECTIONS, newId, normalizeResume, splitBullets, splitList } from "./resume.js";
import { LIST_FIELDS, PERSONAL_FIELDS, POINTS_FIELD } from "./ingest/ops.js";
import { contentChecks } from "./ats/analyze.js";

// ---- Matching ----

const FILLER = new Set(["in", "of", "the", "and", "at", "on", "for", "a", "an"]);
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}+#]+/gu, " ").trim();
const words = (s) => norm(s).split(" ").filter((w) => w && !FILLER.has(w));

/** True when the shorter text's words are (almost) all in the other: "Pathao" ≈ "Pathao Ltd.". */
export function similar(a, b, threshold = 0.8) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return false;
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared / Math.min(A.size, B.size) >= threshold;
}

const stem = (w) => (w.length > 3 ? w.replace(/(ies|es|s|ed|ing)$/, "") : w);
/**
 * How much of the shorter point's wording is in the other (0–1), for "is this the same
 * point, reworded or extended?". Points of fewer than two words never count as a rewording.
 */
export function overlap(a, b) {
  const A = new Set(words(a).map(stem));
  const B = new Set(words(b).map(stem));
  if (A.size < 2 || B.size < 2) return 0;
  return [...A].filter((w) => B.has(w)).length / Math.min(A.size, B.size);
}

// "BA in English" and "MA in English" are different degrees.
const LEVELS = new Set(["ssc", "hsc", "ba", "bs", "bsc", "bss", "bba", "bcom", "beng", "llb", "mbbs", "ma", "ms", "msc", "mss", "mba", "mcom", "meng", "llm", "mphil", "phd", "diploma"]);
const levelOf = (degree) => norm(String(degree || "").replace(/\./g, "")).split(" ").find((w) => LEVELS.has(w));

// What identifies an item in each section: [main field, second field].
const KEY = {
  experience: ["company", "title"], education: ["institution", "degree"], projects: ["name"], certifications: ["name", "issuer"],
  volunteering: ["organization", "role"], awards: ["title", "issuer"], publications: ["title"], courses: ["name"], references: ["name"], links: ["url", "label"],
};

/** Whether two items of a section are the same thing (the same job, school, project…). */
export function sameItem(section, a, b) {
  const [main, second] = KEY[section] || ["name"];
  if (!a?.[main] || !b?.[main] || !similar(a[main], b[main])) return false;
  if (section === "education" && a.degree && b.degree) {
    const [x, y] = [levelOf(a.degree), levelOf(b.degree)];
    if (x && y) return x === y;
  }
  return !second || !a[second] || !b[second] || similar(a[second], b[second], 0.6);
}

/** The profile item a resume item stands for (by its link, else by what it is). */
export const profileItemFor = (section, item, profile) =>
  profile[section].find((p) => item.profileItemId != null && p.id === item.profileItemId) ||
  profile[section].find((p) => item.profileItemId == null && sameItem(section, item, p)) ||
  null;

// ---- Making one from the other ----

const content = (r) => Object.fromEntries(CONTENT_KEYS.map((k) => [k, r[k]]));
const hasText = (item) => Object.entries(item).some(([k, v]) => k !== "id" && k !== "profileItemId" && typeof v === "string" && v.trim());

/** A new profile from a resume's content (fresh ids; empty items left out). */
export function profileFromResume(resume) {
  const r = normalizeResume(resume);
  const out = content(r);
  for (const s of LIST_SECTIONS) out[s] = r[s].filter(hasText).map(({ profileItemId, ...it }) => ({ ...it, id: newId() }));
  out.customSections = r.customSections.map((sec) => ({ ...sec, id: newId(), items: sec.items.filter(hasText).map((it) => ({ ...it, id: newId() })) }));
  out.summaries = [];
  return out;
}

/**
 * Resume content made from the profile. Every item remembers where it came from.
 * `select` (optional, for tailoring): { [section]: [profile item ids] } keeps only those
 * items, in that order; `points`: { [profile item id]: [points] } keeps only those points;
 * `summary`: the text to use.
 */
export function resumeFromProfile(profile, { select, points, summary } = {}) {
  const p = normalizeResume(profile);
  const out = content(p);
  for (const s of LIST_SECTIONS) {
    const chosen = select?.[s] ? select[s].map((id) => p[s].find((it) => it.id === id)).filter(Boolean) : p[s];
    out[s] = chosen.map((it) => {
      const copy = { ...it, id: newId(), profileItemId: it.id };
      const pf = POINTS_FIELD[s];
      if (pf && points?.[it.id]) copy[pf] = points[it.id].join("\n");
      return copy;
    });
  }
  out.customSections = p.customSections.map((sec) => ({ ...sec, id: newId(), items: sec.items.map((it) => ({ ...it, id: newId() })) }));
  if (typeof summary === "string") out.summary = summary;
  return out;
}

// ---- Syncing ----

const fieldsOf = (section) => Object.keys(EMPTY_ITEMS[section]).filter((f) => f !== POINTS_FIELD[section]);
// Two points sharing this much wording are one point, reworded.
const REWORDED = 0.6;
const numberKeys = (ops) => ops.map((o, i) => ({ ...o, key: `s${i + 1}` }));
const replaces = (fields) => (fields.length ? { flags: [{ kind: "replaces", fields }] } : {});

/**
 * What changed in the profile since this resume was made, for the items the resume has.
 * Only additions and changed details: a resume is a selection, so items and points it
 * left out are never pushed back in, and its own rewording is never overwritten.
 */
export function pullUpdates(resumeIn, profileIn) {
  const resume = normalizeResume(resumeIn);
  const profile = normalizeResume(profileIn);
  const ops = [];
  for (const f of PERSONAL_FIELDS) {
    const want = profile.personal[f];
    if (want && norm(want) !== norm(resume.personal[f])) ops.push({ op: "set", field: `personal.${f}`, value: want, ...replaces(resume.personal[f] ? [`personal.${f}`] : []) });
  }
  for (const s of LIST_SECTIONS) {
    for (const item of resume[s]) {
      const source = profileItemFor(s, item, profile);
      if (!source) continue;
      // Matched by name rather than by link: the two may just name it differently, so the
      // naming fields are left as they are.
      const keep = item.profileItemId == null ? KEY[s] || [] : [];
      const changed = Object.fromEntries(fieldsOf(s).filter((f) => !keep.includes(f) && source[f] && source[f] !== item[f]).map((f) => [f, source[f]]));
      const pf = POINTS_FIELD[s];
      const have = pf ? splitBullets(item[pf]) : [];
      const fresh = pf ? splitBullets(source[pf]).filter((b) => !have.some((h) => norm(h) === norm(b) || overlap(h, b) >= REWORDED)) : [];
      if (Object.keys(changed).length) {
        ops.push({ op: "update", section: s, target: item.id, item: changed, bullets: fresh, ...replaces(Object.keys(changed).filter((f) => item[f])) });
      } else if (fresh.length) {
        ops.push({ op: "addBullets", section: s, target: item.id, bullets: fresh });
      }
    }
  }
  return numberKeys(ops);
}

/**
 * What this resume has that the profile doesn't: new items, new or reworded points,
 * changed details and new skills, as operations on the profile.
 */
export function saveToProfile(resumeIn, profileIn) {
  const resume = normalizeResume(resumeIn);
  const profile = normalizeResume(profileIn);
  const ops = [];
  for (const f of PERSONAL_FIELDS) {
    const v = resume.personal[f];
    if (v && norm(v) !== norm(profile.personal[f])) ops.push({ op: "set", field: `personal.${f}`, value: v, ...replaces(profile.personal[f] ? [`personal.${f}`] : []) });
  }
  const known = [profile.summary, ...(profileIn?.summaries || []).map((x) => x?.text)].map(norm);
  if (resume.summary && !known.includes(norm(resume.summary))) ops.push({ op: "set", field: "summary", value: resume.summary, ...replaces(profile.summary ? ["summary"] : []) });

  for (const s of LIST_SECTIONS) {
    const pf = POINTS_FIELD[s];
    for (const item of resume[s].filter(hasText)) {
      const target = profileItemFor(s, item, profile);
      const lines = pf ? splitBullets(item[pf]) : [];
      if (!target) {
        ops.push({ op: "add", section: s, item: Object.fromEntries(fieldsOf(s).filter((f) => item[f]).map((f) => [f, item[f]])), bullets: lines });
        continue;
      }
      const changed = Object.fromEntries(fieldsOf(s).filter((f) => item[f] && item[f] !== target[f]).map((f) => [f, item[f]]));
      const theirs = pf ? splitBullets(target[pf]) : [];
      const added = [];
      const reworded = [];
      const used = new Set();
      for (const line of lines) {
        const same = theirs.findIndex((t, i) => !used.has(i) && norm(t) === norm(line));
        if (same >= 0) {
          used.add(same);
          continue;
        }
        // The closest point of theirs not already matched: a rewording of it, or something new.
        let best = null;
        let score = 0;
        theirs.forEach((t, i) => {
          const o = overlap(t, line);
          if (!used.has(i) && o > score) [best, score] = [i, o];
        });
        if (best !== null && score >= REWORDED) {
          used.add(best);
          if (norm(theirs[best]) !== norm(line)) reworded.push({ from: theirs[best], to: line });
        } else added.push(line);
      }
      if (Object.keys(changed).length) ops.push({ op: "update", section: s, target: target.id, item: changed, bullets: added, ...replaces(Object.keys(changed).filter((f) => target[f])) });
      else if (added.length) ops.push({ op: "addBullets", section: s, target: target.id, bullets: added });
      for (const r of reworded) ops.push({ op: "replaceBullet", section: s, target: target.id, ...r });
    }
  }
  for (const f of LIST_FIELDS) {
    const have = new Set(splitList(profile[f]).map(norm));
    const values = splitList(resume[f]).filter((v) => !have.has(norm(v)));
    if (values.length) ops.push({ op: "addValues", field: f, values });
  }
  return numberKeys(ops);
}

// ---- Profile health ----

// Checks about one printed page don't apply to a profile, which is meant to hold everything.
const NOT_FOR_PROFILE = new Set(["words"]);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * How complete the profile is (0–100) and what to add next, most useful first: what's
 * missing (60%), then the quality of the points, from the same checks as the ATS check (40%).
 */
export function profileHealth(profileIn) {
  const p = normalizeResume(profileIn);
  const undated = p.experience.filter((e) => (e.company || e.title) && !e.startDate).length;
  const skills = splitList(p.skills).length;
  const coverage = [
    [!!p.personal.name, "Add your name"],
    [!!p.personal.email, "Add your email"],
    [!!p.personal.phone, "Add your phone number"],
    [!!p.personal.city, "Add where you're based"],
    [!!p.summary.trim(), "Write a short summary about yourself"],
    [p.experience.length + p.projects.length > 0, "Add a job or a project"],
    [p.education.length > 0, "Add your education"],
    [skills >= 5, skills ? `List at least 5 skills (you have ${skills})` : "List your skills"],
    [!undated, `Add dates to ${plural(undated, "job")}`],
  ];
  const bullets = [...p.experience, ...p.projects, ...p.volunteering].some((e) => splitBullets(e.description).length);
  const checks = bullets ? contentChecks({ resume: p }).filter((c) => !NOT_FOR_PROFILE.has(c.id)) : [];
  const weight = checks.reduce((s, c) => s + c.weight, 0);
  const quality = weight ? checks.reduce((s, c) => s + c.points * c.weight, 0) / weight : 0;
  const covered = coverage.filter(([ok]) => ok).length / coverage.length;
  const score = Math.round(covered * 60 + quality * 40);
  const todo = [
    ...coverage.filter(([ok]) => !ok).map(([, label], i) => ({ id: `missing-${i}`, label, status: "fail" })),
    ...checks.filter((c) => c.status !== "pass").sort((a, b) => b.weight - a.weight || a.points - b.points).map((c) => ({ id: c.id, label: c.label, detail: c.detail, status: c.status })),
  ];
  return { score, todo, checks };
}
