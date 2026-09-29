/**
 * Reminder and digest emails (lib/reminders.js, /api/internal/reminders, unsubscribe links).
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, api, register, setSettings, resetState, baseUrl } = require('./helpers');

const mailer = require('../lib/mailer');
const sent = [];
const realSend = mailer.sendMail;

describe('reminder emails', () => {
    before(async () => {
        await start('reminders');
        mailer.sendMail = async (m) => sent.push(m);
    });
    after(async () => {
        mailer.sendMail = realSend;
        await stop();
    });
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true } });
        sent.length = 0;
        await mongoose.model('Reminder').deleteMany({});
        await mongoose.model('Application').deleteMany({});
        process.env.INTERNAL_API_KEY = 'internal-test-key-123';
    });

    const day = (n) => new Date(Date.now() + n * 864e5).toISOString();
    const run = (body = {}, key = 'internal-test-key-123') => api('POST', '/internal/reminders', { body, headers: key ? { 'X-Internal-Key': key } : {} });
    const add = (token, body) => api('POST', '/applications', { token, body });

    it('needs the internal key', async () => {
        assert.equal((await run({}, null)).status, 404);
        assert.equal((await run({}, 'wrong-key-wrong-key-12')).status, 404);
        assert.equal((await run({}, 'x')).status, 404);
        delete process.env.INTERNAL_API_KEY;
        assert.equal((await run({}, '')).status, 404, 'off when no key is set');
    });

    it('sends deadline (today or tomorrow) and interview reminders once, not for applied ones or later dates', async () => {
        const { token, email } = await register({ name: 'Rahim Uddin' });
        await add(token, { job: { title: 'Engineer', organisation: 'Pathao', deadline: day(1) } });
        await add(token, { job: { title: 'Analyst', deadline: day(0) } });
        await add(token, { job: { title: 'Later', deadline: day(5) } });
        await add(token, { job: { title: 'Sent', deadline: day(1) }, status: 'applied' });
        const iv = (await add(token, { job: { title: 'Lecturer' }, status: 'interviewing' })).body.data;
        await api('PUT', `/applications/${iv._id}`, { token, body: { interviews: [{ id: 1, at: new Date(Date.now() + 5 * 36e5).toISOString(), kind: 'Viva' }] } });

        const r = await run();
        assert.equal(r.status, 200);
        assert.equal(r.body.data.reminders, 3);
        assert.equal(sent.length, 1, 'one email with everything');
        assert.equal(sent[0].to, email);
        assert.match(sent[0].text, /Hi Rahim/);
        assert.match(sent[0].text, /Deadline tomorrow: Engineer at Pathao/);
        assert.match(sent[0].text, /Deadline today: Analyst/);
        assert.match(sent[0].text, /Viva today: Lecturer|Viva tomorrow: Lecturer/);
        assert.doesNotMatch(sent[0].text, /Later|Sent/);
        assert.match(sent[0].text, /\/api\/auth\/unsubscribe\?t=/);
        assert.doesNotMatch(sent[0].html, /<script/);

        await run();
        assert.equal(sent.length, 1, 'nothing is sent twice');
    });

    it('the digest goes out weekly when asked, once per week; people without V2 or who turned emails off get nothing', async () => {
        const a = await register();
        await add(a.token, { job: { title: 'Engineer', deadline: day(4) } });
        await run();
        assert.equal(sent.length, 0, 'no reminder due, no digest unless asked');
        await run({ digest: true });
        assert.equal(sent.length, 1);
        assert.match(sent[0].subject, /Your week: 1 thing coming up/);
        await run({ digest: true });
        assert.equal(sent.length, 1, 'one digest a week');

        sent.length = 0;
        await mongoose.model('Reminder').deleteMany({});
        const off = await api('PUT', '/auth/email-prefs', { token: a.token, body: { digest: false } });
        assert.equal(off.status, 200, JSON.stringify(off.body));
        assert.equal(off.body.user.emailPrefs.digest, false);
        await run({ digest: true });
        assert.equal(sent.length, 0, 'digest turned off');

        await setSettings({ v2: { enabled: false } });
        const b = await register();
        await mongoose.model('Application').create({ user: b.user.id, job: { title: 'X', deadline: day(1) }, status: 'saved' });
        await run();
        assert.equal(sent.length, 0, 'no V2, no emails');
    });

    it('the unsubscribe link turns that kind off without signing in; a bad or session token is refused', async () => {
        const { token, user } = await register();
        const { unsubscribeUrl } = require('../lib/reminders');
        const link = new URL(unsubscribeUrl(user.id, 'reminders'));
        const res = await fetch(`${baseUrl()}/auth/unsubscribe${link.search}`);
        assert.equal(res.status, 200);
        assert.match(await res.text(), /unsubscribed/);
        const me = await api('GET', '/auth/me', { token });
        const prefs = (me.body.user || me.body.data).emailPrefs;
        assert.deepEqual(prefs, { reminders: false, digest: true });
        assert.equal((await fetch(`${baseUrl()}/auth/unsubscribe?t=nonsense`)).status, 400);
        assert.equal((await fetch(`${baseUrl()}/auth/unsubscribe?t=${token}`)).status, 400, 'a session token is not an unsubscribe link');
        assert.equal((await api('PUT', '/auth/email-prefs', { token, body: { digest: 'yes' } })).status, 400);
    });
});
