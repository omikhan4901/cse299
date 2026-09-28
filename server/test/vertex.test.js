/**
 * Vertex AI as the provider (AI_PROVIDER=vertex, lib/vertex.js): the same AI routes, signed
 * in with a service account, billed to the Google Cloud project.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { start, stop, api, register, resetState, ai } = require('./helpers');

// A throwaway service account key, like the JSON file Google Cloud gives out.
const keyFile = path.join(os.tmpdir(), `vertex-test-${process.pid}.json`);
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
fs.writeFileSync(keyFile, JSON.stringify({ type: 'service_account', project_id: 'demo-project', private_key_id: 'k1', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), client_email: 'eval@demo-project.iam.gserviceaccount.com', token_uri: 'https://oauth2.googleapis.com/token' }));

const refine = (token) => api('POST', '/ai/refine', { token, body: { resumeText: 'Built a payments service used by many people every day.', sectionType: 'experience' } });

describe('Vertex AI provider', () => {
    before(() => start('vertex'));
    after(async () => {
        await stop();
        fs.rmSync(keyFile, { force: true });
    });
    beforeEach(async () => {
        await resetState();
        process.env.AI_PROVIDER = 'vertex';
        process.env.VERTEX_CREDENTIALS = keyFile;
    });

    it('calls the project’s Vertex endpoint with a signed-in token, reused across requests', async () => {
        const { token } = await register();
        assert.equal((await refine(token)).status, 200);
        assert.equal((await refine(token)).status, 200);
        assert.match(ai.last.url, /^https:\/\/aiplatform\.googleapis\.com\/v1\/projects\/demo-project\/locations\/global\/publishers\/google\/models\/[\w.-]+:generateContent$/);
        assert.equal(ai.last.headers.Authorization, 'Bearer token-1');
        assert.equal(ai.last.headers['x-goog-api-key'], undefined, 'the AI Studio key is not sent');
        assert.equal(ai.tokens, 1, 'one sign-in for both requests');
        assert.ok(ai.last.body.contents.every((c) => c.role), 'every turn names its speaker');
    });

    it('works without an AI Studio key, and a region picks the regional endpoint', async () => {
        const saved = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        process.env.VERTEX_LOCATION = 'asia-southeast1';
        try {
            const { token } = await register();
            assert.equal((await refine(token)).status, 200);
            assert.match(ai.last.url, /^https:\/\/asia-southeast1-aiplatform\.googleapis\.com\/v1\/projects\/demo-project\/locations\/asia-southeast1\//);
        } finally {
            process.env.GEMINI_API_KEY = saved;
            delete process.env.VERTEX_LOCATION;
        }
    });

    it('billing switched off on the project reads as a usage limit, and is refunded', async () => {
        const { token } = await register();
        ai.status = 403;
        ai.errorMessage = 'This API method requires billing to be enabled.';
        const r = await refine(token);
        assert.equal(r.status, 502);
        assert.match(r.body.error, /usage limit/);
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 0);
    });

    it('a failed sign-in is refunded and never reaches the model', async () => {
        process.env.VERTEX_CREDENTIALS = path.join(os.tmpdir(), 'no-such-key.json');
        const { token } = await register();
        const r = await refine(token);
        assert.equal(r.status, 502);
        assert.equal(ai.calls, 0);
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 0);
    });
});
