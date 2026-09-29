/**
 * AI polish and the editing modes (lib/polish.js, /ai/polish, /ai/strengthen, /ai/refine):
 * proposals only, new facts flagged, charged per job and refunded on failure. The model is stubbed.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, setSettings, resetState, ai } = require('./helpers');
const { polishOperations, newFacts } = require('../lib/polish');

const RESUME = {
    summary: 'Backend engineer.',
    experience: [{ id: 11, title: 'Software Engineer', company: 'Pathao', description: 'Built the payments service\nCut API latency by 35% with Redis' }],
    projects: [{ id: 21, name: 'BondhuKoi', description: 'Made a friend-finder app' }],
    skills: 'Go, Redis',
};
const JOB = 'We need a backend engineer with Go, Kafka and REST APIs to build payment services. 3+ years.';

describe('polish checks', () => {
    it('turns the reply into reviewable changes, drops invented points, and flags new facts', () => {
        const ops = polishOperations(
            {
                summary: 'Backend engineer building payment services in Go with Kafka.',
                points: [
                    { from: 'Built the payments service', to: 'Built REST APIs for the payments service in Go' },
                    { from: 'Cut API latency by 35% with Redis', to: 'Cut API latency by 50% with Redis caching' },
                    { from: 'Led a team of 10', to: 'Led a team of 10 engineers' },
                    { from: 'Made a friend-finder app', to: 'Made a friend-finder app' },
                    { from: 'Built the payments service', to: 'Duplicate' },
                ],
            },
            RESUME
        );
        const byOp = (op) => ops.filter((o) => o.op === op);
        const summary = byOp('set')[0];
        assert.deepEqual(summary.flags.map((f) => f.kind), ['replaces', 'unverified']);
        assert.deepEqual(summary.flags[1].tokens, ['kafka'], 'Kafka is in the job, not in the resume');
        const points = byOp('replaceBullet');
        assert.equal(points.length, 2, 'invented, unchanged and repeated points are dropped');
        assert.equal(points[0].target, 11);
        assert.deepEqual(points[0].flags[0].tokens, ['rest', 'apis'], 'the job’s own terms are flagged too: the person confirms they fit');
        assert.deepEqual(points[1].flags[0].tokens, ['50'], 'a changed number is flagged');
        assert.deepEqual(ops.map((o) => o.key), ['p1', 'p2', 'p3']);
    });

    it('newFacts only counts numbers, names and tools not in the text', () => {
        assert.deepEqual(newFacts('Led 4 engineers at bKash using Kubernetes', 'I led 4 engineers at bKash'), ['kubernetes']);
        assert.deepEqual(newFacts('Improved sales', 'improved sales'), []);
    });
});

describe('AI routes: polish, strengthen, rewrite', () => {
    before(() => start('polish'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true } });
    });

    it('polish from a tailored resume reads its job, stores proposals for later, and charges its cost', async () => {
        const { token } = await register();
        const app = (await api('POST', '/applications', { token, body: { job: { title: 'Backend Engineer', description: JOB } } })).body.data;
        const made = await api('POST', '/applications/tailored', { token, body: { items: [{ application: app._id, nickname: 'Backend', content: RESUME }] } });
        const resumeId = made.body.data[0].resume;
        ai.reply = (payload) => {
            assert.match(payload.contents[0].parts[0].text, /Kafka/, 'the job text comes from the application');
            return JSON.stringify({ summary: '', points: [{ from: 'Built the payments service', to: 'Built the payments service in Go' }] });
        };
        const r = await api('POST', '/ai/polish', { token, body: { resumeId, store: true } });
        assert.equal(r.status, 200);
        assert.equal(r.body.operations.length, 1);
        const saved = (await api('GET', `/resumes/${resumeId}`, { token })).body.data;
        assert.equal(saved.suggestions.operations.length, 1);
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 2);
        // Reviewed: cleared, without counting as a content change.
        const cleared = await api('PUT', `/resumes/${resumeId}`, { token, body: { suggestions: null } });
        assert.equal(cleared.body.data.suggestions, undefined);
        assert.equal(cleared.body.data.rev, saved.rev);
    });

    it('polish refuses without a job text or content, and refunds a failed or unreadable answer', async () => {
        const { token } = await register();
        assert.equal((await api('POST', '/ai/polish', { token, body: { resume: RESUME, jobDescription: 'short' } })).status, 400);
        assert.equal((await api('POST', '/ai/polish', { token, body: { resume: {}, jobDescription: JOB } })).status, 400);
        assert.equal((await api('POST', '/ai/polish', { token, body: { resumeId: 'nope' } })).status, 404);
        const other = await register();
        const theirs = (await api('POST', '/resumes', { token: other.token, body: { nickname: 'x', summary: 'y' } })).body.data;
        assert.equal((await api('POST', '/ai/polish', { token, body: { resumeId: theirs._id } })).status, 404);
        ai.reply = 'not json';
        assert.equal((await api('POST', '/ai/polish', { token, body: { resume: RESUME, jobDescription: JOB } })).status, 502);
        assert.equal(ai.calls, 1, 'only the valid request reached the AI');
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 0);
    });

    it('strengthen asks questions first, then writes only from the answers (new facts flagged)', async () => {
        const { token } = await register();
        ai.reply = JSON.stringify({ questions: ['How much faster was it?', 'How many users?', '', 'x'.repeat(500)] });
        const q = await api('POST', '/ai/strengthen', { token, body: { text: 'Made the app faster' } });
        assert.equal(q.status, 200);
        assert.equal(q.body.questions.length, 3);
        assert.equal(q.body.questions[2].length, 200);
        ai.reply = 'Cut load time by 40% for 20,000 users using Redis';
        const w = await api('POST', '/ai/strengthen', { token, body: { text: 'Made the app faster', answers: [{ q: 'How much faster?', a: 'about 40%' }, { q: 'Users?', a: '20000' }, { q: 'Tools?', a: '' }] } });
        assert.equal(w.status, 200);
        assert.deepEqual(w.body.unverified, ['redis'], 'Redis came from nowhere');
        assert.equal((await api('POST', '/ai/strengthen', { token, body: {} })).status, 400);
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 2);
    });

    it('rewrite (Improve with AI) points out anything new', async () => {
        const { token } = await register();
        ai.reply = 'Built a payments service handling 2M transactions with Kafka';
        const r = await api('POST', '/ai/refine', { token, body: { resumeText: 'Built a payments service handling 2M transactions', sectionType: 'experience', fullResume: { skills: 'Go' } } });
        assert.deepEqual(r.body.unverified, ['kafka']);
    });

    it('polish is part of a plan like other AI features', async () => {
        await setSettings({ freeMode: { enabled: false } });
        const { token } = await register();
        const r = await api('POST', '/ai/polish', { token, body: { resume: RESUME, jobDescription: JOB } });
        assert.equal(r.status, 403);
        assert.equal(r.body.feature, 'polish');
    });
});
