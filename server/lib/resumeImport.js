/**
 * Resume import, step 2: turn the AI's exact transcription of a resume into
 * the ResumeX format. This is plain code on purpose, so every field is
 * checked here instead of trusting the model to fit our format.
 */

// Invisible characters, private-use icon glyphs (e.g. Font Awesome) and emoji.
const JUNK = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uE000-\uF8FF]|\p{Extended_Pictographic}/gu;

const clean = (value) =>
    String(value ?? '')
        .replace(JUNK, '')
        .replace(/[ \t]+/g, ' ')
        .trim();

const cleanBullet = (value) => clean(value).replace(/^[•●▪■◦‣·\-–—*]\s*/, '');

const EMAIL = /[^\s@|,;<>()]+@[^\s@|,;<>()]+\.[a-z]{2,}/i;
const URL_TOKEN = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s|,;()<>]*)?/i;

const firstMatch = (text, re) => (clean(text).match(re) || [''])[0];
const bareUrl = (text) => firstMatch(text, URL_TOKEN).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

const lines = (bullets) => (Array.isArray(bullets) ? bullets : [bullets]).map(cleanBullet).filter(Boolean);

function mapContacts(contacts) {
    const personal = { email: '', phone: '', city: '', linkedin: '', github: '', website: '' };
    const websites = [];
    const links = [];
    for (const c of Array.isArray(contacts) ? contacts : []) {
        const value = clean(c?.value);
        if (!value) continue;
        const type = String(c?.type || '').toLowerCase();
        if (!personal.email && (type === 'email' || EMAIL.test(value)) && EMAIL.test(value)) personal.email = firstMatch(value, EMAIL);
        else if (!personal.linkedin && (type === 'linkedin' || /linkedin\.com/i.test(value))) personal.linkedin = bareUrl(value) || value;
        else if (type === 'phone' && !personal.phone) personal.phone = value.slice(0, 40);
        else if (type === 'location' && !personal.city) personal.city = value;
        else if (!personal.github && (type === 'github' || /github\.com/i.test(value)) && URL_TOKEN.test(value)) personal.github = bareUrl(value);
        else if (['website', 'portfolio', 'other', 'github'].includes(type) && URL_TOKEN.test(value)) websites.push(bareUrl(value));
    }
    // First site goes in Website; any others become extra links.
    personal.website = websites[0] || '';
    for (const url of websites.slice(1)) links.push({ label: '', url });
    return { personal, links };
}

const dateOf = (e) => ({ start: clean(e?.startDate), end: clean(e?.endDate) });

// "Name | React, Node.js [GitHub] [Live]" -> { name, technologies }
function splitProjectTitle(title) {
    const cleanTitle = clean(title).replace(/\[(github|live|demo|link|code|website)\]/gi, '').replace(/\s*\|\s*$/, '').trim();
    const [name, ...rest] = cleanTitle.split(/\s+\|\s+/);
    return { name: name.trim(), technologies: rest.join(', ').replace(/\s*\|\s*/g, ', ').trim() };
}

const GPA_LINE = /\b(c?gpa|cgpa|grade|result)\b\s*[:\-]?\s*/i;

function mapSections(sections) {
    const out = {
        experience: [], education: [], projects: [], certifications: [], skills: [], languages: [],
        volunteering: [], awards: [], publications: [], courses: [], references: [], interests: [], customSections: [],
    };
    for (const section of Array.isArray(sections) ? sections : []) {
        const kind = String(section?.kind || '').toLowerCase();
        const entries = (Array.isArray(section?.entries) ? section.entries : []).filter((e) => e && typeof e === 'object');
        const items = lines(section?.items || []);
        if (kind === 'experience') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.experience.push({ title: clean(e.title), company: clean(e.organization), location: clean(e.location), startDate: start, endDate: end, description: lines(e.bullets).join('\n') });
            }
        } else if (kind === 'education') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                const bullets = lines(e.bullets);
                const gpaLine = bullets.find((b) => GPA_LINE.test(b));
                out.education.push({
                    degree: clean(e.title), institution: clean(e.organization), location: clean(e.location), startYear: start, endYear: end,
                    gpa: gpaLine ? gpaLine.replace(GPA_LINE, '').trim() : '',
                    details: bullets.filter((b) => b !== gpaLine).join(' · '),
                });
            }
        } else if (kind === 'projects') {
            for (const e of entries) {
                const { name, technologies } = splitProjectTitle(e.title);
                const { start, end } = dateOf(e);
                out.projects.push({ name, technologies, link: bareUrl(e.link), startDate: start, endDate: end, description: lines(e.bullets).join('\n') });
            }
        } else if (kind === 'certifications') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.certifications.push({ name: clean(e.title), issuer: clean(e.organization), date: end || start, link: bareUrl(e.link) });
            }
            for (const item of items) out.certifications.push({ name: item, issuer: '', date: '' });
        } else if (kind === 'awards') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.awards.push({ title: clean(e.title), issuer: clean(e.organization), date: end || start, description: lines(e.bullets).join(' ') });
            }
            for (const item of items) out.awards.push({ title: item, issuer: '', date: '', description: '' });
        } else if (kind === 'volunteering') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.volunteering.push({ role: clean(e.title), organization: clean(e.organization), location: clean(e.location), startDate: start, endDate: end, description: lines(e.bullets).join('\n') });
            }
        } else if (kind === 'publications') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.publications.push({ title: clean(e.title), publisher: clean(e.organization), date: end || start, link: bareUrl(e.link), description: lines(e.bullets).join(' ') });
            }
        } else if (kind === 'courses') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.courses.push({ name: clean(e.title), institution: clean(e.organization), date: end || start });
            }
            for (const item of items) out.courses.push({ name: item, institution: '', date: '' });
        } else if (kind === 'references') {
            for (const e of entries) {
                const details = lines(e.bullets);
                const email = details.map((d) => firstMatch(d, EMAIL)).find(Boolean) || '';
                const phone = details.find((d) => /\d{5,}/.test(d.replace(/[\s()+-]/g, '')) && !EMAIL.test(d)) || '';
                const position = details.find((d) => d !== phone && !EMAIL.test(d)) || '';
                out.references.push({ name: clean(e.title), position, company: clean(e.organization), email, phone });
            }
        } else if (kind === 'interests') {
            out.interests.push(...items);
            for (const e of entries) out.interests.push(clean(e.title));
        } else if (kind === 'skills') {
            out.skills.push(...items);
            for (const e of entries) out.skills.push(...lines(e.bullets));
        } else if (kind === 'languages') {
            out.languages.push(...items);
            for (const e of entries) out.languages.push(clean(e.title));
        } else if (entries.length || items.length) {
            // Anything else keeps its own heading as a custom section.
            out.customSections.push({
                title: clean(section.heading),
                items: [
                    ...entries.map((e) => {
                        const { start, end } = dateOf(e);
                        return { title: clean(e.title), subtitle: clean(e.organization), date: [start, end].filter(Boolean).join(' – '), description: lines(e.bullets).join('\n') };
                    }),
                    ...(items.length ? [{ title: '', subtitle: '', date: '', description: items.join('\n') }] : []),
                ],
            });
        }
    }
    return out;
}

const unique = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

/** Maps the model's transcription (see TRANSCRIPT_SCHEMA) to the ResumeX resume shape. */
function toResume(transcript) {
    const t = transcript && typeof transcript === 'object' ? transcript : {};
    const { personal, links } = mapContacts(t.contacts);
    const s = mapSections(t.sections);
    return {
        personal: { name: clean(t.name), title: clean(t.headline), ...personal },
        links,
        summary: clean(t.summary),
        experience: s.experience,
        education: s.education,
        projects: s.projects,
        certifications: s.certifications,
        volunteering: s.volunteering,
        awards: s.awards,
        publications: s.publications,
        courses: s.courses,
        references: s.references,
        customSections: s.customSections,
        skills: unique(s.skills).join(', '),
        languages: unique(s.languages).join(', '),
        interests: unique(s.interests).join(', '),
    };
}

// Step 1: what we ask the model for — an exact, lossless copy of the resume.
const TRANSCRIPT_SCHEMA = {
    type: 'OBJECT',
    properties: {
        name: { type: 'STRING' },
        headline: { type: 'STRING', description: 'Job title or headline under the name, if any' },
        contacts: {
            type: 'ARRAY',
            description: 'Every contact item, one per entry',
            items: {
                type: 'OBJECT',
                properties: {
                    type: { type: 'STRING', enum: ['email', 'phone', 'location', 'linkedin', 'github', 'website', 'other'] },
                    value: { type: 'STRING' },
                },
                required: ['type', 'value'],
            },
        },
        summary: { type: 'STRING', description: 'Summary / objective / about paragraph, if any' },
        sections: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    heading: { type: 'STRING', description: 'Section heading exactly as written' },
                    kind: {
                        type: 'STRING',
                        enum: ['experience', 'education', 'projects', 'skills', 'certifications', 'awards', 'volunteering', 'publications', 'courses', 'references', 'languages', 'interests', 'other'],
                    },
                    entries: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                title: { type: 'STRING', description: 'Role, degree, project, award, publication, course or reference name' },
                                organization: { type: 'STRING', description: 'Company, school, issuer, publisher or organisation' },
                                location: { type: 'STRING' },
                                startDate: { type: 'STRING' },
                                endDate: { type: 'STRING', description: 'As written, e.g. "Present"' },
                                link: { type: 'STRING' },
                                bullets: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Each bullet point or line of description, verbatim (for references: position, email and phone as separate lines)' },
                            },
                            // Required so smaller models don't skip them; empty string when absent.
                            required: ['title', 'organization', 'location', 'startDate', 'endDate', 'link', 'bullets'],
                        },
                    },
                    items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'For list sections (skills, languages, interests): one item each, without group labels' },
                },
                required: ['heading', 'kind', 'entries', 'items'],
            },
        },
    },
    required: ['name', 'headline', 'contacts', 'summary', 'sections'],
};

const TRANSCRIBE_INSTRUCTION = `You transcribe resumes into JSON exactly as written.
- Copy text verbatim. Do not rewrite, shorten, summarize, translate or invent anything.
- Put each contact item (email, phone, location, LinkedIn, GitHub, website) in its own entry.
- Put each bullet point in its own array item, without the bullet symbol.
- Ignore icons, decorative symbols and page numbers.
- Fill every field of every entry: title, organization (company/school/issuer), location, start and end dates, link and all bullet points.
- Use an empty string or empty list only when the resume really doesn't have that detail.`;

module.exports = { toResume, TRANSCRIPT_SCHEMA, TRANSCRIBE_INSTRUCTION, clean };
