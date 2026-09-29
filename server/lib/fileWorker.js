/**
 * Runs inside a worker thread (lib/files.js): reads one uploaded file per message, so a
 * slow, huge or hostile PDF or Word file can be stopped (the thread is killed) without the
 * server's main thread noticing.
 */
const { parentPort } = require('worker_threads');
const { readPdf, pdfPageCount } = require('./pdfText');

const ops = {
    pdf: (buf) => readPdf(buf),
    pages: (buf) => pdfPageCount(buf),
    docx: async (buf) => (await require('mammoth').extractRawText({ buffer: buf })).value,
};
// For the tests only: a job that never finishes, and one that eats memory.
if (process.env.FILE_WORKER_TEST === '1') {
    ops.hang = () => new Promise(() => setInterval(() => {}, 1000));
    ops.bloat = () => {
        const keep = [];
        for (;;) keep.push(new Array(1e6).fill(Math.random()));
    };
}

parentPort.on('message', async ({ id, op, data }) => {
    try {
        const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        const result = await ops[op](buf);
        parentPort.postMessage({ id, result });
    } catch (err) {
        parentPort.postMessage({ id, error: { message: err.message, status: err.status } });
    }
});
