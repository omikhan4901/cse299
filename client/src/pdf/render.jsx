import { pdf } from "@react-pdf/renderer";
import ResumeDocument from "./ResumeDocument";
import { registerFonts } from "./fonts";

/** Renders a resume to PDF bytes. Runs in the worker, or on the main thread as a fallback. */
export async function renderResumeToBuffer(resume, fontBase) {
  registerFonts(fontBase);
  const blob = await pdf(<ResumeDocument resume={resume} />).toBlob();
  return blob.arrayBuffer();
}
