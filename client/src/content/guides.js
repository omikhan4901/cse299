/**
 * Career guides shown at /guides/<slug>. Markdown subset: see components/Markdown.jsx.
 * Keep them practical and up to date; they are the site's main search traffic.
 */
export const GUIDES = [
  {
    slug: "fresh-graduate-resume",
    title: "How to Write a Resume as a Fresh Graduate (with Examples)",
    description: "No experience? No problem. How fresh graduates can write a one-page resume that gets interviews, with section-by-section examples for education, projects and skills.",
    date: "2026-09-28",
    readMinutes: 7,
    keywords: ["fresh graduate resume", "resume with no experience", "first resume", "graduate CV"],
    body: `Your first resume is the hardest one to write. You have a degree, some projects and maybe a part-time job, but a blank page and a job ad asking for "experience". The good news: recruiters hiring fresh graduates know you're new. They're looking for **potential, effort and relevant skills**, and you can show all three on one page.

## What recruiters look for in a fresh graduate

- **Relevant education:** your degree, strong results and coursework that matches the job.
- **Proof you can do the work:** projects, internships, competitions and clubs.
- **Skills that match the job ad:** tools, languages and software they mention.
- **Care and attention:** no typos, a clean layout and a resume that fits on one page.

## The best resume structure for fresh graduates

Put your strongest material first. For most graduates, that means education and projects above work experience.

1. **Contact details:** name, phone, professional email, city, LinkedIn and (if relevant) GitHub or a portfolio.
2. **Summary:** two or three lines on who you are and what you're aiming for.
3. **Education:** degree, university, graduation year and your CGPA if it's strong.
4. **Projects:** two to four projects described like jobs.
5. **Experience:** internships, part-time work, freelancing and volunteering.
6. **Skills:** grouped by type (for example Languages, Tools, Soft skills).
7. **Extras:** certifications, awards, languages and leadership roles.

## Write a summary that isn't generic

Avoid "hard-working and passionate graduate looking for opportunities". Every graduate says that. Instead, name your field, your strongest skill and what you want.

- **Weak:** Motivated graduate seeking a challenging role to grow my skills.
- **Strong:** Computer Science graduate (CGPA 3.72) with hands-on React and Node.js experience from three full-stack projects. Looking for a junior developer role in a product team.

## Turn projects into experience

Projects are your secret weapon. Describe each one with the same formula you'd use for a job: **action verb + what you did + the result**.

- **Weak:** Made a website for my final year project.
- **Strong:** Built a campus lost-and-found app with React and Firebase used by 400+ students in its first month.
- **Weak:** Did a group project on marketing.
- **Strong:** Led a 4-person team to design a social media campaign for a local café, growing its Facebook page from 800 to 2,300 followers.

Numbers make your work concrete, even small ones: users, team size, marks, time saved or money raised.

## Use clubs, volunteering and part-time jobs

Treasurer of a club? You managed a budget. Tutored younger students? You explained complex ideas clearly. Worked in a shop? You handled customers and cash under pressure. List these under Experience or Leadership, with one or two bullets each.

## Match the job description

Read the job ad and underline the skills and tools it mentions. If you have them, make sure those exact words appear in your resume, ideally in a bullet that shows you using them. Many companies use applicant tracking systems (ATS) that rank resumes by these keywords. Our [ATS checker](/ats-checker) shows which ones you're missing.

## Formatting rules for a first resume

- **One page.** Always, as a fresh graduate.
- **A clean, simple template.** Pick from our [student resume templates](/templates/category/student-entry-level).
- **10–12 pt font** and consistent spacing.
- **Save as PDF** named Firstname-Lastname-Resume.pdf.
- **Proofread twice**, then ask a friend to check it too.

## Common fresh graduate mistakes

- Listing every course you took instead of the relevant ones.
- An unprofessional email address.
- Including your SSC/HSC details in full when you have a university degree. Keep them to one line or leave them out.
- Writing "References available on request" (it's assumed).
- Sending the same resume to every job.

> Your first resume won't be perfect, and it doesn't need to be. Send it, learn from the replies, and improve it every few applications.

Ready to start? [Build your resume for free](/builder) with a live PDF preview, or read our full guide on [how to write a good resume](/resume-guide).`,
  },
  {
    slug: "ats-friendly-resume",
    title: "What Is an ATS-Friendly Resume? How to Beat Applicant Tracking Systems",
    description: "What applicant tracking systems (ATS) are, how they read your resume, and exactly how to format and write an ATS-friendly resume that reaches a human.",
    date: "2026-09-28",
    readMinutes: 6,
    keywords: ["ATS friendly resume", "applicant tracking system", "ATS resume format", "ATS resume check"],
    body: `If you've applied to dozens of jobs online and heard nothing back, an applicant tracking system may be the reason. Most medium and large companies use one to collect, filter and rank applications before a recruiter reads them.

## What is an ATS?

An **applicant tracking system (ATS)** is software that stores job applications and helps recruiters sort them. Common ones include Workday, Greenhouse, Lever, Taleo and iCIMS. When you upload a resume, the ATS:

1. **Extracts the text** from your file.
2. **Splits it into fields**: name, contact details, jobs, dates, education and skills.
3. **Ranks or filters** candidates, often by how well their resume matches the job's keywords.

If step 1 or 2 goes wrong, your resume can arrive garbled, missing sections, or ranked at the bottom, even if you're a great fit.

## What makes a resume ATS-friendly

- **Real text, not images.** Scanned resumes and text inside pictures can't be read.
- **Standard section headings** like Experience, Education and Skills. Creative names like "My Journey" can hide a whole section.
- **A simple layout.** One column is safest; tables, text boxes and some multi-column designs are read out of order by older systems.
- **Contact details in the page body**, not only in the header or footer.
- **Consistent dates** such as "Jan 2023 – Present".
- **A standard file type:** a text-based PDF or a Word document.

## Keywords: the part most people miss

Formatting gets you read correctly; **keywords** get you ranked. Recruiters often search their ATS for specific skills, and many systems score how closely your resume matches the job description.

- Use the **exact wording** from the job ad ("project management", not only "managed projects").
- Write acronyms both ways once: "Search Engine Optimisation (SEO)".
- Put skills in context: a bullet that shows you **using** a skill counts for more than a list.
- Never paste the job description into your resume or hide keywords in white text. Recruiters and modern ATS catch it.

## ATS myths

- **"ATS reject most resumes automatically."** Usually recruiters filter and search; the ATS ranks. A poorly parsed resume is still at a real disadvantage.
- **"PDFs don't work with ATS."** Text-based PDFs work well with modern systems. Image-only PDFs don't.
- **"You need a plain, ugly resume."** You need a clean, well-structured one. It can still look professional.

## How to check your resume

The easiest test is to see what an ATS actually extracts. ResumeX's free [ATS checker](/ats-checker) renders your PDF, reads it back the way an ATS does, and runs 30+ checks: parsing, headings, dates, bullet quality and, if you paste a job description, keyword match.

> Tip: start from an [ATS-friendly resume template](/templates/category/ats-friendly), then tailor the keywords for each application.

Want the full picture on writing strong bullet points and structuring sections? Read [how to write a good resume](/resume-guide).`,
  },
  {
    slug: "cv-vs-resume",
    title: "CV vs Resume: What's the Difference and Which Should You Use?",
    description: "CV or resume? The real difference in length, content and purpose, how the terms differ in the US, UK, Europe and South Asia, and which one to send.",
    date: "2026-09-28",
    readMinutes: 5,
    keywords: ["CV vs resume", "difference between CV and resume", "CV format", "resume vs curriculum vitae"],
    body: `"Please send your CV." "Attach your resume." Job ads use both words, sometimes for the same thing. Here's what each really means and which one to send.

## The short answer

- A **resume** is a short, targeted summary of your experience and skills, usually one or two pages, tailored to a specific job.
- A **CV (curriculum vitae)** is a complete record of your career. In academia it lists everything: education, research, publications, teaching, grants and conferences, and can run many pages.

## How the words are used around the world

- **United States and Canada:** "resume" for jobs; "CV" only for academic, research and medical roles.
- **United Kingdom, Ireland, Australia and New Zealand:** "CV" is the everyday word for what Americans call a resume.
- **Europe:** "CV" is standard, sometimes in the Europass format.
- **Bangladesh, India and much of Asia and the Middle East:** both words are used interchangeably. A "CV" requested for a corporate job almost always means a 1–2 page resume.

## Side-by-side comparison

- **Length:** resume 1–2 pages; academic CV 2+ pages with no strict limit.
- **Purpose:** resume to win a specific job; CV to show your full academic record.
- **Tailoring:** a resume changes for each application; a CV grows over time.
- **Content:** a resume shows your most relevant achievements; a CV includes publications, research, teaching and presentations.

## Which should you send?

- **Corporate, startup or government job:** send a **resume** (even if they call it a CV).
- **Graduate school, scholarships, research or university teaching:** send an **academic CV**.
- **Not sure?** A tailored 1–2 page resume is the safe choice unless the ad asks for publications or a full academic history.

## Personal details: what to include

In many South Asian and Middle Eastern countries, CVs traditionally include a photo, date of birth, nationality and even father's name. Today most international employers only need your name, phone, email, city and LinkedIn. Add a photo or date of birth only if the employer or country clearly expects it. ResumeX lets you add these as optional fields.

## Make both with the same tool

Start with a one-page resume using our [professional resume templates](/templates), and use our [academic CV templates](/templates/category/academic-cv) when you need the long form. Read [how to write a good resume](/resume-guide) for section-by-section advice.`,
  },
  {
    slug: "internship-resume",
    title: "How to Write an Internship Resume (Student Guide + Examples)",
    description: "A step-by-step guide to writing an internship resume as a student: what to include, how to describe projects and coursework, and example bullet points.",
    date: "2026-09-28",
    readMinutes: 6,
    keywords: ["internship resume", "student resume", "resume for internship", "internship CV"],
    body: `An internship resume has one job: convince a recruiter you're worth training. You don't need years of experience. You need to show you're capable, curious and a good fit for the role.

## What to include

1. **Contact details:** professional email, phone, city, LinkedIn and GitHub or portfolio if relevant.
2. **Education:** university, degree, expected graduation date and CGPA (if 3.3+ or equivalent).
3. **Relevant coursework:** 4–6 courses that match the internship.
4. **Projects:** your most important section if you have little experience.
5. **Experience:** part-time jobs, tutoring, freelancing, volunteering or previous internships.
6. **Skills:** grouped by type.
7. **Activities and awards:** clubs, competitions, hackathons and leadership roles.

## Lead with education

For internships, education goes at the top. Include your expected graduation date (for example "Expected May 2027") so recruiters know when you're available.

## Make your projects work hard

Describe projects with an action verb, what you did, and the result.

- **Weak:** Worked on an e-commerce website.
- **Strong:** Developed an e-commerce site with Next.js and Stripe test payments; cut page load time to under 1.5 s with image optimisation.
- **Weak:** Did research for a class.
- **Strong:** Analysed survey data from 250 students in SPSS and presented findings on study habits to the department.

## Show soft skills through evidence

Don't write "good communicator". Show it:

- **Strong:** Presented the club's annual plan to 120 members and secured funding from two sponsors.
- **Strong:** Coordinated a 12-person volunteer team for a blood donation camp that collected 85 bags.

## Tailor it to each internship

Read the posting and mirror its keywords where they're true for you. A marketing internship and a data internship should get different resumes, even from the same person. Check your keyword match with the free [ATS checker](/ats-checker).

## Keep it to one page

Recruiters skim internship applications quickly. One clean page, 10–12 pt font, clear headings and no walls of text. Our [student and entry-level templates](/templates/category/student-entry-level) are designed exactly for this.

## Final checklist

- Graduation date and CGPA (if strong) are clear.
- At least two projects with results.
- Keywords from the posting appear naturally.
- One page, PDF, no typos.

> Apply early. Many internship programmes review applications as they arrive, so the first good applications have the best chance.

[Start your internship resume now](/builder), free with a live PDF preview.`,
  },
  {
    slug: "resume-action-verbs",
    title: "120 Strong Action Verbs for Your Resume (with Examples)",
    description: "Replace weak phrases like 'responsible for' with strong resume action verbs. 120 verbs grouped by skill, with before-and-after bullet point examples.",
    date: "2026-09-28",
    readMinutes: 5,
    keywords: ["resume action verbs", "power words for resume", "resume verbs", "resume bullet points"],
    body: `The first word of each bullet point decides how strong it sounds. "Responsible for social media" describes a duty. "Grew Instagram followers 3x in six months" describes an achievement. Start every bullet with a strong action verb, then add what you did and the result.

## Why action verbs matter

- They make you the **actor**, not a bystander.
- They're **shorter and clearer** than phrases like "was in charge of".
- Recruiters and ranking systems favour bullets that show **impact**.

## Leadership

Led, Directed, Managed, Supervised, Mentored, Coached, Coordinated, Delegated, Spearheaded, Chaired, Headed, Mobilised, Guided, Oversaw, Championed

- **Weak:** Was in charge of a team of volunteers.
- **Strong:** Led 15 volunteers to organise a charity run that raised ৳2.4 lakh.

## Building and creating

Built, Designed, Developed, Created, Launched, Engineered, Established, Founded, Produced, Programmed, Prototyped, Authored, Composed, Implemented, Introduced

- **Weak:** Worked on the company app.
- **Strong:** Built the Android version of the company app, reaching 10,000 downloads in three months.

## Improving and fixing

Improved, Streamlined, Optimised, Automated, Reduced, Accelerated, Simplified, Upgraded, Modernised, Redesigned, Restructured, Resolved, Revamped, Strengthened, Standardised

- **Weak:** Helped make reporting faster.
- **Strong:** Automated weekly sales reports in Excel, saving the team 6 hours a week.

## Results and growth

Increased, Grew, Generated, Achieved, Delivered, Exceeded, Boosted, Expanded, Maximised, Secured, Won, Earned, Doubled, Surpassed, Outperformed

## Analysis and research

Analysed, Evaluated, Researched, Assessed, Forecast, Identified, Investigated, Measured, Modelled, Tested, Surveyed, Audited, Calculated, Mapped, Validated

## Communication

Presented, Negotiated, Persuaded, Trained, Wrote, Edited, Published, Pitched, Facilitated, Briefed, Advocated, Collaborated, Consulted, Corresponded, Translated

## Organisation and operations

Organised, Planned, Scheduled, Coordinated, Budgeted, Administered, Allocated, Catalogued, Processed, Tracked, Prioritised, Maintained, Procured, Dispatched, Arranged

## Customer and people

Assisted, Supported, Advised, Resolved, Served, Welcomed, Onboarded, Retained, Counselled, Educated, Enabled, Engaged, Represented, Partnered, Recruited

## Phrases to avoid

- "Responsible for…"
- "Helped with…"
- "Worked on…"
- "Duties included…"
- "Tasked with…"

## Put it together

Use the formula **action verb + what you did + measurable result**, and vary your verbs so bullets don't all start with "Managed". Our [resume guide](/resume-guide) has more examples, and the ResumeX [ATS checker](/ats-checker) flags bullets that start weakly.`,
  },
  {
    slug: "tailor-resume-to-job-description",
    title: "How to Tailor Your Resume to a Job Description in 10 Minutes",
    description: "A fast, repeatable method to tailor your resume for each job: find the keywords that matter, match them honestly, and reorder your experience for impact.",
    date: "2026-09-28",
    readMinutes: 5,
    keywords: ["tailor resume to job description", "resume keywords", "customize resume", "job description keywords"],
    body: `Sending the same resume to every job is the most common reason good candidates get ignored. Tailoring doesn't mean rewriting everything. With a good base resume, it takes about ten minutes.

## Step 1: Start from a strong base resume

Keep one complete "master" resume with all your experience, projects and skills. Tailored versions are copies of it with the most relevant parts brought forward. In ResumeX you can mark one resume as your master profile and fill new ones from it in one click.

## Step 2: Pull the keywords from the job ad (3 minutes)

Read the posting and highlight:

- **Hard skills and tools:** Excel, Python, Figma, SAP, Google Ads.
- **Qualifications:** degrees, certifications, years of experience.
- **Job titles and domain words:** "business analyst", "B2B", "supply chain".
- **Anything repeated** or listed under "requirements". These matter most.

## Step 3: Match them honestly (4 minutes)

For each keyword you genuinely have:

1. Use the **exact wording** from the ad in your skills section.
2. Better, work it into a **bullet point** that shows you using it.
3. Write acronyms both ways once: "Key Performance Indicators (KPIs)".

Never add skills you don't have. You'll be asked about them in the interview.

## Step 4: Reorder for relevance (2 minutes)

- Move your most relevant bullets to the top of each job.
- Adjust your summary to name the target role.
- Cut or shorten experience that doesn't help this application.

## Step 5: Check your match (1 minute)

Paste the job description into the free [ATS checker](/ats-checker). It shows which keywords you're missing, which are only in your skills list and not backed by experience, and whether your title and years match what's asked.

## Example

Job ad: "Looking for a Digital Marketing Executive with experience in **Meta Ads**, **Google Analytics** and **content calendars**."

- **Before:** Managed social media for a clothing brand.
- **After:** Ran Meta Ads campaigns for a clothing brand with a ৳50,000 monthly budget, planned a 4-week content calendar and tracked results in Google Analytics, growing online orders 35%.

> Keep every tailored version. When you get an interview, you'll know exactly what that company saw.

[Tailor your resume now](/builder), or read [how to write a good resume](/resume-guide) for the fundamentals.`,
  },
];

export const guideBySlug = (slug) => GUIDES.find((g) => g.slug === slug);
