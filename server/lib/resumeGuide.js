const fs = require('fs');
const path = require('path');

/**
 * "How to Write a Good Resume" — the same Markdown the builder shows in its
 * help dialog (shared/resume-guide.md). The chat assistant is grounded on it.
 * RESUME_GUIDE_PATH overrides the location when the server is deployed on its own.
 */
const GUIDE_PATH = process.env.RESUME_GUIDE_PATH || path.join(__dirname, '../../shared/resume-guide.md');

let cached = null;
let cachedMtime = 0;

function loadResumeGuide() {
    try {
        const { mtimeMs } = fs.statSync(GUIDE_PATH);
        // Re-read when the file changes, so edits to the guide apply without a restart.
        if (cached === null || mtimeMs !== cachedMtime) {
            cached = fs.readFileSync(GUIDE_PATH, 'utf8').trim();
            cachedMtime = mtimeMs;
        }
    } catch (err) {
        if (cached === null) {
            console.warn(`Resume guide not found at ${GUIDE_PATH}; the AI chat will answer without it.`);
            cached = '';
        }
    }
    return cached;
}

module.exports = { loadResumeGuide, GUIDE_PATH };
