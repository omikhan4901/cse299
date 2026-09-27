# ResumeX 🚀
> **Smarter Resumes, Powered by AI.**

ResumeX is a modern, full-stack web application designed to solve the nightmare of resume formatting and content writing. It combines a professional drag-and-drop builder with context-aware Artificial Intelligence to help students and professionals craft the perfect resume in minutes.

![MERN Stack](https://img.shields.io/badge/Stack-MERN-blue?style=for-the-badge)
![Ant Design](https://img.shields.io/badge/UI-Ant_Design-red?style=for-the-badge)
![AI Powered](https://img.shields.io/badge/AI-Generative-teal?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🌟 Key Features

### 📄 1. Pixel-perfect PDFs
-   **Live PDF preview**: The preview *is* the PDF. Every keystroke re-renders the real document (in a Web Worker), so page breaks, fonts and spacing are exactly what you download.
-   **One-click download**: No print dialogs or browser settings — you get a text-based, ATS-readable `Your_Name_Resume.pdf`.
-   **Multi-page aware**: Sidebars and backgrounds repeat on every page, entries never split mid-line and headings never get stranded at the bottom of a page.

### 🎨 2. Professional Builder
-   **50 templates in 7 categories**: ATS-Optimized, Modern/Minimalist, Aesthetic/Creative, Executive/Corporate, Academic/Technical, Student/Entry-Level and Two-Column/Compact. Ten are hand-built (`src/pdf/templates`); forty come from the spec-driven engine (`src/pdf/engine`).
-   **Make it yours**: Accent colour, ten bundled body fonts, A4 or US Letter.
-   **References with signature lines**: optionally add a signature and date line under each referee, so they can sign a printed copy.
-   **"How to Write a Good Resume" guide** in the builder. The same Markdown (`shared/resume-guide.md`) grounds the AI assistant.
-   **Every section you need**: experience, education, projects, skills, certifications, languages, volunteering, awards, publications, courses, references, interests and your own custom sections, plus GitHub and extra links. Empty sections are hidden automatically.
-   **Photo cropper**: drag, zoom in/out and re-adjust your photo any time.
-   **Works without an account**: Guests can build and download; drafts are kept in the browser. Sign up to save and share.

### 🎯 3. Rigorous ATS check
-   **Checks the real PDF**: renders your resume, extracts the text the way applicant tracking systems do, and verifies the name, contact details, headings, dates and reading order come through intact.
-   **30+ explainable checks**: action verbs, quantified results, bullet counts, clichés, date consistency, length and more. Each is pass / warn / fail with the reason.
-   **Job matching**: paste a job description to see weighted keyword coverage (required vs nice-to-have), skills backed by experience, title, years and degree requirements.
-   Deterministic (`client/src/lib/ats`), runs in the browser and needs no AI.

### 💾 4. Management & Sharing
-   **Autosave** for saved resumes, plus a dashboard with real thumbnails, duplicate, delete and download.
-   **Master Profile**: Keep all your experience in one resume and fill new, tailored resumes from it in one click.
-   **Public links**: `/view/<id>` shows the resume in its own template, colours and font, with a server-rendered web version (SEO metadata and structured data) and a PDF download.
-   **Account settings**: change name or password (signs out other devices), password reset by email, download all your data, delete your account.

### 🧠 5. AI
AI refine, chat assistant, ATS check, cover letter and PDF/DOCX import are powered by Google Gemini. Set `GEMINI_API_KEY` on the server and `NEXT_PUBLIC_AI_ENABLED=true` on the client; without them the AI buttons show as locked. When the main model is overloaded the server retries and then falls back to a lighter model. Each account has a per-minute and daily AI allowance (see *Limits* below).

---

## 🛠️ Tech Stack

### Client (`/client`)
-   **Framework**: Next.js 16 (App Router) — server-rendered marketing and share pages for SEO
-   **UI**: Tailwind CSS 4 + Ant Design 6, lucide icons
-   **PDF engine**: `@react-pdf/renderer` (templates in `src/pdf`), previewed with `pdfjs-dist`
-   **State**: React context for auth, local component state for the editor

### Server (`/server`)
-   **Runtime**: Node.js + Express
-   **Database**: MongoDB (Mongoose)
-   **Authentication**: JWT + bcrypt
-   **AI**: Google Gemini REST API. Imports send the PDF itself to Gemini for an exact JSON transcription, then `server/lib/resumeImport.js` maps it to the ResumeX format (`mammoth` reads DOCX files)

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js** 20 or newer
-   **MongoDB** (local or Atlas)

### 1. Server
```bash
cd server
npm install
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm run dev            # http://localhost:5000
```

### 2. Client
```bash
cd client
npm install
cp .env.example .env.local   # optional — defaults work for local development
npm run dev                  # http://localhost:3000
```

| Client variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Express API base URL. Defaults to `http://localhost:5000/api` in development and the Render deployment in production. |
| `NEXT_PUBLIC_SITE_URL` | Public site URL for canonical links, the sitemap and share links. On Vercel it defaults to the production domain. |
| `NEXT_PUBLIC_AI_ENABLED` | `true` unlocks the AI buttons. Leave `false` until Gemini works. |
| `NEXT_PUBLIC_ANNOUNCEMENT` | Optional banner text shown on the marketing pages (e.g. maintenance notices). |

| Client variable (cont.) | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address shown on the privacy policy and terms pages. |

### Server variables
All server settings are documented in `server/.env.example`. The important ones for production:

| Variable | Purpose |
| --- | --- |
| `MONGO_URI`, `JWT_SECRET` | Required. In production `JWT_SECRET` must be at least 32 random characters (`openssl rand -hex 32`) or the server refuses to start. |
| `CLIENT_ORIGIN` | Comma-separated allowed front-end origins (CORS). Also the default base for emailed links. |
| `TRUST_PROXY=1` | Set behind Render/Railway/Nginx so rate limits see visitors' real IPs. |
| `SMTP_URL`, `MAIL_FROM`, `APP_URL` | Email for password reset links. Without `SMTP_URL`, development prints links to the console and production switches resets off. |
| `GEMINI_API_KEY` | Enables AI features. |

### Limits
-   **AI, per account**: `AI_RATE_PER_MINUTE` (default 8) and a daily allowance, `AI_DAILY_LIMIT` (default 40) or `AI_DAILY_LIMIT_PRO` (default 300) for accounts whose `plan` is `pro`. A PDF import costs 3, a cover letter 2, everything else 1; failed requests are refunded. Counters live in MongoDB (`usages` collection) and reset at midnight UTC.
-   **Sign-in protection**: login attempts are limited per IP and per email, sign-ups and password-reset emails per IP/email.
-   **Resumes**: 120 API requests per minute per account (autosave stays well below) and at most `MAX_RESUMES_PER_ACCOUNT` (default 50) resumes.

### Deploying
-   **Client → Vercel**: root directory `client`. `vercel.json` sets the framework to Next.js (the project used to be Vite, so double-check *Settings → Build & Development* if the first build fails).
-   **Server → Render**: unchanged (`npm start`). Set the variables from `server/.env.example`.

### Updating template previews
The images in `client/public/templates/*.jpg` are renders of each template with the sample resume from `client/src/lib/resume.js`. Re-render them after changing a template's design.

### Editing the resume guide
Edit `shared/resume-guide.md`. The server reads it on each chat request; the client copies it into `client/src/content/resumeGuide.js` before `npm run dev`/`build` (`npm run sync-guide` to do it by hand).

---

## 📂 Project Structure

```text
cse299/
├── client/                      # Next.js front end
│   ├── public/fonts/            # Fonts embedded in the PDFs
│   ├── public/templates/        # Template preview images
│   └── src/
│       ├── app/                 # Routes: (site) marketing pages, (app) builder & dashboard, view/[id]
│       ├── components/          # UI (builder/, public/, navbar, auth …)
│       ├── lib/                 # API client, config, resume data model
│       └── pdf/                 # PDF engine: templates/, shared blocks, fonts, worker
├── server/                      # Express API
│   ├── lib/                     # rate limits, mailer, resume import, guide loader
│   ├── models/                  # User, Resume, Usage
│   ├── routes/                  # auth, resume, public, ai
│   └── server.js
├── shared/resume-guide.md       # "How to Write a Good Resume" (builder + AI assistant)
└── Readme.md
```

---

## 🔒 Security & Privacy
-   **No Data Selling**: We are a student project, not a data broker.
-   **Encryption**: Passwords are hashed using BCrypt.
-   **Protection**: API routes are protected via JWT middleware; tokens carry a session version, so changing or resetting a password signs out every other device.
-   **Abuse limits**: per-account AI allowances, sign-in brute-force limits, MongoDB operator stripping on all input and standard security headers.
-   **Your data**: export everything or delete your account from Account settings. See `/privacy` and `/terms`.

---

## 👥 Contributors
-   **Omikhan** - Lead Developer & AI Integration
-   **Nabigah Bin Sayeed** - Project Support & Feedback

---

*Verified for CSE299 Final Project Submission.*