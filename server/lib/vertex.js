/**
 * Vertex AI (Google Cloud) as the AI provider: same Gemini models and request format as AI
 * Studio, billed to the Google Cloud project (so Cloud credits apply).
 *
 *   AI_PROVIDER=vertex            use Vertex instead of the AI Studio key
 *   VERTEX_PROJECT=<project id>   defaults to the service account key's project
 *   VERTEX_LOCATION=global        or a region such as us-central1
 *   VERTEX_CREDENTIALS=<path>     a service account key file, for running outside Google
 *                                 Cloud; on Cloud Run leave it out and the service's own
 *                                 account is used (it needs the Vertex AI User role)
 */
const crypto = require('node:crypto');
const fs = require('node:fs');

const useVertex = () => String(process.env.AI_PROVIDER || '').toLowerCase() === 'vertex';

let keyCache = null;
function serviceAccountKey() {
    const file = process.env.VERTEX_CREDENTIALS;
    if (!file) return null;
    if (keyCache?.file !== file) keyCache = { file, key: JSON.parse(fs.readFileSync(file, 'utf8')) };
    return keyCache.key;
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

let token = null; // { value, expiresAt }
let pending = null;

/** An OAuth access token, cached until shortly before it expires. */
async function accessToken() {
    if (token && token.expiresAt - Date.now() > 60_000) return token.value;
    pending ||= fetchToken().finally(() => (pending = null));
    return pending;
}

async function fetchToken() {
    const key = serviceAccountKey();
    let response;
    if (key) {
        // A signed JWT exchanged for an access token (the standard service account flow).
        const now = Math.floor(Date.now() / 1000);
        const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT', kid: key.private_key_id })}.${b64url({
            iss: key.client_email,
            scope: 'https://www.googleapis.com/auth/cloud-platform',
            aud: key.token_uri || 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        })}`;
        const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
        response = await fetch(key.token_uri || 'https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
            signal: AbortSignal.timeout(10_000),
        });
    } else {
        // On Cloud Run: the service's own account, from the metadata server.
        response = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
            headers: { 'Metadata-Flavor': 'Google' },
            signal: AbortSignal.timeout(5_000),
        });
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
        const err = new Error(`Vertex AI sign-in failed (${response.status}): ${body.error_description || body.error || 'no token'}`);
        err.auth = true;
        throw err;
    }
    token = { value: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
    return token.value;
}

function project() {
    return process.env.VERTEX_PROJECT || serviceAccountKey()?.project_id || process.env.GOOGLE_CLOUD_PROJECT || '';
}

/** The generateContent URL for a model. */
function modelUrl(model) {
    const location = process.env.VERTEX_LOCATION || 'global';
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    return `https://${host}/v1/projects/${project()}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

/** Forget cached credentials (tests, or after changing the settings). */
function reset() {
    token = null;
    keyCache = null;
}

module.exports = { useVertex, accessToken, modelUrl, project, reset };
