/**
 * Runs the import evaluation against the real AI (costs a few cents per run).
 *
 *   GEMINI_API_KEY=… MONGO_URI=mongodb://127.0.0.1:27017/resumex_eval node eval/ingest/run.js [--only=name] [--repeat=2]
 *   AI_PROVIDER=vertex VERTEX_CREDENTIALS=key.json node eval/ingest/run.js     (through Vertex AI)
 *   node eval/ingest/run.js --rescore     (scores the saved operations again, without the AI)
 *
 * Goes through the real /ai/ingest route (prompt, model, deterministic checks), applies
 * everything (a flagged card counts as one correction: the person has to read and tick it),
 * and scores the result. Writes eval/ingest/last-report.json. Pass criteria: docs/v2/SPEC.md §12.
 */
const path = require('node:path');
const fs = require('node:fs');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const REPORT = path.join(__dirname, 'last-report.json');
if (!process.env.GEMINI_API_KEY && process.env.AI_PROVIDER !== 'vertex' && !args.rescore) {
    console.error('Set GEMINI_API_KEY (or AI_PROVIDER=vertex with VERTEX_CREDENTIALS) to run the evaluation against the real model.');
    process.exit(1);
}
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/resumex_eval';
process.env.JWT_SECRET ||= 'eval-secret-eval-secret-eval-secret-42';
process.env.AI_ENABLED = 'true';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cases = require('./cases');
const { scoreCase } = require('./score');

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

(async () => {
    const { applyOperations, outlineOf } = await import(path.join(__dirname, '../../../client/src/lib/ingest/ops.js'));
    const { normalizeResume } = await import(path.join(__dirname, '../../../client/src/lib/resume.js'));

    // "Add all" applies what isn't flagged; each flagged card is one decision for the
    // person (they read it and tick it), so it costs one correction and is then applied.
    // Invented facts only count in unflagged operations: flagged ones were shown as such.
    const score = (c, operations) => {
        const original = normalizeResume(c.resume || {});
        const flagged = operations.filter((o) => o.flags?.some((f) => f.kind === 'unverified'));
        const applied = operations.filter((o) => !flagged.includes(o));
        const result = applyOperations(original, operations);
        return { withheld: flagged.map((o) => o.flags.find((f) => f.kind === 'unverified').tokens.join('/')), ...scoreCase(c, { original, result, applied, reviewed: flagged.length }) };
    };

    if (args.rescore) {
        const saved = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
        const rows = saved.rows.map((r) => {
            const c = cases.find((x) => x.name === r.name);
            return !c || r.error ? r : { ...r, ...score(c, r.operations) };
        });
        return report(rows, false);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const app = require('../../app');
    const { updateSettings } = require('../../lib/settings');
    await updateSettings({ rateLimits: { 'ai-minute': { max: 1000, windowMs: 60000 }, 'api-ip': { max: 100000, windowMs: 60000 } } }, 'eval');
    const User = require('../../models/User');
    const user =
        (await User.findOne({ email: 'eval@resumex.test' })) ||
        (await User.create({ name: 'Eval', email: 'eval@resumex.test', password: 'x'.repeat(60) }));
    await User.updateOne({ _id: user._id }, { creditLimit: 100000, creditPeriod: 'day' });
    const token = jwt.sign({ id: user._id, v: user.sessionVersion || 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api`;

    const selected = cases.filter((c) => !args.only || c.name.includes(args.only));
    const rounds = Number(args.repeat) || 1;
    const rows = [];
    for (let round = 0; round < rounds; round++) {
        for (const c of selected) {
            const original = normalizeResume(c.resume || {});
            const started = Date.now();
            const res = await fetch(`${base}/ai/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ text: c.input, outline: outlineOf(original) }),
            });
            const body = await res.json();
            if (!res.ok) {
                rows.push({ name: c.name, error: `${res.status} ${body.error}`, corrections: 0, invented: [], notes: [] });
                continue;
            }
            rows.push({ name: c.name, ms: Date.now() - started, ops: body.operations.length, skipped: body.skipped, ...score(c, body.operations), operations: body.operations });
        }
    }
    server.close();
    await mongoose.disconnect();
    report(rows, true);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});

function report(rows, save) {
    const pad = (s, n) => String(s).padEnd(n).slice(0, n);
    console.log(`\n${pad('case', 46)} ${pad('fix', 4)} ${pad('ops', 4)} ${pad('held', 5)} invented`);
    for (const r of rows) console.log(`${pad(r.name, 46)} ${pad(r.corrections, 4)} ${pad(r.ops ?? '-', 4)} ${pad(r.withheld?.length ?? '-', 5)} ${r.error || r.invented.join(', ')}`);
    for (const r of rows.filter((x) => x.notes.length || x.withheld?.length)) {
        console.log(`\n· ${r.name}`);
        for (const n of r.notes) console.log(`    ${n}`);
        if (r.withheld?.length) console.log(`    withheld (flagged): ${r.withheld.join(' | ')}`);
    }
    const ran = rows.filter((r) => !r.error);
    const fixes = ran.map((r) => r.corrections);
    const invented = ran.reduce((n, r) => n + r.invented.length, 0);
    const pass = ran.length === rows.length && median(fixes) <= 1 && Math.max(...fixes) <= 2 && invented === 0;
    const verdict = ran.length < rows.length ? `INCOMPLETE (${rows.length - ran.length} of ${rows.length} couldn't reach the AI)` : pass ? 'PASS' : 'FAIL';
    console.log(`\nmedian corrections ${median(fixes)} · max ${ran.length ? Math.max(...fixes) : '-'} · invented ${invented} → ${verdict} (median ≤ 1, max ≤ 2, invented 0)`);
    // A run where nothing reached the AI would only overwrite the last useful report.
    if (save && ran.length) fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), pass, rows }, null, 2));
    process.exit(pass ? 0 : 1);
}
