import { Font } from "@react-pdf/renderer";

/** Font families bundled in /public/fonts (WOFF files from Google Fonts). */
export const FONT_FILES = {
  Inter: { 400: "inter-400", 500: "inter-500", 700: "inter-700", italic: "inter-400-italic" },
  Lato: { 400: "lato-400", 700: "lato-700", italic: "lato-400-italic" },
  Montserrat: { 400: "montserrat-400", 500: "montserrat-500", 700: "montserrat-700", italic: "montserrat-400-italic" },
  Merriweather: { 400: "merriweather-400", 700: "merriweather-700", italic: "merriweather-400-italic" },
  "Playfair Display": { 400: "playfair-400", 700: "playfair-700", italic: "playfair-400-italic" },
  "Source Serif": { 400: "sourceserif-400", 700: "sourceserif-700", italic: "sourceserif-400-italic" },
  Roboto: { 400: "roboto-400", 500: "roboto-500", 700: "roboto-700", italic: "roboto-400-italic" },
  Raleway: { 400: "raleway-400", 500: "raleway-500", 700: "raleway-700", italic: "raleway-400-italic" },
  Poppins: { 400: "poppins-400", 500: "poppins-500", 700: "poppins-700", italic: "poppins-400-italic" },
  "EB Garamond": { 400: "ebgaramond-400", 500: "ebgaramond-500", 700: "ebgaramond-700", italic: "ebgaramond-400-italic" },
  "JetBrains Mono": { 400: "jetbrains-400", 500: "jetbrains-500", 700: "jetbrains-700", italic: "jetbrains-400-italic" },
  // Condensed display face, only used for names and headings (it has no italic).
  Oswald: { 400: "oswald-400", 500: "oswald-500", 700: "oswald-700" },
};

/** Display-only families, not offered as a body font. */
const DISPLAY_ONLY = new Set(["Oswald"]);

export const FONT_OPTIONS = [
  { value: "", label: "Template default" },
  ...Object.keys(FONT_FILES).filter((f) => !DISPLAY_ONLY.has(f)).map((f) => ({ value: f, label: f })),
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
    // Each file is registered once. Registering the same file under a second weight
    // (e.g. Lato 400 as 500) makes react-pdf embed two copies of one font, and glyphs
    // then go missing in later renders (a name printed as "ANE DOE"). Missing weights
    // (500, 600, bold italic…) resolve to the nearest registered file by the CSS rules.
    Font.register({ family, fonts });
  }
  // Word hyphenation looks broken on a resume, so keep words whole. Long unbroken
  // strings (URLs, emails) may break after "/", ".", "_" or "@" so they wrap
  // instead of running into the next column. (Not after "-": react-pdf adds its
  // own hyphen at a break, which would print "--".)
  Font.registerHyphenationCallback((word) => {
    if (word.length <= 24) return [word];
    const parts = word.match(/[^/._@]+[/._@]*|[/._@]+/g) || [word];
    return parts.flatMap((part) => part.match(/.{1,24}/g));
  });
}
