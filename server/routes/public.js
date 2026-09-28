const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Resume = require("../models/Resume");
const User = require("../models/User");
const { limit, clientIp } = require("../lib/rateLimit");

// @route   GET /api/public/:id
// @desc    A shared resume, by short id (or legacy Mongo id). Only works when isPublic is on.
router.get("/:id", limit({ name: "public-ip", windowMs: 60 * 1000, max: 120, key: clientIp, message: "Too many requests.", label: "Shared resume views", group: "Public pages", description: "Share-link page loads from one network." }), async (req, res) => {
  try {
    const { id } = req.params;
    // Never expose the owner, or the uncropped original photo.
    const hidden = "-__v -personal.profilePicSource -personal.photoCrop";
    let resume = await Resume.findOne({ shortId: id }).select(hidden).lean();
    if (!resume && mongoose.isValidObjectId(id)) resume = await Resume.findById(id).select(hidden).lean();

    // Resumes of suspended accounts are hidden too.
    const owner = resume?.isPublic ? await User.findById(resume.user).select("banned").lean() : null;
    if (resume) delete resume.user;
    if (!resume || !resume.isPublic || !owner || owner.banned) {
      // Same answer for missing and private resumes so ids can't be probed.
      return res.status(404).json({ success: false, error: "This resume doesn't exist or is private." });
    }
    res.set("Cache-Control", "no-cache");
    res.status(200).json({ success: true, data: resume });
  } catch (err) {
    console.error("Public fetch error:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
