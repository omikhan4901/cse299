/**
 * Job capture (client/src/lib/capture.js): what the tracker reads from a pasted post or
 * circular, over realistic Bangladeshi and international examples (fixtures/circulars.js).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const circulars = require('./fixtures/circulars');

const lib = () => import(path.join(__dirname, '../../client/src/lib/capture.js'));
const NOW = new Date('2026-09-29T00:00:00Z');
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

describe('job capture', () => {
    for (const c of circulars) {
        it(c.name, async () => {
            const { captureJob } = await lib();
            const got = captureJob(c.text, { now: NOW });
            for (const [field, want] of Object.entries(c.expect)) {
                const have = got[field];
                if (field === 'keywords') {
                    for (const k of want) assert.ok(have.some((h) => norm(h) === norm(k)), `keyword ${k} in ${have.join(', ')}`);
                } else if (Array.isArray(want)) {
                    assert.deepEqual([...have].sort(), [...want].sort(), field);
                } else if (!want) {
                    assert.equal(have, '', `${field} should be empty, got "${have}"`);
                } else {
                    // The expected text, give or take a little around it ("Software Engineer (Backend)").
                    assert.ok(norm(have).includes(norm(want)) && norm(have).length <= norm(want).length + 25, `${field}: want "${want}", got "${have}"`);
                }
            }
        });
    }

    it('"title at company" openings, as in one-paragraph posts and LinkedIn shares; not every "at"', async () => {
        const { captureJob } = await lib();
        const cases = [
            ['Junior Software Engineer at Pathao, Dhaka. We are looking for a graduate with JavaScript, React and SQL. Apply by 25 October 2026.', 'Junior Software Engineer', 'Pathao'],
            ['Data Analyst @ bKash (Dhaka). SQL and Python.', 'Data Analyst', 'bKash'],
            ['Hiring: Backend Developer at ShopUp - remote friendly', 'Backend Developer', 'ShopUp'],
            ['Senior Product Designer at Brain Station 23 in Dhaka', 'Senior Product Designer', 'Brain Station 23'],
            ['We are looking at new ways to work at Acme. Nothing here.', '', ''],
            ['Engineers at Google say hello', '', ''],
        ];
        for (const [text, title, organisation] of cases) {
            const got = captureJob(text, { now: NOW });
            assert.equal(got.title, title, text);
            assert.equal(got.organisation, organisation, text);
        }
    });

    it('dates: Bangla digits and months, ordinals, two-digit years, and impossible dates', async () => {
        const { findDates, findDeadline } = await lib();
        assert.deepEqual(findDates('১৫ অক্টোবর ২০২৬').map((d) => d.iso), ['2026-10-15']);
        assert.deepEqual(findDates('on 3rd Jan 27 and 29/02/2028 and 30/02/2027').map((d) => d.iso), ['2027-01-03', '2028-02-29']);
        assert.equal(findDeadline('Deadline: tomorrow'), '');
        assert.equal(findDeadline('Deadline'), '');
        assert.equal(findDeadline(''), '');
    });

    it('never throws on odd input, and stays quick on very long pastes', async () => {
        const { captureJob } = await lib();
        for (const input of [null, undefined, 42, '', '\n\n\n', ':::', '📌'.repeat(500), 'Deadline: '.repeat(2000)]) captureJob(input, { now: NOW });
        const big = `Job title: Engineer\n${'Lorem ipsum dolor sit amet 12/12/2026. '.repeat(3000)}`;
        const started = Date.now();
        captureJob(big, { now: NOW });
        assert.ok(Date.now() - started < 2000, `${Date.now() - started} ms`);
    });
});

describe('a real embedded-software posting (keywords and capture)', () => {
    const text = require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures', 'embedded-job.txt'), 'utf8');
    const ats = () => import(require('node:path').join(__dirname, '../../client/src/lib/ats/analyze.js'));

    it('finds the real skills, weighted by section, and none of the noise', async () => {
        const { jobKeywords } = await ats();
        const ks = jobKeywords(text, { ignore: ['ReliSource'] });
        const names = ks.map((k) => k.name);
        for (const want of ['C', 'C++', 'Microcontrollers', 'Embedded systems', 'RTOS', 'Serial protocols', 'Interrupt handling', 'GPIO', 'STM32', 'Git']) assert.ok(names.includes(want), `${want} in ${names}`);
        for (const noise of ['CV', 'C/C', 'B.', 'B', 'Sc', 'bySeptember', 'ReliSource', 'Relisource', 'US', 'IMPORTANT', 'GPIO/SFR', 'I/O', 'ESE_CS_15032025']) assert.ok(!names.includes(noise), `${noise} should not be a keyword`);
        const w = Object.fromEntries(ks.map((k) => [k.name, k.importance]));
        assert.ok(w['C++'] > w.Git, 'a key requirement outweighs a nice-to-have');
        assert.ok(w.TCP < 1, '"Nice To Have Requirements" counts as nice to have');
        // Without the employer given, its email domain still keeps it out.
        assert.ok(!jobKeywords(text).some((k) => /relisource/i.test(k.name)));
    });

    it('no years check for "0-2 years" (no minimum); the organisation comes from the email domain', async () => {
        const { matchChecks } = await ats();
        const { normalizeResume } = await import(require('node:path').join(__dirname, '../../client/src/lib/resume.js'));
        const { checks } = matchChecks({ resume: normalizeResume({ experience: [{ id: 1, title: 'Intern', startDate: '2024', endDate: '2025' }] }), jobDescription: text });
        assert.equal(checks.find((c) => c.id === 'years'), undefined);
        const { captureJob } = await lib();
        const c = captureJob(text, { now: new Date('2026-09-01') });
        assert.equal(c.organisation, 'Relisource');
        assert.equal(c.deadline, '2026-09-30');
        assert.equal(c.email, 'career@relisource.com');
        // A free email provider says nothing about the employer.
        assert.equal(captureJob('Send your CV to hr.team@gmail.com by 30 September 2026. Software Engineer wanted.', { now: new Date('2026-09-01') }).organisation, '');
    });

    it('a known phrase is one keyword: no stray "PCI" and "DSS", and "API" isn\'t repeated next to REST APIs', async () => {
        const { jobKeywords } = await ats();
        const jd = 'Software Engineer (Payments)\nSSLCommerz\n\nRequirements:\n- Kafka or another message queue\n- Docker and Kubernetes\n- gRPC and REST API design\n- Payment systems, PCI DSS is a plus';
        const names = jobKeywords(jd, { ignore: ['SSLCommerz'] }).map((k) => k.name);
        assert.deepEqual(names.sort(), ['Docker', 'Kafka', 'Kubernetes', 'PCI DSS', 'REST APIs', 'gRPC'].sort());
    });
});
