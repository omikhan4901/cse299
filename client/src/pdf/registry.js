import { ENGINE_TEMPLATES } from "./engine/specs";

/** Template categories, in display order. */
export const CATEGORIES = [
  { id: "ats", name: "ATS-Optimized", description: "Single column, standard headings, no frills — built to pass resume scanners." },
  { id: "minimal", name: "Modern / Minimalist", description: "Clean type, lots of white space and a single accent." },
  { id: "creative", name: "Aesthetic / Creative", description: "Colour, character and bold layouts that stand out." },
  { id: "executive", name: "Executive / Corporate", description: "Formal, polished designs for senior and business roles." },
  { id: "academic", name: "Academic / Technical", description: "CVs for research, and layouts that put technical skills first." },
  { id: "student", name: "Student / Entry-Level", description: "Education and projects first — ideal for your first jobs." },
  { id: "twocol", name: "Two-Column / Compact", description: "Sidebars and columns that fit more on one page." },
];

/**
 * The original hand-built templates. `id` values match what older resumes
 * stored in resume.template, so they keep their design.
 */
const HANDMADE = [
  { id: "Classic", name: "Classic", category: "ats", description: "Centered, traditional and ATS-friendly.", accent: "#4338ca", font: "Source Serif", photo: true },
  { id: "Compact", name: "Compact ATS", category: "ats", description: "Dense, plain and built to pass resume scanners.", accent: "#0f172a", font: "Lato" },
  { id: "BasicStylish", name: "Basic Stylish", category: "minimal", description: "Crisp header strip, simple and readable.", accent: "#334155", font: "Inter" },
  { id: "MinimalistBeige", name: "Minimalist Beige", category: "minimal", description: "Warm paper tones with elegant serif type.", accent: "#8c7355", font: "Playfair Display", photo: true, columns: true },
  { id: "Creative", name: "Creative", category: "creative", description: "Bold banner with a floating contact card.", accent: "#2563eb", font: "Lato", photo: true, columns: true },
  { id: "CoolBlue", name: "Cool Blue", category: "creative", description: "Soft pastels with numbered sections.", accent: "#0f766e", font: "Montserrat", photo: true, sidebar: true },
  { id: "ClassicDark", name: "Classic Dark", category: "creative", description: "The classic layout on a dark page.", accent: "#818cf8", font: "Inter", photo: true, dark: true },
  { id: "Modern", name: "Modern", category: "twocol", description: "Dark sidebar with a clean timeline.", accent: "#4f46e5", font: "Inter", photo: true, sidebar: true },
  { id: "ModernDark", name: "Modern Dark", category: "twocol", description: "The modern sidebar layout in dark mode.", accent: "#818cf8", font: "Inter", photo: true, sidebar: true, dark: true },
  { id: "ModernGothic", name: "Modern Gothic", category: "twocol", description: "High-contrast greys with strong type.", accent: "#404040", font: "Montserrat", photo: true, sidebar: true },
];

/** Short labels used on cards and by the ATS check's layout test. */
function tagsFor(t) {
  const s = t.spec || {};
  const tags = [];
  if (t.category === "ats") tags.push("ATS");
  if (t.sidebar || s.sidebar) tags.push("Sidebar");
  else if (t.columns || s.layout === "columns") tags.push("Two column");
  else if (s.layout === "gutter") tags.push("Side headings");
  else tags.push("One column");
  if (t.photo || s.photo) tags.push("Photo");
  if (t.dark || (s.palette?.page && s.palette.page !== "#ffffff" && /^#[0-3]/.test(s.palette.page))) tags.push("Dark");
  return tags;
}

const ORDER = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));

const kebab = (id) => id.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

export const TEMPLATES = [...HANDMADE, ...ENGINE_TEMPLATES]
  .map((t) => ({ ...t, tags: tagsFor(t), slug: kebab(t.id) }))
  .sort((a, b) => ORDER[a.category] - ORDER[b.category]);

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === "Classic");

export const templateBySlug = (slug) => TEMPLATES.find((t) => t.slug === slug);

export const templatesIn = (category) => TEMPLATES.filter((t) => t.category === category);

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

// ---- Template access (which plan a template needs) ----
// Admins set a plan per category and can override single templates (settings.templates).
// Plans stack: free < pro < premium. These defaults apply until the settings load.
export const PLAN_ORDER = ["free", "pro", "premium"];
export const FREE_TEMPLATE_CATEGORIES = ["ats", "student"];
const DEFAULT_ACCESS = { categories: Object.fromEntries(CATEGORIES.map((c) => [c.id, FREE_TEMPLATE_CATEGORIES.includes(c.id) ? "free" : "pro"])), overrides: {} };

/** The plan id a template needs ("free", "pro" or "premium"). */
export const templateTier = (template, access) => {
  if (!template) return "free";
  const a = access || DEFAULT_ACCESS;
  return a.overrides?.[template.id] || a.categories?.[template.category] || DEFAULT_ACCESS.categories[template.category] || "pro";
};

/** True when a plan includes a template. */
export const planIncludes = (planId, template, access) => PLAN_ORDER.indexOf(templateTier(template, access)) <= Math.max(0, PLAN_ORDER.indexOf(planId));

/** With the default settings, whether a template needs a paid plan (used for static page text). */
export const isPremiumTemplate = (template) => templateTier(template) !== "free";

export const ACCENT_SWATCHES = ["#4338ca", "#2563eb", "#0f766e", "#007b7b", "#15803d", "#b45309", "#be123c", "#7c3aed", "#334155", "#0f172a"];

/** A varied handful shown on the home page and in the hero (one or two per category). */
export const FEATURED = ["Classic", "Harbor", "Nordic", "Aria", "Creative", "Sunset", "Studio", "Executive", "Sterling", "Scholar", "Terminal", "Fresh", "Graduate", "Modern", "Metro", "CoolBlue"]
  .map((id) => TEMPLATES.find((t) => t.id === id))
  .filter(Boolean);
