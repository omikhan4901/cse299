/**
 * The import evaluation (docs/v2/SPEC.md §12): realistic messy inputs and what a careful
 * person would expect in their resume afterwards. Expectations list only what matters:
 * fields not mentioned aren't scored. `sections` lets an item count in more than one
 * reasonable place (a Coursera course as a course or a certification); `facts` must appear
 * somewhere in the result, whichever section holds them. `allowExtra` lists
 * sections where extra items aren't counted as mistakes.
 */

const pathaoResume = {
    personal: { name: 'Rahim Uddin', email: 'rahim.uddin@gmail.com' },
    experience: [{ id: 11, title: 'Software Engineer', company: 'Pathao', startDate: 'Mar 2021', endDate: 'Present', description: 'Built the payments service' }],
    projects: [{ id: 21, name: 'BondhuKoi', technologies: 'React Native, Fastify, PostgreSQL', description: 'Built a friend-finder app for university students' }],
    skills: 'Node.js, Go',
};

module.exports = [
    {
        name: 'narrative with two jobs',
        input:
            "I've been working as a software engineer at Pathao since March 2021, where I built the payments service that handles around 2 million transactions a month and cut API response time by 35% using Redis caching. Before that I was a junior developer at Brain Station 23 from Jan 2019 to Feb 2021. I developed REST APIs in Node.js for 3 client projects and wrote integration tests.",
        expected: {
            experience: [
                { title: 'Software Engineer', company: 'Pathao', startDate: 'Mar 2021', endDate: 'Present', bullets: ['payments service 2 million transactions', 'API response time 35% Redis caching'] },
                { title: 'Junior Developer', company: 'Brain Station 23', startDate: 'Jan 2019', endDate: 'Feb 2021', bullets: ['REST APIs Node.js 3 client projects', 'integration tests'] },
            ],
            skills: ['Redis', 'Node.js'],
        },
    },
    {
        name: 'skills and languages dump',
        input: 'skills - python, java, c++, react, node, mongodb, mysql, git, docker, figma, problem solving, team work. languages: bangla (native), english (fluent)',
        expected: {
            skills: ['Python', 'Java', 'C++', 'React', 'Node', 'MongoDB', 'MySQL', 'Git', 'Docker', 'Figma', 'Problem solving', 'Teamwork'],
            languages: ['Bangla', 'English'],
        },
    },
    {
        name: 'Bangla and English mixed',
        input: 'আমি ২০২২ সালে North South University থেকে CSE তে BSc শেষ করেছি, CGPA 3.62. এরপর Grameenphone এ ৬ মাস intern হিসেবে কাজ করেছি, সেখানে একটা network monitoring dashboard বানিয়েছি।',
        expected: {
            education: [{ institution: 'North South University', degree: 'BSc CSE', endYear: '2022', gpa: '3.62' }],
            experience: [{ title: 'Intern', company: 'Grameenphone', bullets: ['network monitoring dashboard'] }],
        },
    },
    {
        name: 'student with projects and volunteering',
        input:
            "I'm a final year CSE student at BRAC University (2021-2025). Projects: 1) Smart attendance system using Python and OpenCV - face recognition, reduced attendance time from 10 min to 1 min. 2) E-commerce site with React and Firebase for a local clothing shop, 200+ orders in the first month. I also volunteer at BRACU Computer Club as event coordinator.",
        expected: {
            education: [{ institution: 'BRAC University', degree: 'CSE', startYear: '2021', endYear: '2025' }],
            projects: [
                { name: 'Smart attendance system', bullets: ['face recognition', 'attendance time 10 min to 1 min'] },
                { name: 'E-commerce', bullets: ['clothing shop', '200+ orders first month'] },
            ],
            volunteering: [{ role: 'Event Coordinator', organization: 'BRACU Computer Club' }],
            skills: ['Python', 'OpenCV', 'React', 'Firebase'],
        },
    },
    {
        name: 'lecturer with publications',
        input:
            "Lecturer, Department of CSE, Daffodil International University, Jan 2023 - present. Teaching Data Structures and Algorithms and Database Systems to 300+ undergraduate students each semester. Publications: 'Deep learning approach for Bangla handwritten digit recognition', ICCIT 2021. 'A survey on federated learning', Journal of Computer Science, 2023. MSc in CSE from BUET (2022), BSc from KUET (2019).",
        expected: {
            experience: [{ title: 'Lecturer', company: 'Daffodil International University', startDate: 'Jan 2023', endDate: 'Present', bullets: ['Data Structures Algorithms Database Systems 300+ students'] }],
            publications: [
                { title: 'Deep learning approach for Bangla handwritten digit recognition', publisher: 'ICCIT', date: '2021' },
                { title: 'A survey on federated learning', publisher: 'Journal of Computer Science', date: '2023' },
            ],
            education: [
                { institution: 'BUET', degree: 'MSc CSE', endYear: '2022' },
                { institution: 'KUET', degree: 'BSc', endYear: '2019' },
            ],
        },
    },
    {
        name: 'old CV pasted as text',
        input: `TANVIR HASAN
Junior Data Analyst | tanvir.hasan@gmail.com | 01712-345678 | Dhaka | linkedin.com/in/tanvirh

PROFILE
Data analyst with experience in SQL and dashboards.

WORK EXPERIENCE
Data Analyst Intern — Robi Axiata (Jun 2023 – Nov 2023)
• Built weekly churn dashboards in Power BI for the marketing team
• Wrote SQL queries on a 5M-row customer table

EDUCATION
BSc in Statistics, University of Dhaka, 2019 – 2023

SKILLS
SQL, Power BI, Excel, Python`,
        expected: {
            personal: { name: 'Tanvir Hasan', title: 'Junior Data Analyst', email: 'tanvir.hasan@gmail.com', phone: '01712-345678', city: 'Dhaka', linkedin: 'linkedin.com/in/tanvirh' },
            summary: 'Data analyst with experience in SQL and dashboards',
            experience: [{ title: 'Data Analyst Intern', company: 'Robi Axiata', startDate: 'Jun 2023', endDate: 'Nov 2023', bullets: ['churn dashboards Power BI marketing', 'SQL queries 5M-row customer table'] }],
            education: [{ institution: 'University of Dhaka', degree: 'BSc Statistics', startYear: '2019', endYear: '2023' }],
            skills: ['SQL', 'Power BI', 'Excel', 'Python'],
        },
    },
    {
        name: 'follow-up about an existing project',
        resume: pathaoResume,
        input: 'I forgot to mention that I presented BondhuKoi at the NSU CSE Fest 2023 and it won 2nd place.',
        // As a point on the project or as an award: either is right, as long as the project
        // isn't duplicated.
        expected: {
            projects: [{ name: 'BondhuKoi', bullets: ['Built a friend-finder app'] }],
            facts: ['presented BondhuKoi NSU CSE Fest 2023 2nd place'],
        },
        allowExtra: ['awards'],
    },
    {
        name: 'follow-up: a job ended and a new one started',
        resume: pathaoResume,
        input: "My job at Pathao ended in June 2024. I've moved to bKash as a Senior Software Engineer since July 2024.",
        expected: {
            experience: [
                { company: 'Pathao', title: 'Software Engineer', endDate: 'Jun 2024' },
                { company: 'bKash', title: 'Senior Software Engineer', startDate: 'Jul 2024', endDate: 'Present' },
            ],
        },
    },
    {
        name: 'repeating what is already there',
        resume: pathaoResume,
        input: 'I work at Pathao as a software engineer since March 2021, building the payments service. Skills: Node.js, Go, Redis.',
        expected: {
            experience: [{ company: 'Pathao', title: 'Software Engineer', bullets: ['payments service'] }],
            skills: ['Node.js', 'Go', 'Redis'],
        },
    },
    {
        name: 'school teacher',
        input:
            'I have been teaching English at Milestone College since 2018 (classes 9 to 12). Before that I taught at a coaching centre for 2 years. I have a BA and an MA in English from Dhaka University. I also run the debate club and my students won the inter-college debate championship in 2022.',
        expected: {
            experience: [{ title: 'Teacher', company: 'Milestone College', startDate: '2018', endDate: 'Present', bullets: ['English classes 9 to 12'] }],
            education: [
                { institution: 'Dhaka University', degree: 'BA English' },
                { institution: 'Dhaka University', degree: 'MA English' },
            ],
        },
        allowExtra: ['experience', 'awards', 'volunteering'],
    },
    {
        name: 'contact details only',
        input: "Call me at 01712-345678 or email tanvir.hasan@gmail.com, I'm in Chattogram. linkedin.com/in/tanvirh",
        expected: {
            personal: { phone: '01712-345678', email: 'tanvir.hasan@gmail.com', city: 'Chattogram', linkedin: 'linkedin.com/in/tanvirh' },
        },
    },
    {
        name: 'nothing for a resume',
        input: 'hi can you help me make my cv better? thanks',
        expected: {},
        expectNothing: true,
    },
    {
        name: 'unstructured dump',
        input:
            "internship at robi axiata summer 2023 - worked on customer churn prediction w/ python pandas sklearn, model accuracy 87%. also did the coursera machine learning course by andrew ng in 2022. got dean's list award 3 times. i know sql too",
        expected: {
            experience: [{ company: 'Robi Axiata', title: 'Intern', bullets: ['customer churn prediction 87% accuracy'] }],
            courses: [{ name: 'Machine Learning', sections: ['courses', 'certifications'] }],
            awards: [{ title: "Dean's List" }],
            skills: ['Python', 'Pandas', 'scikit-learn', 'SQL'],
        },
    },
    {
        name: 'a summary in the first person',
        input: "I'm a data analyst with 3 years of experience in SQL, Power BI and Python, looking for a senior analyst role in fintech.",
        expected: {
            summary: 'data analyst 3 years SQL Power BI Python senior analyst fintech',
            skills: ['SQL', 'Power BI', 'Python'],
        },
    },
];
