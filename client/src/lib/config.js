const PROD_API = "https://cse299-1.onrender.com/api";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? PROD_API : "http://localhost:5000/api");

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production" ? "https://resumex.cc" : "http://localhost:3000")
).replace(/\/$/, "");

/** Gemini features stay locked until this is switched on. */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

export const SITE_NAME = "ResumeX";
export const SITE_DESCRIPTION =
  "Free ATS-friendly resume builder and CV maker. 50 designer templates, a live PDF preview, a real ATS check and AI help. Download a pixel-perfect PDF in minutes.";

/** Shown on the privacy and terms pages (fixed, so a stray environment variable can't change it). */
export const CONTACT_EMAIL = "support@resumex.cc";
/** The legal seller, exactly as registered with Paddle (it must match the terms and refund policy). */
export const SELLER_NAME = "Mehboob Ehsan Khan Omi";
export const LEGAL_UPDATED = "28 September 2026";
