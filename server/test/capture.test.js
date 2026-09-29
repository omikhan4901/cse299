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
