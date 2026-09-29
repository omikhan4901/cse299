/**
 * Limits on every AI feature (lib/aiLimits.js): input refused or trimmed before the model is
 * called, output and thinking capped on every call, file pages limited, a worst-case cost per
 * request that the browser computes the same way (client/src/lib/aiCost.js). Stubbed model.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { start, stop, api, register, setSettings, resetState, ai } = require('./helpers');
const { DEFAULT_LIMITS, cleanLimits, worstCase, dearest, generationLimits } = require('../lib/aiLimits');
const { DEFAULTS, AI_FEATURES } = require('../lib/settings');

const clientCost = () => import(path.join(__dirname, '../../client/src/lib/aiCost.js'));
const FEATURES = AI_FEATURES.map((f) => f.key);

/** A small valid PDF with `n` empty pages (correct cross-reference offsets). */
function pdfWithPages(n) {
    const objs = [];
    const kids = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(' ');
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
    for (let i = 0; i < n; i++) objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>');
    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((o, i) => {
        offsets.push(out.length);
        out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(out, 'latin1');
}

describe('AI limits: settings and worst cases', () => {
    it('every AI feature has limits; bad values are clamped, unknown ones dropped', () => {
        const clean = cleanLimits({ chat: { input: 5, turns: 999, output: 'lots', thinking: -3, evil: 1 }, refine: 'no' }, FEATURES);
        assert.deepEqual(Object.keys(clean).sort(), [...FEATURES].sort());
        assert.deepEqual(clean.chat, { input: 200, turns: 40, output: DEFAULT_LIMITS.chat.output, thinking: 0 });
        assert.deepEqual(clean.refine, DEFAULT_LIMITS.refine);
        assert.ok(clean.parse.pages >= 1 && !('turns' in clean.parse));
    });

    it('output + thinking is the whole output budget sent to the model', () => {
        assert.deepEqual(generationLimits({ input: 1, output: 800, thinking: 200 }), { maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 200 } });
        assert.deepEqual(generationLimits(null), {});
    });

    it('worst case uses the dearest model, grows with every limit, and the browser agrees exactly', async () => {
        const { worstCase: clientWorst, dearest: clientDearest } = await clientCost();
        const settings = { ...structuredClone(DEFAULTS), aiLimits: cleanLimits({}, FEATURES) };
        settings.aiPrices = { default: { input: 0.3, output: 2.5 }, pricey: { input: 1.25, output: 10 } };
        assert.deepEqual(dearest(settings.aiPrices), { input: 1.25, output: 10 });
        assert.deepEqual(clientDearest(settings.aiPrices), dearest(settings.aiPrices));
        for (const f of FEATURES) {
            const base = worstCase(f, settings);
            assert.ok(base > 0, f);
            for (const k of Object.keys(settings.aiLimits[f])) {
                const more = structuredClone(settings);
                more.aiLimits[f][k] += 100;
                assert.ok(worstCase(f, more) > base, `${f}.${k} raises the worst case`);
            }
        }
        // Random settings: server and browser always agree.
        let seed = 7;
        const r = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
        for (let i = 0; i < 300; i++) {
            const s = { aiPrices: { default: { input: r() * 3, output: r() * 20 }, m: { input: r(), output: r() * 5 } }, aiLimits: cleanLimits(Object.fromEntries(FEATURES.map((f) => [f, { input: r() * 60000, turns: r() * 50, pages: r() * 30, output: r() * 40000, thinking: r() * 20000 }])), FEATURES) };
            for (const f of FEATURES) assert.equal(clientWorst(f, s), worstCase(f, s), `${f} #${i}`);
        }
    });
});

describe('AI limits: routes', () => {
    before(() => start('ailimits'));
    after(stop);
    beforeEach(resetState);
    const used = async (token) => (await api('GET', '/billing/me', { token })).body.data.used;

    it('typed text over the limit is refused before the AI, with no charge; the limit is public for the counters', async () => {
        const { token } = await register();
        await setSettings({ aiLimits: { refine: { input: 300 }, chat: { input: 200 } } });
        const long = 'Built things. '.repeat(40);
        const r = await api('POST', '/ai/refine', { token, body: { resumeText: long, sectionType: 'experience' } });
        assert.equal(r.status, 400);
        assert.equal(r.body.code, 'too-long');
        assert.equal(r.body.max, 300);
        assert.equal((await api('POST', '/ai/strengthen', { token, body: { text: long } })).body.code, 'too-long');
        const c = await api('POST', '/ai/chat', { token, body: { conversation: [{ role: 'user', content: long }], fullResume: {} } });
        assert.equal(c.body.code, 'too-long');
        assert.equal(ai.calls, 0);
        assert.equal(await used(token), 0);
        const cfg = (await api('GET', '/billing/plans')).body.data.aiLimits;
        assert.equal(cfg.chat.input, 200);
        assert.equal(cfg.parse.pages, DEFAULT_LIMITS.parse.pages);
        assert.equal(cfg.chat.output, undefined, 'only what the page needs');
    });

    it('every model call carries the feature\'s output and thinking limits; the assistant keeps only the latest turns', async () => {
        const { token } = await register();
        await setSettings({ aiLimits: { chat: { input: 1500, turns: 4, output: 700, thinking: 0 } } });
        ai.reply = 'Sure.';
        const conversation = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `message ${i}` }));
        assert.equal((await api('POST', '/ai/chat', { token, body: { conversation, fullResume: {} } })).status, 200);
        const body = ai.last.body;
        assert.equal(body.generationConfig.maxOutputTokens, 700);
        assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingBudget: 0 });
        // The last 4 messages, minus a leading reply (a conversation starts with the person).
        assert.deepEqual(body.contents.map((c) => c.parts[0].text), ['message 6', 'message 7', 'message 8']);
    });

    it('a model that refuses thinking settings is asked once more without them', async () => {
        const { token } = await register();
        const real = globalThis.fetch;
        let first = true;
        globalThis.fetch = async (url, opts) => {
            if (first && /generativelanguage/.test(String(url))) {
                first = false;
                return new Response(JSON.stringify({ error: { message: 'Thinking is not supported by this model.' } }), { status: 400 });
            }
            return real(url, opts);
        };
        try {
            ai.reply = 'Resolved customer complaints';
            const r = await api('POST', '/ai/refine', { token, body: { resumeText: 'handled complaints', sectionType: 'experience' } });
            assert.equal(r.status, 200);
            assert.equal(ai.last.body.generationConfig.thinkingConfig, undefined);
            assert.ok(ai.last.body.generationConfig.maxOutputTokens > 0, 'the output cap stays');
        } finally {
            globalThis.fetch = real;
        }
    });

    it('a PDF with more pages than allowed is refused before the model, for imports and Add anything', async () => {
        const { token } = await register();
        await setSettings({ aiLimits: { parse: { pages: 3 } } });
        const upload = (route, pages) => {
            const form = new FormData();
            form.append('resumeFile', new Blob([pdfWithPages(pages)]), 'cv.pdf');
            return api('POST', route, { token, raw: form });
        };
        for (const route of ['/ai/parse', '/ai/ingest']) {
            const r = await upload(route, 12);
            assert.equal(r.status, 400, route);
            assert.match(r.body.error, /12 pages\. Upload one of up to 3/);
        }
        assert.equal(ai.calls, 0);
        assert.equal(await used(token), 0);
        ai.reply = JSON.stringify({ operations: [] });
        assert.equal((await upload('/ai/ingest', 2)).status, 200, 'within the limit it goes through');
    });

    it('stored job descriptions are trimmed to the limit, not refused', async () => {
        const { token } = await register();
        await setSettings({ v2: { enabled: true }, aiLimits: { coverLetter: { input: 500 } } });
        let prompt = '';
        ai.reply = (payload) => ((prompt = payload.systemInstruction.parts[0].text), 'Dear team, ...');
        const job = `Backend Engineer. ${'Requirements include Node.js and SQL. '.repeat(100)}END-MARKER`;
        const r = await api('POST', '/ai/cover-letter', { token, body: { resumeData: { personal: { name: 'A' }, summary: 'Engineer' }, jobDescription: job } });
        assert.equal(r.status, 200);
        assert.ok(!prompt.includes('END-MARKER'), 'the tail beyond the limit is not sent');
        assert.match(prompt, /Backend Engineer/);
    });
});
