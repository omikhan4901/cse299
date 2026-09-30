/**
 * Every account has a verified email (routes/auth.js): sign-up emails a 6-digit code and
 * creates nothing until it's entered, so an address nobody can read never becomes an
 * account, takes a campaign place or counts towards the sign-up cap. Codes expire, allow 5
 * tries, work once, and are rate limited. Without email on the server only the owner can
 * sign up.
 */
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { start, stop, api, superadmin, setSettings, resetState, uniqueEmail, signUp } = require('./helpers');

describe('sign-up with an email code', () => {
    before(() => start('signupcode'));
    after(stop);
    beforeEach(resetState);

    const mailer = require('../lib/mailer');
    const realSend = mailer.sendMail;
    const realCan = mailer.canSendMail;
    let sent;
    beforeEach(() => {
        sent = [];
        mailer.sendMail = async (m) => sent.push(m);
    });
    afterEach(() => {
        mailer.sendMail = realSend;
        mailer.canSendMail = realCan;
    });
    const User = () => require('../models/User');
    const Campaign = () => require('../models/Campaign');
    // The latest code emailed to an address (the admin helper signs up by email too).
    const codeFor = (email, nth = -1) => { const all = sent.filter((m) => m.to.toLowerCase() === email.toLowerCase()); return all.at(nth).text.match(/\b(\d{6})\b/)[1]; };
    const step1 = (body) => api('POST', '/auth/register', { body: { name: 'Nadia', password: 'password123', ...body } });
    const step2 = (email, code) => api('POST', '/auth/register/verify', { body: { email, code } });

    it('the emailed code creates a verified account; nothing exists before it', async () => {
        const email = uniqueEmail();
        const r = await step1({ email: email.toUpperCase() });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.pending, true);
        assert.equal(r.body.token, undefined, 'no session yet');
        assert.equal(sent.filter((m) => m.to === email.toUpperCase()).length, 1);
        assert.equal(await User().countDocuments({ email }), 0, 'no account until the code is entered');

        assert.equal((await step2(email, '000000')).status, 400);
        const ok = await step2(email, codeFor(email));
        assert.equal(ok.status, 201, JSON.stringify(ok.body));
        assert.ok(ok.body.token);
        assert.equal(ok.body.user.emailVerified, true);
        const u = await User().findOne({ email }).lean();
        assert.ok(u.emailVerifiedAt);
        assert.equal(u.termsAccepted.version, require('../lib/legal').TERMS_VERSION);
        assert.equal((await step2(email, codeFor(email))).body.code, 'code-expired', 'a code works once');
        assert.equal((await api('POST', '/auth/login', { body: { email, password: 'password123' } })).status, 200);
    });

    it('five wrong tries, or 30 minutes, and the code is gone; asking again sends a new one', async () => {
        const email = uniqueEmail();
        await step1({ email });
        for (let i = 0; i < 5; i++) assert.match((await step2(email, '999999')).body.error, /not right/);
        assert.equal((await step2(email, codeFor(email, 0))).body.code, 'code-expired', 'even the right code, after 5 misses');
        await step1({ email });
        const PendingSignup = require('../models/PendingSignup');
        await PendingSignup.updateOne({ email }, { expiresAt: new Date(Date.now() - 1000) });
        assert.equal((await step2(email, codeFor(email, 1))).body.code, 'code-expired');
        await step1({ email });
        assert.equal((await step2(email, codeFor(email, 2))).status, 201);
        assert.equal((await step2('nobody@x.dev', '123456')).body.code, 'code-expired');
        assert.equal((await step2(email, { $gt: '' })).status, 400, 'not a code');
    });

    it('a campaign place is taken only when the code is entered; a fake address never takes one', async () => {
        await setSettings({ freeMode: { enabled: false } });
        const admin = await superadmin();
        const c = (await api('POST', '/admin/campaigns', { token: admin.token, body: { name: 'NSU', code: 'NSU-ABCDEFGH', plan: 'pro', maxUses: 1, durationDays: 28, emailDomain: 'northsouth.edu' } })).body.data;
        const fake = `made.up.${Date.now()}@northsouth.edu`;
        assert.equal((await step1({ email: fake, campaignCode: c.code })).status, 200);
        assert.equal((await Campaign().findById(c._id).lean()).uses, 0, 'an unverified address holds no place');
        assert.match((await step1({ email: uniqueEmail(), campaignCode: c.code })).body.error, /@northsouth.edu/, 'the domain is still checked first');

        const real = `real.${Date.now()}@northsouth.edu`;
        await step1({ email: real, campaignCode: c.code });
        const r = await step2(real, codeFor(real));
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal((await User().findOne({ email: real }).lean()).plan, 'pro');
        assert.equal((await Campaign().findById(c._id).lean()).uses, 1);
        // The fake one's code, if it ever arrived, finds the campaign full.
        const late = await step2(fake, codeFor(fake));
        assert.equal(late.status, 400);
        assert.match(late.body.error, /full/);
        assert.equal(await User().countDocuments({ email: fake }), 0);
    });

    it('the sign-up cap counts accounts, not codes waiting to be entered', async () => {
        const User_ = User();
        await setSettings({ signups: { cap: (await User_.countDocuments()) + 1 } });
        const a = uniqueEmail();
        const b = uniqueEmail();
        await step1({ email: a });
        await step1({ email: b });
        assert.equal((await step2(b, codeFor(b))).status, 201);
        assert.equal((await step2(a, codeFor(a))).body.code, 'signups-full', 'checked again when the code is entered');
        await setSettings({ signups: { cap: null } });
    });

    it('without email on the server, only the owner can sign up (to set it up)', async () => {
        mailer.canSendMail = () => false;
        const r = await step1({ email: uniqueEmail() });
        assert.equal(r.status, 503);
        assert.equal(r.body.code, 'email-off');
        process.env.SUPERADMIN_EMAILS = `${process.env.SUPERADMIN_EMAILS || ''},owner-${Date.now()}@test.dev`;
        const owner = process.env.SUPERADMIN_EMAILS.split(',').pop();
        const direct = await step1({ email: owner });
        assert.equal(direct.status, 201, JSON.stringify(direct.body));
        assert.ok(direct.body.token);
        assert.equal(sent.filter((m) => m.to === owner).length, 0);
    });

    it('codes to one address are rate limited', async () => {
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'signup-code': { max: 2, windowMs: 3600_000 } });
        const email = uniqueEmail();
        assert.equal((await step1({ email })).status, 200);
        assert.equal((await step1({ email })).status, 200);
        assert.equal((await step1({ email })).status, 429);
        setOverrides({});
    });

    it("doesn't say who has an account: a taken address gets the same answer and a 'log in' email", async () => {
        const email = uniqueEmail();
        await step1({ email });
        assert.equal((await step2(email, codeFor(email))).status, 201);
        const again = await step1({ email: email.toUpperCase(), name: 'Someone else' });
        assert.equal(again.status, 200);
        assert.deepEqual(Object.keys(again.body).sort(), ['email', 'minutes', 'pending', 'success'], 'the same answer as a new address');
        const notice = sent.filter((m) => m.to.toLowerCase() === email).at(-1);
        assert.match(notice.subject, /already have a ResumeX account/);
        assert.doesNotMatch(notice.text, /\b\d{6}\b/, 'no code in it');
        assert.equal(await require('../models/PendingSignup').countDocuments({ email }), 0);
        assert.equal(await User().countDocuments({ email }), 1);
    });

    it('a ceiling on sign-up emails for the whole site, whatever network asks; the owner is alerted once', async () => {
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'signup-mail-site': { max: 20, windowMs: 3600_000 }, 'register-ip': { max: 1000, windowMs: 3600_000 } });
        const Alert = require('../models/Alert');
        let last;
        for (let i = 0; i < 22; i++) last = await step1({ email: uniqueEmail(`flood${i}`) });
        assert.equal(last.status, 429);
        assert.match(last.body.error, /very busy/);
        assert.equal(sent.filter((m) => /sign-up code/.test(m.subject) && /flood/.test(m.to)).length, 20, 'no more emails than the ceiling');
        assert.equal(await Alert.countDocuments({ kind: 'security', _id: /^mail-cap:Sign-up/ }), 1);
        const limits = (await api('GET', '/admin/settings', { token: (await superadmin()).token })).body.data.rateLimits;
        assert.equal(limits.find((l) => l.name === 'signup-mail-site').scope, 'site', 'listed in Admin › Rate limits');
        setOverrides({});
    });

    it('password resets have a whole-site ceiling too, and still say nothing about the account', async () => {
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'reset-mail-site': { max: 20, windowMs: 3600_000 }, 'reset-email': { max: 1000, windowMs: 3600_000 }, 'reset-ip': { max: 1000, windowMs: 3600_000 } });
        const email = uniqueEmail();
        await step1({ email });
        await step2(email, codeFor(email));
        const answers = new Set();
        for (let i = 0; i < 22; i++) answers.add(JSON.stringify((await api('POST', '/auth/forgot-password', { body: { email } })).body));
        assert.equal(answers.size, 1, 'the same answer before and after the ceiling');
        assert.equal(sent.filter((m) => /Reset your ResumeX password/.test(m.subject)).length, 20);
        setOverrides({});
    });

    it('the helper used by the other tests goes through both steps', async () => {
        const r = await signUp({ name: 'H', email: uniqueEmail(), password: 'password123' });
        assert.equal(r.status, 201);
        assert.equal(crypto.createHash('sha256').update('123456').digest('hex').length, 64);
    });
});
