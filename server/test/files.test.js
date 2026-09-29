/**
 * Reading uploads off the main thread (lib/files.js): real PDFs and Word files read the same
 * as before; a file that runs too long or eats memory is stopped by killing its worker, the
 * pool recovers, and the server keeps answering meanwhile; zip bombs are refused unopened.
 */
process.env.FILE_WORKER_TEST = '1';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const files = require('../lib/files');

const fixtures = path.join(__dirname, 'fixtures');
const firstPdf = () => fs.readdirSync(fixtures, { recursive: true }).find((f) => /\.pdf$/i.test(f));

/** A zip whose table of contents claims `entries` files of `size` bytes each (nothing inside). */
function fakeZip(entries, size) {
    const cd = [];
    for (let i = 0; i < entries; i++) {
        const h = Buffer.alloc(46 + 5);
        h.writeUInt32LE(0x02014b50, 0);
        h.writeUInt32LE(size, 24);
        h.writeUInt16LE(5, 28);
        h.write('a.xml', 46);
        cd.push(h);
    }
    const dir = Buffer.concat(cd);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(Math.min(entries, 0xffff), 8);
    end.writeUInt16LE(Math.min(entries, 0xffff), 10);
    end.writeUInt32LE(dir.length, 12);
    end.writeUInt32LE(0, 16);
    return Buffer.concat([dir, end]);
}

describe('file reading in workers', () => {
    it('reads a real PDF: text, pages and layout, like before', async () => {
        const f = firstPdf();
        assert.ok(f, 'a PDF fixture exists');
        const buf = fs.readFileSync(path.join(fixtures, f));
        const r = await files.readPdf(buf);
        assert.ok(r.text.length > 50);
        assert.ok(r.pageCount >= 1);
        assert.equal(await files.pdfPageCount(buf), r.pageCount);
        assert.equal(await files.pdfPageCount(Buffer.from('not a pdf')), null);
    });

    it('a file that never finishes is stopped at the time limit; the server stays responsive and the pool recovers', async () => {
        let ticks = 0;
        const timer = setInterval(() => ticks++, 10);
        const t0 = Date.now();
        await assert.rejects(files._run('hang', Buffer.alloc(1), { timeout: 400 }), (err) => err.status === 422 && /too long/.test(err.message));
        clearInterval(timer);
        assert.ok(Date.now() - t0 < 2000);
        assert.ok(ticks >= 20, `main thread kept running (${ticks} ticks)`);
        const f = firstPdf();
        assert.ok((await files.readPdf(fs.readFileSync(path.join(fixtures, f)))).pageCount >= 1, 'a fresh worker took over');
    });

    it('a file that eats memory kills only its worker', async () => {
        await assert.rejects(files._run('bloat', Buffer.alloc(1), { timeout: 15000 }), (err) => err.status === 422);
        assert.equal(await files.pdfPageCount(Buffer.from('x')), null, 'the pool still works');
        assert.equal(files._pool().busy, 0);
    });

    it('many files at once queue up; past the queue people are asked to retry', async () => {
        const jobs = Array.from({ length: 30 }, () => files._run('hang', Buffer.alloc(1), { timeout: 300 }).catch((e) => e.status));
        const statuses = await Promise.all(jobs);
        assert.ok(statuses.includes(503), 'some refused as busy');
        assert.ok(statuses.includes(422), 'the rest were stopped at the time limit');
        assert.equal(files._pool().queued, 0);
    });

    it('zip bombs and broken Word files are refused before opening', async () => {
        assert.equal(files.zipProblem(fakeZip(3, 1000)), null);
        assert.match(files.zipProblem(fakeZip(3, 30 * 1024 * 1024)), /too large/);
        assert.match(files.zipProblem(fakeZip(2500, 10)), /too many parts/);
        assert.match(files.zipProblem(Buffer.from('PK\u0003\u0004 not really a zip')), /isn't a valid/);
        await assert.rejects(files.docxText(fakeZip(2, 40 * 1024 * 1024)), (err) => err.status === 400 && err.expose);
    });
});
