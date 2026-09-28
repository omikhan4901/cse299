/**
 * Ingestion: turns whatever someone pastes or uploads into reviewable operations on their
 * resume (see client/src/lib/ingest/ops.js for the operation format and how they're
 * applied). The AI proposes; everything here is deterministic and decides what reaches
 * the review screen:
 *   - operations are validated against the resume's real sections and fields;
 *   - an "add" that matches something already there becomes a merge (only what's new);
 *   - points already present are dropped;
 *   - any number, name or organisation that isn't in the pasted text or the existing
 *     resume is flagged "unverified", so invented facts never slip in unnoticed.
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
const OPS = ['add', 'addBullets', 'update', 'set', 'addValues'];

// ---- What the model is asked for ----

const ALL_ITEM_FIELDS = [...new Set(Object.values(SECTION_FIELDS).flat())].filter((f) => !Object.values(POINTS_FIELD).includes(f));

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        operations: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    op: { type: 'STRING', enum: OPS },
                    section: { type: 'STRING', enum: Object.keys(SECTION_FIELDS) },
                    target: { type: 'STRING' },
                    field: { type: 'STRING' },
                    value: { type: 'STRING' },
                    item: { type: 'OBJECT', properties: Object.fromEntries(ALL_ITEM_FIELDS.map((f) => [f, { type: 'STRING' }])) },
                    bullets: { type: 'ARRAY', items: { type: 'STRING' } },
                    values: { type: 'ARRAY', items: { type: 'STRING' } },
                    evidence: { type: 'STRING' },
                },
                required: ['op', 'evidence'],
            },
        },
    },
    required: ['operations'],
};

const INSTRUCTION = `You turn what a person writes about their career into structured resume data.

You receive CURRENT RESUME (an outline of what they already have, with item ids) and INPUT (new text from them: a pasted CV, notes, a paragraph, or a follow-up message).
Return operations that add INPUT's information to the resume:
- "add": a new item in "section". Its fields go in "item", its achievement points in "bullets".
- "addBullets": new points for an item that already exists ("section" and "target" = its id).
- "update": new values for fields of an existing item ("section", "target", and the fields in "item"), e.g. an end date the person has just given.
- "set": a personal detail or the summary. "field" is one of: ${PERSONAL_FIELDS.map((f) => `personal.${f}`).join(', ')}, summary. "value" holds it.
- "addValues": "field" is skills, languages or interests; "values" lists them one by one.

Section fields:
${Object.entries(SECTION_FIELDS).map(([s, f]) => `- ${s}: ${f.filter((x) => x !== POINTS_FIELD[s]).join(', ')}${POINTS_FIELD[s] ? ' (+ bullets)' : ''}`).join('\n')}

Rules:
1. Use only information that is in INPUT. Never invent or estimate numbers, dates, employers, job titles, technologies, results or links. Leave a field out when INPUT doesn't state it.
2. If INPUT is about something already in CURRENT RESUME (the same employer, project, school or award, or phrases like "that project", "my job at X"), use its id with "addBullets" or "update". Never add a second copy.
3. Skip information already in CURRENT RESUME.
4. Keep the person's facts and wording. You may fix grammar and spelling, split a long sentence into separate points, start points with a strong verb and use past tense for finished work. Never add adjectives or claims they didn't make.
5. Dates: "Mon YYYY" (e.g. "Mar 2021"), just "YYYY" if only the year is known, or "Present". Education uses startYear and endYear (years only).
6. Sections: jobs, internships, part-time, tutoring and research-assistant positions go in experience; personal, academic and thesis projects in projects. Individual technologies, tools and methods go in skills; spoken languages (with level if given) in languages.
7. If INPUT is partly or fully in Bangla, write the resume text in English, keeping names as they are.
8. "evidence": copy the shortest exact phrase from INPUT that the operation is based on.
9. If INPUT has nothing for a resume, return an empty list.`;

/** The contents for the model: the outline and the new input. */
function prompt(outline, text) {
    return `CURRENT RESUME:\n${JSON.stringify(outline).slice(0, 30000)}\n\nINPUT:\n${text}`;
}

// ---- Deterministic checks ----

// Bangla digits (০–৯) count as the same numbers as 0–9: "২০২২" confirms "2022".
const asciiDigits = (s) => String(s || '').replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
const norm = (s) => asciiDigits(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);

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
        if (section === 'education') return similar(e.institution, item.institution) && (!item.degree || !e.degree || similar(e.degree, item.degree, 0.6));
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
    const parts = String(text).split(/\s+/);
    parts.forEach((w, i) => {
        const clean = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+#]+$/gu, '');
        if (clean.length < 2 || /^\d/.test(clean) || MONTH.test(clean) || COMMON.has(clean.toLowerCase())) return;
        const sentenceStart = i === 0 || /[.!?:;•\-–]$/.test(parts[i - 1] || '');
        const innerCap = /\p{Lu}/u.test(clean.slice(1));
        if (innerCap || (/^\p{Lu}/u.test(clean) && !sentenceStart)) tokens.add(clean.toLowerCase());
    });
    return [...tokens];
}

/** Every string an operation would put into the resume. */
function strings(o) {
    return [o.value, ...Object.values(o.item || {}), ...(o.bullets || []), ...(o.values || [])].filter((s) => typeof s === 'string' && s);
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
            o.item = {};
            for (const f of SECTION_FIELDS[raw.section]) if (f !== POINTS_FIELD[raw.section] && clean(raw.item?.[f])) o.item[f] = clean(raw.item[f], 200);
        }
        o.bullets = POINTS_FIELD[raw.section] ? (Array.isArray(raw.bullets) ? raw.bullets : []).map((b) => clean(b)).filter(Boolean).slice(0, 20) : [];
    } else if (raw.op === 'set') {
        const f = String(raw.field || '');
        if (f !== 'summary' && !(f.startsWith('personal.') && PERSONAL_FIELDS.includes(f.slice(9)))) return null;
        o.field = f;
        o.value = clean(raw.value, f === 'summary' ? 1500 : 200);
        if (!o.value) return null;
    } else if (raw.op === 'addValues') {
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
function checkOperations(rawOps, { source, outline = {} }) {
    const corpus = norm(`${source} ${JSON.stringify(outline)}`);
    const corpusDigits = asciiDigits(`${source} ${JSON.stringify(outline)}`).replace(/,/g, '');
    // Numbers must appear as whole numbers ("20" isn't confirmed by "2020").
    const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const known = (t) => (/^\d/.test(t) ? new RegExp(`(^|[^\\d.])${escape(t)}(?![\\d]|\\.\\d)`).test(corpusDigits) : corpus.includes(norm(t)));
    const out = [];
    let skipped = 0;
    const listOf = (section) => (Array.isArray(outline[section]) ? outline[section] : []);
    const addedIn = (section) => out.filter((o) => o.op === 'add' && o.section === section);

    for (const raw of Array.isArray(rawOps) ? rawOps : []) {
        let o = sanitize(raw);
        if (!o) continue;

        if (o.op === 'add') {
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
            const current = o.field === 'summary' ? outline.summary : outline.personal?.[o.field.slice(9)];
            if (norm(current) === norm(o.value)) {
                skipped++;
                continue;
            }
            if (current) o.flags = [...(o.flags || []), { kind: 'replaces', fields: [o.field] }];
        } else if (o.op === 'addValues') {
            const have = new Set(String(outline[o.field] || '').split(',').map((v) => norm(v)).filter(Boolean));
            o.values = o.values.filter((v) => !have.has(norm(v)));
            if (!o.values.length) {
                skipped++;
                continue;
            }
        }

        // Anything factual that isn't in what the person wrote (or already had) is flagged.
        const unverified = [...new Set(strings(o).flatMap(factTokens))].filter((t) => !known(t));
        const unlisted = o.op === 'addValues' ? o.values.filter((v) => !corpus.includes(norm(v))) : [];
        const missing = [...new Set([...unverified, ...unlisted.map((v) => v.toLowerCase())])];
        if (missing.length) o.flags = [...(o.flags || []), { kind: 'unverified', tokens: missing }];
        out.push(o);
    }
    out.forEach((o, i) => (o.key = `op${i + 1}`));
    return { operations: out, skipped };
}

module.exports = { INSTRUCTION, RESPONSE_SCHEMA, prompt, checkOperations, factTokens, similar, SECTION_FIELDS, POINTS_FIELD };
