import { pdf } from "@react-pdf/renderer";
import ResumeDocument from "./ResumeDocument";
import { registerFonts } from "./fonts";

// Invisible characters (some crash the font engine), private-use icon glyphs and
// emoji: none of the resume fonts can draw them, so they'd print as garbage.
const UNPRINTABLE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uE000-\uF8FF]|\p{Extended_Pictographic}|\uFE0F/gu;

const stripUnprintable = (value) => {
  if (typeof value === "string") return value.startsWith("data:") ? value : value.replace(UNPRINTABLE, "");
  if (Array.isArray(value)) return value.map(stripUnprintable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripUnprintable(v)]));
  return value;
};

/** Renders a resume to PDF bytes. Runs in the worker, or on the main thread as a fallback. */
export async function renderResumeToBuffer(resume, fontBase) {
  registerFonts(fontBase);
  const blob = await pdf(<ResumeDocument resume={stripUnprintable(resume)} />).toBlob();
  return blob.arrayBuffer();
}
