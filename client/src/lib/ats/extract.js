/**
 * Pulls the text out of a PDF the way an ATS does: in content order, one
 * line per visual line. `pdfjs` is the loaded pdfjs-dist module.
 */
export async function extractPdfText(pdfjs, buffer) {
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)), isEvalSupported: false });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      text += item.str;
      if (item.hasEOL) text += "\n";
    }
    pages.push(text);
  }
  const pageCount = doc.numPages;
  task.destroy();
  return { text: pages.join("\n"), pages, pageCount };
}
