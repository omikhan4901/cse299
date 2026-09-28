const express = require('express');
const multer = require('multer');
const { limit, clientIp } = require('../lib/rateLimit');
const { readPdf } = require('../lib/pdfText');

/**
 * The public ATS checker: reads an uploaded resume PDF and returns what an ATS
 * would extract. The scoring runs in the browser (client/src/lib/ats). No account
 * needed, so it's limited per network. The file is read in memory and never stored.
 */
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 } });
const isPdf = (buf) => buf.length > 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';

const scanLimit = limit({
    name: 'ats-scan',
    windowMs: 60 * 60 * 1000,
    max: 5,
    key: clientIp,
    message: "You've used all your free ATS checks for now.",
    label: 'ATS checks of an uploaded PDF',
    group: 'ATS checker',
    description: 'Resume PDFs checked on the public ATS checker page, per network (no account needed). Checks inside the builder are not counted.',
});

// Only counted once the upload is a real PDF, so picking the wrong file doesn't use up a check.
router.post('/scan', (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is over 5 MB. Upload a smaller PDF.' : 'Upload one PDF file.' });
        if (!req.file) return res.status(400).json({ success: false, error: 'Choose your resume PDF to check.' });
        if (!isPdf(req.file.buffer)) return res.status(400).json({ success: false, error: "That isn't a PDF. Export your resume as a PDF and upload that." });
        next();
    });
}, scanLimit, async (req, res) => {
    try {
        const result = await Promise.race([
            readPdf(req.file.buffer),
            new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('That PDF took too long to read. Try exporting it again.'), { status: 400 })), 20000)),
        ]);
        res.json({ success: true, ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        // Damaged, encrypted or otherwise unreadable PDFs.
        console.error('ATS scan failed:', err.message);
        res.status(400).json({ success: false, error: "We couldn't read that PDF. If it's password-protected or scanned, export an unlocked, text-based PDF and try again." });
    }
});

module.exports = router;
