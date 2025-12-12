# ResumeX 🚀
> **Smarter Resumes, Powered by AI.**

ResumeX is a modern, full-stack web application designed to solve the nightmare of resume formatting and content writing. It combines a professional drag-and-drop builder with context-aware Artificial Intelligence to help students and professionals craft the perfect resume in minutes.

![MERN Stack](https://img.shields.io/badge/Stack-MERN-blue?style=for-the-badge)
![Ant Design](https://img.shields.io/badge/UI-Ant_Design-red?style=for-the-badge)
![AI Powered](https://img.shields.io/badge/AI-Generative-teal?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🌟 Key Features

### 🧠 1. AI-Powered Intelligence
Unlike standard template fillers, ResumeX understands your career:
-   **Context-Aware Parser**: Upload an existing PDF or DOCX. The system extracts dates, job titles, and skills, mapping them automatically to the editor.
-   **Smart Refinement**: One-click polish for your bullet points. Turns *"I did sales"* into *"Generated 20% revenue growth YOY through strategic client acquisition."*
-   **ResumeX Assistant**: A built-in chatbot that knows your resume. Ask it: *"What skills am I missing for a Full Stack role?"*

### 🎨 2. Professional Builder
-   **Real-Time Preview**: See changes instantly as you type.
-   **ATS-Friendly Templates**: Choose from 9+ designs (Classic, Modern, Creative, Minimalist, etc.).
-   **Dark Mode Support**: All templates support both light and dark themes.
-   **Dynamic Page Breaking**: Intelligent layout engine prevents text from being split across pages during print.

### 💾 3. Advanced Management
-   **Master Profile**: Save huge lists of all your experience in one "Master" profile, then create tailored versions for specific job applications.
-   **Secure Cloud Storage**: All data is encrypted and stored in MongoDB.
-   **PDF Generation**: Browser-native high-quality PDF export.

---

## 🛠️ Tech Stack

### Client-Side (Frontend)
-   **Framework**: React.js (Vite)
-   **UI Library**: Ant Design (AntD) + Tailwind CSS
-   **Animation**: Framer Motion
-   **State Management**: React Context API
-   **Routing**: Custom Context-Based Router

### Server-Side (Backend)
-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Database**: MongoDB (Mongoose Schema)
-   **Authentication**: JWT (JSON Web Tokens) + BCrypt
-   **File Handling**: Multer (Memory Storage)
-   **AI Integration**: Google Generative AI API (Gemini Model)
-   **Parsers**: `pdf-parse`, `mammoth` (for .docx)

---

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
-   **Node.js** (v18 or higher)
-   **MongoDB** (Local instance or Atlas Connection String)
-   **Git**

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/omikhan4901/cse299.git
    cd cse299
    ```

2.  **Server Setup**
    ```bash
    cd server
    npm install
    ```
    *Create a `.env` file in the `/server` directory:*
    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/resumex_db
    JWT_SECRET=your_super_secret_jwt_key
    GEMINI_API_KEY=your_google_ai_api_key
    NODE_ENV=development
    ```

3.  **Client Setup**
    ```bash
    cd ../client
    npm install
    ```
    *(No `.env` needed for client unless customizing API endpoint, defaults to localhost:5000)*

---

## 🏃‍♂️ Running the App

You need to run both the backend and frontend terminals.

**Terminal 1 (Server):**
```bash
cd server
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 (Client):**
```bash
cd client
npm run dev
# Client runs on http://localhost:5173
```

Open your browser and navigate to `http://localhost:5173` to start building!

---

## 📂 Project Structure

```text
cse299/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── Components/     # Modular UI Components
│   │   │   ├── Authentication/  # Login/Register Modals
│   │   │   ├── MainBuilder/     # Core Resume Editor Logic
│   │   │   ├── ResumePreview/   # Resume Designs & Templates
│   │   │   └── ...
│   │   ├── Context/        # Global Auth & Routing State
│   │   └── App.jsx         # Main Entry Point
│   └── ...
├── server/                 # Backend Express Application
│   ├── models/             # Mongoose Schemas (User, Resume)
│   ├── routes/             # API Endpoints (Auth, AI, Public)
│   ├── server.js           # Server Entry Point
│   └── ...
└── Readme.md               # Project Documentation
```

---

## 🔒 Security & Privacy
-   **No Data Selling**: We are a student project, not a data broker.
-   **Encryption**: Passwords are hashed using BCrypt.
-   **Protection**: API routes are protected via JWT Middleware.

---

## 👥 Contributors
-   **Omikhan** - Lead Developer & AI Integration

---

*Verified for CSE299 Final Project Submission.*