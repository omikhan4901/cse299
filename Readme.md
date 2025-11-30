"""
# 🚀 ResumeX: AI-Powered Career Platform

**A full-stack, context-aware MERN application built for the CSE299 curriculum, designed to eliminate resume writing friction using Google's Gemini AI.**

---

## ✨ Project Highlights

ResumeX is not just a template builder; it is a complete SaaS Minimum Viable Product (MVP) that integrates complex frontend state management with secure backend APIs and advanced Generative AI capabilities.

| Feature | Technical Implementation | Value Proposition |
| :--- | :--- | :--- |
| **Contextual AI Refinement** | Gemini 1.5 Flash API reads the user's entire JSON profile (Skills, Experience, Title) before generating targeted, professional suggestions. | Guarantees quality output that is specific and relevant to the user's background. |
| **Data Parsing & Extraction** | Backend uses `multer` + `pdf-parse`/`mammoth` to ingest documents, then uses Gemini's **Structured JSON Output** to reliably map messy text into the MongoDB schema. | Eliminates manual data entry and improves data quality. |
| **Dirty State Management** | Implemented a reliable state anchor (`savedResume`) and warning modal to track unsaved edits and template changes, preventing data loss during preview and navigation cycles. | Ensures data integrity and provides enterprise-grade reliability. |
| **Live Sharing & Profiles** | Secure **JWT** authentication protects user data, while **unique Short Links** and a public viewer allow for easy sharing without login. | Enhances professional presentation and user control. |
| **Pixel-Perfect Export** | Uses custom **CSS Print Media Queries** (`@page` rules) to force margin-free, high-fidelity PDF exports across **6+ unique templates** (Modern Gothic, Creative, etc.). | Delivers professional output with zero cost-to-download. |
| **UX & Productivity Tools** | Dynamic list reordering (Move Up/Down), dedicated AI Audit modal, and Cover Letter generation functionality. | Dramatically speeds up the revision and application process. |

## 🛠️ Technical Stack

* **Frontend:** React.js, Ant Design (UI Library), Tailwind CSS (Aesthetics), Framer Motion (Animations)
* **Backend:** Node.js (Express), MongoDB (Mongoose)
* **AI/LLM:** Google Gemini 1.5 Flash (for content generation, refinement, and parsing)

## 🧑‍💻 The Development Team

ResumeX was proudly built by a focused engineering team:

| Role | Developer | Contribution Focus | GitHub |
| :--- | :--- | :--- | :--- |
| **Core Architect** | Mehboob Ehsan Khan | State Management, AI Integration, Backend Security | `[Your GitHub Link]` |
| **Full Stack Engineer** | Nabigah Bin Sayeed | UI/UX, Component Development, Quality Assurance | `[Nabigah's GitHub Link]` |

## 📋 Installation & Setup

### 1. Backend Setup

1. Navigate to the `/server` directory.

2. Install dependencies: `npm install bcryptjs cors dotenv express jsonwebtoken mongoose multer pdf-parse mammoth`

3. Create a `.env` file and set the following variables:

   ```
   MONGO_URI="[Your MongoDB Atlas Connection String]"
   JWT_SECRET="YOUR_RANDOM_SECRET_KEY"
   GEMINI_API_KEY="AIzaS...[Your Gemini API Key]"
   PORT=5000
   ```

4. Run the server: `node server.js` (or `nodemon server.js`)

### 2. Frontend Setup

1. Navigate to the `/client` directory.

2. Install dependencies: `npm install`

3. **Critical Configuration:** Ensure `src/Config/constraints.js` is set for environment detection:
   ```javascript
   // src/Config/constraints.js
   export const API_BASE_URL = window.location.hostname === 'localhost' 
       ? 'http://localhost:5000/api'
       : '[https://cse299-1.onrender.com/api](https://cse299-1.onrender.com/api)'; 
   ```

4. Run the frontend: `npm run dev`

## 🔑 Key API Endpoints

The system relies on protected AI routes for specialized services:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ai/parse` | Ingests PDF/DOCX and returns **Structured JSON**. |
| `POST` | `/api/ai/refine` | Contextually improves text blocks. |
| `POST` | `/api/ai/cover-letter` | Writes a tailored letter using resume and JD context. |
| `GET` | `/api/public/:shortId` | Retrieves a single resume for live, unauthenticated viewing. |
"""