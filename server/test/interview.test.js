/**
 * Interview prep (client/src/lib/interview.js) and outcome insights (client/src/lib/insights.js):
 * both deterministic, made from the job text and the person's own data.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prepLib = () => import(path.join(__dirname, '../../client/src/lib/interview.js'));
const insightsLib = () => import(path.join(__dirname, '../../client/src/lib/insights.js'));

const RESUME = {
    personal: { name: 'Nusrat Jahan' },
    experience: [
        { id: 1, title: 'Software Engineer', company: 'Pathao', description: 'Rebuilt the payout service in Node.js and PostgreSQL, cutting settlement from 2 days to 4 hours\nDesigned REST APIs used by 3 apps\nMentored juniors' },
        { id: 2, title: 'Developer', company: 'bKash', description: 'Added Redis caching, bringing p95 latency from 480 ms to 90 ms\nWrote integration tests' },
    ],
    projects: [{ id: 3, name: 'Bus Tracker', description: 'Live bus positions for 60 routes with PostGIS' }],
    skills: 'Node.js, PostgreSQL, Redis, Docker, AWS',
};
const JOB = {
    title: 'Backend Engineer',
    organisation: 'Nagad',
    description: 'Backend Engineer\n\nRequirements:\n- 3+ years with Node.js\n- Strong PostgreSQL and Redis\n- Designing REST APIs\n- Docker and Kubernetes\n- AWS is a plus',
};

describe('interview prep: kind of role', () => {
    it('picks the right question bank from the title, and never calls a civil engineer a software one', async () => {
        const { familyFor } = await prepLib();
        const cases = [
            ['Lecturer, Department of CSE', 'academic'],
            ['Assistant Professor', 'academic'],
            ['Backend Engineer', 'software'],
            ['Full Stack Developer', 'software'],
            ['Sub-Assistant Engineer (Civil)', 'general'],
            ['Electrical Engineer', 'general'],
            ['Data Analyst', 'data'],
            ['Data Entry Operator', 'general'],
            ['UI/UX Designer', 'design'],
            ['Digital Marketing Executive', 'commercial'],
            ['Account Manager', 'commercial'],
            ['Senior Accountant', 'finance'],
            ['Probationary Officer, Sonali Bank', 'finance'],
            ['Admin Officer', 'general'],
            ['', 'general'],
        ];
        for (const [title, want] of cases) assert.equal(familyFor({ title }).id, want, title);
        // No title: the start of the description decides.
        assert.equal(familyFor({ title: '', description: 'We are hiring a Lecturer in Mathematics' }).id, 'academic');
        assert.equal(familyFor(undefined).id, 'general');
    });
});

describe('interview prep: the sheet', () => {
    it('backs each of the job\'s skills with the person\'s own point, and names gaps honestly', async () => {
        const { prepFor } = await prepLib();
        const p = prepFor({ job: JOB, source: RESUME });
        assert.equal(p.family.id, 'software');
        const byName = Object.fromEntries(p.focus.map((f) => [f.name, f]));
        assert.match(byName['Node.js'].evidence.text, /payout service/);
        assert.equal(byName['Node.js'].evidence.where, 'Pathao · Software Engineer');
        assert.ok(byName.Kubernetes.gap, 'Kubernetes is nowhere in the resume');
        assert.equal(byName.Kubernetes.evidence, null);
        // Docker is only a listed skill: not a gap, but no story either.
        assert.ok(byName.Docker.listed && !byName.Docker.gap && !byName.Docker.evidence);
        // Evidence is spread across different points where possible.
        const texts = p.focus.filter((f) => f.evidence).map((f) => f.evidence.text);
        assert.ok(new Set(texts).size >= 2, texts.join(' | '));
        assert.ok(p.focus.length <= 6);
    });

    it('never invents: every evidence line and story is a point from the source, word for word', async () => {
        const { prepFor } = await prepLib();
        const p = prepFor({ job: JOB, source: RESUME });
        const all = [...RESUME.experience, ...RESUME.projects].flatMap((e) => e.description.split('\n'));
        for (const f of p.focus) if (f.evidence) assert.ok(all.includes(f.evidence.text), f.evidence.text);
        for (const s of p.stories) assert.ok(all.includes(s.text), s.text);
    });

    it('stories favour results with numbers that touch the job, at most three', async () => {
        const { prepFor } = await prepLib();
        const p = prepFor({ job: JOB, source: RESUME });
        assert.ok(p.stories.length >= 1 && p.stories.length <= 3);
        assert.match(p.stories[0].text, /\d/);
        assert.ok(!p.stories.some((s) => s.text === 'Mentored juniors'), 'no number, no job skill');
    });

    it('questions: the role\'s own, one per skill with evidence, one per gap, then the general ones', async () => {
        const { prepFor } = await prepLib();
        const p = prepFor({ job: JOB, source: RESUME });
        const qs = p.questions.map((q) => q.q);
        assert.ok(qs.some((q) => /coding exercise/i.test(q)));
        assert.ok(qs.some((q) => q === 'Tell us about your experience with Node.js.'));
        assert.ok(qs.some((q) => /mentions Kubernetes/.test(q)));
        assert.equal(qs.filter((q) => q === 'Tell me about yourself.').length, 1);
        assert.equal(new Set(qs).size, qs.length, 'no duplicate questions');
        assert.ok(p.ask.length >= 2 && p.ask.length <= 4);
        assert.ok(p.checklist.some((c) => c.includes('Nagad')));
    });

    it('says when it was built from the resume that was sent', async () => {
        const { prepFor } = await prepLib();
        assert.equal(prepFor({ job: JOB, source: RESUME, sent: true }).sent, true);
        assert.ok(prepFor({ job: JOB, source: RESUME, sent: true }).checklist[0].includes('as you sent it'));
        assert.equal(prepFor({ job: JOB, source: RESUME }).sent, false);
    });

    it('copes with nothing to work from', async () => {
        const { prepFor, prepText } = await prepLib();
        assert.equal(prepFor({ job: {} }), null);
        assert.equal(prepFor(), null);
        assert.equal(prepText(null), '');
        // A title only: no skills to look for, but the questions still come.
        const titleOnly = prepFor({ job: { title: 'Lecturer' }, source: {} });
        assert.equal(titleOnly.focus.length, 0);
        assert.equal(titleOnly.family.id, 'academic');
        assert.ok(titleOnly.questions.length >= 5);
        assert.equal(titleOnly.empty, true);
        // An empty profile and a real job: every skill is a gap, no stories.
        const blank = prepFor({ job: JOB, source: {} });
        assert.ok(blank.focus.length && blank.focus.every((f) => f.gap));
        assert.equal(blank.stories.length, 0);
        // Junk in the source doesn't throw.
        assert.ok(prepFor({ job: JOB, source: { experience: [null, { description: 42 }], skills: null } }));
    });

    it('the text version has every section and no "undefined"', async () => {
        const { prepFor, prepText } = await prepLib();
        const t = prepText(prepFor({ job: JOB, source: RESUME }), JOB);
        for (const h of ['Interview prep: Backend Engineer · Nagad', "What they'll look for", 'Stories to have ready', 'Likely questions', 'Questions to ask them', 'Before you go']) assert.ok(t.includes(h), h);
        assert.ok(!/undefined|null/.test(t));
    });
});

const NOW = new Date('2026-10-01T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 864e5).toISOString();
let n = 0;
const app = ({ status = 'applied', applied = 30, interviewAfter, title = 'Backend Engineer', nickname, resume, archived = false } = {}) => {
    const history = [{ status: 'saved', at: daysAgo(applied + 2) }];
    if (applied != null) history.push({ status: 'applied', at: daysAgo(applied) });
    if (interviewAfter != null) history.push({ status: 'interviewing', at: daysAgo(applied - interviewAfter) });
    if (['offer', 'rejected', 'withdrawn', 'noResponse'].includes(status)) history.push({ status, at: daysAgo(1) });
    return {
        _id: `a${++n}`, status, archived, job: { title, organisation: 'X' },
        appliedAt: applied != null ? daysAgo(applied) : undefined, statusHistory: history,
        snapshot: nickname ? { nickname, at: daysAgo(applied) } : undefined, resume,
    };
};

describe('insights: only above a minimum sample', () => {
    it('stays quiet until 8 applications were sent, counting only ones that were sent', async () => {
        const { insightsFor, MIN_SENT } = await insightsLib();
        assert.equal(MIN_SENT, 8);
        const seven = Array.from({ length: 7 }, () => app());
        const saved = Array.from({ length: 5 }, () => app({ status: 'saved', applied: null }));
        assert.deepEqual(insightsFor([...seven, ...saved], { now: NOW }), { ready: false, sent: 7, need: 8 });
        assert.equal(insightsFor([...seven, app()], { now: NOW }).ready, true);
        assert.deepEqual(insightsFor([], { now: NOW }), { ready: false, sent: 0, need: 8 });
        assert.deepEqual(insightsFor(undefined, { now: NOW }), { ready: false, sent: 0, need: 8 });
    });

    it('counts interviews from the history, so rejected-after-interview still counts', async () => {
        const { insightsFor } = await insightsLib();
        const apps = [
            app({ status: 'interviewing', interviewAfter: 10 }),
            app({ status: 'rejected', interviewAfter: 6 }),
            app({ status: 'offer', interviewAfter: 12 }),
            app({ status: 'rejected' }),
            ...Array.from({ length: 6 }, () => app()),
        ];
        const r = insightsFor(apps, { now: NOW });
        assert.equal(r.sent, 10);
        assert.equal(r.interviews, 3);
        assert.equal(r.offers, 1);
        assert.equal(r.heardBack, 4);
        assert.equal(r.interviewRate, 30);
        assert.equal(r.medianDaysToInterview, 10);
        assert.equal(r.waiting, 6, 'applied 30 days ago, still "applied"');
    });

    it('an application with an interview date but no status change still counts as an interview', async () => {
        const { insightsFor } = await insightsLib();
        const apps = Array.from({ length: 8 }, () => app());
        apps[0].interviews = [{ id: 1, at: daysAgo(-2) }];
        assert.equal(insightsFor(apps, { now: NOW }).interviews, 1);
    });

    it('compares resumes and roles only with 3+ applications in each and at least two groups', async () => {
        const { insightsFor } = await insightsLib();
        const apps = [
            ...Array.from({ length: 4 }, (_, i) => app({ nickname: 'CV A', status: i < 3 ? 'interviewing' : 'applied', interviewAfter: i < 3 ? 5 : undefined })),
            ...Array.from({ length: 4 }, () => app({ nickname: 'CV B' })),
            ...Array.from({ length: 2 }, () => app({ nickname: 'CV C', status: 'interviewing', interviewAfter: 3 })),
        ];
        const r = insightsFor(apps, { now: NOW });
        assert.deepEqual(r.byResume.map((g) => [g.label, g.interviews, g.sent]), [['CV A', 3, 4], ['CV B', 0, 4]], 'CV C has only 2: left out');
        assert.deepEqual(r.byRole, [], 'all one kind of role: nothing to compare');

        const one = insightsFor(Array.from({ length: 9 }, () => app({ nickname: 'Only CV' })), { now: NOW });
        assert.deepEqual(one.byResume, [], 'one resume: nothing to compare');
    });

    it('groups roles by kind (lecturer vs software), not by exact title', async () => {
        const { insightsFor } = await insightsLib();
        const apps = [
            app({ title: 'Lecturer, CSE', status: 'interviewing', interviewAfter: 4 }),
            app({ title: 'Lecturer in Mathematics', status: 'interviewing', interviewAfter: 4 }),
            app({ title: 'Assistant Professor' }),
            app({ title: 'Backend Engineer' }),
            app({ title: 'Full Stack Developer' }),
            app({ title: 'Software Engineer' }),
            app({ title: 'Android Developer' }),
            app({ title: 'Data Entry Operator' }),
        ];
        const r = insightsFor(apps, { now: NOW });
        assert.deepEqual(r.byRole.map((g) => [g.key, g.interviews, g.sent]), [['academic', 2, 3], ['software', 0, 4]]);
    });

    it('ignores junk dates and archived waiting ones', async () => {
        const { insightsFor } = await insightsLib();
        const apps = Array.from({ length: 8 }, () => app());
        apps[0].statusHistory.push({ status: 'interviewing', at: 'not a date' });
        apps[1].archived = true;
        const r = insightsFor(apps, { now: NOW });
        assert.equal(r.interviews, 0);
        assert.equal(r.waiting, 7);
        assert.equal(r.medianDaysToInterview, null);
    });
});

describe('plans: interview prep and insights are Pro and Premium features', () => {
    it('are listed as V2 plan features, off on Free and on for Pro and Premium by default', () => {
        const { APP_FEATURES, DEFAULTS } = require('../lib/settings');
        for (const key of ['interviewPrep', 'insights']) {
            const f = APP_FEATURES.find((x) => x.key === key);
            assert.ok(f && f.v2 === true && f.name && f.description, key);
            const [free, pro, premium] = DEFAULTS.plans;
            assert.equal(free.features[key], false, `free ${key}`);
            assert.equal(pro.features[key], true, `pro ${key}`);
            assert.equal(premium.features[key], true, `premium ${key}`);
        }
    });
});
