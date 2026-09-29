const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Resume = require("../models/Resume");
const Application = require("../models/Application");
const { protect } = require("./auth");
const { limit } = require("../lib/rateLimit");
const User = require("../models/User");
const { getSettings } = require("../lib/settings");
const { canUse } = require("../lib/credits");
const { templateAllowed, templateTier } = require("../lib/templates");
const { CONTENT_KEYS, pick } = require("../lib/resumeInput");

// Publishing a share link needs the "shareLinks" feature (only enforced when free mode is off).
// Links that are already public keep working; making one public is what's checked.
// Switching to a template the account's plan doesn't include is refused (resumes that already
// use one keep it, e.g. after a plan ends). The builder normally stops this before it's sent.
const templateOk = async (req, res, id) => {
  const [user, settings] = await Promise.all([User.findById(req.userId).select("plan planExpiresAt").lean(), getSettings()]);
  if (templateAllowed(user, settings, id)) return true;
  const tier = templateTier(id, settings.templates);
  const plan = settings.plans.find((p) => p.id === tier);
  res.status(403).json({ success: false, code: "upgrade", feature: "templates", plan: tier, template: id, error: `That template is part of the ${plan?.name || "paid"} plan.` });
  return false;
};

const shareAllowed = async (req, res) => {
  const [user, settings] = await Promise.all([User.findById(req.userId).select("plan planExpiresAt").lean(), getSettings()]);
  if (canUse(user, settings, "shareLinks")) return true;
  const plan = settings.plans.find((p) => p.features.shareLinks);
  res.status(403).json({ success: false, code: "upgrade", feature: "shareLinks", error: `Share links are part of the ${plan?.name || "paid"} plan.` });
  return false;
};

// Autosave sends a request a couple of seconds after typing stops, so this is generous.
const perAccount = limit({ name: "resumes", windowMs: 60 * 1000, max: 120, key: (req) => req.userId, message: "Too many requests.", label: "Resume requests", group: "Resumes", scope: "account", description: "Opening, autosaving and listing resumes. Autosave sends a request a couple of seconds after typing stops." });
const createByUser = limit({ name: "resume-create", windowMs: 60 * 60 * 1000, max: 30, key: (req) => req.userId, message: "You're creating resumes very quickly.", label: "New resumes", group: "Resumes", scope: "account", description: "New and duplicated resumes per account (on top of the 50-resume cap)." });
const MAX_RESUMES = Number(process.env.MAX_RESUMES_PER_ACCOUNT) || 50;
const underResumeCap = async (req, res) => {
  if ((await Resume.countDocuments({ user: req.userId })) < MAX_RESUMES) return true;
  res.status(400).json({ success: false, error: `You can keep up to ${MAX_RESUMES} resumes. Delete one to make room.` });
  return false;
};

// Only these fields can be written by the client. Everything else (owner,
// shortId, timestamps) is controlled by the server.
const EDITABLE = ["nickname", ...CONTENT_KEYS, "biodata", "template", "theme", "isMaster", "isPublic"];
const pickEditable = (body) => pick(body, EDITABLE);

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

// Someone saved this resume after the caller loaded it: send the latest copy so they can choose.
const conflict = (res, resume) =>
  res.status(409).json({ success: false, code: "conflict", error: "This resume was changed in another tab or device.", data: resume });

const handleError = (res, err, fallback) => {
  console.error(err);
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, error: Object.values(err.errors)[0]?.message || "Invalid resume data" });
  }
  res.status(500).json({ success: false, error: fallback });
};

// @route   POST /api/resumes  — create a resume
router.post("/", protect, perAccount, createByUser, async (req, res) => {
  try {
    if (!(await underResumeCap(req, res))) return;
    const data = pickEditable(req.body);
    if (data.isPublic === true && !(await shareAllowed(req, res))) return;
    if (typeof data.template === "string" && !(await templateOk(req, res, data.template))) return;
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
    // Sharing and "master" toggles don't touch the content, so they never conflict.
    const content = Object.keys(data).some((k) => k !== "isMaster" && k !== "isPublic");
    const rev = resume.rev || 0;
    const baseRev = req.body.baseRev;
    if (content && baseRev !== undefined && baseRev !== rev) return conflict(res, resume);
    if (data.isPublic === true && !resume.isPublic && !(await shareAllowed(req, res))) return;
    if (typeof data.template === "string" && data.template !== resume.template && !(await templateOk(req, res, data.template))) return;
    if (data.isMaster) await Resume.updateMany({ user: req.userId, _id: { $ne: resume._id } }, { isMaster: false }, { timestamps: false });
    resume.set(data);
    // Reviewed AI polish proposals are cleared (doesn't count as a content change).
    if (req.body.suggestions === null) resume.suggestions = undefined;
    if (content) {
      resume.rev = rev + 1;
      // Saves only if nobody else saved in between (otherwise DocumentNotFoundError below).
      resume.$where = rev === 0 ? { rev: { $in: [0, null] } } : { rev };
    }
    await resume.save();
    res.status(200).json({ success: true, data: resume });
  } catch (err) {
    if (err.name === "DocumentNotFoundError") {
      const latest = await Resume.findById(req.params.id).catch(() => null);
      if (latest) return conflict(res, latest);
    }
    handleError(res, err, "Server error while updating the resume.");
  }
});

// @route   POST /api/resumes/:id/duplicate
router.post("/:id/duplicate", protect, perAccount, createByUser, async (req, res) => {
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
    // Applications keep the frozen copy they were sent with; they just stop pointing at it.
    await Application.updateMany({ user: req.userId, resume: resume._id }, { $unset: { resume: 1 } });
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    handleError(res, err, "Server error while deleting the resume.");
  }
});

module.exports = router;
