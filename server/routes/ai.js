const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const { protect } = require('./auth');
const { toResume, TRANSCRIPT_SCHEMA, TRANSCRIBE_INSTRUCTION } = require('../lib/resumeImport');
const { loadResumeGuide } = require('../lib/resumeGuide');
const { aiQuota, usageSummary } = require('../lib/credits');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } });

// File type by content, not by name: PDF starts with "%PDF-", DOCX is a ZIP ("PK\x03\x04").
const isPdf = (buf) => buf.length > 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
const isZip = (buf) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

/**
 * AI routes (Gemini). Switched off unless GEMINI_API_KEY is set, and can be
 * forced off with AI_ENABLED=false while the provider is being fixed.
 * GEMINI_MODEL picks the model (defaults to Google's always-current Flash alias, since pinned models get retired).
 */
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// Used when the main model is overloaded or unavailable.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';

const aiEnabled = () => process.env.AI_ENABLED !== 'false' && !!process.env.GEMINI_API_KEY;

class AiError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}

router.use((req, res, next) => {
    if (!aiEnabled()) {
        return res.status(503).json({ success: false, error: 'AI features are temporarily unavailable.' });
    }
    next();
});

// How many AI requests the signed-in account has left today.
router.get('/usage', protect, async (req, res, next) => {
    try {
        res.json({ success: true, usage: await usageSummary(req.userId) });
    } catch (err) {
        next(err);
    }
});

const BUSY_MESSAGE = 'The AI is very busy right now. Please try again in a minute.';
const SLOW_MESSAGE = 'The AI took too long to answer. Please try again.';

// Time allowed for one AI request, retries and fallback included. It has to end before
// the builder stops waiting (60 s; 120 s for imports), so the person always gets an
// answer, and a refund when it fails.
const aiBudgetMs = (req) => Number(process.env.AI_TIMEOUT_MS) || (req?.aiLongTask ? 100_000 : 45_000);
const PER_TRY_MS = 30_000;

// Retries server errors and rate limits with backoff, within the time left.
// Returns the last HTTP response (possibly an error); throws on timeout or a dropped client.
const fetchWithRetry = async (url, options, { deadline, signal }, maxRetries = 3) => {
    let lastResponse = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const left = deadline - Date.now();
        if (left < 1000) break;
        try {
            const response = await fetch(url, { ...options, signal: AbortSignal.any([signal, AbortSignal.timeout(Math.min(left, PER_TRY_MS))].filter(Boolean)) });
            if (response.status < 500 && response.status !== 429) return response;
            lastResponse = response;
        } catch (err) {
            if (signal?.aborted) throw new AiError('The request was cancelled.', 499);
            // Timed out or network error: try again while there's time.
        }
        const wait = 2 ** attempt * 1000;
        if (attempt < maxRetries - 1 && deadline - Date.now() > wait + 2000) await new Promise((r) => setTimeout(r, wait));
    }
    if (lastResponse) return lastResponse;
    throw new AiError(deadline - Date.now() < 1000 ? SLOW_MESSAGE : BUSY_MESSAGE, deadline - Date.now() < 1000 ? 504 : 502);
};

// Calls one model; returns the HTTP response even when it's an error.
const callModel = (model, payload, limits) =>
    fetchWithRetry(`${API_BASE_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(payload),
    }, limits);

/**
 * Calls Gemini and returns the generated text. Throws AiError on failure (never touches `res`).
 * Pass the request so the call stops when the person goes away, and keeps to the time budget.
 */
const generate = async (systemInstruction, contents, generationConfig, req) => {
    const payload = {
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        ...(generationConfig ? { generationConfig } : {}),
    };
    const limits = { deadline: Date.now() + aiBudgetMs(req), signal: req?.aiSignal };
    let response = await callModel(MODEL_NAME, payload, limits);
    // Overloaded, rate-limited or retired model: try the lighter fallback model once, if there's time.
    if ([404, 429, 500, 503].includes(response.status) && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL_NAME && limits.deadline - Date.now() > 3000) {
        console.warn(`Gemini ${MODEL_NAME} returned ${response.status}; trying ${FALLBACK_MODEL}`);
        response = await callModel(FALLBACK_MODEL, payload, limits).catch((err) => {
            if (err.status === 499) throw err;
            return response; // report the main model's error
        });
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = String(result?.error?.message || '');
        console.error('Gemini API error:', response.status, detail);
        // A used-up quota won't clear in a minute, unlike a busy model.
        if (response.status === 429 && /quota|billing|exceeded/i.test(detail)) {
            console.error("Gemini quota reached: check the API key's quota and billing in Google AI Studio.");
            throw new AiError('The AI has reached its usage limit for now. Please try again later.');
        }
        throw new AiError(response.status === 429 || response.status >= 500 ? BUSY_MESSAGE : 'The AI service is unavailable right now. Please try again later.');
    }
    const text = result.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!text) throw new AiError('The AI could not generate a response. Try rephrasing.');
    return text;
};

// Failed requests are refunded (lib/credits.js), so the message says so.
const sendError = (res, err) => {
    console.error('AI route error:', err.message);
    const message = err instanceof AiError ? err.message : 'AI request failed.';
    res.status(err.status || 500).json({ success: false, error: `${message} You weren't charged for this.` });
};

const clip = (text, max) => String(text || '').slice(0, max);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
// Whether a resume has any writing in it: an empty or malformed one isn't worth a paid AI call.
const hasText = (v, depth = 0) =>
    depth < 8 && (typeof v === 'string' ? !!v.trim() : Array.isArray(v) ? v.some((x) => hasText(x, depth + 1)) : isObj(v) ? Object.values(v).some((x) => hasText(x, depth + 1)) : false);
const resumeOk = (resume) => isObj(resume) && hasText(cleanResume(resume));

// Keep prompts small: never send photos or database fields to the model, and cap
// the size (the request body can be up to 10 MB, which would be costly to send on).
const MAX_RESUME_CHARS = 40000;
const cleanResume = (resume) => {
    if (!isObj(resume)) return {};
    const { _id, user, shortId, createdAt, updatedAt, __v, theme, template, isPublic, isMaster, ...rest } = resume;
    return { ...rest, personal: { ...(isObj(rest.personal) ? rest.personal : {}), profilePic: undefined, profilePicSource: undefined, photoCrop: undefined } };
};
const resumeJson = (resume) => clip(JSON.stringify(cleanResume(resume)), MAX_RESUME_CHARS);

// The model sometimes writes line breaks as a literal "\\n"; turn them back into real ones.
const fixNewlines = (value) => {
    if (typeof value === 'string') return value.replace(/(\\r)?\\n/g, '\n');
    if (Array.isArray(value)) return value.map(fixNewlines);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixNewlines(v)]));
    return value;
};

// --- 1. Context-aware refinement ---
router.post('/refine', protect, aiQuota('refine'), async (req, res) => {
    const { resumeText, fullResume, sectionType } = req.body;
    if (!str(resumeText)) return res.status(400).json({ success: false, error: 'No text provided.' });

    const context = isObj(fullResume)
        ? `CONTEXT FROM USER'S RESUME:
- Job title: ${clip(fullResume.personal?.title, 200) || 'N/A'}
- Skills: ${clip(fullResume.skills, 2000) || 'N/A'}
- Previous roles: ${clip(list(fullResume.experience).map((e) => e?.title).filter(Boolean).join(', '), 1000) || 'N/A'}`
        : '';

    const task = sectionType === 'summary'
        ? `This is the "About me" section. Rewrite it as one short first-person paragraph (3-5 sentences) that sounds human, personal and professional.`
        : `This is a work experience entry. Rewrite it as concise, action-oriented achievements, one per line, with no bullet symbols. Keep numbers the user gave.`;

    const systemInstruction = `You are a professional resume editor.
${context}

TASK: ${task}

RULES:
1. Never invent qualifications, employers, numbers, degrees or job titles that are not in the text.
2. Use the context only to match tone and keywords, not to add facts.
3. If the text contradicts the context, trust the text.
4. Reply with the rewritten text only — no quotes, labels, markdown or commentary.`;

    try {
        const refinedText = await generate(systemInstruction, [{ role: 'user', parts: [{ text: clip(resumeText, 4000) }] }], undefined, req);
        res.status(200).json({ success: true, refinedText: refinedText.replace(/^["']|["']$/g, '') });
    } catch (err) {
        sendError(res, err);
    }
});

// --- 2. Context-aware chat ---
router.post('/chat', protect, aiQuota('chat'), async (req, res) => {
    const { conversation, fullResume } = req.body;
    if (!Array.isArray(conversation) || conversation.length === 0) {
        return res.status(400).json({ success: false, error: 'No conversation history.' });
    }
    const contents = conversation
        .slice(-20)
        .filter((msg) => isObj(msg) && str(msg.content))
        .map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: clip(msg.content, 4000) }],
        }));
    // Gemini requires the conversation to start with a user turn.
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length) return res.status(400).json({ success: false, error: 'No question provided.' });

    // Grounding: before answering, the model gets the "How to Write a Good Resume"
    // guide (shared/resume-guide.md — the same text the builder's help dialog shows)
    // followed by the user's resume. Both go in the system instruction, ahead of the conversation.
    const guide = loadResumeGuide();
    const systemInstruction = `You are "ResumeX Assistant", an expert, encouraging resume consultant.
Use the user's resume (JSON below) to give specific, practical answers. Keep replies short and use plain text (no markdown).
When asked to write resume text, return only the text they can paste.
Never invent facts or numbers about the user: if a result needs a figure they haven't given, use a placeholder such as [X%] or [N users] and ask them for it.
${guide ? `
Base your advice on the ResumeX guide below. Follow its rules (section structure, the action verb + task + quantified result bullet formula, keyword tailoring, formatting and length) and do not contradict it. When it helps, point the user to the relevant part of the guide, e.g. "see Write strong bullet points in the guide". If the guide does not cover a question, answer from general best practice.

<resume_guide>
${guide}
</resume_guide>
` : ''}
RESUME:
${resumeJson(fullResume)}`;

    try {
        const response = await generate(systemInstruction, contents, undefined, req);
        res.status(200).json({ success: true, response });
    } catch (err) {
        sendError(res, err);
    }
});

// --- 3. ATS audit (structured JSON) ---
router.post('/audit', protect, aiQuota('audit'), async (req, res) => {
    const { resumeData, jobDescription } = req.body;
    if (!resumeOk(resumeData)) return res.status(400).json({ success: false, error: 'Add some details to your resume first.' });
    if (jobDescription != null && typeof jobDescription !== 'string') return res.status(400).json({ success: false, error: 'The job description should be text.' });
    const targeted = !!str(jobDescription);

    const schema = {
        type: 'OBJECT',
        properties: {
            score: { type: 'INTEGER' },
            summary: { type: 'STRING' },
            strengths: { type: 'ARRAY', items: { type: 'STRING' } },
            improvements: { type: 'ARRAY', items: { type: 'STRING' } },
            missingKeywords: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['score', 'summary', 'strengths', 'improvements', 'missingKeywords'],
    };
    const systemInstruction = `Act as an applicant tracking system and career coach.
${targeted ? `Score 0-100 how well the resume matches this job description:\n"""${clip(jobDescription, 6000)}"""` : 'Score 0-100 the resume against general best practices for its target role.'}
Give a one-sentence summary, 2-4 strengths, 3-5 specific improvements and up to 10 missing keywords${targeted ? ' from the job description' : ''}.`;

    try {
        const text = await generate(systemInstruction, [{ role: 'user', parts: [{ text: resumeJson(resumeData) }] }], {
            responseMimeType: 'application/json',
            responseSchema: schema,
        }, req);
        const analysis = JSON.parse(text);
        analysis.score = Math.max(0, Math.min(100, Math.round(Number(analysis.score) || 0)));
        res.status(200).json({ success: true, analysis });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError('The AI returned an unexpected answer. Please try again.') : err);
    }
});

// --- 4. Import an existing resume (PDF / DOCX) ---
// Step 1: the model makes an exact JSON transcription (PDFs are sent as-is so
// Gemini can read the real layout). Step 2: lib/resumeImport maps it to our format.
router.post('/parse', protect, aiQuota('parse'), upload.single('resumeFile'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    req.aiLongTask = true; // reading a whole PDF is slow; the builder waits up to 2 minutes

    try {
        let part;
        if (isPdf(file.buffer)) {
            part = { inline_data: { mime_type: 'application/pdf', data: file.buffer.toString('base64') } };
        } else if (isZip(file.buffer) && /\.docx$/i.test(file.originalname)) {
            const text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
            if (!text.trim()) return res.status(400).json({ success: false, error: "We couldn't find any text in that file." });
            part = { text: clip(text, 30000) };
        } else {
            return res.status(400).json({ success: false, error: 'Please upload a PDF or DOCX file.' });
        }

        const json = await generate(TRANSCRIBE_INSTRUCTION, [{ role: 'user', parts: [part, { text: 'Transcribe this resume.' }] }], {
            responseMimeType: 'application/json',
            responseSchema: TRANSCRIPT_SCHEMA,
        }, req);
        res.status(200).json({ success: true, extractedData: toResume(fixNewlines(JSON.parse(json))) });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError('Could not read that resume. Please try another file.') : err);
    }
});

// --- 5. Cover letter ---
router.post('/cover-letter', protect, aiQuota('coverLetter'), async (req, res) => {
    const { resumeData, jobDescription } = req.body;
    if (!resumeOk(resumeData)) return res.status(400).json({ success: false, error: 'Add some details to your resume first.' });
    if (!str(jobDescription)) return res.status(400).json({ success: false, error: 'Paste the job description first.' });

    const systemInstruction = `You are an expert career coach and copywriter.
Write a tailored, professional cover letter for the candidate below and the target job.

CANDIDATE RESUME (JSON):
${resumeJson(resumeData)}

JOB DESCRIPTION:
"""${clip(jobDescription, 6000)}"""

GUIDELINES:
1. Structure: greeting, strong opening hook, why the candidate fits (match real skills to the job), why this company, call to action, sign-off with the candidate's name.
2. Confident, human tone. Avoid clichés such as "I am writing to apply".
3. Only use facts from the resume. Never invent experience.
4. Plain text only: no markdown, no square-bracket placeholders.`;

    try {
        const coverLetter = await generate(systemInstruction, [{ role: 'user', parts: [{ text: 'Write my cover letter.' }] }], undefined, req);
        res.status(200).json({ success: true, coverLetter });
    } catch (err) {
        sendError(res, err);
    }
});

router.aiEnabled = aiEnabled;
module.exports = router;
