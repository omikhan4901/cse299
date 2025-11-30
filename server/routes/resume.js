const express = require('express');
const router = express.Router();
const Resume = require('../models/Resume');
const { protect } = require('./auth'); //

// @route   POST /api/resumes
// @desc    Create a new resume
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { 
            nickname, 
            profilePic, 
            personal, 
            summary, 
            experience, 
            education, 
            skills, 
            template,
            isMaster 
        } = req.body;

        // If user wants this to be the master, unset others first (optional logic)
        if (isMaster) {
            await Resume.updateMany({ user: req.userId }, { isMaster: false });
        }

        const newResume = await Resume.create({
            user: req.userId, // From the protect middleware
            nickname,
            profilePic,
            personal,
            summary,
            experience,
            education,
            skills,
            template,
            isMaster
        });

        res.status(201).json({
            success: true,
            data: newResume
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error saving resume.' });
    }
});

// @route   GET /api/resumes
// @desc    Get all resumes for the logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        // Find resumes belonging to this user, sorted by newest first
        const resumes = await Resume.find({ user: req.userId }).sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            count: resumes.length,
            data: resumes
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error fetching resumes.' });
    }
});

// @route   GET /api/resumes/:id
// @desc    Get a single resume by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const resume = await Resume.findById(req.params.id);

        if (!resume) {
            return res.status(404).json({ success: false, error: 'Resume not found' });
        }

        // Ensure the resume belongs to the requesting user
        if (resume.user.toString() !== req.userId) {
            return res.status(401).json({ success: false, error: 'Not authorized' });
        }

        res.status(200).json({ success: true, data: resume });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

// @route   PUT /api/resumes/:id
// @desc    Update a resume
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        let resume = await Resume.findById(req.params.id);

        if (!resume) {
            return res.status(404).json({ success: false, error: 'Resume not found' });
        }

        // Ensure user owns this resume
        if (resume.user.toString() !== req.userId) {
            return res.status(401).json({ success: false, error: 'Not authorized' });
        }

        // If setting as master, unset others
        if (req.body.isMaster) {
            await Resume.updateMany({ user: req.userId }, { isMaster: false });
        }

        resume = await Resume.findByIdAndUpdate(req.params.id, req.body, {
            new: true, // Return the updated object
            runValidators: true
        });

        res.status(200).json({ success: true, data: resume });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error updating resume' });
    }
});

// @route   DELETE /api/resumes/:id
// @desc    Delete a resume
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const resume = await Resume.findById(req.params.id);

        if (!resume) {
            return res.status(404).json({ success: false, error: 'Resume not found' });
        }

        if (resume.user.toString() !== req.userId) {
            return res.status(401).json({ success: false, error: 'Not authorized' });
        }

        await resume.deleteOne();

        res.status(200).json({ success: true, data: {} });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error deleting resume' });
    }
});

module.exports = router;