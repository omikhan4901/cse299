const PROD_API = "https://cse299-1.onrender.com/api";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? PROD_API : "http://localhost:5000/api");

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/** Gemini features stay locked until this is switched on. */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

export const SITE_NAME = "ResumeX";
export const SITE_DESCRIPTION =
  "Build a professional, ATS-friendly resume in minutes. Pick from 50 designer templates, see a live preview and download a pixel-perfect PDF for free.";

/** Shown on the privacy and terms pages. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@resumex.cc";
export const LEGAL_UPDATED = "27 September 2026";
