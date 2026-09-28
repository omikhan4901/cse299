/**
 * Operations: how new information gets into a resume (and, from V2 Phase 1, the Career
 * Profile). The AI never returns a whole resume; the server returns a list of small,
 * reviewable operations (server/lib/ingest.js), the person picks which to keep, and
 * applyOperations() puts them in. Pure functions, shared by the builder and the tests.
 *
 *   { key, op: "add",        section, item: { …fields }, bullets: [] }
 *   { key, op: "addBullets", section, target: <item id>, bullets: [] }
 *   { key, op: "update",     section, target: <item id>, item: { …fields } }
 *   { key, op: "set",        field: "personal.phone" | "summary", value }
 *   { key, op: "addValues",  field: "skills" | "languages" | "interests", values: [] }
 *
 * Each may carry `evidence` (the phrase it came from) and `flags` (see server/lib/ingest.js).
 */
import { EMPTY_ITEMS, normalizeResume, newId, splitBullets, splitList } from "../resume.js";

/** Where each section keeps its points (one per line). */
export const POINTS_FIELD = { experience: "description", projects: "description", volunteering: "description", awards: "description", publications: "description", education: "details" };

export const PERSONAL_FIELDS = ["name", "title", "email", "phone", "city", "linkedin", "github", "website"];
export const LIST_FIELDS = ["skills", "languages", "interests"];

const str = (v) => (typeof v === "string" ? v.trim() : "");
const joinPoints = (existing, bullets) => [...splitBullets(existing), ...bullets.map(str).filter(Boolean)].join("\n");

/** Copies only the fields a section has, as strings. */
const pickFields = (section, item) => Object.fromEntries(Object.keys(EMPTY_ITEMS[section]).filter((f) => str(item?.[f])).map((f) => [f, str(item[f])]));

/** The resume with the operations applied (operations that no longer fit are skipped). */
export function applyOperations(resume, operations) {
  const next = normalizeResume(structuredClone(resume));
  for (const o of operations || []) {
    if (o.op === "add" && EMPTY_ITEMS[o.section]) {
      const item = { id: newId(), ...Object.fromEntries(Object.keys(EMPTY_ITEMS[o.section]).map((f) => [f, ""])), ...pickFields(o.section, o.item) };
      const points = POINTS_FIELD[o.section];
      if (points && o.bullets?.length) item[points] = joinPoints(item[points], o.bullets);
      next[o.section] = [...next[o.section], item];
    } else if ((o.op === "update" || o.op === "addBullets") && EMPTY_ITEMS[o.section]) {
      next[o.section] = next[o.section].map((it) => {
        if (String(it.id) !== String(o.target)) return it;
        const changed = { ...it, ...(o.op === "update" ? pickFields(o.section, o.item) : {}) };
        const points = POINTS_FIELD[o.section];
        if (points && o.bullets?.length) changed[points] = joinPoints(changed[points], o.bullets);
        return changed;
      });
    } else if (o.op === "set") {
      if (o.field === "summary") next.summary = str(o.value);
      else if (o.field?.startsWith("personal.") && PERSONAL_FIELDS.includes(o.field.slice(9))) next.personal = { ...next.personal, [o.field.slice(9)]: str(o.value) };
    } else if (o.op === "addValues" && LIST_FIELDS.includes(o.field)) {
      const have = splitList(next[o.field]);
      const seen = new Set(have.map((v) => v.toLowerCase()));
      const added = (o.values || []).map(str).filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()));
      next[o.field] = [...have, ...added].join(", ");
    }
  }
  return next;
}

// ---- Describing operations for the review screen ----

const SECTION_NAMES = {
  experience: ["job", "Experience"], education: ["education", "Education"], projects: ["project", "Projects"], certifications: ["certification", "Certifications"],
  volunteering: ["volunteering role", "Volunteering"], awards: ["award", "Awards"], publications: ["publication", "Publications"], courses: ["course", "Courses"],
  references: ["reference", "References"], links: ["link", "Links"],
};
const FIELD_NAMES = { name: "Name", title: "Job title", email: "Email", phone: "Phone", city: "Location", linkedin: "LinkedIn", github: "GitHub", website: "Website", summary: "About me", skills: "Skills", languages: "Languages", interests: "Interests" };

/** A short name for an item: "Software Engineer at Pathao", "BondhuKoi", "BSc in CSE, NSU". */
export function itemLabel(section, it) {
  if (!it) return "";
  const dates = [it.startDate || it.startYear, it.endDate || it.endYear || it.date].filter(Boolean).join(" – ");
  const main =
    section === "experience" ? [it.title, it.company].filter(Boolean).join(" at ")
    : section === "education" ? [it.degree, it.institution].filter(Boolean).join(", ")
    : section === "volunteering" ? [it.role, it.organization].filter(Boolean).join(" at ")
    : section === "links" ? it.label || it.url
    : it.name || it.title || "";
  return [main || "Untitled", dates ? `(${dates})` : ""].filter(Boolean).join(" ");
}

/** { title, detail } for one operation, in plain words. */
export function describeOperation(o, resume) {
  const [one] = SECTION_NAMES[o.section] || ["item"];
  const target = o.target != null ? resume?.[o.section]?.find((it) => String(it.id) === String(o.target)) : null;
  const points = (o.bullets || []).filter(Boolean);
  switch (o.op) {
    case "add":
      return { title: `New ${one}: ${itemLabel(o.section, o.item)}`, detail: points };
    case "addBullets":
      return { title: `Add ${points.length} point${points.length === 1 ? "" : "s"} to ${itemLabel(o.section, target)}`, detail: points };
    case "update": {
      const changes = Object.entries(pickFields(o.section, o.item)).map(([f, v]) => `${f.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`);
      return { title: `Update ${itemLabel(o.section, target)}`, detail: [...changes, ...points] };
    }
    case "set": {
      const f = o.field === "summary" ? "summary" : o.field?.slice(9);
      return { title: `${FIELD_NAMES[f] || f}: ${f === "summary" ? "" : o.value}`.replace(/: $/, ""), detail: f === "summary" ? [o.value] : [] };
    }
    case "addValues":
      return { title: `Add ${o.values.length} ${FIELD_NAMES[o.field]?.toLowerCase() || o.field}`, detail: [o.values.join(", ")] };
    default:
      return { title: "Change", detail: [] };
  }
}

/**
 * A compact outline of the resume for the model: ids, names, dates and the first few
 * points of each item, so it can attach new information to the right place without
 * receiving the whole document.
 */
export function outlineOf(resume) {
  const r = normalizeResume(resume);
  const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const out = { personal: Object.fromEntries(PERSONAL_FIELDS.filter((f) => r.personal[f]).map((f) => [f, r.personal[f]])) };
  if (r.summary) out.summary = clip(r.summary, 300);
  for (const section of Object.keys(SECTION_NAMES)) {
    if (!r[section].length) continue;
    out[section] = r[section].map((it) => {
      const o = { id: String(it.id), ...pickFields(section, it) };
      const pf = POINTS_FIELD[section];
      if (pf && it[pf]) {
        delete o[pf];
        o.points = splitBullets(it[pf]).slice(0, 6).map((b) => clip(b, 90));
      }
      return o;
    });
  }
  for (const f of LIST_FIELDS) if (r[f]) out[f] = r[f];
  return out;
}
