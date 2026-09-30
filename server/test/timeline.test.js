/**
 * The account timeline in Admin › Users (lib/timeline.js): everything that happened to one
 * account, newest first, with AI cost and storage totals; admins only.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, superadmin, setSettings, resetState, uniqueEmail, ai, signUp } = require('./helpers');

describe('account timeline', () => {
    before(() => start('timeline'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true }, freeMode: { enabled: true } });
    });

    it('lists sign-up, resumes, profile, applications and their moves, AI with cost, prompts and admin actions, newest first', async () => {
        const admin = await superadmin();
        const reg = await signUp({ name: 'Tia', email: uniqueEmail(), password: 'password123', ref: 'ig-story' });
        const token = reg.body.token;
        const id = reg.body.user.id;
        const resume = (await api('POST', '/resumes', { token, body: { nickname: 'Main CV', summary: 'Engineer' } })).body.data;
        await api('PUT', '/profile', { token, body: { summary: 'Engineer' } });
        const app = (await api('POST', '/applications', { token, body: { job: { title: 'Engineer', organisation: 'Acme' }, status: 'saved' } })).body.data;
        assert.equal((await api('PUT', `/applications/${app._id}`, { token, body: { status: 'applied', resume: resume._id, baseRev: app.rev } })).status, 200);
        ai.reply = 'Better';
        ai.usage = { promptTokenCount: 10_000, candidatesTokenCount: 1_000 };
        ai.model = 'gemini-2.5-flash';
        await api('POST', '/ai/refine', { token, body: { resumeText: 'did stuff', sectionType: 'experience' } });
        await api('POST', '/billing/event', { token, body: { kind: 'prompt', source: 'feature:coverLetter' } });
        await api('PATCH', `/admin/users/${id}`, { token: admin.token, body: { tester: true } });

        const r = await api('GET', `/admin/users/${id}`, { token: admin.token });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const { entries, totals } = r.body.data.timeline;
        const texts = entries.map((e) => e.text);
        const has = (re) => assert.ok(texts.some((t) => re.test(t)), `${re} in ${JSON.stringify(texts)}`);
        has(/^Signed up on their own from the link "ig-story"$/);
        has(/^Created the resume "Main CV"$/);
        has(/^Set up their Career Profile$/);
        has(/^Added Engineer · Acme$/);
        has(/^AI rewrite$/);
        has(/^boss@test\.dev: update$/);
        for (let i = 1; i < entries.length; i++) assert.ok(new Date(entries[i - 1].at) >= new Date(entries[i].at), 'newest first');
        const aiRow = entries.find((e) => e.kind === 'ai');
        assert.equal(aiRow.credits, 1);
        assert.equal(aiRow.cost.toFixed(4), '0.0055', '10k in × $0.30 + 1k out × $2.50');
        assert.equal(totals.aiUses, 1);
        assert.equal(totals.aiCredits, 1);
        assert.ok(totals.storage > 100);
        assert.equal(r.body.data.signupNet, undefined, 'the network hash stays on the server');
        has(/^Saw the upgrade prompt for Cover letter$/);
        has(/^Moved Engineer · Acme to applied$/);
    });
});
