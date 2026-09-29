/**
 * Scores one import against its expectation (docs/v2/SPEC.md §12).
 *   corrections: what a person would have to fix by hand: each wrong or missing field,
 *                missing point, missing skill, and each extra or duplicate item.
 *   invented:    facts that reached the resume without being in the input or the old
 *                resume (only operations without an "unverified" flag are applied).
 */
const { factTokens, checker, ABBREVIATIONS } = require('../../lib/ingest');

const STOP = new Set('a an the and or of in on at to for with by from as is was were be been my i me we our this that it its their using used into over per each via w'.split(' '));
const asciiDigits = (s) => String(s || '').replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
const norm = (s) => asciiDigits(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim();
// "CSE" and "Computer Science and Engineering" are the same degree: abbreviations count as their words too.
const content = (s) => norm(s).split(' ').flatMap((w) => (ABBREVIATIONS[w] ? [w, ...ABBREVIATIONS[w].split(' ')] : [w])).filter((w) => w && !STOP.has(w));

/** Share of `expected`'s content words found in `actual` (stems loosely: "dashboards" ~ "dashboard"). */
function coverage(expected, actual) {
    const want = content(expected);
    if (!want.length) return 1;
    const have = content(actual);
    const hit = (w) => have.some((h) => h === w || (w.length > 3 && (h.startsWith(w.slice(0, -1)) || w.startsWith(h.slice(0, -1)))));
    return want.filter(hit).length / want.length;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** "Mar 2021", "March 2021", "03/2021", "2021", "Present" → comparable keys. */
function dateKey(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return null;
    if (/^(present|current|now|ongoing)$/.test(s)) return { present: true };
    let m = s.match(/([a-z]{3})[a-z]*\.?,?\s+(\d{4})/);
    if (m && MONTHS[m[1]]) return { year: +m[2], month: MONTHS[m[1]] };
    m = s.match(/(\d{1,2})[/.-](\d{4})/);
    if (m) return { year: +m[2], month: +m[1] };
    m = s.match(/(\d{4})/);
    return m ? { year: +m[1] } : { text: s };
}
function sameDate(expected, actual) {
    const e = dateKey(expected);
    const a = dateKey(actual);
    if (!a) return false;
    if (e.present) return !!a.present;
    if (e.text) return a.text === e.text;
    return a.year === e.year && (!e.month || a.month === e.month);
}
const DATE_FIELDS = new Set(['startDate', 'endDate', 'date', 'startYear', 'endYear']);
const POINTS = { experience: 'description', projects: 'description', volunteering: 'description', awards: 'description', publications: 'description', education: 'details' };
const KEY = { experience: ['company'], education: ['institution', 'degree'], projects: ['name'], volunteering: ['organization'], publications: ['title'], awards: ['title'], courses: ['name'], certifications: ['name'], references: ['name'], links: ['url'] };
const bulletsOf = (section, item) => String(item?.[POINTS[section]] || '').split('\n').map((l) => l.trim()).filter(Boolean);
const listOf = (s) => String(s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const sameValue = (a, b) => {
    const x = norm(a).replace(/ /g, '');
    const y = norm(b).replace(/ /g, '');
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

function scoreCase(c, { original, result, applied, reviewed = 0 }) {
    const notes = [];
    let corrections = 0;
    const miss = (n, why) => {
        corrections += n;
        notes.push(`${n > 1 ? `-${n}` : '-1'} ${why}`);
    };
    if (reviewed) miss(reviewed, `${reviewed} flagged card${reviewed > 1 ? 's' : ''} to review`);
    const exp = c.expected || {};

    if (c.expectNothing && applied.length) miss(applied.length, `expected no changes, got ${applied.length}`);

    for (const [f, want] of Object.entries(exp.personal || {})) {
        const got = result.personal?.[f];
        const ok = f === 'phone' ? norm(got).replace(/\D/g, '').endsWith(norm(want).replace(/\D/g, '').slice(-10)) : sameValue(want, got);
        if (!ok) miss(1, `personal.${f}: want "${want}", got "${got || ''}"`);
    }
    if (exp.summary && coverage(exp.summary, result.summary) < 0.6) miss(1, `summary: got "${result.summary}"`);

    // List sections: find each expected item, check its fields and points.
    const matched = new Set();
    const sections = new Set(Object.keys(POINTS).concat(Object.keys(KEY)));
    for (const section of sections) {
        for (const want of exp[section] || []) {
            const places = want.sections || [section];
            let best = null;
            for (const place of places) {
                for (const item of result[place] || []) {
                    if (matched.has(item)) continue;
                    const keys = (KEY[place] || []).filter((k) => want[k] || (k === 'name' && want.title));
                    const ok =
                        keys.length > 0 &&
                        keys.every((k) => {
                            const got = item[k] || (k === 'name' ? item.title : '');
                            return !!content(got).length && (coverage(want[k] || want.title, got) >= 0.6 || coverage(got, want[k] || want.title) >= 0.8);
                        });
                    if (ok) {
                        best = { place, item };
                        break;
                    }
                }
                if (best) break;
            }
            const fields = Object.keys(want).filter((k) => k !== 'bullets' && k !== 'sections');
            if (!best) {
                miss(fields.length + (want.bullets?.length || 0), `${section}: missing "${want[KEY[section]?.[0]] || want.title || want.name}"`);
                continue;
            }
            matched.add(best.item);
            for (const f of fields) {
                if (KEY[best.place]?.includes(f) && !['degree'].includes(f)) continue;
                const got = best.item[f] ?? (f === 'title' ? best.item.name : undefined);
                const ok = DATE_FIELDS.has(f) ? sameDate(want[f], got) : coverage(want[f], got) >= 0.6;
                if (!ok) miss(1, `${best.place} "${want[KEY[section]?.[0]] || want.title}": ${f} want "${want[f]}", got "${got || ''}"`);
            }
            const points = bulletsOf(best.place, best.item);
            for (const b of want.bullets || []) if (!points.some((p) => coverage(b, p) >= 0.6)) miss(1, `${best.place} "${want[KEY[section]?.[0]] || want.title || want.name}": missing point "${b}"`);
        }
    }
    // Extra items (including duplicates) that weren't there before and weren't expected.
    const before = new Set(Object.keys(POINTS).concat(Object.keys(KEY)).flatMap((s) => (original[s] || []).map((i) => String(i.id))));
    for (const section of sections) {
        if ((c.allowExtra || []).includes(section)) continue;
        for (const item of result[section] || []) {
            if (matched.has(item) || before.has(String(item.id))) continue;
            miss(1, `${section}: unexpected item "${item[KEY[section]?.[0]] || item.title || item.name || item.role}"`);
        }
    }
    // Before/after duplicates of an original item (an "add" that should have been a merge).
    for (const section of sections) {
        const originals = (original[section] || []).map((i) => i[KEY[section]?.[0]]).filter(Boolean);
        for (const key of originals) {
            const copies = (result[section] || []).filter((i) => coverage(key, i[KEY[section][0]]) >= 0.8);
            if (copies.length > 1) miss(copies.length - 1, `${section}: "${key}" duplicated`);
        }
    }

    // Facts that may reasonably land in more than one place (a project point or an award).
    const everything = JSON.stringify(result);
    for (const f of exp.facts || []) if (coverage(f, everything) < 0.8) miss(1, `missing fact "${f}"`);

    for (const field of ['skills', 'languages', 'interests']) {
        const have = listOf(result[field]);
        for (const want of exp[field] || []) if (!have.some((h) => sameValue(want, h) || coverage(want, h) >= 0.99)) miss(1, `${field}: missing "${want}"`);
    }

    // Invented: facts in applied operations that aren't in the input or the old resume.
    // Same whole-number and alias rules as the server check ("sklearn" confirms "scikit-learn").
    const { known } = checker(`${c.input} ${JSON.stringify(original)}`);
    const invented = [];
    for (const o of applied) {
        const texts = [o.value, ...Object.values(o.item || {}), ...(o.bullets || []), ...(o.values || [])].filter(Boolean);
        for (const t of texts.flatMap(factTokens)) if (!known(t)) invented.push(t);
        // A point mostly made of words that aren't in the input is an invented claim.
        for (const b of o.bullets || []) if (coverage(b, `${c.input} ${JSON.stringify(original)}`) < 0.5) invented.push(`point: "${b}"`);
    }
    if (invented.length) notes.push(`invented: ${[...new Set(invented)].join(', ')}`);
    return { corrections, invented: [...new Set(invented)], notes };
}

module.exports = { scoreCase, coverage, dateKey };
