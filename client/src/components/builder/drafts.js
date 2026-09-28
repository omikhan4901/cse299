import { LIST_SECTIONS, normalizeResume, sampleResume, toPayload } from "@/lib/resume";

/** The one resume a browser keeps while it isn't saved to an account. */
export const DRAFT_KEY = "resumex:draft";

export const readDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? normalizeResume(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const writeDraft = (resume) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(resume));
  } catch {
    /* storage full (large photo) or disabled: the editor still works */
  }
};

export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
};

/** True when the resume has anything the person typed (not just a template or colours). */
export const hasRealContent = (r) => {
  if (!r) return false;
  const p = r.personal || {};
  if (["name", "title", "email", "phone", "city", "linkedin", "github", "website"].some((k) => String(p[k] || "").trim())) return true;
  if (["summary", "skills", "languages", "interests"].some((k) => String(r[k] || "").trim())) return true;
  return LIST_SECTIONS.some((k) => (r[k] || []).length > 0) || (r.customSections || []).length > 0;
};

/** The built-in example resume, unchanged (so it's not worth keeping or asking about). */
export const isUntouchedSample = (r) => {
  if (!r) return false;
  const s = sampleResume();
  return r.personal?.name === s.personal.name && r.summary === s.summary && r.personal?.email === s.personal.email;
};

/** A draft someone would be upset to lose. */
export const isWorthKeeping = (r) => hasRealContent(r) && !isUntouchedSample(r);

export const defaultNickname = (r) => {
  const name = String(r?.personal?.name || "").trim();
  const title = String(r?.personal?.title || "").trim();
  if (name) return `${name}'s resume`.slice(0, 80);
  if (title) return `${title} resume`.slice(0, 60);
  return "My resume";
};

export const draftLabel = (r) => (r?.personal?.name ? `${r.personal.name}'s resume` : "an untitled resume");

/** Downloads the resume as a .json file the user keeps (works in private sessions too). */
export function saveToFile(resume) {
  const data = { app: "resumex", version: 1, savedAt: new Date().toISOString(), resume: toPayload(resume) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  const name = (resume.personal.name || "resume").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "resume";
  a.href = url;
  a.download = `${name}.resumex.json`;
  a.click();
  URL.revokeObjectURL(url);
}
