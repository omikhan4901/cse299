const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Resume = require("../models/Resume");
const { protect } = require("./auth");

// Only these fields can be written by the client. Everything else (owner,
// shortId, timestamps) is controlled by the server.
const EDITABLE = [
  "nickname", "personal", "summary", "experience", "education", "projects", "certifications",
  "skills", "languages", "template", "theme", "isMaster", "isPublic",
];

const pickEditable = (body = {}) => {
  const out = {};
  for (const key of EDITABLE) if (body[key] !== undefined) out[key] = body[key];
  return out;
};

// Finds a resume owned by the logged-in user, or sends the right error.
async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ success: false, error: "Resume not found" });
    return null;
  }
  const resume = await Resume.findById(req.params.id);
  if (!resume || resume.user.toString() !== req.userId) {
    res.status(404).json({ success: false, error: "Resume not found" });
    return null;
  }
  return resume;
}

const handleError = (res, err, fallback) => {
  console.error(err);
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, error: Object.values(err.errors)[0]?.message || "Invalid resume data" });
  }
  res.status(500).json({ success: false, error: fallback });
};

// @route   POST /api/resumes  — create a resume
router.post("/", protect, async (req, res) => {
  try {
    const data = pickEditable(req.body);
    if (data.isMaster) await Resume.updateMany({ user: req.userId }, { isMaster: false });
    const resume = await Resume.create({ ...data, user: req.userId });
    res.status(201).json({ success: true, data: resume });
  } catch (err) {
    handleError(res, err, "Server error while saving the resume.");
  }
});

// @route   GET /api/resumes  — list the user's resumes (photos left out to keep it light)
router.get("/", protect, async (req, res) => {
  try {
    const data = await Resume.find({ user: req.userId }).select("-personal.profilePic -personal.profilePicSource").sort({ updatedAt: -1 }).lean();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    handleError(res, err, "Server error while fetching resumes.");
  }
});

// @route   GET /api/resumes/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const resume = await findOwned(req, res);
    if (resume) res.status(200).json({ success: true, data: resume });
  } catch (err) {
    handleError(res, err, "Server error");
  }
});

// @route   PUT /api/resumes/:id  — update (partial updates allowed)
router.put("/:id", protect, async (req, res) => {
  try {
    const resume = await findOwned(req, res);
    if (!resume) return;
    const data = pickEditable(req.body);
    if (data.isMaster) await Resume.updateMany({ user: req.userId, _id: { $ne: resume._id } }, { isMaster: false });
    resume.set(data);
    await resume.save();
    res.status(200).json({ success: true, data: resume });
  } catch (err) {
    handleError(res, err, "Server error while updating the resume.");
  }
});

// @route   POST /api/resumes/:id/duplicate
router.post("/:id/duplicate", protect, async (req, res) => {
  try {
    const resume = await findOwned(req, res);
    if (!resume) return;
    const copy = pickEditable(resume.toObject());
    const created = await Resume.create({ ...copy, nickname: `${resume.nickname} (copy)`.slice(0, 120), isMaster: false, isPublic: false, user: req.userId });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    handleError(res, err, "Server error while duplicating the resume.");
  }
});

// @route   DELETE /api/resumes/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const resume = await findOwned(req, res);
    if (!resume) return;
    await resume.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    handleError(res, err, "Server error while deleting the resume.");
  }
});

module.exports = router;
