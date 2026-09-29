const mongoose = require("mongoose");
const crypto = require("crypto");
const { contentFields } = require("./resumeContent");

// 8 URL-safe characters for public share links (e.g. /view/k9x2mPq1).
const generateShortId = () => crypto.randomBytes(6).toString("base64url").slice(0, 8);

const ResumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    nickname: { type: String, required: [true, "Please add a name for this resume"], trim: true, maxlength: 120 },
    ...contentFields(),
    template: { type: String, default: "Classic" },
    theme: {
      accent: { type: String, default: "" },
      font: { type: String, default: "" },
      pageSize: { type: String, enum: ["A4", "LETTER"], default: "A4" },
    },
    shortId: { type: String, default: generateShortId, unique: true },
    isMaster: { type: Boolean, default: false },
    // V2: the application this resume was tailored for (counts towards the plan's tailored limit).
    tailoredFor: { type: mongoose.Schema.Types.ObjectId, ref: "Application", index: true, sparse: true },
    isPublic: { type: Boolean, default: false },
    // Goes up by one on every content save. The builder sends the revision it
    // started from, so an edit made in another tab or device is never overwritten silently.
    rev: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", ResumeSchema);
