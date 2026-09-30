/**
 * Admin › Site (docs/v2/BETA-PLAN.md, Phase 6): the beta notes the site shows, and
 * maintenance mode: everyone can look, only admins can change anything, signing in and
 * feedback stay open, and the site gets the message to show.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState, signUp } = require('./helpers');

describe('site settings', () => {
    before(() => start('site'));
    after(stop);
    beforeEach(resetState);

    it('beta notes are cleaned and reach the public config', async () => {
        await setSettings({ beta: { label: true, whatsNew: ['  New board  ', '', 'x'.repeat(300), ...Array(10).fill('more')], knownIssues: 'not a list', welcome: 'Hi!' } });
        const beta = (await api('GET', '/billing/plans')).body.data.beta;
        assert.equal(beta.whatsNew[0], 'New board');
        assert.equal(beta.whatsNew[1].length, 160);
        assert.ok(beta.whatsNew.length <= 8);
        assert.deepEqual(beta.knownIssues, [], 'a bad value falls back to the default');
        assert.equal(beta.welcome, 'Hi!');
    });

    it('maintenance: reads work, writes are refused for people but not admins; sign-in and feedback stay open', async () => {
        const admin = await superadmin();
        const u = await register();
        const resume = (await api('POST', '/resumes', { token: u.token, body: { nickname: 'CV' } })).body.data;
        await setSettings({ maintenance: { enabled: true, message: 'Back in 5 minutes.' } });
        assert.deepEqual((await api('GET', '/billing/plans')).body.data.maintenance, { message: 'Back in 5 minutes.' });
        assert.equal((await api('GET', `/resumes/${resume._id}`, { token: u.token })).status, 200, 'reading works');
        const w = await api('PUT', `/resumes/${resume._id}`, { token: u.token, body: { summary: 'x', baseRev: resume.rev } });
        assert.equal(w.status, 503);
        assert.equal(w.body.code, 'maintenance');
        assert.equal(w.body.error, 'Back in 5 minutes.');
        assert.equal((await signUp({ name: 'N', email: 'new@x.dev', password: 'password123' })).status, 503, 'no sign-ups');
        assert.equal((await api('POST', '/auth/login', { body: { email: u.email, password: u.password } })).status, 200, 'signing in works');
        assert.equal((await api('POST', '/reports/feedback', { token: u.token, body: { message: 'Is it down?' } })).status, 201, 'feedback works');
        assert.equal((await api('POST', '/resumes', { token: admin.token, body: { nickname: 'Admin CV' } })).status, 201, 'admins can still change things');
        await setSettings({ maintenance: { enabled: false } });
        assert.equal((await api('PUT', `/resumes/${resume._id}`, { token: u.token, body: { summary: 'x', baseRev: resume.rev } })).status, 200);
        assert.equal((await api('GET', '/billing/plans')).body.data.maintenance, null);
    });
});
