/**
 * Feedback and error reports (routes/reports.js, lib/errors.js, Admin › Feedback and
 * Errors): anyone can send feedback (with the page and an optional small screenshot); admins
 * see it, mark it and reply by email; browser errors and server 500s are grouped with
 * counts, scrubbed of personal data, and alert the owner when one spikes.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState } = require('./helpers');

describe('feedback', () => {
    before(() => start('reports'));
    after(stop);
    beforeEach(resetState);

    it('signed in or not, with the page and an optional screenshot; admins list, mark and read it', async () => {
        const admin = await superadmin();
        const u = await register({ name: 'Tia' });
        const shot = `data:image/jpeg;base64,${'A'.repeat(1000)}`;
        const r = await api('POST', '/reports/feedback', { token: u.token, body: { message: 'The PDF button is hard to find', page: '/builder?id=secret#x', screenshot: shot } });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal((await api('POST', '/reports/feedback', { body: { message: 'Love it', email: 'visitor@x.dev' } })).status, 201, 'signed out works too');
        assert.equal((await api('POST', '/reports/feedback', { body: { message: 'x' } })).status, 400, 'too short');
        assert.equal((await api('POST', '/reports/feedback', { body: { message: 'hello', screenshot: 'javascript:alert(1)' } })).status, 400, 'not an image');
        assert.equal((await api('POST', '/reports/feedback', { body: { message: 'hello', screenshot: `data:image/png;base64,${'A'.repeat(500_000)}` } })).status, 400, 'too big');

        const list = (await api('GET', '/admin/feedback', { token: admin.token })).body.data;
        assert.equal(list.counts.new, 2);
        const mine = list.items.find((f) => f.message.startsWith('The PDF'));
        assert.equal(mine.page, '/builder', 'no query string or hash');
        assert.equal(mine.email, u.email);
        assert.equal(mine.name, 'Tia');
        assert.equal(mine.screenshot, undefined, 'the list leaves screenshots out');
        assert.equal(mine.hasScreenshot, true);
        assert.equal((await api('GET', `/admin/feedback/${mine._id}`, { token: admin.token })).body.data.screenshot, shot);

        const marked = await api('PATCH', `/admin/feedback/${mine._id}`, { token: admin.token, body: { status: 'fixed' } });
        assert.equal(marked.body.data.status, 'fixed');
        assert.equal((await api('PATCH', `/admin/feedback/${mine._id}`, { token: admin.token, body: { status: 'bogus' } })).status, 400);
        assert.equal((await api('GET', '/admin/feedback?status=fixed', { token: admin.token })).body.data.items.length, 1);
        assert.equal((await api('GET', '/admin/feedback', { token: u.token })).status, 403, 'admins only');
        const bell = (await api('GET', '/admin/alerts', { token: admin.token })).body.data;
        assert.ok(bell.some((a) => a.kind === 'feedback' && /from Tia/.test(a.text)));
    });

    it('replies need text, an address to send to, and email set up; nothing is recorded otherwise', async () => {
        const admin = await superadmin();
        await api('POST', '/reports/feedback', { body: { message: 'Where is dark mode?', email: 'someone@x.dev' } });
        await api('POST', '/reports/feedback', { body: { message: 'No address here' } });
        const items = (await api('GET', '/admin/feedback', { token: admin.token })).body.data.items;
        const withMail = items.find((f) => f.email);
        const without = items.find((f) => !f.email);
        assert.equal((await api('POST', `/admin/feedback/${withMail._id}/reply`, { token: admin.token, body: { text: '  ' } })).status, 400, 'empty reply');
        assert.match((await api('POST', `/admin/feedback/${without._id}/reply`, { token: admin.token, body: { text: 'Thanks' } })).body.error, /didn't leave an email/);
        const { canSendMail } = require('../lib/mailer');
        if (!canSendMail()) {
            const r = await api('POST', `/admin/feedback/${withMail._id}/reply`, { token: admin.token, body: { text: 'Soon!' } });
            assert.equal(r.status, 400);
            assert.match(r.body.error, /Email is not set up/);
        }
        const again = (await api('GET', `/admin/feedback/${withMail._id}`, { token: admin.token })).body.data;
        assert.equal(again.replies.length, 0);
        assert.equal(again.status, 'new');
    });

    it('feedback is in the account export and goes with the account', async () => {
        const u = await register();
        await api('POST', '/reports/feedback', { token: u.token, body: { message: 'Mine to take with me' } });
        const exp = await api('GET', '/auth/export', { token: u.token });
        assert.equal(exp.status, 200);
        assert.equal(exp.body.feedback[0].message, 'Mine to take with me');
        assert.equal(exp.body.account.signupNet, undefined, 'internal fields stay out');
        assert.equal(exp.body.account.twoFactor, undefined);
        assert.equal(exp.body.account.twoFactorEnabled, false);
        const Feedback = require('../models/Feedback');
        assert.equal(await Feedback.countDocuments({ user: u.user.id }), 1);
        assert.ok([200, 204].includes((await api('DELETE', '/auth/me', { token: u.token, body: { password: u.password } })).status));
        assert.equal(await Feedback.countDocuments({ user: u.user.id }), 0);
    });

    it('feedback is rate limited per account', async () => {
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ feedback: { max: 2, windowMs: 3600_000 } });
        const u = await register();
        for (let i = 0; i < 2; i++) assert.equal((await api('POST', '/reports/feedback', { token: u.token, body: { message: `note ${i}` } })).status, 201);
        assert.equal((await api('POST', '/reports/feedback', { token: u.token, body: { message: 'one more' } })).status, 429);
    });
});

describe('error reports', () => {
    before(() => start('errorreports'));
    after(stop);
    beforeEach(resetState);

    it('browser errors are grouped, scrubbed and counted; admins resolve them', async () => {
        const admin = await superadmin();
        const send = (message, page = '/builder') => api('POST', '/reports/error', { body: { message, page, stack: 'TypeError: x\n    at render (app.js:10:5)' } });
        for (let i = 0; i < 3; i++) assert.equal((await send(`Cannot read id of undefined for jane${i}@mail.com user 1234567${i}`, `/view/abc?token=secret${i}`)).status, 204);
        await send('Something else broke');
        const groups = (await api('GET', '/admin/errors', { token: admin.token })).body.data;
        assert.equal(groups.length, 2, 'the three variants are one group');
        const g = groups.find((x) => x.count === 3);
        assert.equal(g.kind, 'browser');
        assert.ok(!/@|secret|1234567/.test(JSON.stringify(g)), `scrubbed: ${JSON.stringify(g)}`);
        assert.equal(g.where, '/view/abc');
        assert.equal(g.lastHour, 3);
        assert.equal((await api('PATCH', `/admin/errors/${g._id}`, { token: admin.token, body: {} })).status, 200);
        assert.equal((await api('GET', '/admin/errors', { token: admin.token })).body.data.length, 1, 'resolved ones are hidden');
        await send('Cannot read id of undefined for x@y.com user 99999999');
        assert.equal((await api('GET', '/admin/errors', { token: admin.token })).body.data.length, 2, 'happening again reopens it');
        assert.equal((await api('POST', '/reports/error', { body: {} })).status, 400);
        const glance = (await api('GET', '/admin/overview', { token: admin.token })).body.data.glance;
        assert.ok(glance.errorsToday >= 5);
    });

    it('server 500s are recorded with the route pattern, and a spike alerts the owner once', async () => {
        const admin = await superadmin();
        const { recordError } = require('../lib/errors');
        const { getSettings } = require('../lib/settings');
        await setSettings({ errors: { spikePerHour: 3 } });
        const settings = await getSettings();
        for (let i = 0; i < 4; i++) await recordError({ kind: 'server', message: 'Database timed out', where: 'PUT /api/resumes/:id', stack: 'Error: Database timed out\n    at save (resume.js:1:1)' }, settings);
        const groups = (await api('GET', '/admin/errors?kind=server', { token: admin.token })).body.data;
        assert.equal(groups[0].where, 'PUT /api/resumes/:id');
        assert.equal(groups[0].count, 4);
        const bell = (await api('GET', '/admin/alerts', { token: admin.token })).body.data.filter((a) => a.kind === 'errors');
        assert.equal(bell.length, 1, 'one alert for the spike');
        assert.match(bell[0].text, /server error happened 3 times in the last hour/);
    });
});
