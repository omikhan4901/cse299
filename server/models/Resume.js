const mongoose = require("mongoose");

const generateShortId = () => {
  // Generates a random 6-character string (e.g., "k9x2mP")
  return Math.random().toString(36).substring(2, 8);
};

const ResumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    nickname: {
      type: String,
      required: [true, "Please add a nickname for this resume"],
      trim: true,
    },
    // MOVED: profilePic is no longer at the root

    personal: {
      // NEW LOCATION: It lives here now
      profilePic: {
        type: String,
        default: "",
      },
      name: { type: String, default: "" },
      title: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      city: { type: String, default: "" },
    },
    summary: {
      type: String,
      default: "",
    },
    shortId: {
      type: String,
      default: generateShortId,
      unique: true, // <--- Important
    },
    experience: [
      {
        id: { type: Number },
        company: String,
        title: String,
        startDate: String,
        endDate: String,
        description: String,
      },
    ],
    education: [
      {
        id: { type: Number },
        institution: String,
        degree: String,
        startYear: String,
        endYear: String,
      },
    ],
    skills: {
      type: String,
      default: "",
    },
    template: {
      type: String,
      default: "Classic",
    },
    isMaster: {
      type: Boolean,
      default: false,
    },
    isPublic: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Resume", ResumeSchema);
