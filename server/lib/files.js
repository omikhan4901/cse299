/**
 * Reading uploaded PDFs and Word files off the main thread (docs/v2/BETA-PLAN.md, Phase 4):
 * a small pool of worker threads, each with a memory ceiling, and a hard time limit per
 * file. A file that runs over is stopped by killing its thread (a fresh one takes its
 * place), so one bad upload can't freeze the server for everyone. Word files are also
 * checked for zip bombs before they're opened. The queue is bounded: when it's full, people
 * are asked to try again in a moment.
 */
const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');

const SIZE = Math.max(1, Math.min(Number(process.env.FILE_WORKERS) || 2, os.cpus().length));
const TIMEOUT = Number(process.env.FILE_TIMEOUT_MS) || 20_000;
// Two workers at 160 MB plus the server fit a 1 GiB Cloud Run instance (docs/deploy-cloud-run.md).
const MEMORY_MB = Number(process.env.FILE_WORKER_MB) || 160;
const MAX_QUEUE = 20;

// `expose`: the message is written for people and safe to show them.
const fail = (message, status = 400) => Object.assign(new Error(message), { status, expose: true });

const workers = []; // { worker, job }
const queue = [];
let nextId = 1;

function spawn() {
    const worker = new Worker(path.join(__dirname, 'fileWorker.js'), { resourceLimits: { maxOldGenerationSizeMb: MEMORY_MB, maxYoungGenerationSizeMb: 32 } });
    const slot = { worker, job: null };
    worker.on('message', ({ id, result, error }) => {
        const job = slot.job;
        if (!job || job.id !== id) return;
        finish(slot, error ? fail(error.message, error.status || 400) : null, result);
    });
    const died = (err) => {
        const job = slot.job;
        replace(slot);
        if (job) job.reject(/memory/i.test(err?.message || err?.code || '') ? fail('This file needs too much memory to read. Try saving it again as a simpler PDF.', 422) : fail("We couldn't read that file.", 422));
    };
    worker.on('error', died);
    worker.on('exit', (code) => slot.job && died(new Error(`exit ${code}`)));
    // An idle pool never keeps the process alive (after the listeners, which would ref it again).
    worker.unref();
    return slot;
}

function replace(slot) {
    clearTimeout(slot.job?.timer);
    slot.job = null;
    const i = workers.indexOf(slot);
    slot.worker.removeAllListeners();
    slot.worker.terminate().catch(() => {});
    if (i >= 0) workers[i] = spawn();
    pump();
}

function finish(slot, err, result) {
    const job = slot.job;
    clearTimeout(job.timer);
    slot.job = null;
    if (err) job.reject(err);
    else job.resolve(result);
    pump();
}

function pump() {
    while (workers.length < SIZE) workers.push(spawn());
    for (const slot of workers) {
        if (slot.job || !queue.length) continue;
        const job = queue.shift();
        slot.job = job;
        slot.worker.ref(); // keep the process up while a file is being read
        job.timer = setTimeout(() => {
            // Stop it for real: the thread is killed and replaced.
            job.reject(fail('This file took too long to read. Try saving it again as a simpler PDF.', 422));
            slot.job = null;
            replace(slot);
        }, job.timeout);
        slot.worker.postMessage({ id: job.id, op: job.op, data: job.data });
        const release = () => slot.worker.unref();
        job.promise.then(release, release);
    }
}

function run(op, buffer, { timeout = TIMEOUT } = {}) {
    if (queue.length >= MAX_QUEUE) return Promise.reject(fail('We are reading a lot of files right now. Please try again in a minute.', 503));
    // A copy the worker can own (multer's buffer may share memory with others).
    const data = new Uint8Array(buffer);
    let resolve, reject;
    const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
    const job = { id: nextId++, op, data, timeout, resolve, reject, promise };
    queue.push(job);
    pump();
    return promise;
}

/**
 * Zip bomb guard for Word files: reads the zip's table of contents (no unpacking) and
 * refuses archives that claim too many entries or too much unpacked data.
 */
function zipProblem(buffer, { maxEntries = 2000, maxBytes = 60 * 1024 * 1024 } = {}) {
    // End of central directory: signature 0x06054b50, within the last 64 KB + 22 bytes.
    const from = Math.max(0, buffer.length - 65557);
    let eocd = -1;
    for (let i = buffer.length - 22; i >= from; i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) return "That file isn't a valid Word document.";
    const entries = buffer.readUInt16LE(eocd + 10);
    const size = buffer.readUInt32LE(eocd + 12);
    const offset = buffer.readUInt32LE(eocd + 16);
    if (entries > maxEntries) return 'That Word document has too many parts to read.';
    if (offset + size > buffer.length) return "That file isn't a valid Word document.";
    let total = 0;
    let p = offset;
    for (let n = 0; n < entries; n++) {
        if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== 0x02014b50) return "That file isn't a valid Word document.";
        total += buffer.readUInt32LE(p + 24); // uncompressed size
        if (total > maxBytes) return 'That Word document is too large to read. Try saving it again, or upload a PDF.';
        p += 46 + buffer.readUInt16LE(p + 28) + buffer.readUInt16LE(p + 30) + buffer.readUInt16LE(p + 32);
    }
    return null;
}

module.exports = {
    /** { text, pageCount, layout } of a PDF (lib/pdfText.js), read in a worker. */
    readPdf: (buffer, opts) => run('pdf', buffer, opts),
    /** Pages of a PDF, or null when it can't be opened. */
    pdfPageCount: (buffer, opts) => run('pages', buffer, { timeout: 8000, ...opts }).catch(() => null),
    /** The plain text of a .docx, after the zip bomb check. */
    docxText: (buffer, opts) => {
        const problem = zipProblem(buffer);
        return problem ? Promise.reject(fail(problem)) : run('docx', buffer, opts);
    },
    zipProblem,
    _run: run,
    _pool: () => ({ size: workers.length, busy: workers.filter((w) => w.job).length, queued: queue.length }),
};
