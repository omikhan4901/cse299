/**
 * Template catalogue. `id` values match what the old app stored in
 * resume.template, so existing resumes keep their design.
 */
export const TEMPLATES = [
  { id: "Classic", name: "Classic", description: "Centered, traditional and ATS-friendly.", accent: "#4338ca", font: "Source Serif", tags: ["ATS", "One column"] },
  { id: "Modern", name: "Modern", description: "Dark sidebar with a clean timeline.", accent: "#4f46e5", font: "Inter", tags: ["Sidebar", "Photo"] },
  { id: "Creative", name: "Creative", description: "Bold banner with a floating contact card.", accent: "#2563eb", font: "Lato", tags: ["Photo", "Two column"] },
  { id: "CoolBlue", name: "Cool Blue", description: "Soft pastels with numbered sections.", accent: "#0f766e", font: "Montserrat", tags: ["Sidebar", "Photo"] },
  { id: "BasicStylish", name: "Basic Stylish", description: "Crisp header strip, simple and readable.", accent: "#334155", font: "Inter", tags: ["ATS", "One column"] },
  { id: "MinimalistBeige", name: "Minimalist Beige", description: "Warm paper tones with elegant serif type.", accent: "#8c7355", font: "Playfair Display", tags: ["Photo", "Two column"] },
  { id: "ModernGothic", name: "Modern Gothic", description: "High-contrast greys with strong type.", accent: "#404040", font: "Montserrat", tags: ["Sidebar", "Photo"] },
  { id: "ClassicDark", name: "Classic Dark", description: "The classic layout on a dark page.", accent: "#818cf8", font: "Inter", tags: ["Dark"] },
  { id: "ModernDark", name: "Modern Dark", description: "The modern sidebar layout in dark mode.", accent: "#818cf8", font: "Inter", tags: ["Dark", "Sidebar"] },
  { id: "Compact", name: "Compact ATS", description: "Dense, plain and built to pass resume scanners.", accent: "#0f172a", font: "Lato", tags: ["ATS", "New"] },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

export const ACCENT_SWATCHES = ["#4338ca", "#2563eb", "#0f766e", "#007b7b", "#15803d", "#b45309", "#be123c", "#7c3aed", "#334155", "#0f172a"];
