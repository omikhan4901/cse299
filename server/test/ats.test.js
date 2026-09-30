/**
 * The public ATS checker: the upload endpoint (routes/ats.js, lib/pdfText.js) and the
 * browser-side parsing and scoring it feeds (client/src/lib/ats).
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, api, resetState } = require('./helpers');

before(() => start('ats'));
after(stop);
beforeEach(resetState);

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name));
const scan = (buffer, name = 'resume.pdf', type = 'application/pdf') => {
    const form = new FormData();
    if (buffer) form.append('resume', new Blob([buffer], { type }), name);
    return api('POST', '/ats/scan', { raw: form });
};
const client = async () => ({
    ...(await import(path.join(__dirname, '../../client/src/lib/ats/fromText.js'))),
    ...(await import(path.join(__dirname, '../../client/src/lib/ats/analyze.js'))),
});

describe('upload endpoint', () => {
    it('reads a single-column resume: text, pages and layout', async () => {
        const r = await scan(fixture('single-column.pdf'));
        assert.equal(r.status, 200);
        assert.match(r.body.text, /Jane Doe/);
        assert.match(r.body.text, /EXPERIENCE/);
        assert.equal(r.body.pageCount, 1);
        assert.deepEqual(r.body.layout, { columns: false, images: 0, garbled: 0 });
    });

    it('spots a sidebar (two-column) layout', async () => {
        const r = await scan(fixture('sidebar.pdf'));
        assert.equal(r.status, 200);
        assert.equal(r.body.layout.columns, true);
    });

    it('refuses anything that is not a readable PDF with a clear 400', async () => {
        const cases = [
            [Buffer.from('just some text'), 'resume.pdf'],
            [Buffer.from('%PDF-1.7 this is not really a pdf'), 'broken.pdf'],
            [Buffer.alloc(6 * 1024 * 1024, 0x25), 'huge.pdf'],
            [null],
        ];
        for (const [buffer, name] of cases) {
            const r = await scan(buffer, name);
            assert.equal(r.status, 400, `${name}: ${r.status} ${JSON.stringify(r.body)}`);
            assert.ok(r.body.error && !/stack|Error:/.test(r.body.error), 'a friendly message');
        }
    });

    it('counts checks per network when signed out, per account when signed in; wrong files do not use one up', async () => {
        const { setOverrides } = require('../lib/rateLimit');
        setOverrides({ 'ats-scan': { max: 3, windowMs: 3600000 } });
        assert.equal((await scan(Buffer.from('not a pdf'))).status, 400);
        for (let i = 0; i < 3; i++) assert.equal((await scan(fixture('single-column.pdf'))).status, 200, `check ${i + 1}`);
        // Someone signed in on the same (campus) network still has their own checks.
        const { register } = require('./helpers');
        const { token } = await register();
        const form = new FormData();
        form.append('resume', new Blob([fixture('single-column.pdf')], { type: 'application/pdf' }), 'resume.pdf');
        assert.equal((await api('POST', '/ats/scan', { raw: form, token })).status, 200, 'per account when signed in');
        const r = await scan(fixture('single-column.pdf'));
        assert.equal(r.status, 429);
        assert.match(r.body.error, /free ATS checks/);
        assert.ok(Number(r.headers.get('retry-after')) > 0);
    });

    it('the limit is listed in the admin console and can be changed there', async () => {
        const { describeLimits, setOverrides } = require('../lib/rateLimit');
        const entry = describeLimits().find((l) => l.name === 'ats-scan');
        assert.equal(entry.max, 30, 'room for a campus sharing one address');
        assert.equal(entry.group, 'ATS checker');
        setOverrides({ 'ats-scan': { max: 1, windowMs: 3600000 } });
        assert.equal((await scan(fixture('single-column.pdf'))).status, 200);
        assert.equal((await scan(fixture('single-column.pdf'))).status, 429);
    });
});

describe('parsing an uploaded resume', () => {
    it('finds the details of a resume made in the builder', async () => {
        const { resumeFromText, sectionsFound, analyzeResume } = await client();
        const { body } = await scan(fixture('single-column.pdf'));
        const r = resumeFromText(body.text);
        assert.equal(r.personal.name, 'Jane Doe');
        assert.equal(r.personal.email, 'jane.doe@example.com');
        assert.equal(r.personal.phone, '+1 (555) 123-4567');
        assert.equal(r.personal.city, 'San Francisco, CA');
        assert.equal(r.personal.linkedin, 'linkedin.com/in/janedoe');
        assert.deepEqual(r.experience.map((e) => [e.title, e.company, e.startDate, e.endDate]), [
            ['Lead Software Engineer', 'AI Tech Solutions', 'Jan 2022', 'Present'],
            ['Frontend Developer', 'Brightlane Studio', 'Jun 2019', 'Dec 2021'],
        ]);
        assert.equal(r.experience[0].description.split('\n').length, 3, 'three bullet points');
        assert.deepEqual(r.education.map((e) => [e.degree, e.institution, e.startYear, e.endYear]), [['B.S. Computer Science', 'State University', '2015', '2019']]);
        assert.equal(r.projects[0].name, 'OpenBoard');
        assert.equal(r.projects[0].link, 'github.com/janedoe/openboard');
        assert.ok(r.skills.split(', ').length >= 10);
        const sections = sectionsFound(body.text);
        const report = analyzeResume({ resume: r, pdfText: body.text, pageCount: body.pageCount, upload: { ...body.layout, sections } });
        assert.ok(report.score >= 85, `a well-made resume scores well (${report.score})`);
    });

    it('keeps jobs apart in a sidebar layout with wrapped bullets', async () => {
        const { resumeFromText } = await client();
        const { body } = await scan(fixture('sidebar.pdf'));
        const r = resumeFromText(body.text);
        assert.deepEqual(r.experience.map((e) => [e.title, e.company, e.description.split('\n').length]), [
            ['Lead Software Engineer', 'AI Tech Solutions', 3],
            ['Frontend Developer', 'Brightlane Studio', 2],
        ]);
        assert.ok(r.experience[0].description.endsWith('weekly pairing sessions'), 'a wrapped last word stays with its bullet');
    });

    it('joins wrapped lines when a template draws its bullets as shapes', async () => {
        const { resumeFromText } = await client();
        const text = [
            'Jane Doe', 'EXPERIENCE', 'Lead Software Engineer Jan 2022 – Present', 'AI Tech Solutions · Remote',
            'Led a team of 5 engineers building a microservice platform with React', 'and Node.js',
            'Cut average API latency by 40% by redesigning slow MongoDB queries', 'and adding caching',
            'Mentored junior engineers through code reviews and weekly pairing', 'sessions',
        ].join('\n');
        const points = resumeFromText(text).experience[0].description.split('\n');
        assert.deepEqual(points, [
            'Led a team of 5 engineers building a microservice platform with React and Node.js',
            'Cut average API latency by 40% by redesigning slow MongoDB queries and adding caching',
            'Mentored junior engineers through code reviews and weekly pairing sessions',
        ]);
    });

    it('reads a typical Word-style resume', async () => {
        const { resumeFromText, sectionsFound, analyzeResume } = await client();
        const text = [
            'MOHAMMAD RAHMAN', 'Software Engineer', 'Dhaka, Bangladesh | rahman.dev@gmail.com | +880 1712-345678 | linkedin.com/in/mrahman',
            'PROFESSIONAL SUMMARY', 'Backend engineer with 4 years of experience building payment systems in Node.js and Go.',
            'WORK EXPERIENCE',
            'Pathao Ltd., Dhaka', 'Software Engineer   03/2021 - Present',
            '- Built a payments service handling 2M transactions a month',
            '- Reduced API response time by 35% by adding Redis caching',
            'Brain Station 23', 'Junior Developer | Jan 2019 – Feb 2021',
            '• Developed REST APIs in Node.js for 3 client projects',
            '• Wrote integration tests that cut production bugs by 20%',
            'EDUCATION', 'North South University', 'B.Sc. in Computer Science and Engineering, 2018',
            'TECHNICAL SKILLS', 'Languages: JavaScript, Python, Go', 'Tools: Docker, AWS, PostgreSQL, Redis',
        ].join('\n');
        const r = resumeFromText(text);
        assert.equal(r.personal.name, 'MOHAMMAD RAHMAN');
        assert.equal(r.personal.email, 'rahman.dev@gmail.com');
        assert.equal(r.personal.city, 'Dhaka, Bangladesh');
        assert.deepEqual(r.experience.map((e) => [e.title, e.company, e.startDate, e.endDate, e.description.split('\n').length]), [
            ['Software Engineer', 'Pathao Ltd., Dhaka', '03/2021', 'Present', 2],
            ['Junior Developer', 'Brain Station 23', 'Jan 2019', 'Feb 2021', 2],
        ]);
        assert.equal(r.education[0].degree, 'B.Sc. in Computer Science and Engineering');
        assert.equal(r.education[0].institution, 'North South University');
        assert.equal(r.education[0].endYear, '2018');
        assert.deepEqual(r.skills.split(', '), ['JavaScript', 'Python', 'Go', 'Docker', 'AWS', 'PostgreSQL', 'Redis']);
        const report = analyzeResume({ resume: r, pdfText: text, pageCount: 1, upload: { columns: false, images: 0, garbled: 0, sections: sectionsFound(text) } });
        const headings = report.categories[0].checks.find((c) => c.id === 'headings');
        assert.equal(headings.status, 'pass');
    });

    it('creative headings are flagged, as an ATS would miss those sections', async () => {
        const { resumeFromText, sectionsFound, analyzeResume } = await client();
        const text = [
            'Sam Lee', 'sam@lee.io · +44 7700 900123', "WHERE I'VE WORKED", 'Product Designer 2020 – 2023', 'Acme Studio',
            '• Designed the onboarding flow used by 40,000 new customers a month', '• Ran 25 user interviews that shaped the 2022 roadmap',
            'HOW I LEARNED', 'BA Graphic Design, University of Leeds, 2019', 'WHAT I KNOW', 'Figma, Sketch, prototyping, user research',
        ].join('\n');
        const report = analyzeResume({ resume: resumeFromText(text), pdfText: text, pageCount: 1, upload: { columns: false, images: 0, garbled: 0, sections: sectionsFound(text) } });
        const headings = report.categories[0].checks.find((c) => c.id === 'headings');
        assert.equal(headings.status, 'fail');
        assert.match(headings.detail, /experience, education, skills/);
    });

    it('columns, images and unreadable characters in the file are reported', async () => {
        const { resumeFromText, sectionsFound, analyzeResume } = await client();
        const { body } = await scan(fixture('sidebar.pdf'));
        const report = analyzeResume({ resume: resumeFromText(body.text), pdfText: body.text, pageCount: 1, upload: { ...body.layout, images: 1, garbled: 5, sections: sectionsFound(body.text) } });
        const byId = Object.fromEntries(report.categories[0].checks.map((c) => [c.id, c.status]));
        assert.equal(byId.layout, 'warn');
        assert.equal(byId.photo, 'warn');
        assert.equal(byId.fidelity, 'fail');
    });
});
