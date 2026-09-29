/**
 * Ingestion: turns whatever someone pastes or uploads into reviewable operations on their
 * resume (see client/src/lib/ingest/ops.js for the operation format and how they're
 * applied). The AI proposes; everything here is deterministic and decides what reaches
 * the review screen:
 *   - operations are validated against the resume's real sections and fields;
 *   - an "add" that matches something already there becomes a merge (only what's new);
 *   - points already present are dropped;
 *   - any number, name or organisation that isn't in the pasted text or the existing
 *     resume is flagged "unverified", so invented facts never slip in unnoticed;
 *   - removals ("remove", "clear", "removeValues") only survive when the person's own words
 *     ask for them (their evidence must be in what the person typed, not in a pasted CV or
 *     file), and are listed first so they apply before anything is added.
 */

// The fields of each section (kept in step with EMPTY_ITEMS in client/src/lib/resume.js;
// a test checks they match).
const SECTION_FIELDS = {
    experience: ['company', 'title', 'employmentType', 'location', 'startDate', 'endDate', 'description'],
    education: ['institution', 'degree', 'location', 'startYear', 'endYear', 'gpa', 'details'],
    projects: ['name', 'role', 'link', 'startDate', 'endDate', 'technologies', 'description'],
    certifications: ['name', 'issuer', 'date', 'link'],
    volunteering: ['role', 'organization', 'location', 'startDate', 'endDate', 'description'],
    awards: ['title', 'issuer', 'date', 'description'],
    publications: ['title', 'publisher', 'date', 'link', 'description'],
    courses: ['name', 'institution', 'date'],
    references: ['name', 'position', 'company', 'email', 'phone'],
    links: ['label', 'url'],
};
const POINTS_FIELD = { experience: 'description', projects: 'description', volunteering: 'description', awards: 'description', publications: 'description', education: 'details' };
const PERSONAL_FIELDS = ['name', 'title', 'email', 'phone', 'city', 'linkedin', 'github', 'website'];
const LIST_FIELDS = ['skills', 'languages', 'interests'];
const OPS = ['add', 'addBullets', 'update', 'set', 'addValues', 'remove', 'clear', 'removeValues'];
const REMOVALS = new Set(['remove', 'clear', 'removeValues']);
// What "clear" can empty: a section, the summary, a list, or "everything" (all of them).
const CLEARABLE = [...Object.keys(SECTION_FIELDS), 'summary', ...LIST_FIELDS];

// ---- What the model is asked for ----

const ALL_ITEM_FIELDS = [...new Set(Object.values(SECTION_FIELDS).flat())].filter((f) => !Object.values(POINTS_FIELD).includes(f));

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        operations: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                // Item fields sit directly on the operation: models fill flat fields far more
                // reliably than a nested object of optional ones.
                properties: {
                    evidence: { type: 'STRING' },
                    op: { type: 'STRING', enum: OPS },
                    section: { type: 'STRING', enum: Object.keys(SECTION_FIELDS) },
                    target: { type: 'STRING' },
                    field: { type: 'STRING' },
                    value: { type: 'STRING' },
                    ...Object.fromEntries(ALL_ITEM_FIELDS.map((f) => [f, { type: 'STRING' }])),
                    bullets: { type: 'ARRAY', items: { type: 'STRING' } },
                    values: { type: 'ARRAY', items: { type: 'STRING' } },
                },
                propertyOrdering: ['evidence', 'op', 'section', 'target', 'field', 'value', ...ALL_ITEM_FIELDS, 'bullets', 'values'],
                required: ['op', 'evidence'],
            },
        },
    },
    required: ['operations'],
};

const INSTRUCTION = `You turn what a person writes about their career into structured resume data.

You receive CURRENT RESUME (an outline of what they already have, with item ids) and INPUT (new text from them: a pasted CV, notes, a paragraph, or a follow-up message).
Return operations that change the resume:
- "add": a new item in "section". Put its fields (company, title, startDate, …) directly on the operation, and its achievement points in "bullets".
- "addBullets": new points for an item that already exists ("section" and "target" = its id).
- "update": new values for fields of an existing item ("section", "target", and the changed fields directly on the operation), e.g. an end date the person has just given.
- "set": a personal detail or the summary. "field" is one of: ${PERSONAL_FIELDS.map((f) => `personal.${f}`).join(', ')}, summary. "value" holds it.
- "addValues": "field" is skills, languages or interests; "values" lists them one by one.
- "remove": delete one existing item ("section" and "target" = its id).
- "clear": empty a whole part. "field" is a section (${Object.keys(SECTION_FIELDS).join(', ')}), summary, skills, languages or interests, or "everything" for the whole resume.
- "removeValues": "field" is skills, languages or interests; "values" lists the ones to take out.

Section fields:
${Object.entries(SECTION_FIELDS).map(([s, f]) => `- ${s}: ${f.filter((x) => x !== POINTS_FIELD[s]).join(', ')}${POINTS_FIELD[s] ? ' (+ bullets)' : ''}`).join('\n')}

Rules:
1. Use only information that is in INPUT. Never invent or estimate numbers, dates, employers, job titles, technologies, results or links. Leave a field out when INPUT doesn't state it. Don't work dates out from a duration ("for 2 years", "6 months"): leave those dates out.
2. If INPUT is about something already in CURRENT RESUME (the same employer, project, school or award, or phrases like "that project", "my job at X"), use its id with "addBullets" or "update". Never add a second copy.
3. Skip information already in CURRENT RESUME.
4. Keep the person's facts and wording. You may fix grammar and spelling, split a long sentence into separate points, start points with a strong verb and use past tense for finished work. Never add adjectives or claims they didn't make.
5. Dates: "Mon YYYY" (e.g. "Mar 2021"), just "YYYY" if only the year or a season is known, or "Present". Education uses startYear and endYear (years only).
6. Sections: jobs, internships, part-time, tutoring, teaching and research-assistant positions go in experience (always with "company" = the employer or institution, and "title"); personal, academic and thesis projects in projects; each degree is its own education item. Publications take the venue as "publisher" and the year as "date". Volunteering takes the person's "role" when INPUT gives it. Keep award, course and certificate names as written; a count such as "3 times" goes in the description.
7. Skills: every technology, programming language, tool and method named anywhere in INPUT (in a job, a project or a point) also goes in one "addValues" for skills, written the usual way (e.g. "Node.js"). Spoken languages (with level if given) go in languages.
8. If INPUT is partly or fully in Bangla, write the resume text in English, keeping names as they are.
9. "evidence": copy the shortest exact phrase from INPUT that the operation is based on.
10. When INPUT describes the person as a whole (who they are, their experience, what they want next), also "set" the summary from it, without "I".
11. If INPUT has nothing for a resume, return an empty list.
12. Remove only when the person asks for it: "remove my job at X", "delete the projects", "cancel the whole experience part", "take Java out of my skills". Use "remove" for one item, "clear" for a whole part, "removeValues" for list values.
13. When the person says the new content replaces what they have ("this is my previous resume", "my latest CV, use this instead", "start over with this", "I don't want the current stuff"), "clear" "everything" and then "add" INPUT's content as new items (and "set" the personal details and summary it gives).
14. Never remove anything just because INPUT doesn't mention it. For every removal, "evidence" must copy the person's own words that ask for it (from NOTE when there is one).`;

/**
 * The contents for the model: the outline, the new input and, when a file came with a
 * message, that message on its own (so "this is my old CV" reads as an instruction).
 */
function prompt(outline, text, note = '') {
    return `CURRENT RESUME:\n${JSON.stringify(outline).slice(0, 30000)}\n\nINPUT:\n${text}${note ? `\n\nNOTE (what the person wrote with the file):\n${note}` : ''}`;
}

// ---- Deterministic checks ----

// Bangla digits (০–৯) count as the same numbers as 0–9: "২০২২" confirms "2022".
const asciiDigits = (s) => String(s || '').replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
const norm = (s) => asciiDigits(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim();
const FILLER = new Set(['in', 'of', 'the', 'and', 'at', 'on', 'for', 'a', 'an']);
const words = (s) => norm(s).split(' ').filter((w) => w && !FILLER.has(w));
// Degree levels: "BA in English" and "MA in English" are different degrees.
const LEVELS = new Set(['ssc', 'hsc', 'o', 'a', 'ba', 'bs', 'bsc', 'bss', 'bba', 'bcom', 'beng', 'llb', 'mbbs', 'ma', 'ms', 'msc', 'mss', 'mba', 'mcom', 'meng', 'llm', 'mphil', 'phd', 'diploma']);
const levelOf = (degree) => norm(String(degree || '').replace(/\./g, '')).split(' ').find((w) => LEVELS.has(w));

/** True when the shorter text's words are (almost) all in the other: "Pathao" ≈ "Pathao Ltd.". */
function similar(a, b, threshold = 0.8) {
    const A = new Set(words(a));
    const B = new Set(words(b));
    if (!A.size || !B.size) return false;
    const shared = [...A].filter((w) => B.has(w)).length;
    return shared / Math.min(A.size, B.size) >= threshold;
}

/** The existing item that an added item is really about, if any. */
function findSame(section, item, list) {
    return list.find((e) => {
        if (section === 'experience') return similar(e.company, item.company) && (!item.title || !e.title || similar(e.title, item.title, 0.6));
        if (section === 'education') {
            if (!similar(e.institution, item.institution)) return false;
            if (!item.degree || !e.degree) return true;
            const [a, b] = [levelOf(e.degree), levelOf(item.degree)];
            return a && b ? a === b : similar(e.degree, item.degree, 0.6);
        }
        if (section === 'volunteering') return similar(e.organization, item.organization);
        if (section === 'links') return similar(e.url || e.label, item.url || item.label);
        if (section === 'references') return similar(e.name, item.name);
        const key = (x) => x.name || x.title;
        return similar(key(e), key(item));
    });
}

const pointsOf = (item, section) => {
    const text = item?.[POINTS_FIELD[section]] || '';
    return Array.isArray(item?.points) ? item.points : String(text).split('\n').map((l) => l.replace(/^\s*[•\-–*]\s*/, '').trim()).filter(Boolean);
};
const newPoints = (bullets, existing) => {
    const kept = [];
    for (const b of bullets) if (![...existing, ...kept].some((e) => similar(e, b, 0.85))) kept.push(b);
    return kept;
};

// The usual way of writing a tool, and the shorthand people use for it: "sklearn" confirms "scikit-learn".
const ALIASES = {
    'scikit-learn': ['sklearn', 'scikit'],
    javascript: ['js'],
    typescript: ['ts'],
    'node.js': ['node', 'nodejs'],
    nodejs: ['node'],
    react: ['reactjs', 'react js'],
    'react.js': ['react', 'reactjs'],
    'vue.js': ['vue'],
    'next.js': ['next', 'nextjs'],
    'express.js': ['express'],
    postgresql: ['postgres'],
    mongodb: ['mongo'],
    kubernetes: ['k8s'],
    'c#': ['csharp'],
    tensorflow: ['tf'],
    'power bi': ['powerbi'],
    'microsoft excel': ['excel', 'ms excel'],
    'machine learning': ['ml'],
    bangla: ['bengali', 'বাংলা'],
    bengali: ['bangla'],
    english: ['ইংরেজি'],
};

// Abbreviations people use for degrees, subjects and universities, and what they stand for:
// writing "CSE" out in full isn't inventing anything, so the words of the expansion count as
// confirmed when the abbreviation is in the text. (Not ambiguous words like "me" or "ce".)
const ABBREVIATIONS = {
    cse: 'computer science and engineering',
    cs: 'computer science',
    eee: 'electrical and electronic engineering electronics',
    ece: 'electrical electronics and computer communication engineering',
    ete: 'electronics and telecommunication engineering',
    ipe: 'industrial and production engineering',
    it: 'information technology',
    ict: 'information and communication technology',
    bba: 'bachelor of business administration',
    mba: 'master of business administration',
    bsc: 'bachelor of science',
    msc: 'master of science',
    ba: 'bachelor of arts',
    ma: 'master of arts',
    bss: 'bachelor of social science',
    mss: 'master of social science',
    llb: 'bachelor of laws',
    llm: 'master of laws',
    mbbs: 'bachelor of medicine and bachelor of surgery',
    bpharm: 'bachelor of pharmacy',
    phd: 'doctor of philosophy',
    ssc: 'secondary school certificate',
    hsc: 'higher secondary certificate',
    buet: 'bangladesh university of engineering and technology',
    du: 'dhaka university of dhaka',
    nsu: 'north south university',
    bracu: 'brac university',
    iub: 'independent university bangladesh',
    aiub: 'american international university bangladesh',
    ewu: 'east west university',
    ruet: 'rajshahi university of engineering and technology',
    kuet: 'khulna university of engineering and technology',
    cuet: 'chittagong chattogram university of engineering and technology',
    sust: 'shahjalal university of science and technology',
    ai: 'artificial intelligence',
    ml: 'machine learning',
    hr: 'human resources',
    ui: 'user interface',
    ux: 'user experience',
};

/** A rough stem, so "teaching" confirms "Teacher" and "management" confirms "Manager". */
function stem(word) {
    let w = String(word).toLowerCase();
    for (const suffix of ['ations', 'ation', 'ments', 'ment', 'ings', 'ing', 'ers', 'er', 'ors', 'or', 'ies', 'ied', 'ed', 'es', 's']) {
        if (w.endsWith(suffix) && w.length - suffix.length >= 4) {
            w = w.slice(0, -suffix.length);
            break;
        }
    }
    return w.length > 4 && w.endsWith('e') ? w.slice(0, -1) : w;
}

const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?$/i;
const COMMON = new Set(['present', 'i', 'bsc', 'msc', 'ba', 'ma', 'phd', 'ceo', 'cto', 'hr', 'it', 'ai', 'ui', 'ux']);

/**
 * The facts in a piece of text that must come from the person: numbers, and names
 * (capitalised words that aren't just starting a sentence, and words like GitHub or AWS).
 */
function factTokens(text) {
    const tokens = new Set();
    for (const m of String(text).matchAll(/\d[\d.,]*/g)) {
        const n = m[0].replace(/[.,]+$/, '').replace(/,/g, '');
        if (n) tokens.add(n);
    }
    // Each line starts a sentence too (points are one per line).
    for (const line of String(text).split('\n')) {
        const parts = line.trim().split(/\s+/);
        parts.forEach((w, i) => {
            const clean = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+#]+$/gu, '');
            if (clean.length < 2 || /^\d/.test(clean) || MONTH.test(clean) || COMMON.has(clean.toLowerCase())) return;
            const sentenceStart = i === 0 || /[.!?:;•\-–]$/.test(parts[i - 1] || '');
            const innerCap = /\p{Lu}/u.test(clean.slice(1));
            if (innerCap || (/^\p{Lu}/u.test(clean) && !sentenceStart)) tokens.add(clean.toLowerCase());
        });
    }
    return [...tokens];
}

/** Every string an operation would put into the resume. */
function strings(o) {
    return [o.value, ...Object.values(o.item || {}), ...(o.bullets || []), ...(o.values || [])].filter((s) => typeof s === 'string' && s);
}

const DATE_FIELDS = new Set(['startDate', 'endDate', 'date', 'startYear', 'endYear']);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "March 2021" → "Mar 2021"; "Summer 2023" → "2023" (not a month); years only for education. */
function cleanDate(v, field) {
    const s = asciiDigits(v).trim();
    if (/^(present|current|now|ongoing)$/i.test(s)) return field.endsWith('Year') || field === 'endDate' ? 'Present' : s;
    const year = s.match(/\b(19|20)\d{2}\b/)?.[0];
    if (field.endsWith('Year')) return year || s;
    const month = s.match(/^([a-z]{3})[a-z]*\.?,?\s+(19|20)\d{2}$/i);
    if (month) return MONTHS.includes(month[1].toLowerCase()) ? `${month[1][0].toUpperCase()}${month[1].slice(1, 3).toLowerCase()} ${year}` : year;
    return s;
}

const clean = (v, max = 400) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Keeps only what the resume model allows. Returns null for an unusable operation. */
function sanitize(raw) {
    if (!raw || !OPS.includes(raw.op)) return null;
    const o = { op: raw.op, evidence: clean(raw.evidence, 300) };
    if (['add', 'addBullets', 'update'].includes(raw.op)) {
        if (!SECTION_FIELDS[raw.section]) return null;
        o.section = raw.section;
        if (raw.op !== 'add') {
            if (raw.target == null || raw.target === '') return null;
            o.target = String(raw.target);
        }
        if (raw.op !== 'addBullets') {
            // Fields come flat on the operation (the schema), or nested in "item".
            const from = raw.item && typeof raw.item === 'object' ? { ...raw, ...raw.item } : raw;
            o.item = {};
            for (const f of SECTION_FIELDS[raw.section]) if (f !== POINTS_FIELD[raw.section] && clean(from[f])) o.item[f] = DATE_FIELDS.has(f) ? cleanDate(clean(from[f], 40), f) : clean(from[f], 200);
        }
        o.bullets = POINTS_FIELD[raw.section] ? (Array.isArray(raw.bullets) ? raw.bullets : []).map((b) => clean(b)).filter(Boolean).slice(0, 20) : [];
        if (raw.op === 'add' && !Object.keys(o.item).length && !o.bullets.length) return null; // nothing to add
    } else if (raw.op === 'set') {
        const f = String(raw.field || '');
        if (f !== 'summary' && !(f.startsWith('personal.') && PERSONAL_FIELDS.includes(f.slice(9)))) return null;
        o.field = f;
        o.value = clean(raw.value, f === 'summary' ? 1500 : 200);
        if (!o.value) return null;
    } else if (raw.op === 'remove') {
        if (!SECTION_FIELDS[raw.section] || raw.target == null || raw.target === '') return null;
        o.section = raw.section;
        o.target = String(raw.target);
    } else if (raw.op === 'clear') {
        const f = String(raw.field || raw.section || '');
        if (f !== 'everything' && !CLEARABLE.includes(f)) return null;
        o.field = f;
    } else if (raw.op === 'removeValues' || raw.op === 'addValues') {
        if (!LIST_FIELDS.includes(raw.field)) return null;
        o.field = raw.field;
        o.values = [...new Set((Array.isArray(raw.values) ? raw.values : []).map((v) => clean(v, 60)).filter(Boolean))].slice(0, 60);
        if (!o.values.length) return null;
    }
    return o;
}

/**
 * Turns the model's operations into the ones the person reviews.
 * `outline` is the resume outline sent with the request (ids, fields, first points).
 * Returns { operations, skipped } (skipped = things that were already in the resume).
 */
/**
 * Checks against what the person wrote: inCorpus(phrase) for names and skills (aliases
 * allowed), known(token) for fact tokens (numbers must appear whole: "20" isn't confirmed
 * by "2020").
 */
function checker(text) {
    const corpus = norm(text);
    const corpusDigits = asciiDigits(text).replace(/,/g, '');
    const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inCorpus = (t) => corpus.includes(norm(t)) || (ALIASES[t.toLowerCase()] || []).some((a) => new RegExp(`(^| )${escape(norm(a))}( |$)`).test(corpus));
    const words = new Set(corpus.split(' '));
    // Words that abbreviations in the text stand for, and the stems of every word in it.
    const expanded = new Set([...words].flatMap((w) => (ABBREVIATIONS[w] ? ABBREVIATIONS[w].split(' ') : [])));
    const stems = new Set([...words].filter((w) => w.length >= 4 && /^\p{L}+$/u.test(w)).map(stem));
    const wordKnown = (t) => {
        const w = norm(t);
        if (!w || w.includes(' ')) return false;
        return expanded.has(w) || (w.length >= 5 && /^\p{L}+$/u.test(w) && stems.has(stem(w)));
    };
    const known = (t) => (/^\d/.test(t) ? new RegExp(`(^|[^\\d.])${escape(t)}(?![\\d]|\\.\\d)`).test(corpusDigits) : inCorpus(t) || wordKnown(t));
    return { corpus, inCorpus, known };
}

/** True when a part of the resume outline has something in it. */
const filled = (outline, f) => (f === 'summary' || LIST_FIELDS.includes(f) ? !!String(outline[f] || '').trim() : Array.isArray(outline[f]) && outline[f].length > 0);

/**
 * The removals the person really asked for: each must quote their own words (`asked`: what
 * they typed, never a pasted CV or file) and point at something that exists. "everything"
 * becomes one "clear" per filled part. Returns { removals, cleared, removedIds }.
 */
function checkRemovals(rawOps, outline, asked) {
    const removals = [];
    const cleared = new Set();
    const removedIds = new Set();
    // The quoted words must be theirs: (nearly) every word of the evidence is in what they typed.
    const theirs = new Set(words(asked));
    const saidIt = (evidence) => {
        const ev = words(evidence);
        return ev.length > 0 && (norm(asked).includes(norm(evidence)) || ev.filter((w) => theirs.has(w)).length / ev.length >= 0.8);
    };
    const listOf = (section) => (Array.isArray(outline[section]) ? outline[section] : []);
    for (const raw of Array.isArray(rawOps) ? rawOps : []) {
        if (!REMOVALS.has(raw?.op)) continue;
        const o = sanitize(raw);
        if (!o || !saidIt(o.evidence)) continue;
        if (o.op === 'clear') {
            // "everything" stays one change (one card), listing the parts it empties.
            const fields = (o.field === 'everything' ? CLEARABLE : [o.field]).filter((f) => !cleared.has(f) && filled(outline, f));
            if (!fields.length) continue;
            fields.forEach((f) => cleared.add(f));
            removals.push(o.field === 'everything' ? { op: 'clear', field: 'everything', fields, evidence: o.evidence, flags: [{ kind: 'removes' }] } : { op: 'clear', field: fields[0], evidence: o.evidence, flags: [{ kind: 'removes' }] });
        } else if (o.op === 'remove') {
            if (!listOf(o.section).some((e) => String(e.id) === o.target) || removedIds.has(`${o.section}:${o.target}`)) continue;
            removedIds.add(`${o.section}:${o.target}`);
            removals.push({ ...o, flags: [{ kind: 'removes' }] });
        } else if (o.op === 'removeValues') {
            const have = String(outline[o.field] || '').split(',').map((v) => v.trim()).filter(Boolean);
            o.values = have.filter((h) => o.values.some((v) => norm(v) === norm(h)));
            if (o.values.length) removals.push({ ...o, flags: [{ kind: 'removes' }] });
        }
    }
    // Clearing a part makes removing single items or values from it pointless.
    const kept = removals.filter((o) => o.op === 'clear' || !cleared.has(o.section || o.field));
    return { removals: kept, cleared, removedIds };
}

function checkOperations(rawOps, { source, outline = {}, asked = '' }) {
    const { corpus, inCorpus, known } = checker(`${source} ${JSON.stringify(outline)}`);
    const { removals, cleared, removedIds } = checkRemovals(rawOps, outline, asked);
    const out = [];
    let skipped = 0;
    // What's left of each part once the removals apply: new items can't merge into removed ones.
    const listOf = (section) => (cleared.has(section) || !Array.isArray(outline[section]) ? [] : outline[section].filter((e) => !removedIds.has(`${section}:${e.id}`)));
    const addedIn = (section) => out.filter((o) => o.op === 'add' && o.section === section);

    for (const raw of Array.isArray(rawOps) ? rawOps : []) {
        if (REMOVALS.has(raw?.op)) continue; // handled above
        let o = sanitize(raw);
        if (!o) continue;

        if (o.op === 'add') {
            // A dated entry (publication, award, course…) without its year: take the year from
            // the evidence when that is really in the text and names exactly one year.
            if (SECTION_FIELDS[o.section].includes('date') && !o.item.date && o.evidence && corpus.includes(norm(o.evidence))) {
                const years = [...new Set(asciiDigits(o.evidence).match(/\b(19|20)\d{2}\b/g) || [])];
                if (years.length === 1) o.item.date = years[0];
            }
            // Already in this batch: fold into that operation.
            const twin = addedIn(o.section).find((a) => findSame(o.section, o.item, [a.item]));
            if (twin) {
                twin.item = { ...o.item, ...twin.item };
                twin.bullets = [...twin.bullets, ...newPoints(o.bullets, twin.bullets)];
                continue;
            }
            // Already in the resume: keep only what's new about it.
            const same = findSame(o.section, o.item, listOf(o.section));
            if (same) {
                const fresh = Object.fromEntries(Object.entries(o.item).filter(([f, v]) => !same[f] && v));
                const points = newPoints(o.bullets, pointsOf(same, o.section));
                if (!Object.keys(fresh).length && !points.length) {
                    skipped++;
                    continue;
                }
                o = { ...o, op: Object.keys(fresh).length ? 'update' : 'addBullets', target: String(same.id), item: fresh, bullets: points };
            }
        }

        if (o.op === 'update' || o.op === 'addBullets') {
            const target = listOf(o.section).find((e) => String(e.id) === o.target);
            if (!target) continue; // an id that isn't in the resume
            o.bullets = newPoints(o.bullets, pointsOf(target, o.section));
            if (o.op === 'update') {
                o.item = Object.fromEntries(Object.entries(o.item || {}).filter(([f, v]) => norm(target[f]) !== norm(v)));
                const replaced = Object.keys(o.item).filter((f) => target[f]);
                if (replaced.length) o.flags = [...(o.flags || []), { kind: 'replaces', fields: replaced }];
            }
            if (!Object.keys(o.item || {}).length && !o.bullets.length) {
                skipped++;
                continue;
            }
            if (!Object.keys(o.item || {}).length) {
                o.op = 'addBullets';
                delete o.item;
            }
        } else if (o.op === 'set') {
            const current = o.field === 'summary' ? (cleared.has('summary') ? '' : outline.summary) : outline.personal?.[o.field.slice(9)];
            if (norm(current) === norm(o.value)) {
                skipped++;
                continue;
            }
            if (current) o.flags = [...(o.flags || []), { kind: 'replaces', fields: [o.field] }];
        } else if (o.op === 'addValues') {
            const have = new Set(cleared.has(o.field) ? [] : String(outline[o.field] || '').split(',').map((v) => norm(v)).filter(Boolean));
            o.values = o.values.filter((v) => !have.has(norm(v)));
            if (!o.values.length) {
                skipped++;
                continue;
            }
        }

        // Anything factual that isn't in what the person wrote (or already had) is flagged.
        const unverified = [...new Set(strings(o).flatMap(factTokens))].filter((t) => !known(t));
        const unlisted = o.op === 'addValues' ? o.values.filter((v) => !inCorpus(v)) : [];
        const missing = [...new Set([...unverified, ...unlisted.map((v) => v.toLowerCase())])];
        if (missing.length) o.flags = [...(o.flags || []), { kind: 'unverified', tokens: missing }];
        out.push(o);
    }
    // Deterministic tidy-ups the model sometimes misses (nothing here is new information):
    // "since 2018" / "currently" with no end date means it's still going on,
    for (const o of out) {
        if (o.op !== 'add' || !['experience', 'volunteering'].includes(o.section) || !o.item.startDate || o.item.endDate) continue;
        if (/\b(since|currently|present|ongoing|till now|to date)\b|এখনও|থেকে এখন/i.test(o.evidence || '')) o.item.endDate = 'Present';
    }
    // and technologies named on a project or job belong in skills too (rule 7).
    const listed = new Set(cleared.has('skills') ? [] : String(outline.skills || '').split(',').map((v) => norm(v)).filter(Boolean));
    let skillsOp = out.find((o) => o.op === 'addValues' && o.field === 'skills');
    for (const v of skillsOp?.values || []) listed.add(norm(v));
    const tech = out
        .filter((o) => (o.op === 'add' || o.op === 'update') && o.item?.technologies)
        .flatMap((o) => String(o.item.technologies).split(',').map((t) => t.trim()).filter(Boolean))
        .filter((t) => t.length <= 40 && inCorpus(t) && !listed.has(norm(t)) && (listed.add(norm(t)), true));
    if (tech.length) {
        if (!skillsOp) out.push((skillsOp = { op: 'addValues', field: 'skills', values: [], evidence: tech.join(', ') }));
        skillsOp.values = [...skillsOp.values, ...tech];
    }
    // A new summary replaces the old one anyway: no separate "clear summary".
    const all = [...removals.filter((r) => !(r.op === 'clear' && r.field === 'summary' && out.some((o) => o.op === 'set' && o.field === 'summary'))), ...out];
    // Clearing a single part that "everything" already covers is left out.
    const everything = all.find((o) => o.op === 'clear' && o.field === 'everything');
    if (everything) for (let i = all.length - 1; i >= 0; i--) if (all[i].op === 'clear' && all[i] !== everything && everything.fields.includes(all[i].field)) all.splice(i, 1);
    all.forEach((o, i) => (o.key = `op${i + 1}`));
    return { operations: all, skipped };
}

module.exports = { ABBREVIATIONS, stem, checker, INSTRUCTION, RESPONSE_SCHEMA, prompt, checkOperations, factTokens, similar, SECTION_FIELDS, POINTS_FIELD };
