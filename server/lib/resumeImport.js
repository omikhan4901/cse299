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

function mapContacts(contacts = []) {
    const personal = { email: '', phone: '', city: '', linkedin: '', website: '' };
    const websites = [];
    for (const c of contacts) {
        const value = clean(c?.value);
        if (!value) continue;
        const type = String(c?.type || '').toLowerCase();
        if (!personal.email && (type === 'email' || EMAIL.test(value)) && EMAIL.test(value)) personal.email = firstMatch(value, EMAIL);
        else if (!personal.linkedin && (type === 'linkedin' || /linkedin\.com/i.test(value))) personal.linkedin = bareUrl(value) || value;
        else if (type === 'phone' && !personal.phone) personal.phone = value.slice(0, 40);
        else if (type === 'location' && !personal.city) personal.city = value;
        else if (['github', 'website', 'portfolio', 'other'].includes(type) && URL_TOKEN.test(value)) {
            websites.push({ url: bareUrl(value), github: type === 'github' || /github\.com/i.test(value) });
        }
    }
    // We have one website slot: prefer a personal site, otherwise GitHub.
    const site = websites.find((w) => !w.github) || websites[0];
    personal.website = site ? site.url : '';
    return personal;
}

const dateOf = (e) => ({ start: clean(e?.startDate), end: clean(e?.endDate) });

function mapSections(sections = []) {
    const out = { experience: [], education: [], projects: [], certifications: [], skills: [], languages: [] };
    for (const section of sections) {
        const kind = String(section?.kind || '').toLowerCase();
        const entries = Array.isArray(section?.entries) ? section.entries : [];
        const items = lines(section?.items || []);
        if (kind === 'experience') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.experience.push({ title: clean(e.title), company: clean(e.organization), location: clean(e.location), startDate: start, endDate: end, description: lines(e.bullets).join('\n') });
            }
        } else if (kind === 'education') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.education.push({ degree: clean(e.title), institution: clean(e.organization), startYear: start, endYear: end, details: lines(e.bullets).join(' · ') });
            }
        } else if (kind === 'projects') {
            for (const e of entries) {
                out.projects.push({ name: clean(e.title), link: bareUrl(e.link), description: lines(e.bullets).join('\n') });
            }
        } else if (kind === 'certifications' || kind === 'awards') {
            for (const e of entries) {
                const { start, end } = dateOf(e);
                out.certifications.push({ name: clean(e.title), issuer: clean(e.organization), date: end || start });
            }
            for (const item of items) out.certifications.push({ name: item, issuer: '', date: '' });
        } else if (kind === 'skills') {
            out.skills.push(...items);
            for (const e of entries) out.skills.push(...lines(e.bullets));
        } else if (kind === 'languages') {
            out.languages.push(...items);
        }
    }
    return out;
}

const unique = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

/** Maps the model's transcription (see TRANSCRIPT_SCHEMA) to the ResumeX resume shape. */
function toResume(t = {}) {
    const personal = mapContacts(t.contacts);
    const s = mapSections(t.sections);
    return {
        personal: { name: clean(t.name), title: clean(t.headline), ...personal },
        summary: clean(t.summary),
        experience: s.experience,
        education: s.education,
        projects: s.projects,
        certifications: s.certifications,
        skills: unique(s.skills).join(', '),
        languages: unique(s.languages).join(', '),
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
                    kind: { type: 'STRING', enum: ['experience', 'education', 'projects', 'skills', 'certifications', 'awards', 'languages', 'other'] },
                    entries: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                title: { type: 'STRING', description: 'Role, degree, project or certificate name' },
                                organization: { type: 'STRING', description: 'Company, school or issuer' },
                                location: { type: 'STRING' },
                                startDate: { type: 'STRING' },
                                endDate: { type: 'STRING', description: 'As written, e.g. "Present"' },
                                link: { type: 'STRING' },
                                bullets: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Each bullet point or line of description, verbatim' },
                            },
                            // Required so smaller models don't skip them; empty string when absent.
                            required: ['title', 'organization', 'location', 'startDate', 'endDate', 'link', 'bullets'],
                        },
                    },
                    items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'For list sections (skills, languages): one item per skill or language, without group labels' },
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
