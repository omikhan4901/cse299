/**
 * Fuzz: every route in the app gets malformed ids, bodies and query strings.
 * Bad input must be answered with a 4xx, never a 500 or a crash, and the API
 * must still be up afterwards. Routes are read from the app itself, so a new
 * endpoint is fuzzed without editing this file.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, resetState, ai } = require('./helpers');

const HUGE = 'x'.repeat(200_000);
const WEIRD = [null, [], {}, '', 'x', HUGE, 0, -1, 1e308, true, { $gt: '' }, { $where: 'sleep(100)' }, ['a', { $ne: 1 }], { __proto__: { admin: true } }, { a: { b: { c: { d: { e: {} } } } } }, '<script>x</script>', '../../etc/passwd', '\u0000', 'NaN'];
// Field names used across the API; a fuzzed body sets all of them to one odd value.
const FIELDS = ['name', 'email', 'password', 'currentPassword', 'newPassword', 'code', 'token', 'ticket', 'title', 'data', 'template', 'design', 'photo', 'isPublic', 'shareMode', 'prompt', 'text', 'resume', 'resumeData', 'jobDescription', 'section', 'context', 'messages', 'message', 'tone', 'plan', 'planExpiresAt', 'banned', 'bannedReason', 'role', 'credits', 'freeMode', 'plans', 'featureCosts', 'registration', 'templates', 'rateLimits', 'maxUses', 'expiresAt', 'paused', 'domains', 'campaignCode', 'recoveryCode', 'baseUpdatedAt', 'q', 'page', 'limit'];

const BODIES = [
    ...WEIRD.filter((v) => v !== undefined).map((v) => ({ body: v })),
    ...WEIRD.map((v) => ({ body: Object.fromEntries(FIELDS.map((f) => [f, v])) })),
    { raw: '{"broken json', headers: { 'Content-Type': 'application/json' } },
    { raw: 'a=1&a=2&b[c]=3', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    { raw: '\u0000\u0001\u0002', headers: { 'Content-Type': 'text/plain' } },
    { raw: '{"a":1}', headers: { 'Content-Type': 'application/json; charset=utf-7' } },
];
// A valid-looking body; single-field fuzzing breaks one field of it at a time, so
// requests get past the first check and reach the deeper code.
const BASE = {
    name: 'Fuzz Tester', email: 'fuzz@test.dev', password: 'password123', currentPassword: 'password123', newPassword: 'password456',
    nickname: 'Fuzzed', template: 'Classic', personal: { fullName: 'Fuzz', email: 'f@test.dev' }, experience: [{ title: 'Dev', company: 'X', description: 'Did things' }],
    resumeText: 'Built things', sectionType: 'summary', fullResume: { personal: { title: 'Dev' }, skills: 'JS' },
    conversation: [{ role: 'user', content: 'Hi' }], resumeData: { personal: { fullName: 'Fuzz' }, summary: 'A dev' }, jobDescription: 'A job',
    code: '123456', token: 'abc', plan: 'pro', credits: 5, role: 'user', banned: false, maxUses: 5, durationDays: 30, creditLimit: 10,
};
const SINGLE = [null, [], {}, HUGE, '\u0000', 'a\u0000b@x.com', 1e308, -1, { $gt: '' }, [{ $ne: 1 }], true];
const QUERIES = ['', '?q=%00', '?q=a%00b&page=%00', '?page=-1&limit=1e9', '?page[$gt]=1&q[$regex]=.*', '?q=((((((((((a', '?limit=abc&page=NaN&sort=__proto__', `?q=${'a'.repeat(5000)}`, '?role=superadmin&plan[]=pro&plan[]=x'];

function routes(app) {
    const out = [];
    const walk = (stack, prefix) => {
        for (const layer of stack) {
            if (layer.route) {
                for (const m of Object.keys(layer.route.methods)) out.push([m.toUpperCase(), prefix + layer.route.path]);
            } else if (layer.name === 'router' && layer.handle.stack) {
                const p = layer.regexp.source.replace('^\\', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
                walk(layer.handle.stack, prefix + p);
            }
        }
    };
    walk(app._router.stack, '');
    return out.map(([m, p]) => [m, p.replace(/^\/+api/, '').replace(/\/$/, '') || '/']).filter(([, p]) => p.startsWith('/'));
}

/** Ids to try for each ":param": a real one the caller owns, someone else's, and junk. */
const IDS = (own, other) => [own, other, '000000000000000000000000', 'not-an-id', '%24gt', '..%2F..%2Fadmin', 'a'.repeat(3000), '__proto__', 'constructor'];

// Lift every per-IP/per-account limit so fuzz requests reach the handlers.
async function liftLimits() {
    const { describeLimits, setOverrides } = require('../lib/rateLimit');
    setOverrides(Object.fromEntries(describeLimits().map((l) => [l.name, { max: 1e6, windowMs: l.windowMs }])));
}

describe('fuzz: malformed input never causes a 5xx', () => {
    const crashes = [];
    const onCrash = (err) => crashes.push(String(err?.stack || err));
    const quiet = console.error;
    before(async () => {
        console.error = () => {}; // handlers log what they reject; keep the report readable
        process.on('uncaughtException', onCrash);
        process.on('unhandledRejection', onCrash);
        await start('fuzz');
        await resetState();
    });
    after(async () => {
        console.error = quiet;
        process.off('uncaughtException', onCrash);
        process.off('unhandledRejection', onCrash);
        await stop();
    });

    it('every route answers malformed ids, bodies and queries with < 500', { timeout: 600_000 }, async () => {
        const app = require('../app');
        const failures = [];
        const all = routes(app);
        assert.ok(all.length > 40, `found ${all.length} routes`);
        // Destructive self-service routes last, so they don't cut the session short for the rest.
        const destructive = /\/auth\/(me|logout-all|password)$|\/2fa\/disable/;
        all.sort((a, b) => destructive.test(a[1]) - destructive.test(b[1]));

        for (const [method, path] of all) {
            await resetState();
            await liftLimits();
            ai.reply = '{"score":50,"summary":"ok","strengths":[],"improvements":[],"missingKeywords":[]}';
            const user = await register();
            const other = await register();
            const boss = await superadmin();
            const mine = await api('POST', '/resumes', { token: user.token, body: { nickname: 'Mine' } });
            const theirs = await api('POST', '/resumes', { token: other.token, body: { nickname: 'Theirs' } });
            const ownId = path.startsWith('/admin') ? String(user.user?.id || user.user?._id) : mine.body.data?._id;
            const otherId = path.startsWith('/admin') ? String(boss.user._id) : theirs.body.data?._id;
            const ids = path.includes(':') ? IDS(ownId, otherId) : [null];
            const tokens = path.startsWith('/admin') ? [boss.token, user.token] : [user.token, undefined, 'garbage.token.here'];

            for (const id of ids) {
                const url = id === null ? path : path.replace(/:[a-zA-Z]+/g, encodeURIComponent(id).replace(/%25/g, '%'));
                for (const token of tokens) {
                    const variants = method === 'GET' || method === 'DELETE' ? QUERIES.map((q) => ({ q })) : BODIES.map((b) => ({ q: '', ...b }));
                    // One broken field at a time, from a valid body (first id and token only, to keep it quick).
                    if (method !== 'GET' && method !== 'DELETE' && id === ids[0] && token === tokens[0]) {
                        for (const field of Object.keys(BASE)) for (const value of SINGLE) variants.push({ q: '', body: { ...BASE, [field]: value } });
                    }
                    for (const v of variants) {
                        const r = await api(method, url + v.q, { token, body: v.body, raw: v.raw, headers: v.headers });
                        if (r.status >= 500) failures.push(`${method} ${url}${v.q} ${JSON.stringify(v.body ?? v.raw)?.slice(0, 120)} -> ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
                    }
                }
            }
        }
        if (process.env.FUZZ_REPORT) require('fs').writeFileSync(process.env.FUZZ_REPORT, failures.join('\n'));
        const health = await api('GET', '/health');
        assert.equal(health.status, 200, 'API must still be up');
        assert.deepEqual(crashes, [], 'no uncaught errors');
        assert.deepEqual(failures.slice(0, 40), [], `${failures.length} requests got a 5xx`);
    });
});
