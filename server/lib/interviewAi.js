/**
 * AI interview prep (V2.1, docs/v2/SPEC.md §5.6): one call that turns the job and the
 * person's own resume into a prep sheet for that job, in a fixed JSON shape the site styles.
 * Deterministic prep (client/src/lib/interview.js) stays free; this is the paid, specific one.
 *
 * The AI proposes, these checks keep it honest:
 *   - "evidence" and "use" must be a line from the resume (matched loosely, returned exactly,
 *     with where it's from), otherwise they're cleared;
 *   - lines about the person ("talk", honest answers to gaps, and outline points that speak
 *     about them) are dropped when they name numbers, tools or employers that are in neither
 *     the resume nor the job. General advice ("Start from p95 and p99") is kept.
 */
const { newFacts } = require('./polish');

const TYPES = ['role', 'behavioural', 'motivation', 'situational'];

const S = { type: 'STRING' };
const LIST = { type: 'ARRAY', items: S };
const PREP_SCHEMA = {
    type: 'OBJECT',
    properties: {
        summary: S,
        focus: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { skill: S, why: S, evidence: S, talk: S }, required: ['skill', 'why', 'evidence', 'talk'] },
        },
        questions: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: { question: S, type: { type: 'STRING', enum: TYPES }, why: S, outline: LIST, use: S },
                required: ['question', 'type', 'why', 'outline', 'use'],
            },
        },
        gaps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { gap: S, answer: S }, required: ['gap', 'answer'] } },
        ask: LIST,
        prepare: LIST,
    },
    required: ['summary', 'focus', 'questions', 'gaps', 'ask', 'prepare'],
};

const PREP_INSTRUCTION = `You prepare one person for an interview for one specific job.
You receive JOB (the job description) and CANDIDATE (their resume; each line is labelled with where it comes from).
Return:
- "summary": 1-2 plain sentences on what this role needs day to day and what the interviewers will care about most.
- "focus": the 3-5 things they will probe hardest, each { "skill", "why": why it matters in this job (one sentence), "evidence": ONE line copied exactly from CANDIDATE that shows it, or "" if none does, "talk": 1-2 sentences on how this person should talk about it }.
- "questions": 6-8 questions this interviewer is likely to ask for THIS job, field and level. Mostly "role" questions about the actual work (the tools, methods, rules and situations of this field), plus a few "behavioural", "situational" and "motivation" ones. Each { "question", "type", "why": what they are checking, "outline": 2-4 short points the answer should cover, "use": a line copied exactly from CANDIDATE to build the answer on, or "" }.
- "gaps": up to 3 things JOB asks for that CANDIDATE does not show, each { "gap", "answer": an honest way to answer if it comes up }.
- "ask": 3 sharp questions the person can ask them about this role and team.
- "prepare": 3-5 concrete things to revise or have ready before the interview (topics, documents, examples).
Rules:
1. Only CANDIDATE is true about the person. Never give them experience, numbers, employers, tools, results or qualifications they don't have, even to fill a gap.
2. Be specific to the field: a bank job gets banking questions, an embedded job gets embedded questions, a teaching job gets classroom questions. No generic filler.
3. Outlines say what to cover using the person's real work. Where they have no example, say how to answer honestly.
4. Short, plain sentences. No markdown, no emojis, no placeholders in brackets.`;

const SECTIONS = [
    ['experience', (x) => [x.title, x.company].filter(Boolean).join(' at '), 'description'],
    ['projects', (x) => x.name, 'description'],
    ['volunteering', (x) => [x.role, x.organization].filter(Boolean).join(' at '), 'description'],
    ['education', (x) => [x.degree, x.institution].filter(Boolean).join(', '), 'details'],
];
const splitLines = (text) => String(text || '').split('\n').map((l) => l.replace(/^\s*[•\-–*]\s*/, '').trim()).filter(Boolean);
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}%+#]+/gu, ' ').trim();

/** Every line of the resume that can be quoted, with where it's from. */
function sourceLines(resume) {
    const out = [];
    if (resume?.summary) for (const l of splitLines(resume.summary)) out.push({ text: l, where: 'Summary' });
    for (const [key, label, field] of SECTIONS) {
        for (const it of Array.isArray(resume?.[key]) ? resume[key] : []) {
            const where = label(it || {}) || key[0].toUpperCase() + key.slice(1);
            for (const l of splitLines(it?.[field])) out.push({ text: l, where });
        }
    }
    const skills = Array.isArray(resume?.skills) ? resume.skills.join(', ') : resume?.skills;
    if (skills) out.push({ text: String(skills).slice(0, 400), where: 'Skills' });
    return out;
}

/** The model's input. */
function prepPrompt(resume, job) {
    const lines = sourceLines(resume).map((l) => `[${l.where}] ${l.text}`);
    const head = [resume?.personal?.title, job?.title && `Applying for: ${job.title}${job.organisation ? ` at ${job.organisation}` : ''}`].filter(Boolean);
    return `JOB:\n${String(job?.description || job?.title || '').slice(0, 12000)}\n\nCANDIDATE:\n${[...head, ...lines].join('\n').slice(0, 16000)}`;
}

/** A quoted line, if it really is one of theirs: returned as written, with where it's from. */
function findLine(quote, lines) {
    const q = norm(quote);
    if (q.length < 8) return null;
    const hit = lines.find((l) => norm(l.text) === q) || lines.find((l) => norm(l.text).includes(q) && q.length >= 20) || lines.find((l) => q.includes(norm(l.text)) && norm(l.text).length >= 20);
    return hit ? { text: hit.text, where: hit.where } : null;
}

// An outline point that says something about the person, rather than general advice.
const ABOUT_THEM = /\b(i|i'm|i've|i'd|my|me|we|our|you|your|you've|you're|yours)\b/i;
const TELL = /^(mention|describe|talk about|walk (them )?through|highlight|share|say|tell|give|relate|point to|bring up|use your)\b/i;

const text = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);

/**
 * The reply, checked and trimmed to the shape the page shows. `dropped` counts the lines
 * removed for naming facts that are in neither the resume nor the job.
 */
function checkPrep(reply, resume, job) {
    const lines = sourceLines(resume);
    const corpus = `${JSON.stringify({ ...resume, personal: undefined })}\n${job?.title || ''} ${job?.organisation || ''}\n${job?.description || ''}`;
    let dropped = 0;
    const honest = (s, max, advice = false) => {
        const t = text(s, max);
        if (!t) return '';
        if ((!advice || ABOUT_THEM.test(t) || TELL.test(t)) && newFacts(t, corpus).length) {
            dropped++;
            return '';
        }
        return t;
    };
    const focus = arr(reply?.focus, 6)
        .map((f) => ({ skill: text(f?.skill, 80), why: text(f?.why, 300), evidence: findLine(f?.evidence, lines), talk: honest(f?.talk, 400) }))
        .filter((f) => f.skill);
    const questions = arr(reply?.questions, 10)
        .map((q) => ({
            question: text(q?.question, 300),
            type: TYPES.includes(q?.type) ? q.type : 'role',
            why: text(q?.why, 300),
            outline: arr(q?.outline, 5).map((o) => honest(o, 300, true)).filter(Boolean),
            use: findLine(q?.use, lines),
        }))
        .filter((q) => q.question);
    const gaps = arr(reply?.gaps, 4)
        .map((g) => ({ gap: text(g?.gap, 160), answer: honest(g?.answer, 400) }))
        .filter((g) => g.gap);
    return {
        summary: text(reply?.summary, 500),
        focus,
        questions,
        gaps,
        ask: arr(reply?.ask, 5).map((s) => text(s, 300)).filter(Boolean),
        prepare: arr(reply?.prepare, 6).map((s) => text(s, 300)).filter(Boolean),
        dropped,
    };
}

module.exports = { PREP_SCHEMA, PREP_INSTRUCTION, prepPrompt, checkPrep, sourceLines, findLine, TYPES };
