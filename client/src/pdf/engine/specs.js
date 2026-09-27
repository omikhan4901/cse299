/**
 * Engine-built templates. Each spec is a different combination of layout,
 * header, heading style, typography, palette, skill display, bullets, date
 * placement, decoration and section order (see Engine.jsx for the options).
 */
const EDU_FIRST = ["summary", "education", "projects", "experience", "skills", "certifications", "languages"];
const TECH = ["summary", "skills", "experience", "projects", "education", "certifications", "languages"];

export const ENGINE_TEMPLATES = [
  // ---------------- ATS-Optimized ----------------
  { id: "Harbor", name: "Harbor", category: "ats", description: "Left-aligned and quietly confident.", accent: "#1d4ed8", font: "Roboto",
    spec: { header: "left", heading: "rule", contactStyle: "dots", skills: "inline", bullet: "dot", nameSize: 24 } },
  { id: "Ledger", name: "Ledger", category: "ats", description: "Garamond with double rules — timeless.", accent: "#111827", font: "EB Garamond",
    spec: { header: "center", headerRule: true, heading: "double", contactStyle: "dots", skills: "inline", bullet: "dash", nameSize: 26, titleCase: "upper" } },
  { id: "Clearline", name: "Clearline", category: "ats", description: "Split header and crisp accent headings.", accent: "#0f766e", font: "Lato",
    spec: { header: "split", heading: "caps", skills: "grid3", bullet: "square", contactStyle: "icons" } },
  { id: "Standard", name: "Standard", category: "ats", description: "Serif body, sans headings, zero fuss.", accent: "#7c2d12", font: "Source Serif",
    spec: { header: "minimal", heading: "rule-above", headingFont: "Inter", bodyFont: "Source Serif", contactStyle: "dots", skills: "inline", bullet: "dot", nameSize: 22 } },
  { id: "Keystone", name: "Keystone", category: "ats", description: "Underlined headings with dates beneath.", accent: "#4338ca", font: "Raleway",
    spec: { header: "left", headerRule: true, heading: "underline", dates: "below", skills: "grid", bullet: "dot" } },
  { id: "Summit", name: "Summit", category: "ats", description: "Dense and scannable, company first.", accent: "#0369a1", font: "Inter",
    spec: { density: "compact", header: "center", heading: "dotted", contactStyle: "dots", companyFirst: true, skills: "inline", bullet: "dot", nameSize: 22 } },

  // ---------------- Modern / Minimalist ----------------
  { id: "Nordic", name: "Nordic", category: "minimal", description: "Side headings and generous white space.", accent: "#64748b", font: "Inter",
    spec: { layout: "gutter", density: "airy", header: "minimal", heading: "caps", contactStyle: "dots", skills: "inline", bullet: "dash", nameSize: 22, nameWeight: 500, palette: { heading: "#334155", headingAccent: "#64748b" } } },
  { id: "Mono", name: "Mono", category: "minimal", description: "Monospaced headings, numbered sections.", accent: "#111827", font: "Inter",
    spec: { header: "left", heading: "number", headingFont: "JetBrains Mono", nameFont: "JetBrains Mono", headingCase: "none", skills: "outline", bullet: "dash", nameSize: 22, titleColor: "#6b7280" } },
  { id: "Aria", name: "Aria", category: "minimal", description: "Centred, airy and softly elegant.", accent: "#0d9488", font: "Raleway",
    spec: { density: "airy", header: "center", heading: "center", contactStyle: "dots", skills: "inline", bullet: "ring", nameSize: 26, nameWeight: 500 } },
  { id: "Folio", name: "Folio", category: "minimal", description: "Stacked name with a single accent colour.", accent: "#e11d48", font: "Poppins",
    spec: { density: "airy", header: "stack", heading: "short", skills: "inline", bullet: "dash", nameSize: 28, contactStyle: "icons" } },
  { id: "Slate", name: "Slate", category: "minimal", description: "Grey tones, accent bars, outlined skills.", accent: "#475569", font: "Montserrat",
    spec: { header: "underline", heading: "bar", skills: "outline", bullet: "square", nameSize: 24, palette: { text: "#475569", heading: "#1e293b" } } },

  // ---------------- Aesthetic / Creative ----------------
  { id: "Blush", name: "Blush", category: "creative", description: "Rosy page, pill headings, a photo up top.", accent: "#db2777", font: "Poppins",
    spec: { header: "band", bandBg: "accentTint", bandText: "accentDark", heading: "pill", skills: "chips", bullet: "diamond", photo: "circle", initials: true, palette: { page: "#fff7fa", rule: "#fbcfe8" } } },
  { id: "Midnight", name: "Midnight", category: "creative", description: "Dark page with a neon accent.", accent: "#22d3ee", font: "Raleway",
    spec: { header: "monogram", heading: "caps", skills: "outline", bullet: "chevron", monogramRound: true, palette: { page: "#0f172a", text: "#cbd5e1", muted: "#94a3b8", heading: "#f8fafc", name: "#f8fafc", rule: "#334155" } } },
  { id: "Sunset", name: "Sunset", category: "creative", description: "Warm circles and a serif headline.", accent: "#ea580c", font: "Lato",
    spec: { header: "left", heading: "underline", headingFont: "Playfair Display", nameFont: "Playfair Display", headingCase: "none", headingSize: 3, skills: "chips", bullet: "dot", photo: "circle", decor: { circles: true }, nameSize: 30 } },
  { id: "Studio", name: "Studio", category: "creative", description: "Colour sidebar on the right, bold type.", accent: "#7c3aed", font: "Roboto",
    spec: { header: "none", heading: "tab", headingFont: "Oswald", nameFont: "Oswald", photo: "rounded", initials: true, nameCase: "upper", skills: "chips",
      sidebar: { side: "right", bg: "accent", text: "#f5f3ff", muted: "#ddd6fe", heading: "#ffffff", rule: "#8b5cf6", accent: "#ffffff" }, sideHeading: "rule", sideSkills: "bullets",
      sideOrder: ["contact", "skills", "languages", "interests"], bullet: "square" } },

  // ---------------- Executive / Corporate ----------------
  { id: "Executive", name: "Executive", category: "executive", description: "Navy masthead with gold accents.", accent: "#b08d57", font: "EB Garamond",
    spec: { header: "band", bandBg: "#0b2545", bandText: "#ffffff", heading: "double", nameSize: 30, titleCase: "upper", skills: "inline", bullet: "square", palette: { heading: "#0b2545" } } },
  { id: "Boardroom", name: "Boardroom", category: "executive", description: "Burgundy, centred and formal.", accent: "#7f1d1d", font: "Merriweather",
    spec: { header: "center", headerRule: true, heading: "center", contactStyle: "dots", skills: "grid3", bullet: "square", nameSize: 25, titleCase: "upper" } },
  { id: "Sterling", name: "Sterling", category: "executive", description: "Light sidebar, corporate blue.", accent: "#1e3a8a", font: "Roboto",
    spec: { header: "left", heading: "rule", sidebar: { side: "left", bg: "#f1f5f9", text: "#334155", muted: "#64748b", heading: "#1e3a8a", rule: "#cbd5e1", accent: "#1e3a8a", width: "30%" },
      sideOrder: ["skills", "languages", "certifications"], sideSkills: "bullets", sideHeading: "rule", bullet: "dot", contactStyle: "icons" } },
  { id: "Capital", name: "Capital", category: "executive", description: "Boxed header and strong green bars.", accent: "#065f46", font: "Source Serif",
    spec: { header: "boxed", boxAccentEdge: true, boxRadius: 0, heading: "bar", headingFont: "Montserrat", nameFont: "Montserrat", bodyFont: "Source Serif", skills: "chips", chipRadius: 2, bullet: "square" } },
  { id: "Regent", name: "Regent", category: "executive", description: "Stately serif name, dates in the margin.", accent: "#3f3f46", font: "Lato",
    spec: { header: "stack", heading: "rule-above", headingFont: "Playfair Display", nameFont: "Playfair Display", dates: "left", skills: "inline", bullet: "dash", nameSize: 30 } },
  { id: "Prestige", name: "Prestige", category: "executive", description: "Bronze top strip, split masthead.", accent: "#92400e", font: "EB Garamond",
    spec: { header: "split", heading: "caps", skills: "inline", bullet: "diamond", decor: { topStrip: 7 }, nameSize: 28 } },
  { id: "Chairman", name: "Chairman", category: "executive", description: "Two measured columns for senior profiles.", accent: "#111827", font: "Source Serif",
    spec: { layout: "columns", split: "67%", divider: true, header: "center", headerRule: true, heading: "double", contactStyle: "dots", nameSize: 26, titleCase: "upper",
      sideOrder: ["skills", "certifications", "languages"], skills: "bullets", bullet: "square" } },

  // ---------------- Academic / Technical ----------------
  { id: "Scholar", name: "Scholar", category: "academic", description: "Academic CV with side headings.", accent: "#1e3a8a", font: "EB Garamond",
    spec: { layout: "gutter", gutter: "22%", header: "center", heading: "caps", contactStyle: "dots", order: EDU_FIRST, titles: { projects: "Research" }, dates: "below", skills: "inline", bullet: "dash", nameSize: 26 } },
  { id: "Research", name: "Research", category: "academic", description: "Publication-friendly and precise.", accent: "#334155", font: "Source Serif",
    spec: { header: "left", headerRule: true, heading: "rule", order: ["summary", "education", "experience", "projects", "certifications", "skills", "languages"], titles: { projects: "Research Projects", summary: "Research Interests" }, skills: "inline", bullet: "dash" } },
  { id: "Terminal", name: "Terminal", category: "academic", description: "Monospace everything, for engineers.", accent: "#16a34a", font: "JetBrains Mono",
    spec: { density: "compact", header: "minimal", heading: "number", headingCase: "none", order: TECH, skills: "grid3", bullet: "chevron", nameSize: 20, contactStyle: "dots" } },
  { id: "Engineer", name: "Engineer", category: "academic", description: "Skills up top, boxed section headers.", accent: "#0369a1", font: "Roboto",
    spec: { header: "split", heading: "boxed", order: TECH, skills: "outline", bullet: "square" } },
  { id: "Lab", name: "Lab", category: "academic", description: "Two columns with a violet accent.", accent: "#9333ea", font: "Inter",
    spec: { layout: "columns", split: "63%", header: "underline", heading: "short", sideOrder: ["skills", "certifications", "languages", "interests"], skills: "chips", bullet: "dot" } },
  { id: "Thesis", name: "Thesis", category: "academic", description: "Olive, centred and scholarly.", accent: "#4d7c0f", font: "Merriweather",
    spec: { density: "airy", header: "center", heading: "center", order: EDU_FIRST, contactStyle: "dots", skills: "inline", bullet: "ring", nameSize: 24 } },
  { id: "Syntax", name: "Syntax", category: "academic", description: "Dark code-editor sidebar, amber accent.", accent: "#f59e0b", font: "Inter",
    spec: { header: "none", heading: "bar", headingFont: "JetBrains Mono", headingCase: "none", sidebar: { side: "left", bg: "#111827", text: "#d1d5db", muted: "#9ca3af", heading: "#fbbf24", rule: "#374151", accent: "#fbbf24", align: "left" },
      sideHeading: "rule", sideSkills: "outline", sideOrder: ["contact", "skills", "languages", "certifications"], order: TECH, bullet: "chevron", initials: true, photo: "rounded" } },

  // ---------------- Student / Entry-Level ----------------
  { id: "Fresh", name: "Fresh", category: "student", description: "Friendly box header and pill headings.", accent: "#0891b2", font: "Poppins",
    spec: { header: "boxed", boxRadius: 10, heading: "pill", order: EDU_FIRST, skills: "chips", bullet: "dot", photo: "circle", initials: true } },
  { id: "Campus", name: "Campus", category: "student", description: "Pastel sidebar, education first.", accent: "#0e7490", font: "Lato",
    spec: { header: "none", heading: "underline", headingCase: "none", headingSize: 2.4, order: EDU_FIRST, photo: "circle", initials: true,
      sidebar: { side: "left", bg: "#ecfeff", text: "#155e75", muted: "#0e7490", heading: "#164e63", rule: "#a5f3fc", accent: "#0891b2" }, sideHeading: "rule", sideSkills: "bullets",
      sideOrder: ["contact", "skills", "languages", "interests"], bullet: "dot" } },
  { id: "Launch", name: "Launch", category: "student", description: "Accent edge strip and chevron bullets.", accent: "#4f46e5", font: "Montserrat",
    spec: { header: "left", heading: "bar", order: ["summary", "education", "projects", "experience", "skills", "certifications", "languages"], skills: "chips", bullet: "chevron", decor: { sideStrip: 8 } } },
  { id: "Starter", name: "Starter", category: "student", description: "Compact one-pager for first jobs.", accent: "#0f766e", font: "Lato",
    spec: { density: "compact", header: "center", heading: "rule", contactStyle: "dots", order: ["summary", "education", "skills", "projects", "experience", "certifications", "languages"], skills: "grid3", bullet: "dot", nameSize: 22 } },
  { id: "Graduate", name: "Graduate", category: "student", description: "Blue banner with your photo.", accent: "#1d4ed8", font: "Raleway",
    spec: { header: "band", heading: "caps", order: ["summary", "education", "experience", "projects", "skills", "certifications", "languages"], skills: "chips", bullet: "dot", photo: "circle", initials: true, initialsBg: "#ffffff" } },
  { id: "Intern", name: "Intern", category: "student", description: "Round monogram, two tidy columns.", accent: "#e11d48", font: "Poppins",
    spec: { layout: "columns", split: "60%", divider: true, header: "monogram", monogramRound: true, heading: "short", order: EDU_FIRST, sideOrder: ["skills", "languages", "certifications", "interests"], skills: "chips", bullet: "dot" } },
  { id: "Spark", name: "Spark", category: "student", description: "Playful circles and numbered sections.", accent: "#d97706", font: "Poppins",
    spec: { header: "stack", heading: "number", order: EDU_FIRST, skills: "solid", bullet: "diamond", decor: { circles: true }, nameSize: 28 } },

  // ---------------- Two-Column / Compact ----------------
  { id: "Split", name: "Split", category: "twocol", description: "Right-hand panel, fits more on a page.", accent: "#2563eb", font: "Inter",
    spec: { density: "compact", header: "left", heading: "rule", sidebar: { side: "right", bg: "#f8fafc", text: "#334155", muted: "#64748b", heading: "#0f172a", rule: "#e2e8f0", accent: "#2563eb", width: "31%" },
      sideHeading: "rule", sideSkills: "chips", sideOrder: ["skills", "education", "languages", "certifications"], bullet: "dot", contactStyle: "icons" } },
  { id: "Duo", name: "Duo", category: "twocol", description: "Balanced columns in charcoal.", accent: "#0f172a", font: "Roboto",
    spec: { density: "compact", layout: "columns", split: "58%", divider: true, header: "split", heading: "caps", sideOrder: ["skills", "education", "certifications", "languages"], skills: "outline", bullet: "square" } },
  { id: "Metro", name: "Metro", category: "twocol", description: "Bold teal sidebar with square photo.", accent: "#0d9488", font: "Montserrat",
    spec: { header: "none", heading: "boxed", photo: "square", initials: true, initialsBg: "#ffffff", sidebar: { side: "left", bg: "accent", text: "#f0fdfa", muted: "#ccfbf1", heading: "#ffffff", rule: "#5eead4", accent: "#ffffff" },
      sideHeading: "rule", sideSkills: "bullets", sideOrder: ["contact", "skills", "languages", "certifications"], bullet: "square" } },
  { id: "Dense", name: "Dense", category: "twocol", description: "Maximum content, still readable.", accent: "#7c2d12", font: "Source Serif",
    spec: { density: "compact", layout: "columns", split: "66%", header: "minimal", heading: "dotted", contactStyle: "dots", sideOrder: ["skills", "languages", "certifications", "education"], skills: "bullets", bullet: "dash", nameSize: 20 } },
];
