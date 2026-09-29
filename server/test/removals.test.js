/**
 * Removing and replacing through "Add anything" and the assistant (server/lib/ingest.js,
 * client/src/lib/ingest/ops.js): removals only when the person's own words ask for them,
 * "this is my previous resume" replaces everything, and removals apply first.
 * The model is stubbed.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { start, stop, api, register, resetState, ai } = require('./helpers');
const { checkOperations } = require('../lib/ingest');

const clientOps = () => import(path.join(__dirname, '../../client/src/lib/ingest/ops.js'));
const clientResume = () => import(path.join(__dirname, '../../client/src/lib/resume.js'));

// What's in the resume now (the builder's example jobs, as in the owner's report).
const outline = {
    personal: { name: 'Jane Doe', email: 'jane@example.com' },
    summary: 'Full stack developer.',
    experience: [
        { id: '1', title: 'Lead Software Engineer', company: 'AI Tech Solutions', points: ['Led a team of 5 engineers'] },
        { id: '2', title: 'Frontend Developer', company: 'Brightlane Studio', points: ['Built a design system'] },
    ],
    projects: [{ id: '3', name: 'OpenBoard', points: ['Real-time whiteboard'] }],
    skills: 'React, Node.js, Java',
};
const FILE = 'Mehboob Ehsan Khan Omi\nExperience\nSoftware Developer, Growth Inc. (Online Startup), Mar 2024 – Jun 2025\nEngineered full-stack web applications\nTechnical Skills: JavaScript, PostgreSQL';
const REPLACE = [
    { op: 'clear', field: 'everything', evidence: 'this is my previous resume' },
    { op: 'add', section: 'experience', title: 'Software Developer', company: 'Growth Inc. (Online Startup)', startDate: 'Mar 2024', endDate: 'Jun 2025', bullets: ['Engineered full-stack web applications'], evidence: 'Software Developer, Growth Inc.' },
    { op: 'set', field: 'personal.name', value: 'Mehboob Ehsan Khan Omi', evidence: 'Mehboob Ehsan Khan Omi' },
    { op: 'addValues', field: 'skills', values: ['JavaScript', 'PostgreSQL'], evidence: 'JavaScript, PostgreSQL' },
];

describe('removals: checks', () => {
    it('"this is my previous resume" clears every filled part first, then adds the file as new items', () => {
        const { operations } = checkOperations(REPLACE, { source: `${FILE}\nthis is my previous resume`, outline, asked: 'Hi, this is my previous resume, use it' });
        const clears = operations.filter((o) => o.op === 'clear');
        assert.equal(clears.length, 1, 'one change for "start over", not one per part');
        assert.deepEqual(clears[0].fields, ['experience', 'projects', 'summary', 'skills'], 'only parts that have something; the empty ones are left alone');
        assert.equal(operations[0], clears[0], 'removals come first');
        assert.equal(clears[0].flags[0].kind, 'removes');
        const job = operations.find((o) => o.section === 'experience');
        assert.equal(job.op, 'add', 'a new job, not merged into a job that is being removed');
        const skills = operations.find((o) => o.op === 'addValues');
        assert.deepEqual(skills.values, ['JavaScript', 'PostgreSQL']);
        assert.deepEqual(operations.map((o) => o.key), operations.map((_, i) => `op${i + 1}`));
    });

    it('no removal without the person asking in their own words: a file or pasted CV is not an instruction', () => {
        for (const asked of ['', 'here is some stuff', 'Add my new job please']) {
            const { operations } = checkOperations(REPLACE, { source: FILE, outline, asked });
            assert.equal(operations.filter((o) => ['clear', 'remove', 'removeValues'].includes(o.op)).length, 0, `asked: "${asked}"`);
            assert.equal(operations.find((o) => o.section === 'experience').op, 'add');
        }
        const noEvidence = checkOperations([{ op: 'clear', field: 'projects' }], { source: 'x', outline, asked: 'remove projects' });
        assert.equal(noEvidence.operations.length, 0, 'a removal must quote the words that asked for it');
        const shortYes = checkOperations([{ op: 'clear', field: 'everything', evidence: 'yes clear everything and start over' }], { source: 'yes', outline, asked: 'yes' });
        assert.equal(shortYes.operations.length, 0, 'a short message can\'t vouch for a longer made-up quote');
    });

    it('removes one item, a whole part or single values; ignores what isn\'t there', () => {
        const asked = 'Remove my job at Brightlane, cancel the whole projects part and take Java and Rust out of my skills';
        const { operations } = checkOperations(
            [
                { op: 'remove', section: 'experience', target: '2', evidence: 'Remove my job at Brightlane' },
                { op: 'remove', section: 'experience', target: '99', evidence: 'Remove my job at Brightlane' },
                { op: 'clear', field: 'projects', evidence: 'cancel the whole projects part' },
                { op: 'remove', section: 'projects', target: '3', evidence: 'cancel the whole projects part' },
                { op: 'clear', field: 'education', evidence: 'cancel the whole projects part' },
                { op: 'removeValues', field: 'skills', values: ['java', 'Rust'], evidence: 'take Java and Rust out of my skills' },
            ],
            { source: asked, outline, asked }
        );
        assert.deepEqual(
            operations.map((o) => [o.op, o.section || o.field, o.target || o.values?.join(',') || '']),
            [['remove', 'experience', '2'], ['clear', 'projects', ''], ['removeValues', 'skills', 'Java']],
            'no unknown id, no empty section, no single remove inside a cleared part, and only values that are listed (as written)'
        );
    });

    it('points for a job being removed are dropped; a new summary replaces the old one without a separate clear', () => {
        const asked = 'Delete the AI Tech Solutions job. My summary: Backend developer who likes maps.';
        const { operations } = checkOperations(
            [
                { op: 'remove', section: 'experience', target: '1', evidence: 'Delete the AI Tech Solutions job' },
                { op: 'addBullets', section: 'experience', target: '1', bullets: ['Shipped things'], evidence: 'x' },
                { op: 'clear', field: 'summary', evidence: 'My summary' },
                { op: 'set', field: 'summary', value: 'Backend developer who likes maps.', evidence: 'My summary' },
            ],
            { source: asked, outline, asked }
        );
        assert.deepEqual(operations.map((o) => o.op), ['remove', 'set']);
    });
});

describe('removals: applying', () => {
    it('removals apply first whatever the order, and describe themselves plainly', async () => {
        const { applyOperations, describeOperation, isRemoval } = await clientOps();
        const { normalizeResume } = await clientResume();
        const resume = normalizeResume({
            summary: 'Old summary',
            experience: [{ id: 1, title: 'Lead', company: 'AI Tech Solutions' }, { id: 2, title: 'Frontend', company: 'Brightlane Studio' }],
            projects: [{ id: 3, name: 'OpenBoard' }],
            skills: 'React, Java, Node.js',
        });
        const ops = [
            { op: 'add', section: 'experience', item: { title: 'Software Developer', company: 'Growth Inc.' } },
            { op: 'clear', field: 'experience' },
            { op: 'removeValues', field: 'skills', values: ['java'] },
            { op: 'clear', field: 'summary' },
            { op: 'remove', section: 'projects', target: '3' },
        ];
        const next = applyOperations(resume, ops);
        assert.deepEqual(next.experience.map((e) => e.company), ['Growth Inc.'], 'the new job survives the clear');
        assert.equal(next.skills, 'React, Node.js');
        assert.equal(next.summary, '');
        assert.equal(next.projects.length, 0);
        assert.equal(resume.experience.length, 2, 'the original is not changed');
        assert.equal(describeOperation(ops[1], resume).title, 'Remove all of Experience');
        assert.deepEqual(describeOperation(ops[1], resume).detail, ['Lead at AI Tech Solutions', 'Frontend at Brightlane Studio']);
        assert.equal(describeOperation(ops[4], resume).title, 'Remove project: OpenBoard');
        assert.equal(describeOperation(ops[2], resume).title, 'Remove from skills: java');
        assert.ok(isRemoval(ops[1]) && !isRemoval(ops[0]));
        assert.equal(describeOperation(ops[3], resume).title, 'Remove the summary');
        const all = { op: 'clear', field: 'everything', fields: ['experience', 'projects', 'skills'] };
        assert.deepEqual(describeOperation(all, resume), { title: "Start over: remove what's in it now", detail: ['Experience (2), Projects (1), Skills'] });
        const fresh = applyOperations(resume, [{ op: 'add', section: 'projects', item: { name: 'BondhuKoi' } }, all]);
        assert.deepEqual([fresh.experience.length, fresh.projects.map((x) => x.name), fresh.skills, fresh.summary], [0, ['BondhuKoi'], '', 'Old summary'], 'only the listed parts are emptied');
    });
});

describe('removals: routes', () => {
    before(() => start('removals'));
    after(stop);
    beforeEach(resetState);

    it('a file with "this is my previous resume" sends the note on its own and replaces the resume', async () => {
        const { token } = await register();
        let prompt = '';
        ai.reply = (payload) => {
            prompt = payload.contents[0].parts.at(-1).text;
            return JSON.stringify({ operations: REPLACE });
        };
        const form = new FormData();
        form.append('resumeFile', new Blob([Buffer.from('%PDF-1.4\n%%EOF')]), 'Resume.pdf');
        form.append('outline', JSON.stringify(outline));
        form.append('text', 'Hi, this is my previous resume, use it');
        const r = await api('POST', '/ai/ingest', { token, raw: form });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.match(prompt, /NOTE \(what the person wrote with the file\):\nHi, this is my previous resume/);
        assert.equal(r.body.operations[0].op, 'clear');
        assert.ok(r.body.operations.some((o) => o.op === 'add' && o.section === 'experience'));
    });

    it('pasted text can ask for a removal; the assistant can too, but not on its own initiative', async () => {
        const { token } = await register();
        ai.reply = JSON.stringify({ operations: [{ op: 'clear', field: 'experience', evidence: 'cancel the whole experience part' }] });
        const r = await api('POST', '/ai/ingest', { token, body: { text: 'Can you cancel the whole experience part?', outline } });
        assert.deepEqual(r.body.operations.map((o) => [o.op, o.field]), [['clear', 'experience']]);

        ai.reply = JSON.stringify({ reply: 'Removed.', operations: [{ op: 'remove', section: 'projects', target: '3', evidence: 'delete the OpenBoard project' }] });
        const asked = await api('POST', '/ai/chat', { token, body: { conversation: [{ role: 'user', content: 'Please delete the OpenBoard project' }], fullResume: {}, propose: true, outline } });
        assert.deepEqual(asked.body.operations.map((o) => [o.op, o.target]), [['remove', '3']]);
        const unasked = await api('POST', '/ai/chat', { token, body: { conversation: [{ role: 'user', content: 'Make my summary shorter' }], fullResume: {}, propose: true, outline } });
        assert.equal(unasked.body.operations.length, 0);
    });
});
