/**
 * Load test (docs/v2/BETA-PLAN.md, Phase 5): simulated signed-in users doing what beta
 * students do (open the builder, autosave every few seconds, check credits, track
 * applications, run the ATS checker) against a running API, reporting latency per route,
 * errors, rate limiting and the server's memory. Not part of `npm test`; AI is left out (its
 * latency is Google's, and credit is limited).
 *
 *   MONGO_URI=... JWT_SECRET=... API=http://localhost:5000/api USERS=80 SECONDS=60 \
 *     SERVER_PIDS="$(pgrep -f '^node server.js')" node load/run.js
 *
 * Test accounts (load-*@load.test) are created directly in the database (sign-up limits
 * would stop hundreds from one machine) and deleted with their data at the end.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const API = process.env.API || 'http://localhost:5000/api';
const USERS = Number(process.env.USERS) || 80;
const SECONDS = Number(process.env.SECONDS) || 60;
const PIDS = String(process.env.SERVER_PIDS || '').split(/\s+/).filter(Boolean);
const PDF = fs.readFileSync(path.join(__dirname, '../test/fixtures/single-column.pdf'));

const stats = new Map(); // route -> { times: [], codes: {} }
const note = (route, ms, code) => {
    const s = stats.get(route) || { times: [], codes: {} };
    s.times.push(ms);
    s.codes[code] = (s.codes[code] || 0) + 1;
    stats.set(route, s);
};
async function call(route, method, url, token, body, raw) {
    const t = performance.now();
    let code = 0;
    let json = null;
    try {
        const res = await fetch(API + url, {
            method,
            headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
            body: raw || (body ? JSON.stringify(body) : undefined),
        });
        code = res.status;
        json = await res.json().catch(() => null);
    } catch {
        code = 'net';
    }
    note(route, performance.now() - t, code);
    return { code, json };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.5 + Math.random());

async function user(token, i, until) {
    await call('GET /auth/me', 'GET', '/auth/me', token);
    await call('GET /billing/plans', 'GET', '/billing/plans', token);
    await call('GET /billing/me', 'GET', '/billing/me', token);
    await call('GET /resumes', 'GET', '/resumes', token);
    const made = await call('POST /resumes', 'POST', '/resumes', token, { nickname: `Load ${i}`, summary: 'Computer science graduate.', experience: [{ id: 1, role: 'Intern', company: 'Acme', description: 'Built things.' }] });
    const id = made.json?.data?._id;
    let rev = made.json?.data?.rev || 0;
    if (i % 10 === 0) {
        const form = new FormData();
        form.append('resume', new Blob([PDF], { type: 'application/pdf' }), 'cv.pdf');
        const t = performance.now();
        const res = await fetch(`${API}/ats/scan`, { method: 'POST', body: form }).catch(() => null);
        note('POST /ats/scan (PDF)', performance.now() - t, res ? res.status : 'net');
    }
    let tick = 0;
    while (Date.now() < until) {
        await sleep(jitter(3000));
        tick++;
        if (id) {
            const r = await call('PUT /resumes/:id (autosave)', 'PUT', `/resumes/${id}`, token, { summary: `Computer science graduate. Edit ${tick}.`, baseRev: rev });
            if (r.json?.data?.rev != null) rev = r.json.data.rev;
            else if (r.code === 409) rev = r.json?.data?.rev ?? rev;
        }
        if (tick % 5 === 0) await call('GET /billing/me', 'GET', '/billing/me', token);
        if (tick % 7 === 0) await call('GET /applications', 'GET', '/applications', token);
        if (tick % 11 === 0) await call('POST /applications', 'POST', '/applications', token, { job: { title: 'Software Engineer', organisation: `Company ${i}-${tick}` } });
        if (tick % 13 === 0) await call('GET /profile', 'GET', '/profile', token);
    }
}

const pct = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
};
const rss = () =>
    PIDS.map((pid) => {
        try {
            return Number(/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, 'utf8'))[1]) / 1024;
        } catch {
            return null;
        }
    });

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const User = require('../models/User');
    const ids = [];
    for (let i = 0; i < USERS; i++) {
        const u = await User.create({ name: `Load ${i}`, email: `load-${Date.now()}-${i}@load.test`, password: 'x'.repeat(60), plan: 'pro', emailVerifiedAt: new Date(), v2Preview: true });
        ids.push(u._id);
    }
    const tokens = ids.map((id) => jwt.sign({ id, v: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' }));
    const memory = [rss()];
    const sampler = setInterval(() => memory.push(rss()), 5000);
    const t0 = Date.now();
    const until = t0 + SECONDS * 1000;
    // Everyone arrives within the first 10 seconds (a class opening the link together).
    await Promise.all(tokens.map((tk, i) => sleep((i / USERS) * 10_000).then(() => user(tk, i, until))));
    clearInterval(sampler);
    memory.push(rss());

    let total = 0;
    let errors = 0;
    let limited = 0;
    const rows = [];
    for (const [route, s] of [...stats].sort()) {
        total += s.times.length;
        const five = Object.entries(s.codes).filter(([c]) => c === 'net' || Number(c) >= 500).reduce((n, [, v]) => n + v, 0);
        errors += five;
        limited += s.codes[429] || 0;
        rows.push(`${route.padEnd(30)} n=${String(s.times.length).padStart(5)}  p50=${pct(s.times, 50).toFixed(0).padStart(5)}ms  p95=${pct(s.times, 95).toFixed(0).padStart(5)}ms  p99=${pct(s.times, 99).toFixed(0).padStart(5)}ms  codes=${JSON.stringify(s.codes)}`);
    }
    const secs = (Date.now() - t0) / 1000;
    console.log(`\n${USERS} users for ${secs.toFixed(0)} s: ${total} requests (${(total / secs).toFixed(1)}/s), 5xx or network errors: ${errors}, rate limited: ${limited}`);
    console.log(rows.join('\n'));
    if (PIDS.length) console.log(`server memory (MB) start ${memory[0].map((m) => m?.toFixed(0)).join('/')}, peak ${PIDS.map((_, k) => Math.max(...memory.map((m) => m[k] || 0)).toFixed(0)).join('/')}, end ${memory.at(-1).map((m) => m?.toFixed(0)).join('/')}`);

    // Clean up the test accounts and everything they made.
    const { deleteUserData } = require('../lib/userData');
    for (const id of ids) await deleteUserData(id);
    await User.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
    process.exit(errors ? 1 : 0);
})();
