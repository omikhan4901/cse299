// --- Configuration ---

// If running locally (using `npm run dev`), use localhost:5000 (your server port).
// Otherwise, use the production Render URL.
// export const API_BASE_URL = "https://cse299-1.onrender.com/api";
export const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://cse299-1.onrender.com/api";
export const RESUME_VERSION = "1.0";

// --- Initial Data Structures ---

const initialExperience = {
  id: Date.now() + 1,
  company: "AI Tech Solutions",
  title: "Lead Software Engineer",
  startDate: "Jan 2022",
  endDate: "Present",
  description:
    "• Spearheaded development of high-performance microservices using React and Node.js.\n• Optimized database queries, reducing latency by 40%.\n• Mentored junior engineers on best coding practices.",
};
const initialEducation = {
  id: Date.now() + 2,
  institution: "State University",
  degree: "M.S. Computer Science",
  startYear: "2018",
  endYear: "2020",
};

export const initialResumeState = {
  personal: {
    name: "Jane Doe",
    title: "Full Stack Developer",
    phone: "(555) 123-4567",
    email: "jane.doe@example.com",
    linkedin: "linkedin.com/in/janedoe",
    city: "San Francisco, CA",
    profilePic: "",
  },
  summary:
    "Highly motivated and results-driven Full Stack Developer with 5+ years of experience building scalable web applications. Proficient in modern JavaScript frameworks and focused on delivering clean, efficient code.",
  experience: [initialExperience],
  education: [initialEducation],
  skills:
    "React, Node.js, TypeScript, MongoDB, Express, Tailwind CSS, AWS, Git, Agile",
};
