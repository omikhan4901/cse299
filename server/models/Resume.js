const mongoose = require("mongoose");
const crypto = require("crypto");

// 8 URL-safe characters for public share links (e.g. /view/k9x2mPq1).
const generateShortId = () => crypto.randomBytes(6).toString("base64url").slice(0, 8);

const experienceSchema = new mongoose.Schema(
  {
    id: Number,
    company: String,
    title: String,
    employmentType: String,
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
    location: String,
    startYear: String,
    endYear: String,
    gpa: String,
    details: String,
  },
  { _id: false }
);

const item = (fields) => new mongoose.Schema({ id: Number, ...Object.fromEntries(fields.map((f) => [f, String])) }, { _id: false });

const projectSchema = item(["name", "role", "link", "startDate", "endDate", "technologies", "description"]);
const certificationSchema = item(["name", "issuer", "date", "link"]);
const volunteeringSchema = item(["role", "organization", "location", "startDate", "endDate", "description"]);
const awardSchema = item(["title", "issuer", "date", "description"]);
const publicationSchema = item(["title", "publisher", "date", "link", "description"]);
const courseSchema = item(["name", "institution", "date"]);
const referenceSchema = item(["name", "position", "company", "email", "phone"]);
const linkSchema = item(["label", "url"]);
const customItemSchema = item(["title", "subtitle", "date", "description"]);
const customSectionSchema = new mongoose.Schema({ id: Number, title: String, items: [customItemSchema] }, { _id: false });

const ResumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    nickname: { type: String, required: [true, "Please add a name for this resume"], trim: true, maxlength: 120 },
    personal: {
      profilePic: { type: String, default: "" },
      // Original upload + crop settings, so the photo can be re-adjusted later.
      profilePicSource: { type: String, default: "" },
      photoCrop: { type: mongoose.Schema.Types.Mixed, default: null },
      name: { type: String, default: "" },
      title: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      website: { type: String, default: "" },
      city: { type: String, default: "" },
      dateOfBirth: { type: String, default: "" },
      nationality: { type: String, default: "" },
    },
    summary: { type: String, default: "" },
    experience: [experienceSchema],
    education: [educationSchema],
    projects: [projectSchema],
    certifications: [certificationSchema],
    volunteering: [volunteeringSchema],
    awards: [awardSchema],
    publications: [publicationSchema],
    courses: [courseSchema],
    references: [referenceSchema],
    referencesOnRequest: { type: Boolean, default: false },
    // Adds a signature and date line under each referee, for printed copies they sign.
    referenceSignatures: { type: Boolean, default: false },
    links: [linkSchema],
    customSections: [customSectionSchema],
    skills: { type: String, default: "" },
    languages: { type: String, default: "" },
    interests: { type: String, default: "" },
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
