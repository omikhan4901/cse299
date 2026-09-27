const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Resume = require("../models/Resume");
const { protect } = require("./auth");
const { limit } = require("../lib/rateLimit");

// Autosave sends a request a couple of seconds after typing stops, so this is generous.
const perAccount = limit({ name: "resumes", windowMs: 60 * 1000, max: 120, key: (req) => req.userId, message: "Too many requests." });
const MAX_RESUMES = Number(process.env.MAX_RESUMES_PER_ACCOUNT) || 50;
const underResumeCap = async (req, res) => {
  if ((await Resume.countDocuments({ user: req.userId })) < MAX_RESUMES) return true;
  res.status(400).json({ success: false, error: `You can keep up to ${MAX_RESUMES} resumes. Delete one to make room.` });
  return false;
};

// Only these fields can be written by the client. Everything else (owner,
// shortId, timestamps) is controlled by the server.
const EDITABLE = [
  "nickname", "personal", "summary", "experience", "education", "projects", "certifications",
  "volunteering", "awards", "publications", "courses", "references", "referencesOnRequest", "referenceSignatures", "links",
  "customSections", "skills", "languages", "interests", "template", "theme", "isMaster", "isPublic",
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
router.post("/", protect, perAccount, async (req, res) => {
  try {
    if (!(await underResumeCap(req, res))) return;
    const data = pickEditable(req.body);
    if (data.isMaster) await Resume.updateMany({ user: req.userId }, { isMaster: false });
    const resume = await Resume.create({ ...data, user: req.userId });
    res.status(201).json({ success: true, data: resume });
  } catch (err) {
    handleError(res, err, "Server error while saving the resume.");
  }
});

// @route   GET /api/resumes  — list the user's resumes (photos left out to keep it light)
router.get("/", protect, perAccount, async (req, res) => {
  try {
    const data = await Resume.find({ user: req.userId }).select("-personal.profilePic -personal.profilePicSource").sort({ updatedAt: -1 }).lean();
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    handleError(res, err, "Server error while fetching resumes.");
  }
});

// @route   GET /api/resumes/:id
router.get("/:id", protect, perAccount, async (req, res) => {
  try {
    const resume = await findOwned(req, res);
    if (resume) res.status(200).json({ success: true, data: resume });
  } catch (err) {
    handleError(res, err, "Server error");
  }
});

// @route   PUT /api/resumes/:id  — update (partial updates allowed)
router.put("/:id", protect, perAccount, async (req, res) => {
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
router.post("/:id/duplicate", protect, perAccount, async (req, res) => {
  try {
    const resume = await findOwned(req, res);
    if (!resume) return;
    if (!(await underResumeCap(req, res))) return;
    const copy = pickEditable(resume.toObject());
    const created = await Resume.create({ ...copy, nickname: `${resume.nickname} (copy)`.slice(0, 120), isMaster: false, isPublic: false, user: req.userId });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    handleError(res, err, "Server error while duplicating the resume.");
  }
});

// @route   DELETE /api/resumes/:id
router.delete("/:id", protect, perAccount, async (req, res) => {
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
