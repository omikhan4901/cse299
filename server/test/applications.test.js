/**
 * The job tracker (V2): the API (limits, statuses, the frozen copy sent, revisions, link
 * fetching safety) and the shared rules in client/src/lib/applications.js.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const mongoose = require('mongoose');
const { start, stop, api, register, setSettings, resetState } = require('./helpers');

const lib = () => import(path.join(__dirname, '../../client/src/lib/applications.js'));
const JOB = { title: 'Software Engineer', organisation: 'Pathao', deadline: '2026-10-15', description: 'We need Go, PostgreSQL and Redis. 3+ years of experience. BSc in CSE.', applyVia: ['bdjobs', 'hack'] };

describe('applications API', () => {
    before(() => start('applications'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true } });
    });

    const add = (token, body) => api('POST', '/applications', { token, body });

    it('is hidden until V2 is on for the account', async () => {
        await setSettings({ v2: { enabled: false } });
        const { token } = await register();
        assert.equal((await api('GET', '/applications', { token })).status, 404);
        assert.equal((await add(token, { job: JOB })).status, 404);
        assert.equal((await api('GET', '/applications')).status, 401);
    });

    it('adds, lists without the heavy parts, reads in full, and cleans what it stores', async () => {
        const { token } = await register();
        const r = await add(token, { job: { ...JOB, url: 'javascript:alert(1)', keywords: ['Go', '', 'x'.repeat(100)] }, status: 'saved', user: new mongoose.Types.ObjectId(), rev: 50 });
        assert.equal(r.status, 201);
        assert.equal(r.body.data.rev, 1);
        assert.equal(r.body.data.job.url, '', 'unsafe link dropped');
        assert.deepEqual(r.body.data.job.applyVia, ['bdjobs'], 'unknown ways to apply dropped');
        assert.equal(r.body.data.job.keywords[1].length, 60);
        assert.equal(r.body.data.statusHistory.length, 1);
        const list = await api('GET', '/applications', { token });
        assert.equal(list.body.data.length, 1);
        assert.equal(list.body.data[0].job.description, undefined, 'the list leaves out the job text');
        assert.equal(list.body.data[0].job.hasDescription, true);
        const one = await api('GET', `/applications/${r.body.data._id}`, { token });
        assert.match(one.body.data.job.description, /Go, PostgreSQL/);
    });

    it('refuses empty or malformed input', async () => {
        const { token } = await register();
        for (const body of [{}, { job: {} }, { job: { title: 'x', deadline: 'not a date' } }, { job: JOB, status: 'hired' }, { job: JOB, checklist: [] }, { job: JOB, followUpAt: 'soon' }, { job: JOB, resume: 'nope' }, { job: { title: { $gt: '' } } }]) {
            const r = await add(token, body);
            assert.equal(r.status, 400, JSON.stringify(body));
        }
        assert.equal((await api('GET', '/applications', { token })).body.data.length, 0);
    });

    it('the plan limit counts active applications only; closed or archived ones free a place, and reopening checks again', async () => {
        // A Free plan that includes Applications (off by default), with a limit of 2.
        await setSettings({ v2: { enabled: true }, freeMode: { enabled: false }, plans: [{ features: { applications: true }, limits: { applications: 2, tailored: 1, batch: 0 } }, {}, {}] });
        const { token } = await register();
        const a = (await add(token, { job: JOB })).body.data;
        await add(token, { job: JOB, status: 'preparing' });
        const third = await add(token, { job: JOB });
        assert.equal(third.status, 403);
        assert.equal(third.body.code, 'upgrade');
        assert.equal(third.body.feature, 'applications');
        assert.equal((await add(token, { job: JOB, status: 'rejected' })).status, 201, 'a closed one can always be recorded');

        const closed = await api('PUT', `/applications/${a._id}`, { token, body: { status: 'withdrawn', baseRev: 1 } });
        assert.equal(closed.status, 200);
        const c = (await add(token, { job: JOB })).body.data;
        assert.ok(c, 'room again');
        const reopen = await api('PUT', `/applications/${a._id}`, { token, body: { status: 'saved', baseRev: 2 } });
        assert.equal(reopen.status, 403, 'reopening would go over the limit');
        await api('PUT', `/applications/${c._id}`, { token, body: { archived: true, baseRev: 1 } });
        assert.equal((await api('PUT', `/applications/${a._id}`, { token, body: { status: 'saved', baseRev: 2 } })).status, 200);

        await setSettings({ freeMode: { enabled: true } });
        assert.equal((await add(token, { job: JOB })).status, 201, 'free mode lifts the limit');
    });

    it('status changes are recorded; marking applied freezes the resume as it was, and later edits don’t change it', async () => {
        const { token } = await register();
        const resume = (await api('POST', '/resumes', { token, body: { nickname: 'SWE', template: 'Classic', summary: 'Version one' } })).body.data;
        const app = (await add(token, { job: JOB, resume: resume._id })).body.data;
        const applied = await api('PUT', `/applications/${app._id}`, { token, body: { status: 'applied', baseRev: 1 } });
        assert.equal(applied.status, 200);
        assert.ok(applied.body.data.appliedAt);
        assert.equal(applied.body.data.snapshot.content.summary, 'Version one');
        assert.equal(applied.body.data.snapshot.nickname, 'SWE');
        assert.equal(applied.body.data.snapshot.content.user, undefined);
        assert.deepEqual(applied.body.data.statusHistory.map((h) => h.status), ['saved', 'applied']);

        await api('PUT', `/resumes/${resume._id}`, { token, body: { summary: 'Version two' } });
        const again = await api('PUT', `/applications/${app._id}`, { token, body: { status: 'interviewing', baseRev: 2 } });
        assert.equal(again.body.data.snapshot.content.summary, 'Version one', 'what was sent stays as it was');

        const replaced = await api('POST', `/applications/${app._id}/snapshot`, { token });
        assert.equal(replaced.body.data.snapshot.content.summary, 'Version two', 'unless the person replaces it on purpose');

        // Deleting the resume keeps the copy, and unlinks it.
        await api('DELETE', `/resumes/${resume._id}`, { token });
        const after = (await api('GET', `/applications/${app._id}`, { token })).body.data;
        assert.equal(after.resume, undefined);
        assert.equal(after.snapshot.content.summary, 'Version two');
    });

    it('checklist ticks keep their time, unticks remove them; partial job saves keep the rest', async () => {
        const { token } = await register();
        const app = (await add(token, { job: JOB })).body.data;
        const r1 = await api('PUT', `/applications/${app._id}`, { token, body: { checklist: { match: true, followUp: true }, baseRev: 1 } });
        const first = r1.body.data.checklist.match;
        assert.ok(first);
        const r2 = await api('PUT', `/applications/${app._id}`, { token, body: { checklist: { match: true, followUp: false }, job: { title: 'Senior Software Engineer' }, baseRev: 2 } });
        assert.equal(r2.body.data.checklist.match, first, 'ticking again keeps when it was done');
        assert.equal(r2.body.data.checklist.followUp, undefined);
        assert.equal(r2.body.data.job.title, 'Senior Software Engineer');
        assert.equal(r2.body.data.job.organisation, 'Pathao');
        assert.match(r2.body.data.job.description, /Redis/);
    });

    it('stale saves conflict with the latest copy; other people’s applications and resumes are off limits', async () => {
        const a = await register();
        const b = await register();
        const app = (await add(a.token, { job: JOB })).body.data;
        await api('PUT', `/applications/${app._id}`, { token: a.token, body: { notes: 'first', baseRev: 1 } });
        const stale = await api('PUT', `/applications/${app._id}`, { token: a.token, body: { notes: 'old tab', baseRev: 1 } });
        assert.equal(stale.status, 409);
        assert.equal(stale.body.data.notes, 'first');
        assert.equal((await api('GET', `/applications/${app._id}`, { token: b.token })).status, 404);
        assert.equal((await api('PUT', `/applications/${app._id}`, { token: b.token, body: { notes: 'x' } })).status, 404);
        assert.equal((await api('DELETE', `/applications/${app._id}`, { token: b.token })).status, 404);
        const bResume = (await api('POST', '/resumes', { token: b.token, body: { nickname: 'B' } })).body.data;
        assert.equal((await api('PUT', `/applications/${app._id}`, { token: a.token, body: { resume: bResume._id } })).status, 400);
        assert.equal((await api('GET', '/applications/not-an-id', { token: a.token })).status, 404);
        assert.equal((await api('DELETE', `/applications/${app._id}`, { token: a.token })).status, 200);
    });

    it('reading a job link refuses internal addresses, other schemes and LinkedIn before connecting', async () => {
        const { token } = await register();
        for (const [url, code] of [
            ['http://127.0.0.1/admin', 'blocked'], ['http://localhost:5000/api', 'blocked'], ['http://169.254.169.254/latest/meta-data', 'blocked'],
            ['http://[::1]/', 'blocked'], ['http://10.0.0.5/', 'blocked'], ['http://example.com:8080/', 'blocked'], ['file:///etc/passwd', 'invalid'],
            ['ftp://example.com/job', 'invalid'], ['https://user:pw@example.com/', 'invalid'], ['not a link', 'invalid'],
            ['https://www.linkedin.com/jobs/view/123', 'linkedin'], ['https://metadata.google.internal/', 'blocked'],
        ]) {
            const r = await api('POST', '/applications/fetch', { token, body: { url } });
            assert.equal(r.status, 400, url);
            assert.equal(r.body.code, code, url);
        }
    });

    it('tailored resumes: linked to their application, within the plan’s total and batch limits', async () => {
        await setSettings({ v2: { enabled: true }, freeMode: { enabled: false }, plans: [{ features: { applications: true }, limits: { resumes: null, applications: 10, tailored: 2, batch: 0 } }, { limits: { resumes: null, applications: null, tailored: null, batch: 2 } }, {}] });
        const { token, user } = await register();
        const a1 = (await add(token, { job: JOB })).body.data;
        const a2 = (await add(token, { job: JOB })).body.data;
        const a3 = (await add(token, { job: JOB })).body.data;
        const item = (app, extra = {}) => ({ application: app._id, nickname: 'SWE · Pathao', template: 'Classic', content: { summary: 'Tailored', experience: [{ id: 1, profileItemId: 7, company: 'Pathao' }], user: 'x' }, ...extra });

        const batch = await api('POST', '/applications/tailored', { token, body: { items: [item(a1), item(a2)] } });
        assert.equal(batch.status, 403, 'free plan: one at a time');
        assert.equal(batch.body.feature, 'batch');

        const one = await api('POST', '/applications/tailored', { token, body: { items: [item(a1, { template: 'Modern' })] } });
        assert.equal(one.status, 201);
        const made = (await api('GET', `/resumes/${one.body.data[0].resume}`, { token })).body.data;
        assert.equal(made.summary, 'Tailored');
        assert.equal(made.experience[0].profileItemId, 7);
        assert.equal(made.template, 'Classic', 'a template outside the plan falls back to the default');
        assert.equal(String(made.tailoredFor), a1._id);
        const linked = (await api('GET', `/applications/${a1._id}`, { token })).body.data;
        assert.equal(linked.resume, made._id);
        assert.equal(linked.rev, one.body.data[0].rev, 'the application’s revision moves on, so an open drawer reloads instead of overwriting');

        assert.equal((await api('POST', '/applications/tailored', { token, body: { items: [item(a2)] } })).status, 201);
        const third = await api('POST', '/applications/tailored', { token, body: { items: [item(a3)] } });
        assert.equal(third.status, 403);
        assert.equal(third.body.feature, 'tailored');

        await mongoose.model('User').updateOne({ _id: user.id }, { plan: 'pro' });
        assert.equal((await api('POST', '/applications/tailored', { token, body: { items: [item(a3), item(a1)] } })).status, 201, 'Pro: two at once, no total limit');
        assert.equal((await api('POST', '/applications/tailored', { token, body: { items: [item(a1), item(a2), item(a3)] } })).status, 403, 'over the batch size');

        const other = await register();
        assert.equal((await api('POST', '/applications/tailored', { token: other.token, body: { items: [item(a1)] } })).status, 400, "someone else's application");
        for (const body of [{}, { items: [] }, { items: [{ application: 'bad' }] }, { items: Array.from({ length: 31 }, () => item(a1)) }]) {
            assert.equal((await api('POST', '/applications/tailored', { token, body })).status, 400, JSON.stringify(body).slice(0, 60));
        }
    });

    it('is exported with the account and deleted with it', async () => {
        const { token, password } = await register();
        await add(token, { job: JOB });
        const exported = await api('GET', '/auth/export', { token });
        assert.equal(exported.body.applications.length, 1);
        await api('DELETE', '/auth/me', { token, body: { password } });
        assert.equal(await mongoose.model('Application').countDocuments({ user: exported.body.account._id }), 0);
    });
});

describe('address safety and page text (server/lib/safeFetch.js)', () => {
    it('knows which addresses are not public', () => {
        const { isPrivateAddress, htmlToText } = require('../lib/safeFetch');
        for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', 'garbage']) {
            assert.equal(isPrivateAddress(ip), true, ip);
        }
        for (const ip of ['8.8.8.8', '172.32.0.1', '203.0.113.9', '2606:4700::1111', '::ffff:1.1.1.1']) assert.equal(isPrivateAddress(ip), false, ip);
        const text = htmlToText('<html><head><style>.x{}</style><script>alert(1)</script></head><body><h1>Engineer</h1><p>Apply by 5&nbsp;Nov&#44; 2026 &amp; more</p><ul><li>Go</li><li>SQL</li></ul></body></html>');
        assert.equal(text, 'Engineer\nApply by 5 Nov, 2026 & more\n\n- Go\n- SQL');
    });
});

describe('tracker rules (client/src/lib/applications.js)', () => {
    const NOW = new Date('2026-10-10T09:00:00');
    it('the checklist fits the job: Teletalk fee and admit card, posted applications, academic jobs', async () => {
        const { checklistFor, nextStep } = await lib();
        const gov = { status: 'saved', job: { title: 'Assistant Engineer', applyVia: ['teletalk'], description: 'x' }, checklist: {} };
        const keys = checklistFor(gov).map((i) => i.key);
        assert.ok(keys.includes('fee') && keys.includes('admitCard') && !keys.includes('publications'));
        assert.equal(nextStep(gov).key, 'resume', 'the description is there, so a resume is next');
        assert.ok(checklistFor({ status: 'saved', job: { title: 'Lecturer in CSE' } }).some((i) => i.key === 'publications'));
        assert.ok(checklistFor({ status: 'saved', job: { applyVia: ['post'] } }).some((i) => i.key === 'posted'));
        assert.equal(nextStep({ status: 'rejected', job: {} }), null, 'closed: nothing to do');
        const applied = { status: 'applied', appliedAt: NOW, resume: 'r1', job: { description: 'x' }, checklist: { match: NOW } };
        assert.equal(nextStep(applied).key, 'followUp', 'after applying, following up comes next');
    });

    it('due items: deadlines this week, just missed, follow-ups, interviews, and silence after three weeks', async () => {
        const { dueItems } = await lib();
        const day = (n) => new Date(NOW.getTime() + n * 864e5);
        const apps = [
            { _id: 1, status: 'saved', job: { title: 'A', deadline: day(3) } },
            { _id: 2, status: 'preparing', job: { title: 'B', deadline: day(-1) } },
            { _id: 3, status: 'applied', job: { title: 'C', deadline: day(2) }, appliedAt: day(-2), followUpAt: day(-1) },
            { _id: 4, status: 'interviewing', job: { title: 'D' }, interviews: [{ at: day(1), kind: 'Technical' }, { at: day(30) }] },
            { _id: 5, status: 'applied', job: { title: 'E' }, appliedAt: day(-25), statusHistory: [{ status: 'applied', at: day(-25) }] },
            { _id: 6, status: 'saved', archived: true, job: { title: 'F', deadline: day(1) } },
            { _id: 7, status: 'saved', job: { title: 'G', deadline: day(20) } },
            { _id: 8, status: 'applied', job: { title: 'H' }, followUpAt: day(-2), checklist: { followUp: day(-1) } },
        ];
        const due = dueItems(apps, NOW);
        assert.deepEqual(due.map((d) => [d.kind, d.app._id]), [['missed', 2], ['interview', 4], ['deadline', 1], ['followUp', 3], ['noResponse', 5]]);
        assert.equal(due.find((d) => d.kind === 'deadline').days, 3);
    });

    it('the funnel counts how far each got, and applications this week', async () => {
        const { funnel } = await lib();
        const f = funnel([
            { status: 'saved' },
            { status: 'applied', appliedAt: NOW },
            { status: 'interviewing', appliedAt: new Date('2026-09-01') },
            { status: 'rejected', appliedAt: new Date('2026-09-01'), statusHistory: [{ status: 'interviewing' }, { status: 'rejected' }] },
            { status: 'offer', appliedAt: new Date('2026-09-01') },
            { status: 'offer', archived: true },
        ], NOW);
        assert.deepEqual(f, { saved: 5, applied: 4, interviewing: 3, offers: 1, thisWeek: 1, active: 3 });
    });

    it('job match: evidence lines, missing skills the profile has, and nothing for a too-short job text', async () => {
        const { jobMatch } = await lib();
        const resume = { experience: [{ id: 1, title: 'Software Engineer', company: 'X', startDate: 'Jan 2024', endDate: 'Present', description: 'Built APIs in Go with PostgreSQL' }], education: [{ id: 2, degree: 'BSc in CSE' }], skills: 'Go, PostgreSQL' };
        const profile = { ...resume, skills: 'Go, PostgreSQL, Redis' };
        const m = jobMatch(resume, JOB.description + ' We also use Kubernetes.', profile);
        assert.ok(m.shown.includes('Go') && m.shown.includes('PostgreSQL'));
        assert.ok(m.missing.includes('Redis') && m.missing.includes('Kubernetes'));
        assert.deepEqual(m.inProfile, ['Redis']);
        assert.ok(m.lines.some((l) => /years/.test(l.text) && !l.ok), 'asks for 3+ years; about 2 dated');
        assert.ok(m.lines.some((l) => /bachelor/i.test(l.text) && l.ok));
        assert.equal(jobMatch(resume, 'too short'), null);
    });
});

describe('calendar export (client/src/lib/ics.js)', () => {
    it('deadlines, follow-ups and interviews as events; closed or archived ones left out; long and Bangla text folded safely', async () => {
        const { calendarFor } = await import(path.join(__dirname, '../../client/src/lib/ics.js'));
        const NOW = new Date('2026-10-01T00:00:00Z');
        const { text, count } = calendarFor(
            [
                { _id: 'a1', status: 'saved', job: { title: 'Engineer, Backend; Payments', organisation: 'Pathao', deadline: '2026-10-15T00:00:00Z' } },
                { _id: 'a2', status: 'applied', job: { title: 'Lecturer' }, followUpAt: '2026-10-20T00:00:00Z', interviews: [{ id: 5, at: '2026-10-22T04:00:00Z', kind: 'Viva', notes: 'Bring certificates' }] },
                { _id: 'a3', status: 'rejected', job: { title: 'X', deadline: '2026-10-15' } },
                { _id: 'a4', status: 'saved', archived: true, job: { title: 'Y', deadline: '2026-10-15' } },
                { _id: 'a5', status: 'saved', job: { title: 'উপসহকারী প্রকৌশলী '.repeat(6), deadline: '2026-11-10T00:00:00Z' } },
            ],
            { now: NOW }
        );
        assert.equal(count, 4);
        assert.match(text, /^BEGIN:VCALENDAR\r\n/);
        assert.match(text, /DTSTART;VALUE=DATE:20261015\r\nDTEND;VALUE=DATE:20261016/);
        assert.ok(text.includes('SUMMARY:Deadline: Engineer\\, Backend\\; Payments · Pathao'), 'commas and semicolons escaped');
        assert.match(text, /DTSTART:20261022T040000Z/);
        assert.match(text, /SUMMARY:Follow up: Lecturer/);
        assert.ok(!text.includes('a3-') && !text.includes('a4-'));
        for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `too long: ${line}`);
        assert.ok(!text.includes('�'), 'no character split in half');
        assert.equal(calendarFor([]).count, 0);
    });
});
