/**
 * AI polish (V2, docs/v2/SPEC.md §5.3) and the two editing modes (§5.2):
 *   - polish: rewrites a tailored resume's summary and its top points in the job's language,
 *     using only the resume's own facts;
 *   - rewrite (truth-preserving) and strengthen (asks questions, writes only from answers).
 * The AI proposes; these checks flag anything that looks new, and the person decides.
 */
const { checker, factTokens } = require('./ingest');

const POINTS = { experience: 'description', projects: 'description', volunteering: 'description' };
const lines = (text) => String(text || '').split('\n').map((l) => l.replace(/^\s*[•\-–*]\s*/, '').trim()).filter(Boolean);

/** Numbers, names and tools in `text` that aren't in `corpus` (what the person wrote or had). */
function newFacts(text, corpus) {
    const { known } = checker(corpus);
    return [...new Set(factTokens(text))].filter((t) => !known(t));
}

const POLISH_SCHEMA = {
    type: 'OBJECT',
    properties: {
        summary: { type: 'STRING' },
        points: { type: 'ARRAY', items: { type: 'OBJECT', properties: { from: { type: 'STRING' }, to: { type: 'STRING' } }, required: ['from', 'to'] } },
    },
    required: ['points'],
};

const POLISH_INSTRUCTION = `You polish a resume for one specific job.
You receive RESUME (its summary and points, each point on its own line) and JOB (the job description).
Return:
- "summary": the summary rewritten in 2-4 sentences for this job, or "" if it is already right or there is none.
- "points": up to 8 of the points that matter most for this job, each as { "from": the point exactly as written, "to": the rewrite }.
Rules:
1. Use only facts from RESUME. Never add numbers, tools, employers, results or claims that aren't there, even if JOB asks for them.
2. Use the job's words for things the person really did (e.g. "REST APIs" if they built APIs).
3. Start points with a strong past-tense verb for finished work; keep numbers exactly.
4. Leave out points that are already good; never return "from" text that isn't in RESUME.`;

/** The model's input: the resume's text parts and the job. */
function polishPrompt(resume, jobText) {
    const parts = [`SUMMARY: ${resume.summary || '(none)'}`];
    for (const [section, field] of Object.entries(POINTS)) {
        for (const it of Array.isArray(resume[section]) ? resume[section] : []) {
            const pts = lines(it?.[field]);
            if (pts.length) parts.push(`${[it.title || it.name || it.role, it.company || it.organization].filter(Boolean).join(' at ')}:\n${pts.join('\n')}`);
        }
    }
    return `RESUME:\n${parts.join('\n\n').slice(0, 20000)}\n\nJOB:\n${String(jobText || '').slice(0, 12000)}`;
}

/**
 * The reply as reviewable operations on the resume (client/src/lib/ingest/ops.js format):
 * "set summary" and "replaceBullet" per point. Rewrites of points that don't exist are dropped;
 * anything new is flagged "unverified" (the review screen leaves it unticked).
 */
function polishOperations(reply, resume) {
    const corpus = JSON.stringify({ ...resume, personal: undefined });
    const ops = [];
    const summary = String(reply?.summary || '').trim();
    if (summary && summary !== String(resume.summary || '').trim()) {
        const unverified = newFacts(summary, corpus);
        ops.push({ op: 'set', field: 'summary', value: summary.slice(0, 1500), flags: [...(resume.summary ? [{ kind: 'replaces', fields: ['summary'] }] : []), ...(unverified.length ? [{ kind: 'unverified', tokens: unverified }] : [])] });
    }
    const seen = new Set();
    for (const p of Array.isArray(reply?.points) ? reply.points.slice(0, 12) : []) {
        const from = String(p?.from || '').trim();
        const to = String(p?.to || '').trim().slice(0, 400);
        if (!from || !to || from === to || seen.has(from)) continue;
        let target = null;
        for (const [section, field] of Object.entries(POINTS)) {
            const it = (resume[section] || []).find((x) => lines(x?.[field]).includes(from));
            if (it) {
                target = { section, id: it.id };
                break;
            }
        }
        if (!target) continue; // a point that isn't in the resume
        seen.add(from);
        const unverified = newFacts(to, corpus);
        ops.push({ op: 'replaceBullet', section: target.section, target: target.id, from, to, ...(unverified.length ? { flags: [{ kind: 'unverified', tokens: unverified }] } : {}) });
    }
    return ops.map((o, i) => ({ ...o, key: `p${i + 1}` }));
}

const QUESTIONS_SCHEMA = { type: 'OBJECT', properties: { questions: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['questions'] };
const STRENGTHEN_ASK = `You help someone make one resume point stronger without inventing anything.
Ask 2 to 4 short, concrete questions whose answers would make the point stronger: what changed because of it, by roughly how much (numbers), how many people or users, which tools, was it shipped or used. Ask only about things the point doesn't already say. Plain words, one question each.`;
const STRENGTHEN_WRITE = `You rewrite one resume point using the original point and the person's answers.
Use the answers: include every number, tool and result they give, exactly as they give it, with numbers as digits (e.g. "120 students", "from 6 s to 2 s").
Add nothing that isn't in the point or the answers. Skip questions they left unanswered or answered with something unrelated.
Write one strong point (two only if the answers clearly describe two achievements), past tense, starting with a verb. Reply with the point text only.`;

module.exports = { POLISH_SCHEMA, POLISH_INSTRUCTION, polishPrompt, polishOperations, newFacts, QUESTIONS_SCHEMA, STRENGTHEN_ASK, STRENGTHEN_WRITE };
