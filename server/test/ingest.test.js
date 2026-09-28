/**
 * Ingestion: the deterministic checks on the AI's operations (server/lib/ingest.js), how
 * operations are applied (client/src/lib/ingest/ops.js), and the /ai/ingest route.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { start, stop, api, register, resetState, ai } = require('./helpers');
const { checkOperations, factTokens, SECTION_FIELDS } = require('../lib/ingest');

const clientOps = () => import(path.join(__dirname, '../../client/src/lib/ingest/ops.js'));
const clientResume = () => import(path.join(__dirname, '../../client/src/lib/resume.js'));

const outline = {
    personal: { name: 'Rahim Uddin', email: 'rahim@mail.com' },
    summary: 'Backend developer.',
    experience: [{ id: '11', title: 'Software Engineer', company: 'Pathao Ltd.', startDate: 'Mar 2021', endDate: 'Present', points: ['Built the payments service'] }],
    projects: [{ id: '21', name: 'BondhuKoi', technologies: 'React Native, Fastify', points: ['Built a friend-finder app'] }],
    skills: 'Node.js, Go',
};

describe('checking the AI operations', () => {
    it('an item that is already there becomes a merge with only the new points; an exact repeat is skipped', () => {
        const source = 'At Pathao I built the payments service and reduced API latency by 35% with Redis.';
        const { operations, skipped } = checkOperations(
            [
                { op: 'add', section: 'experience', item: { company: 'Pathao', title: 'Software Engineer' }, bullets: ['Built the payments service', 'Reduced API latency by 35% with Redis'], evidence: 'At Pathao' },
                { op: 'add', section: 'projects', item: { name: 'BondhuKoi' }, bullets: ['Built a friend-finder app'], evidence: 'x' },
            ],
            { source, outline }
        );
        assert.equal(skipped, 1);
        assert.equal(operations.length, 1);
        assert.equal(operations[0].op, 'addBullets');
        assert.equal(operations[0].target, '11');
        assert.deepEqual(operations[0].bullets, ['Reduced API latency by 35% with Redis']);
        assert.equal(operations[0].flags, undefined, 'every fact is in the text');
    });

    it('two adds of the same thing in one reply are merged', () => {
        const source = 'I worked at Brain Station 23 as a Junior Developer. At Brain Station 23 I wrote REST APIs and integration tests.';
        const { operations } = checkOperations(
            [
                { op: 'add', section: 'experience', item: { company: 'Brain Station 23', title: 'Junior Developer' }, bullets: ['Wrote REST APIs'], evidence: 'a' },
                { op: 'add', section: 'experience', item: { company: 'Brain Station 23' }, bullets: ['Wrote integration tests'], evidence: 'b' },
            ],
            { source, outline }
        );
        assert.equal(operations.length, 1);
        assert.deepEqual(operations[0].bullets, ['Wrote REST APIs', 'Wrote integration tests']);
    });

    it('numbers, names and skills that are not in the text are flagged; dates written differently are not', () => {
        const source = 'I led a team of five at Acme from March 2020 and improved sales.';
        const { operations } = checkOperations(
            [
                { op: 'add', section: 'experience', item: { company: 'Acme', title: 'Team Lead', startDate: 'Mar 2020' }, bullets: ['Led a team of 5 engineers', 'Improved sales by 20% at Google'], evidence: 'x' },
                { op: 'addValues', field: 'skills', values: ['Leadership', 'Kubernetes'], evidence: 'x' },
            ],
            { source, outline }
        );
        const flagged = operations[0].flags.find((f) => f.kind === 'unverified').tokens;
        assert.ok(flagged.includes('5') && flagged.includes('20') && flagged.includes('google'), flagged.join());
        assert.ok(!flagged.includes('mar') && !flagged.includes('2020') && !flagged.includes('acme'));
        const skills = operations[1].flags.find((f) => f.kind === 'unverified').tokens;
        assert.deepEqual(skills, ['leadership', 'kubernetes'], 'neither skill word is in the text');
    });

    it('drops operations on items that do not exist, and flags replacing something already filled', () => {
        const source = 'My email is rahim.new@mail.com. My job at Pathao ended in June 2024.';
        const { operations } = checkOperations(
            [
                { op: 'update', section: 'experience', target: '999', item: { endDate: 'Jun 2024' }, evidence: 'x' },
                { op: 'update', section: 'experience', target: '11', item: { endDate: 'Jun 2024' }, evidence: 'ended in June 2024' },
                { op: 'set', field: 'personal.email', value: 'rahim.new@mail.com', evidence: 'x' },
                { op: 'set', field: 'personal.name', value: 'Rahim Uddin', evidence: 'x' },
                { op: 'set', field: 'password', value: 'x', evidence: 'x' },
            ],
            { source, outline }
        );
        assert.deepEqual(operations.map((o) => [o.op, o.target || o.field]), [['update', '11'], ['set', 'personal.email']]);
        assert.deepEqual(operations[0].flags, [{ kind: 'replaces', fields: ['endDate'] }]);
        assert.deepEqual(operations[1].flags, [{ kind: 'replaces', fields: ['personal.email'] }]);
    });

    it('skills already listed are left out; fact tokens ignore sentence starts and months', () => {
        const { operations, skipped } = checkOperations([{ op: 'addValues', field: 'skills', values: ['node.js', 'Go'], evidence: 'x' }], { source: 'Node.js and Go', outline });
        assert.equal(operations.length, 0);
        assert.equal(skipped, 1);
        assert.deepEqual(factTokens('Built a dashboard in React for 1,200 users. Deployed on AWS in Jan 2024.'), ['1200', '2024', 'react', 'aws']);
    });
});

describe('applying operations', () => {
    it('adds, merges, updates and sets, and keeps everything else', async () => {
        const { applyOperations } = await clientOps();
        const { normalizeResume } = await clientResume();
        const resume = normalizeResume({
            personal: { name: 'Rahim' },
            experience: [{ id: 11, title: 'Software Engineer', company: 'Pathao', startDate: 'Mar 2021', endDate: 'Present', description: 'Built the payments service' }],
            skills: 'Node.js',
        });
        const next = applyOperations(resume, [
            { op: 'addBullets', section: 'experience', target: '11', bullets: ['Reduced latency by 35%'] },
            { op: 'update', section: 'experience', target: '11', item: { endDate: 'Jun 2024' } },
            { op: 'add', section: 'projects', item: { name: 'BondhuKoi', technologies: 'React Native' }, bullets: ['Built a friend-finder app'] },
            { op: 'set', field: 'personal.phone', value: '+880 1712-345678' },
            { op: 'addValues', field: 'skills', values: ['node.js', 'Redis'] },
        ]);
        assert.equal(next.experience[0].description, 'Built the payments service\nReduced latency by 35%');
        assert.equal(next.experience[0].endDate, 'Jun 2024');
        assert.equal(next.projects[0].name, 'BondhuKoi');
        assert.equal(next.projects[0].description, 'Built a friend-finder app');
        assert.equal(next.personal.phone, '+880 1712-345678');
        assert.equal(next.personal.name, 'Rahim');
        assert.equal(next.skills, 'Node.js, Redis');
        assert.equal(resume.experience[0].endDate, 'Present', 'the original is not changed');
    });

    it('the server and the builder agree on every section and field', async () => {
        const { EMPTY_ITEMS } = await clientResume();
        assert.deepEqual(Object.fromEntries(Object.entries(EMPTY_ITEMS).map(([s, f]) => [s, Object.keys(f)])), SECTION_FIELDS);
    });
});

describe('/ai/ingest', () => {
    before(() => start('ingest'));
    after(stop);
    beforeEach(resetState);

    it('returns checked operations and charges the import cost', async () => {
        const { token } = await register();
        ai.reply = JSON.stringify({ operations: [{ op: 'add', section: 'projects', item: { name: 'Attendance system', technologies: 'Python, OpenCV' }, bullets: ['Cut processing time by 40%'], evidence: 'attendance system' }] });
        const r = await api('POST', '/ai/ingest', { token, body: { text: 'In third year I built an attendance system with Python and OpenCV that cut processing time by 40%.', outline } });
        assert.equal(r.status, 200);
        assert.equal(r.body.operations.length, 1);
        assert.equal(r.body.operations[0].key, 'op1');
        assert.equal(r.body.operations[0].flags, undefined);
        const usage = (await api('GET', '/billing/me', { token })).body.data;
        assert.equal(usage.used, 3);
    });

    it('refuses empty or oversized input before calling the AI, and refunds an unreadable reply', async () => {
        const { token } = await register();
        assert.equal((await api('POST', '/ai/ingest', { token, body: { text: '   ' } })).status, 400);
        assert.equal((await api('POST', '/ai/ingest', { token, body: { text: 'x'.repeat(30001) } })).status, 400);
        assert.equal(ai.calls, 0);
        ai.reply = 'not json';
        assert.equal((await api('POST', '/ai/ingest', { token, body: { text: 'I worked at Acme.' } })).status, 502);
        assert.equal((await api('GET', '/billing/me', { token })).body.data.used, 0);
    });
});
