/**
 * Test harness: runs the real Express app on a random port against a
 * throwaway database (TEST_MONGO_URI, default a local "resumex_test"), with the
 * Gemini API stubbed so AI routes, credits and refunds can be tested offline.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-42';
process.env.SUPERADMIN_EMAILS = 'boss@test.dev';
process.env.GEMINI_API_KEY = 'test-key';
process.env.AI_ENABLED = 'true';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/resumex_test';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { resetLimits, setOverrides } = require('../lib/rateLimit');

// ---- Gemini stub: tests decide what the "AI" answers ----
const realFetch = globalThis.fetch;
const ai = { reply: 'AI says hi', status: 200, calls: 0, delayMs: 0, aborted: 0, tokens: 0, last: null };
globalThis.fetch = async (url, opts) => {
    // Vertex AI sign-in (lib/vertex.js): a service account key exchanged for a token.
    if (String(url) === 'https://oauth2.googleapis.com/token') {
        ai.tokens += 1;
        return new Response(JSON.stringify({ access_token: `token-${ai.tokens}`, expires_in: 3600 }), { status: 200 });
    }
    if (/generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com/.test(String(url))) {
        ai.calls += 1;
        ai.last = { url: String(url), headers: opts?.headers || {}, body: JSON.parse(opts.body) };
        // A slow answer, which the caller can cancel like a real request.
        if (ai.delayMs) {
            await new Promise((resolve, reject) => {
                const t = setTimeout(resolve, ai.delayMs);
                opts?.signal?.addEventListener('abort', () => {
                    clearTimeout(t);
                    ai.aborted += 1;
                    reject(opts.signal.reason || new Error('aborted'));
                });
            });
        }
        if (ai.status !== 200) return new Response(JSON.stringify({ error: { message: ai.errorMessage || 'stub failure' } }), { status: ai.status });
        const text = typeof ai.reply === 'function' ? ai.reply(JSON.parse(opts.body)) : ai.reply;
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
    }
    // Paddle's API: tests set paddleApi.handler(url, opts) to answer like Paddle would.
    if (/paddle\.com/.test(String(url))) {
        paddleApi.calls.push({ url: String(url), method: opts?.method || 'GET', body: opts?.body ? JSON.parse(opts.body) : undefined });
        const reply = paddleApi.handler ? await paddleApi.handler(String(url), opts) : null;
        return new Response(JSON.stringify(reply?.body ?? { error: { code: 'not_found', detail: 'stub' } }), { status: reply?.status ?? (reply ? 200 : 404), headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, opts);
};
const paddleApi = { handler: null, calls: [] };

let server;
let base;
let realMongo = true;
/** Skip reason for tests that need MongoDB's atomic updates (see start()). */
const needsRealMongo = () => (realMongo ? false : 'needs real MongoDB (FerretDB is not atomic under concurrent updates)');

/** Starts the API on a random port with its own empty database (one per test file). */
async function start(name = 'default') {
    if (server) return;
    const uri = process.env.MONGO_URI.replace(/\/([^/?]+)(\?|$)/, `/$1_${name}$2`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    await mongoose.connection.db.dropDatabase();
    // FerretDB (handy for local runs) doesn't make single-document updates atomic under
    // load the way MongoDB does, so concurrency tests only run against real MongoDB.
    const info = await mongoose.connection.db.admin().command({ buildInfo: 1 });
    realMongo = !info.ferretdb && !info.ferretdbFeatures;
    const app = require('../app');
    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });
    base = `http://127.0.0.1:${server.address().port}/api`;
}

async function stop() {
    if (!server) return;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    server = null;
}

/** Calls the API. Returns { status, body, headers }. */
async function api(method, path, { token, body, headers = {}, raw } = {}) {
    const res = await realFetch(base + path, {
        method,
        headers: { ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
}

let counter = 0;
const uniqueEmail = (prefix = 'user') => `${prefix}${Date.now()}${++counter}@test.dev`;

/** Registers a user and returns { token, user, email, password }. */
async function register(extra = {}) {
    const email = extra.email || uniqueEmail();
    const password = extra.password || 'password123';
    const r = await api('POST', '/auth/register', { body: { name: extra.name || 'Test User', email, password, ...extra.body } });
    if (r.status !== 201) throw new Error(`register failed: ${r.status} ${JSON.stringify(r.body)}`);
    return { token: r.body.token, user: r.body.user, email, password };
}

/** A super admin with a verified email, 2FA on, and a session that passed 2FA. */
async function superadmin() {
    const User = require('../models/User');
    const totp = require('../lib/totp');
    let user = await User.findOne({ email: 'boss@test.dev' });
    if (!user) {
        await register({ email: 'boss@test.dev', name: 'Boss' });
        user = await User.findOne({ email: 'boss@test.dev' });
    }
    user.emailVerifiedAt = new Date();
    user.twoFactor = { enabled: true, secret: totp.encrypt(totp.generateSecret()), lastStep: 0, recoveryCodes: [] };
    await user.save();
    const token = jwt.sign({ id: user._id, v: user.sessionVersion || 0, mfa: true }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    return { token, user };
}

/** Changes settings directly (as an admin would) and applies them now. */
async function setSettings(patch) {
    const { updateSettings } = require('../lib/settings');
    return updateSettings(patch, 'test');
}

/** Reset settings to defaults and clear rate-limit counters between tests. */
async function resetState() {
    const Settings = require('../models/Settings');
    await Settings.deleteMany({});
    await setSettings(require('../lib/settings').DEFAULTS);
    resetLimits();
    // Tests make many requests from one IP; lift the per-IP ceilings unless a test sets its own.
    setOverrides({});
    ai.reply = 'AI says hi';
    ai.status = 200;
    ai.calls = 0;
    ai.delayMs = 0;
    ai.aborted = 0;
    ai.tokens = 0;
    ai.last = null;
    ai.errorMessage = null;
    delete process.env.AI_PROVIDER;
    delete process.env.VERTEX_CREDENTIALS;
    require('../lib/vertex').reset();
    paddleApi.handler = null;
    paddleApi.calls = [];
    require('../lib/paddle').resetPaddleCache();
    delete process.env.AI_TIMEOUT_MS;
}

/** The API's base URL (for raw fetch calls). */
const baseUrl = () => base;

module.exports = { paddleApi, baseUrl, needsRealMongo, start, stop, api, register, superadmin, setSettings, resetState, uniqueEmail, ai };
