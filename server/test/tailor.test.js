/**
 * Tailoring (client/src/lib/tailor.js): a resume for one job, picked from the Career Profile
 * without AI.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const lib = () => import(path.join(__dirname, '../../client/src/lib/tailor.js'));
const profileLib = () => import(path.join(__dirname, '../../client/src/lib/profile.js'));
const matchLib = () => import(path.join(__dirname, '../../client/src/lib/applications.js'));
const NOW = new Date('2026-10-01');

const PROFILE = {
    personal: { name: 'Nusrat Jahan', email: 'n@mail.com' },
    summary: 'Backend engineer who builds reliable payment systems in Go.',
    summaries: [{ id: 90, label: 'Academic', text: 'Lecturer and researcher in machine learning with publications in IEEE venues.' }],
    experience: [
        { id: 1, title: 'Senior Software Engineer', company: 'bKash', startDate: 'Jul 2024', endDate: 'Present', description: 'Built payment APIs in Go handling 5M transactions a day\nCut p99 latency by 40% with Redis caching\nMentored 4 engineers\nOrganised the office football team\nWrote the on-call handbook' },
        { id: 2, title: 'Software Engineer', company: 'Pathao', startDate: 'Mar 2021', endDate: 'Jun 2024', description: 'Designed PostgreSQL schemas for the rides platform\nMigrated services to Kubernetes\nPresented at the company all-hands' },
        { id: 3, title: 'Lecturer', company: 'Daffodil International University', startDate: 'Jan 2019', endDate: 'Feb 2021', description: 'Taught Data Structures to 300 students a semester\nSupervised 12 undergraduate theses' },
        { id: 4, title: 'Teaching Assistant', company: 'BUET', startDate: 'Jan 2017', endDate: 'Dec 2018', description: 'Graded assignments for Algorithms' },
        { id: 5, title: 'Intern', company: 'Brain Station 23', startDate: 'Jun 2016', endDate: 'Aug 2016', description: 'Fixed bugs in a PHP CRM' },
    ],
    projects: [
        { id: 10, name: 'LedgerKit', technologies: 'Go, gRPC', description: 'Open-source double-entry ledger library in Go' },
        { id: 11, name: 'Recipe app', technologies: 'Flutter', description: 'A cooking app for my family' },
    ],
    education: [{ id: 20, institution: 'BUET', degree: 'MSc in CSE', endYear: '2019' }, { id: 21, institution: 'KUET', degree: 'BSc in CSE', endYear: '2016' }],
    publications: [{ id: 30, title: 'Federated learning on edge devices', publisher: 'IEEE Access', date: '2022' }],
    certifications: [{ id: 40, name: 'AWS Certified Developer', issuer: 'Amazon' }, { id: 41, name: 'IELTS 7.5' }],
    awards: [{ id: 50, title: 'Best Paper Award', issuer: 'ICCIT' }],
    skills: 'Python, Machine Learning, Go, Redis, PostgreSQL, Kubernetes, Flutter, Docker, Teaching',
};
const BACKEND = `Senior Backend Engineer
We are hiring a backend engineer to build payment services.
Requirements:
- Strong experience with Go and PostgreSQL
- Redis, Kafka and Kubernetes
- AWS experience is a plus
- 5+ years of experience`;
const LECTURER = `Applications are invited for the post of Lecturer in the Department of CSE.
Requirements: MSc in CSE, research experience in machine learning, publications in reputed journals, teaching experience.`;

describe('tailoring', () => {
    it('keeps the relevant jobs and points within a page or two, the job’s skills first, and the best summary', async () => {
        const { tailor } = await lib();
        const t = tailor(PROFILE, BACKEND, { now: NOW });
        const jobs = t.content.experience.map((e) => e.company);
        assert.ok(jobs.includes('bKash') && jobs.includes('Pathao'), jobs.join());
        assert.ok(!jobs.includes('Brain Station 23'), 'an old unrelated internship is left out');
        const bkash = t.content.experience.find((e) => e.company === 'bKash').description.split('\n');
        assert.ok(bkash.includes('Built payment APIs in Go handling 5M transactions a day') && bkash.includes('Cut p99 latency by 40% with Redis caching'));
        assert.ok(!bkash.includes('Organised the office football team'), 'an irrelevant point is trimmed');
        assert.equal(bkash[0], 'Built payment APIs in Go handling 5M transactions a day', 'points keep their order');
        assert.deepEqual(t.content.projects.map((p) => p.name), ['LedgerKit']);
        assert.match(t.content.skills, /^(Go|Redis|PostgreSQL|Kubernetes)/);
        assert.ok(t.content.skills.split(', ').length <= 15);
        assert.equal(t.content.summary, PROFILE.summary);
        assert.deepEqual(t.content.certifications.map((c) => c.name), ['AWS Certified Developer']);
        assert.equal(t.content.education.length, 2, 'education is always kept');
        assert.equal(t.category, 'ats');
        assert.ok(t.report.after >= t.report.before, `${t.report.before} → ${t.report.after}`);
        assert.ok(t.content.experience.every((e) => Number.isFinite(e.profileItemId)), 'every item remembers where it came from');
    });

    it('an academic job gets the academic summary, publications, awards and teaching, and an academic template', async () => {
        const { tailor } = await lib();
        const t = tailor(PROFILE, LECTURER, { now: NOW });
        assert.equal(t.category, 'academic');
        assert.equal(t.content.summary, PROFILE.summaries[0].text);
        assert.equal(t.content.publications.length, 1);
        assert.equal(t.content.awards.length, 1);
        assert.ok(t.content.experience.some((e) => e.title === 'Lecturer'));
    });

    it('include adds the profile’s point or item that has a missing keyword', async () => {
        const { planFor, contentFrom, include } = await lib();
        const { jobMatch } = await matchLib();
        const job = `${BACKEND}\n- PHP is needed for our legacy CRM`;
        const plan = planFor(PROFILE, BACKEND, { now: NOW }); // planned without PHP in mind
        assert.ok(!jobMatch(contentFrom(PROFILE, plan), job).shown.includes('PHP'));
        const next = include(PROFILE, plan, 'PHP', job);
        const m = jobMatch(contentFrom(PROFILE, next), job);
        assert.ok(m.shown.includes('PHP'), m.missing.join());
        assert.deepEqual(include(PROFILE, plan, 'Nonexistent', job), plan, 'unknown keywords change nothing');
    });

    it('a tailored resume is in sync with the profile (nothing to pull), and odd input never breaks it', async () => {
        const { tailor } = await lib();
        const { pullUpdates } = await profileLib();
        const t = tailor(PROFILE, BACKEND, { now: NOW });
        assert.deepEqual(pullUpdates(t.content, PROFILE).filter((o) => o.op !== 'addBullets'), [], 'only left-out points could be pulled');
        for (const [profile, job] of [[{}, BACKEND], [PROFILE, ''], [{ experience: [{ id: 1 }] }, 'x'], [PROFILE, '🙂'.repeat(100)]]) {
            const r = tailor(profile, job, { now: NOW });
            assert.ok(r.content && Array.isArray(r.content.experience));
        }
    });
});

describe('job match percentage', () => {
    const JOB = 'Backend Engineer\n\nRequirements:\n- 3+ years with Node.js\n- Strong PostgreSQL and Redis\n- Experience designing REST APIs\n- Docker and Kubernetes\n- AWS experience is a plus';
    const resume = (skills) => ({ personal: { name: 'A' }, experience: [{ id: 1, title: 'Engineer', company: 'X', description: `Built services with ${skills}` }], skills });

    it('never shows 100% while a skill the job asks for is missing', async () => {
        const { jobMatch } = await matchLib();
        const m = jobMatch(resume('Node.js, PostgreSQL, Redis, REST APIs, Docker, AWS'), JOB);
        assert.ok(m.missing.includes('Kubernetes'), m.missing.join());
        assert.ok(m.score < 100, `score ${m.score}`);
        assert.ok(m.score > 50, `score ${m.score}`);
    });

    it('is 100% when every skill is there, and goes up as skills are added', async () => {
        const { jobMatch } = await matchLib();
        const full = jobMatch(resume('Node.js, PostgreSQL, Redis, REST APIs, Docker, Kubernetes, AWS'), JOB);
        assert.deepEqual(full.missing, []);
        assert.equal(full.score, 100);
        const less = jobMatch(resume('Node.js, PostgreSQL'), JOB);
        assert.ok(less.score < full.score, `${less.score} < ${full.score}`);
        assert.equal(jobMatch(resume('x'), 'too short'), null);
    });
});
