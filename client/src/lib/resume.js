/**
 * Resume data model shared by the editor, the PDF engine and the public page.
 * Older resumes saved by the Vite app only have a subset of these fields, so
 * always pass loaded data through normalizeResume() before using it.
 */

let idCounter = 0;
export const newId = () => Date.now() * 100 + (idCounter++ % 100);

export const EMPTY_ITEMS = {
  experience: { company: "", title: "", location: "", startDate: "", endDate: "", description: "" },
  education: { institution: "", degree: "", startYear: "", endYear: "", details: "" },
  projects: { name: "", link: "", description: "" },
  certifications: { name: "", issuer: "", date: "" },
};

export const LIST_SECTIONS = Object.keys(EMPTY_ITEMS);

export const DEFAULT_THEME = { accent: "", font: "", pageSize: "A4" };

export const blankResume = () => ({
  nickname: "",
  template: "Classic",
  theme: { ...DEFAULT_THEME },
  // profilePic is the cropped photo used in the PDF; profilePicSource and photoCrop
  // keep the original and the crop settings so the photo can be re-adjusted.
  personal: { name: "", title: "", email: "", phone: "", city: "", linkedin: "", website: "", profilePic: "", profilePicSource: "", photoCrop: null },
  summary: "",
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  skills: "",
  languages: "",
});

export const sampleResume = () => ({
  ...blankResume(),
  personal: {
    name: "Jane Doe",
    title: "Full Stack Developer",
    phone: "+1 (555) 123-4567",
    email: "jane.doe@example.com",
    linkedin: "linkedin.com/in/janedoe",
    website: "janedoe.dev",
    city: "San Francisco, CA",
    profilePic: "",
  },
  summary:
    "Full stack developer with 5+ years of experience building fast, accessible web applications. I enjoy turning messy product problems into simple interfaces, and I care about clean code, good tests and teams that ship.",
  experience: [
    {
      id: 1,
      company: "AI Tech Solutions",
      title: "Lead Software Engineer",
      location: "Remote",
      startDate: "Jan 2022",
      endDate: "Present",
      description:
        "Led a team of 5 engineers building a microservice platform with React and Node.js\nCut average API latency by 40% by redesigning slow MongoDB queries and adding caching\nMentored junior engineers through code reviews and weekly pairing sessions",
    },
    {
      id: 2,
      company: "Brightlane Studio",
      title: "Frontend Developer",
      location: "San Francisco, CA",
      startDate: "Jun 2019",
      endDate: "Dec 2021",
      description:
        "Built a design system of 40+ components used across 6 product teams\nImproved Lighthouse performance scores from 58 to 94 on the marketing site",
    },
  ],
  education: [
    { id: 3, institution: "State University", degree: "B.S. Computer Science", startYear: "2015", endYear: "2019", details: "" },
  ],
  projects: [
    { id: 5, name: "OpenBoard", link: "github.com/janedoe/openboard", description: "Real-time collaborative whiteboard built with WebSockets and Canvas. 1.2k GitHub stars." },
  ],
  certifications: [{ id: 6, name: "AWS Certified Developer – Associate", issuer: "Amazon Web Services", date: "2023" }],
  skills: "React, Node.js, TypeScript, Next.js, MongoDB, Express, Tailwind CSS, AWS, Git, Agile",
  languages: "English (Native), Spanish (Professional)",
});

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function normalizeResume(input) {
  const base = blankResume();
  const data = input || {};
  const out = {
    ...base,
    ...(data._id ? { _id: data._id } : {}),
    ...(data.shortId ? { shortId: data.shortId } : {}),
    nickname: str(data.nickname),
    template: str(data.template) || "Classic",
    theme: { ...DEFAULT_THEME, ...(data.theme || {}) },
    isMaster: !!data.isMaster,
    isPublic: !!data.isPublic,
    updatedAt: data.updatedAt,
    personal: { ...base.personal },
    summary: str(data.summary),
    skills: str(data.skills),
    languages: str(data.languages),
  };
  for (const key of Object.keys(base.personal)) out.personal[key] = str(data.personal?.[key]);
  const crop = data.personal?.photoCrop;
  out.personal.photoCrop = crop && typeof crop === "object" ? crop : null;
  for (const section of LIST_SECTIONS) {
    const list = Array.isArray(data[section]) ? data[section] : [];
    out[section] = list.map((item) => {
      const clean = { id: item?.id ?? newId() };
      for (const field of Object.keys(EMPTY_ITEMS[section])) clean[field] = str(item?.[field]);
      return clean;
    });
  }
  return out;
}

/** The fields the API accepts when saving (no ids, owner or timestamps). */
export function toPayload(resume) {
  const { _id, shortId, updatedAt, isPublic, ...rest } = resume;
  return rest;
}

// ---- Helpers used by every template ----

export const splitList = (text) =>
  str(text)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

export const splitBullets = (text) =>
  str(text)
    .split("\n")
    .map((line) => line.replace(/^\s*[•\-–*]\s*/, "").trim())
    .filter(Boolean);

export const dateRange = (start, end) => [str(start).trim(), str(end).trim()].filter(Boolean).join(" – ");

/** Adds https:// for links typed without a protocol; leaves full URLs alone. */
export const toHref = (url) => {
  const u = str(url).trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  return `https://${u}`;
};

/** Shows links without the protocol so they read cleanly on paper. */
export const prettyUrl = (url) => str(url).trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

export const hasContent = (resume, section) => {
  if (section === "summary" || section === "skills" || section === "languages") return !!str(resume[section]).trim();
  if (LIST_SECTIONS.includes(section)) return (resume[section] || []).length > 0;
  return true;
};

export const fileNameFor = (resume) => {
  const base = (resume.personal?.name || resume.nickname || "Resume").trim().replace(/[^\p{L}\p{N}]+/gu, "_");
  return `${base || "Resume"}_Resume.pdf`;
};
