/**
 * Reads an uploaded PDF the way an ATS parser does, for the public ATS checker
 * (routes/ats.js): the text in content order, the page count, and layout signals
 * a parser struggles with (a second column, images, unreadable characters).
 * Nothing is stored.
 */

let pdfjs;
const load = () => (pdfjs ||= import('pdfjs-dist/legacy/build/pdf.mjs'));

const MAX_PAGES = 10;

/** Where text runs start on each line, for spotting a second column. */
function runStarts(items, width) {
    const rows = new Map();
    for (const it of items) {
        if (!it.str || !it.str.trim()) continue;
        const key = Math.round(it.transform[5] / 3);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push([it.transform[4], it.transform[4] + (it.width || 0)]);
    }
    const starts = [];
    for (const row of rows.values()) {
        row.sort((a, b) => a[0] - b[0]);
        let reach = -Infinity;
        for (const [x, end] of row) {
            // A run starts after a real gap (not the next word on the same line).
            if (x - reach > width * 0.04) starts.push(x);
            reach = Math.max(reach, end);
        }
    }
    return starts;
}

async function readPdf(buffer) {
    const lib = await load();
    const task = lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
    const doc = await task.promise;
    try {
        const pageCount = doc.numPages;
        if (pageCount > MAX_PAGES) {
            throw Object.assign(new Error(`This PDF has ${pageCount} pages. Upload a resume of up to ${MAX_PAGES} pages.`), { status: 400 });
        }
        const IMAGE_OPS = new Set([lib.OPS.paintImageXObject, lib.OPS.paintInlineImageXObject, lib.OPS.paintImageXObjectRepeat]);
        const pages = [];
        let images = 0;
        let runs = 0;
        let columnRuns = 0;
        for (let n = 1; n <= pageCount; n++) {
            const page = await doc.getPage(n);
            const { width } = page.getViewport({ scale: 1 });
            const content = await page.getTextContent();
            let text = '';
            for (const item of content.items) {
                text += item.str;
                if (item.hasEOL) text += '\n';
            }
            pages.push(text);

            // A second column shows up as many text runs starting at the same x in the
            // middle of the page (right-aligned dates start at scattered x instead).
            const starts = runStarts(content.items, width);
            runs += starts.length;
            const middle = starts.filter((x) => x > width * 0.22 && x < width * 0.75).sort((a, b) => a - b);
            let best = 0;
            for (let i = 0, j = 0; j < middle.length; j++) {
                while (middle[j] - middle[i] > 8) i++;
                best = Math.max(best, j - i + 1);
            }
            columnRuns += best >= 6 ? best : 0;

            const ops = await page.getOperatorList();
            for (const fn of ops.fnArray) if (IMAGE_OPS.has(fn)) images++;
            page.cleanup();
        }
        const text = pages.join('\n');
        const garbled = (text.match(/�|[-]/g) || []).length;
        const columns = columnRuns >= 8 && columnRuns / Math.max(1, runs) >= 0.15;
        return { text, pageCount, layout: { columns, images, garbled } };
    } finally {
        await task.destroy();
    }
}

/** Just the number of pages (cheap: no page is read), or null when the PDF can't be opened. */
async function pdfPageCount(buffer) {
    let task;
    try {
        const lib = await load();
        task = lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
        return (await task.promise).numPages;
    } catch {
        return null;
    } finally {
        await task?.destroy().catch(() => {});
    }
}

module.exports = { pdfPageCount, readPdf, MAX_PAGES };
