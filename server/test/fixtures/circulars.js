/**
 * Job posts and circulars as people paste them (Bdjobs, LinkedIn, company sites,
 * universities, government circulars in Bangla), with what capture should find.
 * Fields not listed in `expect` aren't checked. Invented organisations; realistic formats.
 */
module.exports = [
    {
        name: 'Bdjobs listing',
        text: `Software Engineer (Backend)
Pathao Limited
Vacancy: 3
Job Context
We are looking for backend engineers to build our payments platform.
Job Responsibilities
- Design and build REST APIs in Go and Node.js
- Work with PostgreSQL and Redis
Employment Status: Full-time
Educational Requirements
BSc in Computer Science & Engineering
Experience Requirements
2 to 4 years
Job Location: Dhaka (Gulshan)
Salary: Negotiable
Application Deadline : 15 Oct 2026
Apply Procedure
Apply Online through bdjobs.com`,
        expect: { title: 'Software Engineer', organisation: 'Pathao Limited', deadline: '2026-10-15', location: 'Dhaka', jobType: 'Full-time', salary: 'Negotiable', applyVia: ['bdjobs'], keywords: ['Go', 'PostgreSQL', 'Redis'] },
    },
    {
        name: 'LinkedIn post',
        text: `Senior Product Designer
Shikho · Dhaka, Bangladesh (Hybrid)
About the job
Shikho is looking for a Senior Product Designer to shape how millions of students learn.
What you'll do
- Own end-to-end design for our learning app
- Work in Figma with product and engineering
Requirements
- 4+ years of product design experience`,
        expect: { title: 'Senior Product Designer', organisation: 'Shikho', location: 'Dhaka', deadline: '' },
    },
    {
        name: 'university lecturer circular',
        text: `EAST RIVER UNIVERSITY
Department of Computer Science and Engineering
Applications are invited for the post of Lecturer in the Department of CSE.
Qualifications: MSc in CSE with first class. Publications in reputed journals will be preferred.
Salary: As per university pay scale.
Interested candidates should send their CV to hr@eastriver.edu.bd.
Last date of application: 20.11.2026`,
        expect: { title: 'Lecturer', organisation: 'EAST RIVER UNIVERSITY', deadline: '2026-11-20', applyVia: ['email'], email: 'hr@eastriver.edu.bd', salary: 'As per university pay scale' },
    },
    {
        name: 'government circular in Bangla (Teletalk)',
        text: `গণপ্রজাতন্ত্রী বাংলাদেশ সরকার
জনস্বাস্থ্য প্রকৌশল অধিদপ্তর
নিয়োগ বিজ্ঞপ্তি
পদের নাম: উপসহকারী প্রকৌশলী
বেতন স্কেল: ১৬,০০০-৩৮,৬৪০ টাকা (গ্রেড-১০)
আবেদনের শেষ তারিখ: ১০ নভেম্বর ২০২৬ বিকাল ৫টা
অনলাইনে আবেদন করতে হবে: http://dphe.teletalk.com.bd`,
        expect: { title: 'উপসহকারী প্রকৌশলী', deadline: '2026-11-10', applyVia: ['teletalk'], url: 'http://dphe.teletalk.com.bd' },
    },
    {
        name: 'Bangla circular with a numeric date before the phrase',
        text: `নিয়োগ বিজ্ঞপ্তি
পদের নাম: অফিস সহকারী
প্রতিষ্ঠানের নাম: সবুজ বাংলা ফাউন্ডেশন
কর্মস্থল: রাজশাহী
আগ্রহী প্রার্থীদের ২৫/১০/২০২৬ তারিখের মধ্যে ডাকযোগে আবেদন করতে হবে।`,
        expect: { title: 'অফিস সহকারী', organisation: 'সবুজ বাংলা ফাউন্ডেশন', deadline: '2026-10-25', location: 'রাজশাহী', applyVia: ['post'] },
    },
    {
        name: 'company careers page (international style)',
        text: `Data Analyst
Location: Remote
Employment type: Contract (6 months)
About Northwind Analytics
Northwind Analytics is hiring a Data Analyst to join our growth team.
You will build dashboards in Power BI and write SQL.
Apply by October 30, 2026.`,
        expect: { title: 'Data Analyst', organisation: 'Northwind Analytics', deadline: '2026-10-30', location: 'Remote', jobType: 'Contract', keywords: ['SQL', 'Power BI'] },
    },
    {
        name: 'email application',
        text: `We are hiring! Position: Junior Accountant
Company: Rahman & Sons Trading Ltd.
Job location: Chattogram
Salary: Tk. 25,000 - 30,000
Send your CV to jobs@rahmansons.com.bd with the subject "Junior Accountant" by 5 December 2026.`,
        expect: { title: 'Junior Accountant', organisation: 'Rahman & Sons Trading Ltd', deadline: '2026-12-05', location: 'Chattogram', salary: 'Tk. 25,000 - 30,000', applyVia: ['email'], email: 'jobs@rahmansons.com.bd' },
    },
    {
        name: 'internship post',
        text: `Internship Opportunity: Marketing Intern
BrightPath Foundation invites applications for a 3-month paid internship.
Location: Sylhet
Stipend: BDT 10,000/month
Deadline: 01/12/2026`,
        expect: { title: 'Marketing Intern', organisation: 'BrightPath Foundation', deadline: '2026-12-01', location: 'Sylhet', jobType: 'Internship' },
    },
    {
        name: 'US-style date, month first',
        text: `Position: QA Engineer
Organization: Lakeside Software Inc.
Closing date: 10/28/2026
Must have experience with Selenium and Cypress.`,
        expect: { title: 'QA Engineer', organisation: 'Lakeside Software Inc', deadline: '2026-10-28', keywords: ['Selenium', 'Cypress'] },
    },
    {
        name: 'ISO date and a publication date to ignore',
        text: `Published on: 2026-09-01
Job title: Frontend Developer (React)
Company name: Pixelwise Studio
Application deadline: 2026-10-12`,
        expect: { title: 'Frontend Developer', organisation: 'Pixelwise Studio', deadline: '2026-10-12', keywords: ['React'] },
    },
    {
        name: 'school teacher, Bangla-English mix',
        text: `Milestone School & College
Post: Assistant Teacher (English)
Qualification: BA/MA in English
Salary: আলোচনা সাপেক্ষে
আবেদনের শেষ তারিখ: ৩০ অক্টোবর ২০২৬`,
        expect: { title: 'Assistant Teacher', organisation: 'Milestone School & College', deadline: '2026-10-30' },
    },
    {
        name: 'no deadline, only a posted date',
        text: `Business Development Executive
Horizon Telecom Ltd
Posted: 12 September 2026
Location: Khulna
Requirements: 1-2 years of sales experience, good communication skills.`,
        expect: { title: 'Business Development Executive', organisation: 'Horizon Telecom Ltd', deadline: '', location: 'Khulna' },
    },
    {
        name: 'ordinal day and comma',
        text: `NGO job: Monitoring & Evaluation Officer
Organization: CareBridge Bangladesh
Last date: 7th November, 2026
Place of posting: Cox's Bazar`,
        expect: { title: 'Monitoring & Evaluation Officer', organisation: 'CareBridge Bangladesh', deadline: '2026-11-07', location: "Cox's Bazar" },
    },
    {
        name: 'short date with two-digit year',
        text: `Hiring: Customer Support Executive (Night Shift)
at Swift Courier Ltd, Dhaka
Deadline 15-11-26`,
        expect: { title: 'Customer Support Executive', organisation: 'Swift Courier Ltd', deadline: '2026-11-15', location: 'Dhaka' },
    },
    {
        name: 'bank circular with grade',
        text: `Sonali Horizon Bank PLC
Recruitment of Senior Officer (General)
Pay: 9th Grade (National Pay Scale)
Application deadline: 18 December 2026
Apply online: https://erecruitment.shbplc.com/apply`,
        expect: { title: 'Senior Officer', organisation: 'Sonali Horizon Bank PLC', deadline: '2026-12-18', url: 'https://erecruitment.shbplc.com/apply', applyVia: ['online'] },
    },
    {
        name: 'research assistant, deadline in a sentence',
        text: `The Centre for Climate Studies at Dhaka University is seeking a Research Assistant for a two-year project.
Applicants must hold a BSc in Environmental Science. Knowledge of Python and GIS is a plus.
Please apply before 31 October 2026 by emailing rc@ccs.du.ac.bd.`,
        expect: { title: 'Research Assistant', deadline: '2026-10-31', email: 'rc@ccs.du.ac.bd', applyVia: ['email'], keywords: ['Python'] },
    },
    {
        name: 'part-time tutor',
        text: `Part-time Math Tutor needed
Organisation: Alo Coaching Centre
Location: Mirpur, Dhaka
Salary: 8000 taka/month
Apply by 12 Nov 2026`,
        expect: { title: 'Math Tutor', organisation: 'Alo Coaching Centre', deadline: '2026-11-12', jobType: 'Part-time' },
    },
    {
        name: 'nothing useful',
        text: 'hello, can you help me find a job please',
        expect: { title: '', organisation: '', deadline: '', location: '' },
    },
    {
        name: 'impossible dates are ignored',
        text: `Position: Driver
Deadline: 31/02/2026`,
        expect: { title: 'Driver', deadline: '' },
    },
    {
        name: 'several dates, the deadline wins',
        text: `Job title: Graphic Designer
Company: Canvas Creative Agency
Interview date: 20 November 2026
Joining date: 1 December 2026
Last date of application: 5 November 2026`,
        expect: { title: 'Graphic Designer', organisation: 'Canvas Creative Agency', deadline: '2026-11-05' },
    },
];
