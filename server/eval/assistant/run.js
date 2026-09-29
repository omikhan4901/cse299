/**
 * Checks the assistant's proposals against the real AI (docs/v2/PLAN.md §4, items 2–3):
 *   Rewrite    adds no facts (anything new must come back flagged as unverified)
 *   Strengthen asks questions instead of guessing, then writes only from the answers
 *   Polish     proposes no unflagged new facts, and doesn't lower the job's keyword coverage
 *
 *   AI_PROVIDER=vertex VERTEX_CREDENTIALS=key.json node eval/assistant/run.js [--repeat=2]
 *   GEMINI_API_KEY=… node eval/assistant/run.js
 * Costs a few cents per run. Writes eval/assistant/last-report.json.
 */
const path = require('node:path');
const fs = require('node:fs');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
if (!process.env.GEMINI_API_KEY && process.env.AI_PROVIDER !== 'vertex') {
    console.error('Set GEMINI_API_KEY (or AI_PROVIDER=vertex with VERTEX_CREDENTIALS).');
    process.exit(1);
}
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/resumex_eval';
process.env.JWT_SECRET ||= 'eval-secret-eval-secret-eval-secret-42';
process.env.AI_ENABLED = 'true';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { factTokens, checker } = require('../../lib/ingest');

const REWRITES = [
    { name: 'plain duties', sectionType: 'experience', text: 'responsible for handling customer complaints\nmade weekly sales reports in excel\ntrained new staff' },
    { name: 'numbers to keep', sectionType: 'experience', text: 'Built payment API in Node.js handling 5M transactions a day. Cut p99 latency by 40% with Redis caching. Mentored 4 engineers.' },
    { name: 'vague and short', sectionType: 'experience', text: 'worked on the website\nhelped the team' },
    { name: 'summary, first person', sectionType: 'summary', text: 'i am a fresh graduate in BBA from North South University, interested in marketing and brand management. did an internship at Unilever.' },
];
const STRENGTHEN = [
    { name: 'no numbers', text: 'Improved the checkout page', answers: ['It loaded in 6 seconds before and 2 seconds after', 'I rewrote the image loading and removed two heavy libraries'] },
    { name: 'teaching', text: 'Taught English to school students', answers: ['Classes 9 and 10, about 120 students', '18 of my students got GPA 5 in SSC 2023'] },
];
const POLISH = {
    resume: {
        personal: { name: 'Rafi Ahmed', title: 'Software Engineer' },
        summary: 'Software engineer who builds backend services.',
        experience: [{ id: 1, company: 'Pathao', title: 'Software Engineer', startDate: 'Jan 2022', endDate: 'Present', description: 'Built payout service in Node.js\nWrote SQL queries for reports\nFixed bugs in the rider app' }],
        projects: [{ id: 2, name: 'Bus Tracker', technologies: 'PostgreSQL, Redis', description: 'Live bus positions for 60 routes' }],
        skills: 'Node.js, PostgreSQL, Redis, Docker, Git',
    },
    job: 'Backend Engineer\n\nWe need a backend engineer to build payment APIs.\nRequirements:\n- Node.js and PostgreSQL\n- Redis caching\n- REST API design\n- Docker\n- Experience with payments is a plus',
};

(async () => {
    const { jobMatch } = await import(path.join(__dirname, '../../../client/src/lib/applications.js'));
    const { applyOperations } = await import(path.join(__dirname, '../../../client/src/lib/ingest/ops.js'));
    const { normalizeResume } = await import(path.join(__dirname, '../../../client/src/lib/resume.js'));
    await mongoose.connect(process.env.MONGO_URI);
    const app = require('../../app');
    const { updateSettings } = require('../../lib/settings');
    await updateSettings({ rateLimits: { 'ai-minute': { max: 1000, windowMs: 60000 }, 'api-ip': { max: 100000, windowMs: 60000 } } }, 'eval');
    const User = require('../../models/User');
    const user = (await User.findOne({ email: 'eval@resumex.test' })) || (await User.create({ name: 'Eval', email: 'eval@resumex.test', password: 'x'.repeat(60) }));
    await User.updateOne({ _id: user._id }, { creditLimit: 100000, creditPeriod: 'day' });
    const token = jwt.sign({ id: user._id, v: user.sessionVersion || 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const post = async (route, body) => {
        const started = Date.now();
        const res = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        return { ok: res.ok, status: res.status, ms: Date.now() - started, body: await res.json() };
    };

    const rows = [];
    const rounds = Number(args.repeat) || 1;
    for (let round = 0; round < rounds; round++) {
        for (const c of REWRITES) {
            const r = await post('/ai/refine', { resumeText: c.text, sectionType: c.sectionType, fullResume: { personal: { title: '' }, skills: '' } });
            if (!r.ok) { rows.push({ kind: 'rewrite', name: c.name, error: `${r.status} ${r.body.error}` }); continue; }
            // Every fact-looking token must be in the input or come back flagged.
            const tokens = [...new Set(factTokens(r.body.refinedText))];
            const flagged = r.body.unverified || [];
            // A safety net for the route's own flagging: nothing new may pass unflagged.
            const unflaggedNew = tokens.filter((t) => !flagged.includes(t) && !checker(c.text).known(t));
            const lostNumbers = (c.text.match(/\d[\d.,]*%?/g) || []).filter((n) => !r.body.refinedText.includes(n.replace(/[.,]$/, '')));
            rows.push({ kind: 'rewrite', name: c.name, ms: r.ms, flagged, unflaggedNew, lostNumbers, pass: !unflaggedNew.length && !lostNumbers.length, out: r.body.refinedText });
        }
        for (const c of STRENGTHEN) {
            const ask = await post('/ai/strengthen', { text: c.text });
            if (!ask.ok) { rows.push({ kind: 'strengthen', name: c.name, error: `${ask.status} ${ask.body.error}` }); continue; }
            const questions = ask.body.questions || [];
            const answers = questions.slice(0, c.answers.length).map((q, i) => ({ q, a: c.answers[i] }));
            const write = await post('/ai/strengthen', { text: c.text, answers });
            if (!write.ok) { rows.push({ kind: 'strengthen', name: c.name, questions, error: `${write.status} ${write.body.error}` }); continue; }
            const usedAnswer = c.answers.some((a) => (a.match(/\d+/g) || []).some((n) => write.body.text.includes(n)));
            rows.push({
                kind: 'strengthen', name: c.name, ms: ask.ms + write.ms, questions, flagged: write.body.unverified || [], usedAnswer,
                pass: questions.length >= 1 && questions.length <= 4 && !(write.body.unverified || []).length && usedAnswer, out: write.body.text,
            });
        }
        const p = await post('/ai/polish', { resume: POLISH.resume, jobDescription: POLISH.job });
        if (!p.ok) rows.push({ kind: 'polish', name: 'backend job', error: `${p.status} ${p.body.error}` });
        else {
            const ops = p.body.operations || [];
            const flagged = ops.filter((o) => o.flags?.some((f) => f.kind === 'unverified'));
            const applied = ops.filter((o) => !flagged.includes(o));
            const before = jobMatch(normalizeResume(POLISH.resume), POLISH.job)?.score;
            const after = jobMatch(applyOperations(normalizeResume(POLISH.resume), applied), POLISH.job)?.score;
            rows.push({
                kind: 'polish', name: 'backend job', ms: p.ms, proposals: ops.length, flagged: flagged.map((o) => o.flags.find((f) => f.kind === 'unverified').tokens.join('/')),
                before, after, pass: ops.length > 0 && after >= before, out: ops.map((o) => o.to || o.value).join(' | '),
            });
        }
    }
    server.close();
    await mongoose.disconnect();

    for (const r of rows) {
        console.log(`\n[${r.pass ? 'PASS' : r.error ? 'ERROR' : 'FAIL'}] ${r.kind} · ${r.name}${r.ms ? ` · ${(r.ms / 1000).toFixed(1)} s` : ''}`);
        if (r.error) { console.log(`    ${r.error}`); continue; }
        if (r.questions) console.log(`    asked: ${r.questions.join(' / ')}`);
        if (r.flagged?.length) console.log(`    flagged for review: ${r.flagged.join(', ')}`);
        if (r.unflaggedNew?.length) console.log(`    NEW FACTS NOT FLAGGED: ${r.unflaggedNew.join(', ')}`);
        if (r.lostNumbers?.length) console.log(`    numbers dropped: ${r.lostNumbers.join(', ')}`);
        if (r.before != null) console.log(`    keyword coverage ${r.before}% → ${r.after}% (${r.proposals} proposals)`);
        console.log(`    → ${String(r.out).slice(0, 300).replace(/\n/g, ' ⏎ ')}`);
    }
    const passed = rows.filter((r) => r.pass).length;
    console.log(`\n${passed} of ${rows.length} passed${rows.some((r) => r.error) ? ` (${rows.filter((r) => r.error).length} errors)` : ''}`);
    fs.writeFileSync(path.join(__dirname, 'last-report.json'), JSON.stringify({ at: new Date(), rows }, null, 2));
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
