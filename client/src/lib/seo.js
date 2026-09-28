import { SITE_URL, SITE_NAME } from "./config";

/** Absolute URL for a path. */
export const abs = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Safe JSON-LD script body (escapes "<" so content can't close the tag). */
export const jsonLdHtml = (data) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

export const breadcrumbs = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
});

export const faqSchema = (faqs) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

export const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: abs("/logo.svg"),
  email: "support@resumex.cc",
};

export const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { "@id": `${SITE_URL}/#organization` },
  inLanguage: "en",
};

/**
 * Landing-page copy for each template category (/templates/category/<slug>).
 * Slugs are the words people search for.
 */
export const CATEGORY_PAGES = [
  {
    id: "ats",
    slug: "ats-friendly",
    title: "ATS-Friendly Resume Templates",
    metaTitle: "Free ATS-Friendly Resume Templates (2026)",
    description: "Free ATS-friendly resume templates that applicant tracking systems read perfectly: single column, standard headings, real text. Edit online and download as PDF.",
    intro: "Most companies filter applications with an applicant tracking system (ATS) before a person reads them. These templates are built to pass: one column, standard section headings, real selectable text and no tables or text boxes. Each one is checked with our own ATS parser.",
    bestFor: ["Applying through online job portals", "Large companies and government jobs", "Any application where you're not sure how it will be read"],
    faqs: [
      { q: "What makes a resume template ATS-friendly?", a: "A single-column layout, standard headings like Experience, Education and Skills, real text rather than images, no tables or text boxes, and contact details in the page body. All of these templates follow those rules." },
      { q: "Can an ATS read a PDF resume?", a: "Yes, as long as the PDF contains real text. ResumeX creates text-based PDFs, and the built-in ATS check shows you exactly what an ATS extracts from yours." },
      { q: "Are these ATS resume templates free?", a: "Yes. You can edit any of them online and download a PDF without paying." },
    ],
  },
  {
    id: "minimal",
    slug: "modern-minimalist",
    title: "Modern & Minimalist Resume Templates",
    metaTitle: "Modern Minimalist Resume Templates – Free & Editable",
    description: "Clean, modern and minimalist resume templates with plenty of white space and a single accent colour. Customise online and download a PDF for free.",
    intro: "Minimalist resumes let your experience do the talking: generous spacing, clean type and just one accent colour. They look current without trying too hard, and most of them still read well in applicant tracking systems.",
    bestFor: ["Tech, product and startup roles", "Designers who want a quiet layout", "Anyone who wants a modern look that stays professional"],
    faqs: [
      { q: "Is a minimalist resume better?", a: "A minimalist layout makes a resume easier to scan, which helps recruiters who spend only seconds on a first look. It works for almost every industry." },
      { q: "Can I change the colours and font?", a: "Yes. Every template works with any accent colour, 11 fonts, and A4 or US Letter paper." },
    ],
  },
  {
    id: "creative",
    slug: "creative",
    title: "Creative Resume Templates",
    metaTitle: "Creative Resume Templates – Stand Out (Free PDF)",
    description: "Creative, aesthetic resume templates with bold colour, sidebars and photos. Stand out when you send your resume directly to a person. Free to edit and download.",
    intro: "When a real person will see your resume first, such as at a career fair, in an email or for a design or media role, a creative layout helps you stand out. These templates use colour, shapes and photos while keeping your information easy to find.",
    bestFor: ["Design, marketing and media roles", "Resumes you email or hand in person", "Portfolios and personal websites"],
    faqs: [
      { q: "Are creative resumes ATS-friendly?", a: "Some are and some aren't. Designs with sidebars or photos can confuse older applicant tracking systems. For online portals, run the built-in ATS check or pick an ATS-Optimized template." },
      { q: "Should I add a photo to my resume?", a: "It depends on the country and industry. In the US, UK and Canada photos are usually left off; in much of Europe, Asia and the Middle East they are common." },
    ],
  },
  {
    id: "executive",
    slug: "executive-professional",
    title: "Executive & Professional Resume Templates",
    metaTitle: "Executive Resume Templates – Professional & Corporate",
    description: "Formal, polished executive and corporate resume templates for senior, management and business roles. Free to customise and download as PDF.",
    intro: "Senior roles call for a resume that looks as credible as your track record. These executive templates use classic typography, structured headers and restrained colour, the look expected in finance, consulting, law and management.",
    bestFor: ["Managers, directors and executives", "Finance, consulting, law and banking", "Corporate applications"],
    faqs: [
      { q: "How long should an executive resume be?", a: "Two pages is normal for senior professionals with 7 or more years of experience. Lead with a strong summary and your biggest results." },
      { q: "What should an executive resume focus on?", a: "Leadership and measurable impact: revenue, cost savings, team size, growth and strategic decisions, rather than day-to-day duties." },
    ],
  },
  {
    id: "academic",
    slug: "academic-cv",
    title: "Academic CV & Technical Resume Templates",
    metaTitle: "Academic CV Templates & Technical Resume Templates",
    description: "Academic CV templates for research, teaching and graduate school, plus technical resume templates that put skills and projects first. Free PDF download.",
    intro: "Academic CVs need room for research, publications and teaching; technical resumes need skills and projects up front. These templates handle both, with education-first layouts, side headings and monospaced options for engineers.",
    bestFor: ["Graduate school and scholarship applications", "Research and teaching positions", "Software engineers and technical roles"],
    faqs: [
      { q: "What's the difference between a CV and a resume?", a: "An academic CV is a full record of your academic career and can run several pages; a resume is a one- or two-page summary tailored to a job. Read our CV vs resume guide for details." },
      { q: "What should a technical resume include?", a: "A skills section grouped by type (languages, frameworks, tools), projects with links, and experience bullets that show what you built and its impact." },
    ],
  },
  {
    id: "student",
    slug: "student-entry-level",
    title: "Student & Entry-Level Resume Templates",
    metaTitle: "Student Resume Templates for Fresh Graduates & Internships",
    description: "Resume templates for students, fresh graduates and internships: education and projects first, so you stand out even without much experience. Free PDF.",
    intro: "No work experience yet? These templates put your education, projects, clubs and skills first, so a first resume still looks full and focused. They're ideal for internships, part-time jobs and graduate programmes.",
    bestFor: ["University students and fresh graduates", "Internship and trainee applications", "Career changers with little direct experience"],
    faqs: [
      { q: "What do I put on a resume with no experience?", a: "Education, relevant coursework, projects, clubs and volunteering, competitions, certifications and skills. Describe projects like jobs: what you built and the result." },
      { q: "Should a student resume be one page?", a: "Yes. One page is right for students and fresh graduates." },
    ],
  },
  {
    id: "twocol",
    slug: "two-column",
    title: "Two-Column Resume Templates",
    metaTitle: "Two-Column Resume Templates – Compact & Modern",
    description: "Two-column and sidebar resume templates that fit more on one page. Modern, compact layouts you can edit online and download as PDF for free.",
    intro: "Two-column resumes use a sidebar for contact details, skills and languages, leaving the main column for experience. They fit more on a single page and look modern, which makes them great for resumes you share directly.",
    bestFor: ["Fitting a lot onto one page", "Tech and creative roles", "Resumes you send directly to recruiters"],
    faqs: [
      { q: "Are two-column resumes bad for ATS?", a: "Modern applicant tracking systems usually handle them, but some older ones read columns out of order. For online applications, check yours with the built-in ATS check, or use a single-column template." },
      { q: "What goes in the sidebar?", a: "Contact details, skills, languages, certifications and interests. Keep experience and education in the main column." },
    ],
  },
];

export const categoryPage = (slug) => CATEGORY_PAGES.find((c) => c.slug === slug);
export const categoryPageFor = (id) => CATEGORY_PAGES.find((c) => c.id === id);
