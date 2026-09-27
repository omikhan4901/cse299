const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Resume = require("../models/Resume");

// @route   GET /api/public/:id
// @desc    A shared resume, by short id (or legacy Mongo id). Only works when isPublic is on.
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let resume = await Resume.findOne({ shortId: id }).select("-user -__v").lean();
    if (!resume && mongoose.isValidObjectId(id)) resume = await Resume.findById(id).select("-user -__v").lean();

    if (!resume || !resume.isPublic) {
      // Same answer for missing and private resumes so ids can't be probed.
      return res.status(404).json({ success: false, error: "This resume doesn't exist or is private." });
    }
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({ success: true, data: resume });
  } catch (err) {
    console.error("Public fetch error:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
