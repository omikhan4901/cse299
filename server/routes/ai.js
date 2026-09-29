const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const { protect } = require('./auth');
const { toResume, TRANSCRIPT_SCHEMA, TRANSCRIBE_INSTRUCTION } = require('../lib/resumeImport');
const { loadResumeGuide } = require('../lib/resumeGuide');
const { aiQuota, usageSummary } = require('../lib/credits');
const { INSTRUCTION: INGEST_INSTRUCTION, RESPONSE_SCHEMA: INGEST_SCHEMA, prompt: ingestPrompt, checkOperations } = require('../lib/ingest');
// The assistant's reply with proposed edits (same operation format as imports).
const CHAT_SCHEMA = { type: 'OBJECT', properties: { reply: { type: 'STRING' }, operations: INGEST_SCHEMA.properties.operations }, required: ['reply', 'operations'] };
// The operation part of the import instructions, reused to explain the format to the assistant.
const OPERATIONS_GUIDE = INGEST_INSTRUCTION.slice(INGEST_INSTRUCTION.indexOf('- "add"'), INGEST_INSTRUCTION.indexOf('Rules:')).trim();
const { readPdf, pdfPageCount } = require('../lib/pdfText');
const polish = require('../lib/polish');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const CareerProfile = require('../models/CareerProfile');
const interviewAi = require('../lib/interviewAi');
const { requireV2 } = require('../lib/v2');
const mongoose = require('mongoose');
const vertex = require('../lib/vertex');
const { generationLimits } = require('../lib/aiLimits');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } });

// File type by content, not by name: PDF starts with "%PDF-", DOCX is a ZIP ("PK\x03\x04").
const isPdf = (buf) => buf.length > 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
const isZip = (buf) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

/**
 * AI routes (Gemini). Two providers with the same models and request format:
 *   - AI Studio (default): needs GEMINI_API_KEY.
 *   - Vertex AI (AI_PROVIDER=vertex): billed to the Google Cloud project; see lib/vertex.js.
 * Switched off when neither is set up, and can be forced off with AI_ENABLED=false while
 * the provider is being fixed.
 * GEMINI_MODEL picks the model (defaults to Google's always-current Flash alias, since pinned models get retired).
 */
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// Used when the main model is overloaded or unavailable.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';

const aiEnabled = () => process.env.AI_ENABLED !== 'false' && (vertex.useVertex() || !!process.env.GEMINI_API_KEY);

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
// One attempt: imports of a long CV can take well over 30 s, so they get longer before a retry.
const PER_TRY_MS = 30_000;
const PER_TRY_LONG_MS = 70_000;

// Retries server errors and rate limits with backoff, within the time left.
// Returns the last HTTP response (possibly an error); throws on timeout or a dropped client.
const fetchWithRetry = async (url, options, { deadline, signal, perTry = PER_TRY_MS }, maxRetries = 3) => {
    let lastResponse = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const left = deadline - Date.now();
        if (left < 1000) break;
        try {
            const response = await fetch(url, { ...options, signal: AbortSignal.any([signal, AbortSignal.timeout(Math.min(left, perTry))].filter(Boolean)) });
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
const callModel = async (model, payload, limits) => {
    if (!vertex.useVertex()) {
        return fetchWithRetry(`${API_BASE_URL}/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify(payload),
        }, limits);
    }
    let token;
    try {
        token = await vertex.accessToken();
    } catch (err) {
        console.error(err.message);
        throw new AiError('The AI service is unavailable right now. Please try again later.');
    }
    // Vertex wants every turn to say who is speaking.
    const body = { ...payload, contents: payload.contents.map((c) => (c.role ? c : { role: 'user', ...c })) };
    return fetchWithRetry(vertex.modelUrl(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    }, limits);
};

/**
 * Calls Gemini and returns the generated text. Throws AiError on failure (never touches `res`).
 * Pass the request so the call stops when the person goes away, and keeps to the time budget.
 */
const generate = async (systemInstruction, contents, generationConfig, req) => {
    // The feature's output and thinking limits (lib/aiLimits.js) bound what the call can cost.
    const bounded = { ...(generationConfig || {}), ...generationLimits(req?.aiLimits) };
    const payload = {
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        ...(Object.keys(bounded).length ? { generationConfig: bounded } : {}),
    };
    const limits = { deadline: Date.now() + aiBudgetMs(req), signal: req?.aiSignal, perTry: req?.aiLongTask ? PER_TRY_LONG_MS : PER_TRY_MS };
    let response = await callModel(MODEL_NAME, payload, limits);
    // A model without thinking settings refuses them: try once more without (the output cap stays).
    if (response.status === 400 && payload.generationConfig?.thinkingConfig) {
        const detail = await response.clone().json().then((r) => String(r?.error?.message || '')).catch(() => '');
        if (/thinking/i.test(detail)) {
            delete payload.generationConfig.thinkingConfig;
            response = await callModel(MODEL_NAME, payload, limits);
        }
    }
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
        // A used-up quota, prepaid balance (402) or switched-off billing (Vertex: 403) won't
        // clear in a minute, unlike a busy model.
        if (response.status === 402 || (response.status === 429 && /quota|billing|exceeded/i.test(detail)) || (response.status === 403 && /billing/i.test(detail))) {
            console.error("Gemini quota or prepaid credit used up: check the API key's quota and billing in Google AI Studio.");
            throw new AiError('The AI has reached its usage limit for now. Please try again later.');
        }
        throw new AiError(response.status === 429 || response.status >= 500 ? BUSY_MESSAGE : 'The AI service is unavailable right now. Please try again later.');
    }
    // Tokens paid for, per request (lib/credits.js stores them with the request's AiEvent).
    const usage = result.usageMetadata;
    if (req && usage) {
        req.aiUsage ||= { inputTokens: 0, outputTokens: 0, model: null };
        req.aiUsage.inputTokens += Number(usage.promptTokenCount) || 0;
        req.aiUsage.outputTokens += (Number(usage.candidatesTokenCount) || 0) + (Number(usage.thoughtsTokenCount) || 0);
        req.aiUsage.model = result.modelVersion || req.aiUsage.model || (response.url?.match(/models\/([^:]+):/)?.[1] ?? null);
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
    // Never to the AI: database fields, design, and biodata (parents' names, addresses…).
    const { _id, user, shortId, createdAt, updatedAt, __v, theme, template, isPublic, isMaster, biodata, suggestions, tailoredFor, rev, ...rest } = resume;
    return { ...rest, personal: { ...(isObj(rest.personal) ? rest.personal : {}), profilePic: undefined, profilePicSource: undefined, photoCrop: undefined } };
};
const resumeJson = (resume) => clip(JSON.stringify(cleanResume(resume)), MAX_RESUME_CHARS);

// Input limits (lib/aiLimits.js): typed text over the feature's limit is refused before the
// model is called (the credits are refunded); stored text, like a job description, is trimmed.
const inputCap = (req, fallback) => req.aiLimits?.input || fallback;
// A PDF with more pages than the feature allows is refused before the model sees it.
const tooManyPages = async (req, res, buffer) => {
    const max = req.aiLimits?.pages;
    const n = max ? await pdfPageCount(buffer) : null;
    if (!n || n <= max) return false;
    res.status(400).json({ success: false, code: 'too-long', max, error: `That PDF has ${n} pages. Upload one of up to ${max} pages.` });
    return true;
};
const tooLong = (req, res, text, what = 'That text') => {
    const max = req.aiLimits?.input;
    if (!max || String(text || '').length <= max) return false;
    res.status(400).json({ success: false, code: 'too-long', max, error: `${what} is too long. Keep it under ${max.toLocaleString('en-US')} characters.` });
    return true;
};

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
    if (tooLong(req, res, resumeText)) return;

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
1. Never invent qualifications, employers, numbers, degrees or job titles that are not in the text. Don't add details the text doesn't give either: no new purposes, audiences, scale, topics or adjectives (e.g. "high-throughput", "strategic", "valuable", "for management review"). Keep each point as specific as the original, no more.
2. Use the context only to match tone and keywords, not to add facts.
3. If the text contradicts the context, trust the text.
4. Reply with the rewritten text only — no quotes, labels, markdown or commentary.`;

    try {
        const refinedText = (await generate(systemInstruction, [{ role: 'user', parts: [{ text: clip(resumeText, inputCap(req, 4000)) }] }], undefined, req)).replace(/^["']|["']$/g, '');
        // Rewrite is truth-preserving: anything that looks new is pointed out before it's used.
        const unverified = polish.newFacts(refinedText, `${resumeText} ${isObj(fullResume) ? JSON.stringify({ ...fullResume, personal: undefined }) : ''}`);
        res.status(200).json({ success: true, refinedText, unverified });
    } catch (err) {
        sendError(res, err);
    }
});

// --- 1b. Strengthen: asks what would make a point stronger, then writes it from the answers only ---
router.post('/strengthen', protect, aiQuota('refine'), async (req, res) => {
    if (tooLong(req, res, str(req.body?.text), 'That point')) return;
    const text = str(req.body?.text);
    if (!text) return res.status(400).json({ success: false, error: 'No text provided.' });
    const answers = list(req.body?.answers)
        .filter((x) => isObj(x) && str(x.a))
        .slice(0, 6)
        .map((x) => ({ q: clip(str(x.q), 300), a: clip(str(x.a), 600) }));
    try {
        if (!answers.length) {
            const json = await generate(polish.STRENGTHEN_ASK, [{ role: 'user', parts: [{ text: `POINT: ${text}` }] }], { responseMimeType: 'application/json', responseSchema: polish.QUESTIONS_SCHEMA }, req);
            const questions = list(JSON.parse(json).questions).map((q) => clip(str(q), 200)).filter(Boolean).slice(0, 4);
            if (!questions.length) throw new AiError("The AI couldn't think of questions for that point. Try another one.");
            return res.json({ success: true, questions });
        }
        const input = `POINT: ${text}\n\nANSWERS:\n${answers.map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n')}`;
        const write = async (note = '') => (await generate(polish.STRENGTHEN_WRITE, [{ role: 'user', parts: [{ text: input + note }] }], undefined, req)).replace(/^["'\s•-]+|["'\s]+$/g, '');
        let out = await write();
        // The numbers they gave are the point of Strengthen: if none made it in, ask once more.
        const given = [...new Set(answers.flatMap((x) => x.a.match(/\d[\d.,]*/g) || []).map((n) => n.replace(/[.,]+$/, '')))];
        if (given.length && !given.some((n) => out.includes(n))) out = await write(`\n\nInclude the numbers from the answers (${given.join(', ')}).`);
        res.json({ success: true, text: out, unverified: polish.newFacts(out, `${text} ${answers.map((x) => x.a).join(' ')}`) });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError("We couldn't make sense of the AI's answer. Please try again.") : err);
    }
});

// --- 1c. Polish a tailored resume for its job: proposals to review (lib/polish.js) ---
// Body: { resumeId } (the job text comes from its application), or { resume, jobDescription }.
// With store: true the proposals are kept on the resume for later review (batch polish).
router.post('/polish', protect, aiQuota('polish'), async (req, res) => {
    try {
        let resume = isObj(req.body?.resume) ? req.body.resume : null;
        let jobText = str(req.body?.jobDescription);
        let doc = null;
        if (req.body?.resumeId) {
            if (!mongoose.isValidObjectId(req.body.resumeId)) return res.status(404).json({ success: false, error: 'Resume not found.' });
            doc = await Resume.findOne({ _id: req.body.resumeId, user: req.userId });
            if (!doc) return res.status(404).json({ success: false, error: 'Resume not found.' });
            resume = doc.toObject();
            if (!jobText && doc.tailoredFor) jobText = (await Application.findOne({ _id: doc.tailoredFor, user: req.userId }).select('job.description').lean())?.job?.description || '';
        }
        if (!resume || !resumeOk(resume)) return res.status(400).json({ success: false, error: 'There is nothing in this resume to polish yet.' });
        if (jobText.length < 40) return res.status(400).json({ success: false, error: 'Add the job description to the application first: polish writes for that job.' });
        jobText = clip(jobText, inputCap(req, 12000));
        req.aiLongTask = true;
        // Only the resume's own content counts as known facts (not earlier proposals).
        const { suggestions, tailoredFor, rev, ...content } = resume;
        const clean = cleanResume(content);
        const json = await generate(polish.POLISH_INSTRUCTION, [{ role: 'user', parts: [{ text: polish.polishPrompt(clean, jobText) }] }], { responseMimeType: 'application/json', responseSchema: polish.POLISH_SCHEMA }, req);
        const operations = polish.polishOperations(fixNewlines(JSON.parse(json)), clean);
        if (doc && req.body?.store) {
            doc.suggestions = { operations, at: new Date() };
            await doc.save({ timestamps: false });
        }
        res.json({ success: true, operations });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError("We couldn't make sense of the AI's answer. Please try again.") : err);
    }
});

// --- 1d. Interview prep for one application (V2, lib/interviewAi.js) ---
// Body: { applicationId }. Built from the resume that was sent, else the linked resume,
// else the Career Profile. The sheet is kept on the application (prepAi) and returned.
router.post('/interview-prep', protect, requireV2, aiQuota('interviewAi'), async (req, res) => {
    try {
        const id = req.body?.applicationId;
        const app = mongoose.isValidObjectId(id) ? await Application.findOne({ _id: id, user: req.userId }) : null;
        if (!app) return res.status(404).json({ success: false, error: 'Application not found.' });
        if (str(app.job?.description).length < 80) return res.status(400).json({ success: false, error: 'Add the job description first: the prep is written for that job.' });
        let source = app.snapshot?.content;
        let from = 'sent';
        if (!resumeOk(source || {}) && app.resume) {
            source = await Resume.findOne({ _id: app.resume, user: req.userId }).lean();
            from = 'resume';
        }
        if (!resumeOk(source || {})) {
            source = await CareerProfile.findOne({ user: req.userId }).lean();
            from = 'profile';
        }
        if (!source || !resumeOk(source)) return res.status(400).json({ success: false, error: 'Choose a resume for this job, or fill in your Career Profile, first.' });
        req.aiLongTask = true;
        const clean = cleanResume(source);
        const job = { title: app.job.title, organisation: app.job.organisation, description: clip(app.job.description, inputCap(req, 12000)) };
        const json = await generate(interviewAi.PREP_INSTRUCTION, [{ role: 'user', parts: [{ text: interviewAi.prepPrompt(clean, job) }] }], { responseMimeType: 'application/json', responseSchema: interviewAi.PREP_SCHEMA }, req);
        const data = interviewAi.checkPrep(JSON.parse(json), clean, job);
        if (!data.questions.length) throw new AiError("The AI's answer didn't include any questions. Please try again.");
        const prepAi = { data, at: new Date(), from };
        // Not an edit by the person: no new revision, so an open drawer can keep saving.
        await Application.updateOne({ _id: app._id, user: req.userId }, { $set: { prepAi } }, { timestamps: false });
        res.json({ success: true, data: prepAi });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError("We couldn't make sense of the AI's answer. Please try again.") : err);
    }
});

// --- 2. Context-aware chat ---
router.post('/chat', protect, aiQuota('chat'), async (req, res) => {
    const { conversation, fullResume } = req.body;
    if (!Array.isArray(conversation) || conversation.length === 0) {
        return res.status(400).json({ success: false, error: 'No conversation history.' });
    }
    // Only the latest turns are kept; the person's own messages must fit the limit.
    const kept = conversation.slice(-(req.aiLimits?.turns || 20)).filter((msg) => isObj(msg) && str(msg.content));
    const last = kept.at(-1);
    if (last && last.role !== 'assistant' && tooLong(req, res, last.content, 'That message')) return;
    const contents = kept.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: clip(msg.content, msg.role === 'assistant' ? 2000 : inputCap(req, 4000)) }],
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

    // V2: the reply can carry proposed edits (the same operations as imports), shown as
    // cards the person applies or dismisses; nothing changes on its own.
    if (req.body?.propose && isObj(req.body?.outline)) {
        const instruction = `${systemInstruction}

EDITS: Besides "reply", return "operations" whenever the user tells you new facts about themselves or asks you to change their resume (e.g. "add that I led a team of 4", "make my summary shorter"). Use these operations on CURRENT RESUME OUTLINE (ids included):
${OPERATIONS_GUIDE}
Only use facts the user stated or that are already in the resume; never invent. For a rewrite of existing text, use "set" (summary) or "update"/"addBullets" on the item. Remove ("remove", "clear", "removeValues") only when the user asks for it, with "evidence" copying their words. If nothing should change, return an empty list. Keep "reply" short and say what you propose.

CURRENT RESUME OUTLINE:
${clip(JSON.stringify(req.body.outline), 20000)}`;
        try {
            const json = await generate(instruction, contents, { responseMimeType: 'application/json', responseSchema: CHAT_SCHEMA }, req);
            const out = JSON.parse(json);
            const said = contents.filter((c) => c.role === 'user').map((c) => c.parts[0].text).join('\n');
            const { operations } = checkOperations(list(out.operations), { source: `${said}\n${resumeJson(fullResume)}`, outline: req.body.outline, asked: said });
            return res.status(200).json({ success: true, response: str(out.reply) || (operations.length ? 'Here is what I suggest:' : ''), operations });
        } catch (err) {
            return sendError(res, err instanceof SyntaxError ? new AiError("We couldn't make sense of the AI's answer. Please try again.") : err);
        }
    }

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
${targeted ? `Score 0-100 how well the resume matches this job description:\n"""${clip(jobDescription, inputCap(req, 6000))}"""` : 'Score 0-100 the resume against general best practices for its target role.'}
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
            if (await tooManyPages(req, res, file.buffer)) return;
            part = { inline_data: { mime_type: 'application/pdf', data: file.buffer.toString('base64') } };
        } else if (isZip(file.buffer) && /\.docx$/i.test(file.originalname)) {
            const text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
            if (!text.trim()) return res.status(400).json({ success: false, error: "We couldn't find any text in that file." });
            part = { text: clip(text, inputCap(req, 30000)) };
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

// --- 4b. Ingest: anything pasted or uploaded → reviewable operations on the resume ---
// (server/lib/ingest.js; the builder shows them for review and applies the accepted ones).
router.post('/ingest', protect, aiQuota('parse'), upload.single('resumeFile'), async (req, res) => {
    const file = req.file;
    const typed = str(req.body?.text);
    let outline = req.body?.outline;
    if (typeof outline === 'string') {
        try {
            outline = JSON.parse(outline);
        } catch {
            outline = null;
        }
    }
    if (!isObj(outline)) outline = {};
    if (!file && !typed) return res.status(400).json({ success: false, error: 'Paste some text or choose a PDF or Word file.' });
    if (typed.length > 30000) return res.status(400).json({ success: false, error: 'That text is very long. Paste it in parts of up to about 30,000 characters.' });
    // Typed on its own it's the input (limited); with a file it's a short note about the file.
    if (!file && tooLong(req, res, typed)) return;
    if (file && typed.length > 2000) return res.status(400).json({ success: false, code: 'too-long', max: 2000, error: 'That note is too long. Keep it under 2,000 characters.' });
    // Reading a file, or a long pasted CV, takes a while: allow the import's longer budget.
    if (file || typed.length > 1500) req.aiLongTask = true;

    try {
        // The text the model reads, and the facts are checked against. With a file, what the
        // person typed is their note about it ("this is my old CV"), sent on its own.
        let source = typed;
        let fileText = '';
        let pdfPart = null;
        if (file) {
            if (isPdf(file.buffer)) {
                if (await tooManyPages(req, res, file.buffer)) return;
                const { text } = await readPdf(file.buffer).catch(() => ({ text: '' }));
                if (text.replace(/\s/g, '').length > 150) fileText = text;
                else pdfPart = { inline_data: { mime_type: 'application/pdf', data: file.buffer.toString('base64') } }; // a scanned PDF
            } else if (isZip(file.buffer) && /\.docx$/i.test(file.originalname)) {
                const text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
                if (!text.trim()) return res.status(400).json({ success: false, error: "We couldn't find any text in that file." });
                fileText = text;
            } else {
                return res.status(400).json({ success: false, error: 'Please upload a PDF or DOCX file.' });
            }
        }
        if (fileText) source = `${fileText}\n\n${typed}`.trim();
        const input = file ? clip(fileText, inputCap(req, 30000)) || '(see the attached PDF)' : clip(typed, 30000);
        const parts = [...(pdfPart ? [pdfPart] : []), { text: ingestPrompt(outline, input, file ? clip(typed, 2000) : '') }];
        const json = await generate(INGEST_INSTRUCTION, [{ role: 'user', parts }], { responseMimeType: 'application/json', responseSchema: INGEST_SCHEMA }, req);
        // Removals must be asked for in the person's own words: what they typed, not the file.
        const { operations, skipped } = checkOperations(JSON.parse(json).operations, { source, outline, asked: typed });
        res.status(200).json({ success: true, operations, skipped });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError("We couldn't make sense of that. Please try again.") : err);
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
"""${clip(jobDescription, inputCap(req, 6000))}"""

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
