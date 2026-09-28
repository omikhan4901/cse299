/**
 * The Career Profile (V2): who sees it, saving with revisions, validation, account
 * deletion and export; and the pure sync logic in client/src/lib/profile.js.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const mongoose = require('mongoose');
const { start, stop, api, register, superadmin, setSettings, resetState } = require('./helpers');

const lib = () => import(path.join(__dirname, '../../client/src/lib/profile.js'));
const ops = () => import(path.join(__dirname, '../../client/src/lib/ingest/ops.js'));
const resumeLib = () => import(path.join(__dirname, '../../client/src/lib/resume.js'));

const JOB = { id: 11, title: 'Software Engineer', company: 'Pathao', startDate: 'Mar 2021', endDate: 'Present', description: 'Built the payments service\nCut API latency by 35%' };

describe('Career Profile API', () => {
    before(() => start('profile'));
    after(stop);
    beforeEach(resetState);

    const v2On = () => setSettings({ v2: { enabled: true } });

    it('is hidden (404) until V2 is on for the account: everyone, preview accounts, or admins', async () => {
        const { token, user } = await register();
        assert.equal((await api('GET', '/profile', { token })).status, 404);
        assert.equal((await api('PUT', '/profile', { token, body: { summary: 'x' } })).status, 404);
        assert.equal((await api('GET', '/profile')).status, 401, 'signed out');

        // A preview account (set by an admin in the console).
        const boss = await superadmin();
        const patched = await api('PATCH', `/admin/users/${user.id}`, { token: boss.token, body: { v2Preview: true } });
        assert.equal(patched.status, 200);
        assert.equal(patched.body.data.v2Preview, true);
        assert.equal((await api('GET', '/profile', { token })).status, 200);
        assert.equal((await api('GET', '/auth/me', { token })).body.user?.v2Preview ?? (await api('GET', '/auth/me', { token })).body.data?.v2Preview, true);

        // Admins always; everyone once it's switched on.
        const other = await register();
        await mongoose.model('User').updateOne({ _id: other.user.id }, { role: 'admin' });
        assert.equal((await api('GET', '/profile', { token: other.token })).status, 200);
        const third = await register();
        await v2On();
        assert.equal((await api('GET', '/profile', { token: third.token })).status, 200);
        const plans = await api('GET', '/billing/plans');
        assert.deepEqual(plans.body.data.v2, { enabled: true });
        assert.ok(plans.body.data.planLimits.some((l) => l.key === 'applications'));
    });

    it('creates, saves with revisions, refuses stale saves with the latest copy, and deletes', async () => {
        await v2On();
        const { token } = await register();
        assert.equal((await api('GET', '/profile', { token })).body.data, null);
        assert.equal((await api('PUT', '/profile', { token, body: { summary: 'a', baseRev: 3 } })).status, 409, 'a save based on a profile that no longer exists');

        const created = await api('PUT', '/profile', { token, body: { summary: 'First', experience: [JOB], baseRev: 0 } });
        assert.equal(created.status, 201);
        assert.equal(created.body.data.rev, 1);
        assert.equal(created.body.data.experience[0].company, 'Pathao');

        const saved = await api('PUT', '/profile', { token, body: { summary: 'Second', baseRev: 1 } });
        assert.equal(saved.status, 200);
        assert.equal(saved.body.data.rev, 2);
        assert.equal(saved.body.data.experience.length, 1, 'a partial save keeps the rest');

        const stale = await api('PUT', '/profile', { token, body: { summary: 'From an old tab', baseRev: 1 } });
        assert.equal(stale.status, 409);
        assert.equal(stale.body.code, 'conflict');
        assert.equal(stale.body.data.summary, 'Second', 'the latest copy comes back to choose from');

        const again = await api('PUT', '/profile', { token, body: { baseRev: 0, summary: 'x' } });
        assert.equal(again.status, 409, 'creating again from a tab that never saw the profile');

        assert.equal((await api('DELETE', '/profile', { token })).status, 200);
        assert.equal((await api('GET', '/profile', { token })).body.data, null);
    });

    it('only the owner’s data: other people’s profiles, owner and revision fields can’t be written', async () => {
        await v2On();
        const a = await register();
        const b = await register();
        const { body: resumeOfB } = await api('POST', '/resumes', { token: b.token, body: { nickname: 'B' } });
        const { body: resumeOfA } = await api('POST', '/resumes', { token: a.token, body: { nickname: 'A' } });
        const r = await api('PUT', '/profile', { token: a.token, body: { user: b.user.id, rev: 99, _id: new mongoose.Types.ObjectId(), summary: 'mine', createdFrom: resumeOfB.data._id } });
        assert.equal(r.status, 201);
        assert.equal(String(r.body.data.user), String(a.user.id));
        assert.equal(r.body.data.rev, 1);
        assert.equal(r.body.data.createdFrom, undefined, "someone else's resume isn't recorded");
        assert.equal((await api('GET', '/profile', { token: b.token })).body.data, null, "B still has no profile");

        await api('DELETE', '/profile', { token: a.token });
        const own = await api('PUT', '/profile', { token: a.token, body: { summary: 'mine', createdFrom: resumeOfA.data._id } });
        assert.equal(String(own.body.data.createdFrom), resumeOfA.data._id);
    });

    it('rejects malformed content and oversized lists; blanks photos that aren’t images', async () => {
        await v2On();
        const { token } = await register();
        const bad = [
            { experience: 'not a list' },
            { experience: Array.from({ length: 201 }, (_, i) => ({ id: i, company: 'x' })) },
            { summaries: Array.from({ length: 11 }, (_, i) => ({ id: i, label: 'x', text: 'y' })) },
            { summaries: 'x' },
            { experience: [{ id: 'not-a-number', company: 'x' }] },
            { experience: [{ id: 1, company: { $gt: '' } }] },
        ];
        for (const body of bad) {
            const r = await api('PUT', '/profile', { token, body });
            assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
            assert.ok(r.body.error);
        }
        assert.equal((await api('GET', '/profile', { token })).body.data, null, 'nothing was saved');

        const r = await api('PUT', '/profile', {
            token,
            body: { personal: { name: 'Rahim', profilePic: 'javascript:alert(1)' }, summaries: [{ id: 1, label: 'x'.repeat(100), text: 'Academic' }, null] },
        });
        assert.equal(r.status, 201);
        assert.equal(r.body.data.personal.profilePic, '');
        assert.equal(r.body.data.summaries.length, 1);
        assert.equal(r.body.data.summaries[0].label.length, 40);
    });

    it('is exported with the account and deleted with it', async () => {
        await v2On();
        const { token, password } = await register();
        await api('PUT', '/profile', { token, body: { summary: 'Exported' } });
        const exported = await api('GET', '/auth/export', { token });
        assert.equal(exported.body.careerProfile.summary, 'Exported');
        assert.equal(exported.body.careerProfile.user, undefined);
        assert.equal((await api('DELETE', '/auth/me', { token, body: { password } })).status, 200);
        assert.equal(await mongoose.model('CareerProfile').countDocuments({ user: exported.body.account._id }), 0);
    });

    it('plan limits and the V2 switch are validated in settings', async () => {
        const { readSettings, updateSettings } = require('../lib/settings');
        await updateSettings({ v2: { enabled: 'yes' }, plans: [{ limits: { applications: -4, tailored: '7', batch: null } }, { limits: { applications: 'lots' } }, {}] }, 'test');
        const { settings } = await readSettings();
        assert.equal(settings.v2.enabled, true);
        assert.deepEqual(settings.plans[0].limits, { applications: 0, tailored: 7, batch: null });
        assert.equal(settings.plans[1].limits.applications, null, 'garbage falls back to the default (unlimited on Pro)');
        assert.equal(settings.plans[2].limits.batch, 15);
    });
});

describe('profile ↔ resume (client/src/lib/profile.js)', () => {
    it('a profile from a resume drops empty items and links; a resume from the profile links every item', async () => {
        const { profileFromResume, resumeFromProfile } = await lib();
        const profile = profileFromResume({ nickname: 'Old', template: 'Modern', experience: [JOB, { id: 12 }, { id: 13, profileItemId: 5, company: 'bKash' }], skills: 'Go' });
        assert.equal(profile.experience.length, 2, 'the empty job is left out');
        assert.ok(profile.experience.every((e) => e.profileItemId === undefined && e.id !== 11 && e.id !== 13));
        assert.equal(profile.template, undefined, 'design settings are not content');
        assert.deepEqual(profile.summaries, []);

        const resume = resumeFromProfile(profile);
        assert.deepEqual(resume.experience.map((e) => e.profileItemId), profile.experience.map((e) => e.id));
        assert.ok(resume.experience.every((e) => !profile.experience.some((p) => p.id === e.id)), 'new ids');

        const picked = resumeFromProfile(profile, { select: { experience: [profile.experience[1].id, 999] }, points: { [profile.experience[1].id]: ['Only this'] }, summary: 'Tailored' });
        assert.deepEqual(picked.experience.map((e) => e.company), ['bKash'], 'unknown ids are ignored');
        assert.equal(picked.experience[0].description, 'Only this');
        assert.equal(picked.summary, 'Tailored');
        assert.equal(picked.education.length, 0);
    });

    it('pull updates: changed details and new points of the items the resume has, never what it left out', async () => {
        const { pullUpdates } = await lib();
        const { applyOperations } = await ops();
        const profile = {
            personal: { name: 'Rahim', email: 'new@mail.com', phone: '' },
            experience: [{ ...JOB, id: 1, endDate: 'Jun 2024', description: `${JOB.description}\nLed a team of 4` }, { id: 2, company: 'bKash', title: 'SE' }],
            projects: [{ id: 3, name: 'BondhuKoi', description: 'A friend-finder app' }],
            skills: 'Go, Rust',
        };
        const resume = {
            personal: { name: 'Rahim', email: 'old@mail.com', phone: '017' },
            // Linked, with its own rewording of the first point (kept).
            experience: [{ ...JOB, id: 50, profileItemId: 1, description: 'Built the payment service handling 2M transactions\nCut API latency by 35%' }],
            // Not linked (made before profiles): found by name.
            projects: [{ id: 60, name: 'Bondhukoi app', description: '' }],
            skills: 'Go',
        };
        const updates = pullUpdates(resume, profile);
        const byOp = Object.groupBy(updates, (o) => o.op);
        assert.deepEqual(byOp.set.map((o) => [o.field, o.value]), [['personal.email', 'new@mail.com']], 'an empty profile phone never blanks the resume');
        assert.deepEqual(byOp.set[0].flags, [{ kind: 'replaces', fields: ['personal.email'] }]);
        const job = byOp.update.find((o) => o.section === 'experience');
        assert.deepEqual(job.item, { endDate: 'Jun 2024' });
        assert.deepEqual(job.bullets, ['Led a team of 4'], 'the reworded point is not re-added');
        const project = byOp.addBullets.find((o) => o.section === 'projects');
        assert.equal(project.target, 60);
        assert.equal(project.link, undefined, 'matched by name, so its naming stays its own');
        assert.ok(!updates.some((o) => o.item?.company === 'bKash'), 'bKash was left out of this resume on purpose');
        assert.ok(!updates.some((o) => o.field === 'skills'));

        const next = applyOperations(resume, updates);
        assert.equal(next.experience[0].endDate, 'Jun 2024');
        assert.equal(next.personal.phone, '017');
        assert.equal(pullUpdates(next, profile).length, 0, 'nothing left to pull after applying');
    });

    it('save to profile: new items, reworded and new points, changed details and new skills', async () => {
        const { saveToProfile } = await lib();
        const { applyOperations } = await ops();
        const profile = {
            summary: 'Backend developer.',
            experience: [{ ...JOB, id: 1 }],
            education: [{ id: 2, institution: 'Dhaka University', degree: 'BA in English' }],
            skills: 'Go, Node.js',
        };
        const resume = {
            summary: 'Backend engineer focused on payments.',
            experience: [{ ...JOB, id: 9, profileItemId: 1, location: 'Dhaka', description: 'Built the payments service used by 2M people\nCut API latency by 35%\nMentored 3 juniors' }],
            education: [{ id: 8, institution: 'University of Dhaka', degree: 'MA in English' }],
            skills: 'go, Redis',
        };
        const changes = saveToProfile(resume, profile);
        const find = (op, pred = () => true) => changes.filter((o) => o.op === op && pred(o));
        assert.equal(find('set', (o) => o.field === 'summary')[0].flags[0].kind, 'replaces');
        const job = find('update', (o) => o.section === 'experience')[0];
        assert.deepEqual(job.item, { location: 'Dhaka' });
        assert.deepEqual(job.bullets, ['Mentored 3 juniors']);
        const reworded = find('replaceBullet')[0];
        assert.deepEqual([reworded.from, reworded.to], ['Built the payments service', 'Built the payments service used by 2M people']);
        assert.equal(find('add', (o) => o.section === 'education').length, 1, 'an MA is not the BA');
        assert.deepEqual(find('addValues')[0].values, ['Redis'], 'go is already there, in any case');

        const next = applyOperations(profile, changes);
        assert.equal(next.experience[0].description, 'Built the payments service used by 2M people\nCut API latency by 35%\nMentored 3 juniors');
        assert.equal(next.education.length, 2);
        assert.equal(saveToProfile(resume, next).length, 0, 'nothing left to save after applying');
    });

    it('a summary already kept as a variant is not offered again; empty resumes offer nothing', async () => {
        const { saveToProfile, pullUpdates } = await lib();
        const profile = { summary: 'Industry', summaries: [{ id: 1, label: 'Academic', text: 'Academic summary' }] };
        assert.equal(saveToProfile({ summary: 'Academic summary' }, profile).length, 0);
        assert.equal(saveToProfile({}, {}).length, 0);
        assert.equal(pullUpdates({}, {}).length, 0);
        assert.equal(pullUpdates({}, profile).length, 0, 'a resume without items pulls nothing but personal details');
    });

    it('replaceBullet only replaces an exact point; normalize keeps links; duplicates drop them', async () => {
        const { applyOperations } = await ops();
        const { normalizeResume } = await resumeLib();
        const r = normalizeResume({ experience: [{ id: 1, profileItemId: 7, description: 'A\nB' }] });
        assert.equal(r.experience[0].profileItemId, 7);
        assert.equal(normalizeResume({ experience: [{ id: 1, profileItemId: 'x' }] }).experience[0].profileItemId, undefined);
        assert.equal(applyOperations(r, [{ op: 'replaceBullet', section: 'experience', target: 1, from: 'B', to: 'B2' }]).experience[0].description, 'A\nB2');
        assert.equal(applyOperations(r, [{ op: 'replaceBullet', section: 'experience', target: 1, from: 'C', to: 'X' }]).experience[0].description, 'A\nB', 'a point that changed meanwhile is left alone');
        assert.equal(applyOperations(r, [{ op: 'replaceBullet', section: 'experience', target: 1, from: 'B', to: '  ' }]).experience[0].description, 'A\nB');
    });

    it('profile health: an empty profile scores low with the most useful tips first; a full one scores high', async () => {
        const { profileHealth } = await lib();
        const empty = profileHealth({});
        assert.ok(empty.score < 30, String(empty.score));
        assert.ok(empty.todo.length >= 3);
        assert.ok(!empty.checks.some((c) => c.id === 'words'), 'page length does not apply to a profile');
        const full = profileHealth({
            personal: { name: 'Rahim', email: 'r@mail.com', phone: '017', city: 'Dhaka', linkedin: 'linkedin.com/in/r' },
            summary: 'Backend engineer with 5 years building payment systems used by millions of people in Bangladesh, focused on reliability and speed.',
            experience: [
                { id: 1, title: 'Software Engineer', company: 'Pathao', startDate: 'Mar 2021', endDate: 'Present', description: 'Built a payments service handling 2M transactions a month\nReduced API latency by 35% with Redis caching\nLed a team of 4 engineers across 3 releases' },
                { id: 2, title: 'Junior Developer', company: 'Brain Station 23', startDate: 'Jan 2019', endDate: 'Feb 2021', description: 'Developed REST APIs for 3 client projects\nAutomated 120 integration tests, cutting release time by 40%\nMigrated 2 services to Docker' },
            ],
            education: [{ id: 3, institution: 'NSU', degree: 'BSc in CSE', endYear: '2018' }],
            skills: 'Go, Node.js, Redis, PostgreSQL, Docker, Kubernetes, AWS, Git',
        });
        assert.ok(full.score >= 75, String(full.score));
        assert.ok(full.score > empty.score);
    });
});
