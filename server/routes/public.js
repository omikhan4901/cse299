const express = require('express');
const router = express.Router();
const Resume = require('../models/Resume');

// @route   GET /api/public/:id
// @desc    Get a resume by ID without authentication
// @access  Public (But strictly controlled by the isPublic flag)
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let resume;

        // 1. Try finding by Short ID first (Preferred)
        resume = await Resume.findOne({ shortId: id });

        // 2. If not found, and it looks like a MongoID (24 chars), try that (Legacy support)
        if (!resume && id.match(/^[0-9a-fA-F]{24}$/)) {
            resume = await Resume.findById(id);
        }

        if (!resume) {
            return res.status(404).json({ success: false, error: 'Resume not found' });
        }

        if (!resume.isPublic) {
            return res.status(403).json({ success: false, error: 'Access Denied. This resume is private.' });
        }

        res.status(200).json({ success: true, data: resume });

    } catch (err) {
        console.error('Public Fetch Error:', err.message);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

module.exports = router;