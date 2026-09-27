import { Font } from "@react-pdf/renderer";

/** Font families bundled in /public/fonts (WOFF files from Google Fonts). */
export const FONT_FILES = {
  Inter: { 400: "inter-400", 500: "inter-500", 700: "inter-700", italic: "inter-400-italic" },
  Lato: { 400: "lato-400", 700: "lato-700", italic: "lato-400-italic" },
  Montserrat: { 400: "montserrat-400", 500: "montserrat-500", 700: "montserrat-700", italic: "montserrat-400-italic" },
  Merriweather: { 400: "merriweather-400", 700: "merriweather-700", italic: "merriweather-400-italic" },
  "Playfair Display": { 400: "playfair-400", 700: "playfair-700", italic: "playfair-400-italic" },
  "Source Serif": { 400: "sourceserif-400", 700: "sourceserif-700", italic: "sourceserif-400-italic" },
};

export const FONT_OPTIONS = [
  { value: "", label: "Template default" },
  ...Object.keys(FONT_FILES).map((f) => ({ value: f, label: f })),
];

let registeredBase = null;

/**
 * Registers every family with react-pdf. `base` is a URL prefix in the browser
 * ("/fonts") or an absolute directory when rendering from Node.
 */
export function registerFonts(base = "/fonts") {
  if (registeredBase === base) return;
  registeredBase = base;
  for (const [family, files] of Object.entries(FONT_FILES)) {
    const fonts = [];
    for (const [key, file] of Object.entries(files)) {
      const src = `${base}/${file}.woff`;
      if (key === "italic") fonts.push({ src, fontStyle: "italic", fontWeight: 400 });
      else fonts.push({ src, fontWeight: Number(key) });
    }
    // Map missing weights to the closest file so bold/medium text never falls back to Helvetica.
    if (!files[500]) fonts.push({ src: `${base}/${files[400]}.woff`, fontWeight: 500 });
    fonts.push({ src: `${base}/${files[700]}.woff`, fontWeight: 600 });
    fonts.push({ src: `${base}/${files[700]}.woff`, fontWeight: 800 });
    fonts.push({ src: `${base}/${files.italic}.woff`, fontStyle: "italic", fontWeight: 700 });
    Font.register({ family, fonts });
  }
  // Word hyphenation looks broken on a resume, so keep words whole.
  Font.registerHyphenationCallback((word) => [word]);
}
