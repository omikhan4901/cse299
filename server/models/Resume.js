const mongoose = require("mongoose");
const crypto = require("crypto");

// 8 URL-safe characters for public share links (e.g. /view/k9x2mPq1).
const generateShortId = () => crypto.randomBytes(6).toString("base64url").slice(0, 8);

const experienceSchema = new mongoose.Schema(
  {
    id: Number,
    company: String,
    title: String,
    location: String,
    startDate: String,
    endDate: String,
    description: String,
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    id: Number,
    institution: String,
    degree: String,
    startYear: String,
    endYear: String,
    details: String,
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema({ id: Number, name: String, link: String, description: String }, { _id: false });
const certificationSchema = new mongoose.Schema({ id: Number, name: String, issuer: String, date: String }, { _id: false });

const ResumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    nickname: { type: String, required: [true, "Please add a name for this resume"], trim: true, maxlength: 120 },
    personal: {
      profilePic: { type: String, default: "" },
      name: { type: String, default: "" },
      title: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      website: { type: String, default: "" },
      city: { type: String, default: "" },
    },
    summary: { type: String, default: "" },
    experience: [experienceSchema],
    education: [educationSchema],
    projects: [projectSchema],
    certifications: [certificationSchema],
    skills: { type: String, default: "" },
    languages: { type: String, default: "" },
    template: { type: String, default: "Classic" },
    theme: {
      accent: { type: String, default: "" },
      font: { type: String, default: "" },
      pageSize: { type: String, enum: ["A4", "LETTER"], default: "A4" },
    },
    shortId: { type: String, default: generateShortId, unique: true },
    isMaster: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", ResumeSchema);
