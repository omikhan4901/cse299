const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');
const { protect } = require('./auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * AI routes (Gemini). Switched off unless GEMINI_API_KEY is set, and can be
 * forced off with AI_ENABLED=false while the provider is being fixed.
 * GEMINI_MODEL picks the model (defaults to Google's always-current Flash alias, since pinned models get retired).
 */
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-latest';

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

// Retries server errors and rate limits with exponential backoff.
const fetchWithRetry = async (url, options, maxRetries = 3) => {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.status < 500 && response.status !== 429) return response;
            lastError = new AiError(`AI provider returned ${response.status}`);
        } catch (err) {
            lastError = err;
        }
        if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
    throw lastError;
};

/** Calls Gemini and returns the generated text. Throws AiError on failure (never touches `res`). */
const generate = async (systemInstruction, contents, generationConfig) => {
    const payload = {
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        ...(generationConfig ? { generationConfig } : {}),
    };
    const response = await fetchWithRetry(`${API_BASE_URL}/${MODEL_NAME}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('Gemini API error:', response.status, result?.error?.message);
        throw new AiError('The AI service is unavailable right now. Please try again later.');
    }
    const text = result.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!text) throw new AiError('The AI could not generate a response. Try rephrasing.');
    return text;
};

const sendError = (res, err) => {
    console.error('AI route error:', err.message);
    res.status(err.status || 500).json({ success: false, error: err instanceof AiError ? err.message : 'AI request failed.' });
};

// Keep prompts small: never send photos or database fields to the model.
const cleanResume = (resume = {}) => {
    const { _id, user, shortId, createdAt, updatedAt, __v, theme, template, isPublic, isMaster, ...rest } = resume;
    return { ...rest, personal: { ...(rest.personal || {}), profilePic: undefined } };
};

const clip = (text, max) => String(text || '').slice(0, max);

// --- 1. Context-aware refinement ---
router.post('/refine', protect, async (req, res) => {
    const { resumeText, fullResume, sectionType } = req.body;
    if (!resumeText || !String(resumeText).trim()) return res.status(400).json({ success: false, error: 'No text provided.' });

    const context = fullResume
        ? `CONTEXT FROM USER'S RESUME:
- Job title: ${fullResume.personal?.title || 'N/A'}
- Skills: ${fullResume.skills || 'N/A'}
- Previous roles: ${(fullResume.experience || []).map((e) => e.title).filter(Boolean).join(', ') || 'N/A'}`
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
        const refinedText = await generate(systemInstruction, [{ role: 'user', parts: [{ text: clip(resumeText, 4000) }] }]);
        res.status(200).json({ success: true, refinedText: refinedText.replace(/^["']|["']$/g, '') });
    } catch (err) {
        sendError(res, err);
    }
});

// --- 2. Context-aware chat ---
router.post('/chat', protect, async (req, res) => {
    const { conversation, fullResume } = req.body;
    if (!Array.isArray(conversation) || conversation.length === 0) {
        return res.status(400).json({ success: false, error: 'No conversation history.' });
    }
    const contents = conversation.slice(-20).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: clip(msg.content, 4000) }],
    }));
    // Gemini requires the conversation to start with a user turn.
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length) return res.status(400).json({ success: false, error: 'No question provided.' });

    const systemInstruction = `You are "ResumeX Assistant", an expert, encouraging resume consultant.
Use the user's resume (JSON below) to give specific, practical answers. Keep replies short and use plain text (no markdown).
When asked to write resume text, return only the text they can paste.

RESUME:
${JSON.stringify(cleanResume(fullResume))}`;

    try {
        const response = await generate(systemInstruction, contents);
        res.status(200).json({ success: true, response });
    } catch (err) {
        sendError(res, err);
    }
});

// --- 3. ATS audit (structured JSON) ---
router.post('/audit', protect, async (req, res) => {
    const { resumeData, jobDescription } = req.body;
    if (!resumeData) return res.status(400).json({ success: false, error: 'Missing resume.' });
    const targeted = !!String(jobDescription || '').trim();

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
        const text = await generate(systemInstruction, [{ role: 'user', parts: [{ text: JSON.stringify(cleanResume(resumeData)) }] }], {
            responseMimeType: 'application/json',
            responseSchema: schema,
        });
        const analysis = JSON.parse(text);
        analysis.score = Math.max(0, Math.min(100, Math.round(Number(analysis.score) || 0)));
        res.status(200).json({ success: true, analysis });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError('The AI returned an unexpected answer. Please try again.') : err);
    }
});

// --- 4. Import an existing resume (PDF / DOCX) ---
const RESUME_SCHEMA = {
    type: 'OBJECT',
    properties: {
        personal: {
            type: 'OBJECT',
            properties: {
                name: { type: 'STRING' }, title: { type: 'STRING' }, phone: { type: 'STRING' }, email: { type: 'STRING' },
                linkedin: { type: 'STRING' }, website: { type: 'STRING' }, city: { type: 'STRING' },
            },
        },
        summary: { type: 'STRING' },
        experience: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    company: { type: 'STRING' }, title: { type: 'STRING' }, location: { type: 'STRING' },
                    startDate: { type: 'STRING' }, endDate: { type: 'STRING' },
                    description: { type: 'STRING', description: 'Achievements, one per line, no bullet symbols' },
                },
            },
        },
        education: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    institution: { type: 'STRING' }, degree: { type: 'STRING' }, startYear: { type: 'STRING' },
                    endYear: { type: 'STRING' }, details: { type: 'STRING' },
                },
            },
        },
        projects: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, link: { type: 'STRING' }, description: { type: 'STRING' } } },
        },
        certifications: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, issuer: { type: 'STRING' }, date: { type: 'STRING' } } },
        },
        skills: { type: 'STRING', description: 'Comma-separated' },
        languages: { type: 'STRING', description: 'Comma-separated' },
    },
};

router.post('/parse', protect, upload.single('resumeFile'), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    try {
        let resumeText = '';
        if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) {
            resumeText = (await pdf(file.buffer)).text;
        } else if (/\.docx$/i.test(file.originalname)) {
            resumeText = (await mammoth.extractRawText({ buffer: file.buffer })).value;
        } else {
            return res.status(400).json({ success: false, error: 'Please upload a PDF or DOCX file.' });
        }
        if (!resumeText.trim()) {
            return res.status(400).json({ success: false, error: "We couldn't find any text in that file. Scanned images aren't supported." });
        }

        const json = await generate(
            'Extract the resume below into the JSON schema. Copy facts exactly; leave fields empty when unknown.',
            [{ role: 'user', parts: [{ text: clip(resumeText, 30000) }] }],
            { responseMimeType: 'application/json', responseSchema: RESUME_SCHEMA }
        );
        res.status(200).json({ success: true, extractedData: JSON.parse(json) });
    } catch (err) {
        sendError(res, err instanceof SyntaxError ? new AiError('Could not read that resume. Please try another file.') : err);
    }
});

// --- 5. Cover letter ---
router.post('/cover-letter', protect, async (req, res) => {
    const { resumeData, jobDescription } = req.body;
    if (!resumeData || !String(jobDescription || '').trim()) {
        return res.status(400).json({ success: false, error: 'Missing resume or job description.' });
    }

    const systemInstruction = `You are an expert career coach and copywriter.
Write a tailored, professional cover letter for the candidate below and the target job.

CANDIDATE RESUME (JSON):
${JSON.stringify(cleanResume(resumeData))}

JOB DESCRIPTION:
"""${clip(jobDescription, 6000)}"""

GUIDELINES:
1. Structure: greeting, strong opening hook, why the candidate fits (match real skills to the job), why this company, call to action, sign-off with the candidate's name.
2. Confident, human tone. Avoid clichés such as "I am writing to apply".
3. Only use facts from the resume. Never invent experience.
4. Plain text only: no markdown, no square-bracket placeholders.`;

    try {
        const coverLetter = await generate(systemInstruction, [{ role: 'user', parts: [{ text: 'Write my cover letter.' }] }]);
        res.status(200).json({ success: true, coverLetter });
    } catch (err) {
        sendError(res, err);
    }
});

router.aiEnabled = aiEnabled;
module.exports = router;
