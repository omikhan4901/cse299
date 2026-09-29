/**
 * ResumeX ATS checker. Deterministic and explainable: every point in the
 * score comes from a named check with a pass / warn / fail result.
 *
 *   analyzeResume({ resume, pdfText, pageCount, template, jobDescription })
 *
 * `pdfText` is the text extracted from the real PDF (what an ATS reads);
 * `resume` is the structured data used for content checks.
 */
import { SKILLS, SOFT_SKILLS, ACTION_VERBS, WEAK_PHRASES, CLICHES, PRONOUNS, STANDARD_HEADINGS, DEGREE_LEVELS, STOPWORDS } from "./dictionary.js";
import { splitBullets, splitList } from "../resume.js";

// ---------- text helpers ----------

const lower = (s) => String(s || "").toLowerCase();
const squash = (s) => lower(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const words = (s) => (String(s || "").match(/[\p{L}\p{N}][\p{L}\p{N}'+#.-]*/gu) || []).map((w) => w.replace(/[.'-]+$/, ""));

const termCache = new Map();
/** Whole-term matcher that copes with C++, C#, .NET, Node.js, CI/CD. "=Term" means case-sensitive. */
function termRegex(term) {
  if (termCache.has(term)) return termCache.get(term);
  const exact = term.startsWith("=");
  const body = escapeRe(exact ? term.slice(1) : term).replace(/\\ /g, "[\\s-]+").replace(/ /g, "[\\s-]+");
  // Not preceded by a letter, digit, +, # or "." (so "js" doesn't match inside "Next.js").
  const re = new RegExp(`(?<![\\p{L}\\p{N}+#.])${body}(?![\\p{L}\\p{N}+#]|\\.[\\p{L}\\p{N}])`, exact ? "gu" : "giu");
  termCache.set(term, re);
  return re;
}
const countTerm = (text, term) => (String(text || "").match(termRegex(term)) || []).length;
const hasTerm = (text, term) => countTerm(text, term) > 0;
export const countAny = (text, aliases) => aliases.reduce((n, a) => n + countTerm(text, a), 0);

// ---------- dates ----------

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const PRESENT = /^(present|current|now|ongoing|today|till date|to date)$/i;

/** Parses "Jan 2022", "January 2022", "01/2022", "2022-01", "2022" or "Present" into a fractional year. */
export function parseDate(value, now = new Date()) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (PRESENT.test(v)) return { value: now.getFullYear() + now.getMonth() / 12, present: true, format: "present" };
  let m = v.match(/^([a-z]{3,9})\.?,?\s+(\d{4})$/i);
  if (m) {
    const key = m[1].toLowerCase();
    const month = MONTHS[key.slice(0, 4)] ?? MONTHS[key.slice(0, 3)];
    if (month) return { value: +m[2] + (month - 1) / 12, format: "month-year" };
  }
  m = v.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { value: +m[2] + (+m[1] - 1) / 12, format: "mm/yyyy" };
  m = v.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { value: +m[1] + (+m[2] - 1) / 12, format: "yyyy-mm" };
  m = v.match(/^(\d{4})$/);
  if (m) return { value: +m[1], format: "year" };
  return { value: null, format: "unknown" };
}

/** Total years covered by the experience entries, counting overlapping jobs once. */
export function experienceYears(experience, now = new Date()) {
  const spans = [];
  for (const e of experience) {
    const s = parseDate(e.startDate, now);
    const f = parseDate(e.endDate, now) || (s ? { value: s.value + 1 / 12 } : null);
    if (s?.value != null && f?.value != null && f.value >= s.value) spans.push([s.value, f.value]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur = null;
  for (const [a, b] of spans) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return Math.round(total * 10) / 10;
}

// ---------- check helpers ----------

const PASS = "pass";
const WARN = "warn";
const FAIL = "fail";

const check = (id, label, status, detail, weight = 1, extra = {}) => ({ id, label, status, detail, weight, points: extra.points ?? (status === PASS ? 1 : status === WARN ? 0.5 : 0), ...extra });

const pct = (n) => `${Math.round(n * 100)}%`;
const list = (items, max = 4) => {
  const shown = items.slice(0, max).map((x) => `“${x}”`).join(", ");
  return items.length > max ? `${shown} and ${items.length - max} more` : shown;
};

// ---------- 1. Parsing: what an ATS actually extracts from the PDF ----------

/**
 * `upload` is set for a PDF uploaded to the ATS checker page: { columns, images, garbled,
 * sections } describe the file itself, since there's no builder template to go by.
 */
function parsingChecks({ resume, pdfText, pageCount, template, upload }) {
  const checks = [];
  const text = squash(pdfText);
  const despaced = text.replace(/\b(\p{L}) (?=\p{L}\b)/gu, "$1"); // "E X P E R I E N C E" -> "EXPERIENCE"
  const p = resume.personal;

  const selectable = text.replace(/\s/g, "").length > 150;
  checks.push(
    check("text", "Text can be extracted", selectable ? PASS : FAIL, selectable ? "Every word in your PDF is real, selectable text." : "Almost no text could be extracted. An ATS would see an empty resume.", 3, { critical: !selectable })
  );
  if (!selectable) return checks;

  const found = (value) => {
    const v = squash(value);
    if (!v) return "missing";
    if (text.includes(v)) return "ok";
    if (despaced.includes(v.replace(/\s+/g, "")) || despaced.includes(v)) return "spaced";
    return "no";
  };

  const name = found(p.name);
  checks.push(
    check(
      "name",
      "Name is readable",
      name === "ok" ? PASS : name === "spaced" ? WARN : FAIL,
      name === "missing" ? "Add your full name." : name === "ok" ? `Found “${p.name}”.` : name === "spaced" ? "Your name is letter-spaced, so some ATS read it as separate letters." : "Your name could not be found in the extracted text.",
      2
    )
  );

  const email = p.email && found(p.email);
  checks.push(
    check("email", "Email is readable", !p.email ? FAIL : email === "ok" ? PASS : WARN, !p.email ? "Add an email address — recruiters and ATS need it." : email === "ok" ? `Found ${p.email}.` : "Your email didn't come through cleanly in the extracted text.", 2)
  );

  const phoneDigits = (p.phone || "").replace(/\D/g, "");
  const textDigits = text.replace(/\D/g, "");
  checks.push(
    check("phone", "Phone number is readable", !phoneDigits ? WARN : textDigits.includes(phoneDigits) ? PASS : WARN, !phoneDigits ? "Add a phone number." : textDigits.includes(phoneDigits) ? `Found ${p.phone}.` : "Your phone number didn't come through cleanly.", 1)
  );

  // An uploaded PDF: sections are only known through their headings.
  if (upload) {
    const main = ["experience", "education", "skills"];
    const missing = main.filter((s) => !upload.sections?.has(s));
    checks.push(
      check(
        "headings",
        "Standard section headings",
        missing.length === main.length ? FAIL : missing.length ? WARN : PASS,
        missing.length
          ? `We couldn't find a standard heading for: ${missing.join(", ")}. If your resume has ${missing.length > 1 ? "these sections" : "this section"}, title ${missing.length > 1 ? "them" : "it"} “${missing.map((m) => m[0].toUpperCase() + m.slice(1)).join("”, “")}” so an ATS can find ${missing.length > 1 ? "them" : "it"}.`
          : "Experience, Education and Skills use headings ATS recognise.",
        2
      )
    );
    const garbled = upload.garbled || 0;
    checks.push(
      check("fidelity", "Characters come through cleanly", garbled > 3 ? FAIL : garbled ? WARN : PASS, garbled ? `${garbled} character${garbled === 1 ? "" : "s"} couldn't be read (special fonts, icons or symbols). An ATS may drop or garble them.` : "Every character in your PDF can be read.", 2)
    );
    checks.push(
      check(
        "layout",
        "Single-column layout",
        upload.columns ? WARN : PASS,
        upload.columns
          ? "Your PDF uses columns. Modern ATS usually handle it, but older ones can mix the columns together. For online applications, a single-column layout is the safest."
          : "One column: every ATS reads this top to bottom.",
        2
      )
    );
    checks.push(
      check("photo", "No photo or graphics", upload.images ? WARN : PASS, upload.images ? "Your PDF contains an image (a photo, logo or graphic). ATS ignore images, so any text inside them is lost, and employers in the US, UK and Canada often prefer no photo." : "No images — the safest choice for ATS.", 1)
    );
    checks.push(
      check("pages", "Length", pageCount <= 2 ? PASS : pageCount === 3 ? WARN : FAIL, pageCount <= 2 ? `${pageCount} page${pageCount > 1 ? "s" : ""} — ideal.` : `${pageCount} pages. Recruiters expect one page, or two with long experience.`, 1)
    );
    return checks;
  }

  // Headings: each section the resume has should be introduced by a heading ATS know.
  const need = ["experience", "education", "skills"].filter((s) => (s === "skills" ? splitList(resume.skills).length : resume[s]?.length));
  const lines = String(pdfText || "").split(/\n+/).map(squash);
  // A heading line may carry numbering ("02 Education") or a colon; nothing else.
  const bare = (l) => l.replace(/^[\d.)\s-]+/, "").replace(/[:\d.\s]+$/, "").trim();
  const headingState = need.map((section) => {
    const names = STANDARD_HEADINGS[section];
    if (lines.some((l) => names.includes(bare(l)))) return [section, "ok"];
    if (lines.some((l) => names.includes(bare(l.replace(/\b(\p{L}) (?=\p{L}\b)/gu, "$1"))))) return [section, "spaced"];
    return [section, "no"];
  });
  const badHeadings = headingState.filter(([, st]) => st === "no").map(([sec]) => sec);
  const spacedHeadings = headingState.filter(([, st]) => st === "spaced").map(([sec]) => sec);
  checks.push(
    check(
      "headings",
      "Standard section headings",
      badHeadings.length ? FAIL : spacedHeadings.length ? WARN : PASS,
      badHeadings.length
        ? `No standard heading found for: ${badHeadings.join(", ")}. ATS look for headings like “Experience”, “Education” and “Skills”; creative names (e.g. “Expertise”) can hide a section.`
        : spacedHeadings.length
          ? `Headings for ${spacedHeadings.join(", ")} are letter-spaced, which some parsers read as separate letters.`
          : "Experience, Education and Skills use headings ATS recognise.",
      2
    )
  );

  // Reading order: job titles should come out in the same order as on the page.
  const titles = resume.experience.map((e) => squash(e.title)).filter(Boolean);
  const positions = titles.map((t) => text.indexOf(t));
  const missingTitles = titles.filter((t, i) => positions[i] < 0);
  const inOrder = positions.filter((x) => x >= 0).every((x, i, arr) => i === 0 || x >= arr[i - 1]);
  checks.push(
    check(
      "order",
      "Reading order is intact",
      !titles.length ? PASS : missingTitles.length ? WARN : inOrder ? PASS : FAIL,
      !titles.length ? "No job titles to check." : missingTitles.length ? `Some job titles weren't found word-for-word: ${list(missingTitles)}.` : inOrder ? "Jobs are read in the order they appear." : "Jobs come out of the PDF in a different order than they appear.",
      2
    )
  );

  // Fidelity: a stretch of the summary should survive extraction word-for-word.
  const sample = squash(resume.summary || resume.experience[0]?.description || "").split(" ").slice(0, 12).join(" ");
  const faithful = !sample || text.includes(sample);
  checks.push(check("fidelity", "Text survives extraction", faithful ? PASS : WARN, faithful ? "Sentences come out of the PDF exactly as written." : "Some text changes when extracted (merged words or odd characters).", 2));

  // Layout.
  const columns = template?.tags?.some((t) => /sidebar|two column|side headings/i.test(t));
  checks.push(
    check(
      "layout",
      "Single-column layout",
      columns ? WARN : PASS,
      columns
        ? `“${template.name}” uses columns. Modern ATS usually handle it, but older ones can mix the columns together. For online applications, Compact ATS, Classic or Basic Stylish are the safest.`
        : "One column: every ATS reads this top to bottom.",
      2
    )
  );

  // Only templates with a photo area print it.
  const hasPhoto = !!p.profilePic && !!template?.tags?.includes("Photo");
  checks.push(check("photo", "No photo", hasPhoto ? WARN : PASS, hasPhoto ? "ATS ignore photos, and employers in the US, UK and Canada often prefer none. Keep it only where photos are expected." : "No photo — the safest choice for ATS.", 1));

  checks.push(
    check("pages", "Length", pageCount <= 2 ? PASS : pageCount === 3 ? WARN : FAIL, pageCount <= 2 ? `${pageCount} page${pageCount > 1 ? "s" : ""} — ideal.` : `${pageCount} pages. Recruiters expect one page, or two with long experience.`, 1)
  );
  return checks;
}

// ---------- 2. Content: what recruiters and ranking engines reward ----------

export function contentChecks({ resume }) {
  const checks = [];
  const p = resume.personal;
  const allBullets = [
    ...resume.experience.flatMap((e) => splitBullets(e.description)),
    ...resume.projects.flatMap((e) => splitBullets(e.description)),
    ...resume.volunteering.flatMap((e) => splitBullets(e.description)),
  ];

  const missingContact = [["email", p.email], ["phone", p.phone], ["location", p.city], ["LinkedIn", p.linkedin]].filter(([, v]) => !v).map(([k]) => k);
  checks.push(check("contact", "Contact details", missingContact.length === 0 ? PASS : missingContact.length <= 1 ? WARN : FAIL, missingContact.length ? `Missing: ${missingContact.join(", ")}.` : "Email, phone, location and LinkedIn are all there.", 1));

  const summaryWords = words(resume.summary).length;
  checks.push(
    check("summary", "Summary", summaryWords >= 25 && summaryWords <= 120 ? PASS : WARN, !summaryWords ? "Add a 2–4 sentence summary. It's the first thing recruiters read and a natural place for keywords." : summaryWords < 25 ? `${summaryWords} words — a little thin. Aim for 40–80.` : summaryWords > 120 ? `${summaryWords} words — too long. Aim for 40–80.` : `${summaryWords} words.`, 1)
  );

  const exp = resume.experience;
  checks.push(check("experience", "Work experience", exp.length ? PASS : resume.education.length ? WARN : FAIL, exp.length ? `${exp.length} position${exp.length > 1 ? "s" : ""}.` : "No work experience. Add internships, freelance or part-time work, or strengthen your Projects section.", 2));

  const perRole = exp.map((e) => splitBullets(e.description).length);
  const thin = exp.filter((_, i) => perRole[i] < 2).map((e) => e.title || e.company || "Untitled");
  const bloated = exp.filter((_, i) => perRole[i] > 8).map((e) => e.title || e.company || "Untitled");
  checks.push(
    check("bullets", "Bullet points per job", !exp.length ? WARN : thin.length || bloated.length ? WARN : PASS, !exp.length ? "No jobs to check." : thin.length ? `Add at least 2–3 achievements to: ${list(thin)}.` : bloated.length ? `Trim to the 5–6 strongest points: ${list(bloated)}.` : "Every job has 2–8 points.", 1)
  );

  if (allBullets.length) {
    const firstWord = (b) => lower(words(b)[0] || "");
    const weakStart = allBullets.filter((b) => !ACTION_VERBS.has(firstWord(b)));
    const verbShare = 1 - weakStart.length / allBullets.length;
    checks.push(
      check("verbs", "Starts with action verbs", verbShare >= 0.7 ? PASS : verbShare >= 0.4 ? WARN : FAIL, `${pct(verbShare)} of your points start with a strong verb (e.g. Built, Led, Reduced).${weakStart.length ? ` Rework: ${list(weakStart.map((b) => b.split(" ").slice(0, 6).join(" ") + "…"), 3)}` : ""}`, 2)
    );

    const quantified = allBullets.filter((b) => /\d|%|\$|€|£|৳/.test(b));
    const qShare = quantified.length / allBullets.length;
    checks.push(
      check("numbers", "Quantified results", qShare >= 0.4 ? PASS : qShare >= 0.2 ? WARN : FAIL, `${pct(qShare)} of your points include a number. Aim for 40%+: team sizes, users, %, time or money saved.`, 2)
    );

    const long = allBullets.filter((b) => words(b).length > 35);
    const short = allBullets.filter((b) => words(b).length < 4);
    checks.push(
      check("length", "Bullet length", long.length || short.length ? WARN : PASS, long.length ? `${long.length} point${long.length > 1 ? "s are" : " is"} over 35 words — split or tighten them.` : short.length ? `${short.length} point${short.length > 1 ? "s are" : " is"} under 4 words — add what you did and the result.` : "Points are a readable length.", 1)
    );

    const pronoun = allBullets.filter((b) => PRONOUNS.test(b));
    checks.push(check("pronouns", "No personal pronouns", pronoun.length ? WARN : PASS, pronoun.length ? `Drop “I/my/we” from: ${list(pronoun.map((b) => b.slice(0, 40) + "…"), 2)}` : "Points are written in the implied first person.", 1));

    const corpus = lower(allBullets.join("\n"));
    const weak = WEAK_PHRASES.filter((w) => corpus.includes(w));
    checks.push(check("weak", "Results, not duties", weak.length ? WARN : PASS, weak.length ? `Replace duty phrases with outcomes: ${list(weak)}.` : "No “responsible for”-style phrases.", 1));

    const verbs = allBullets.map(firstWord).filter((w) => ACTION_VERBS.has(w));
    const counts = verbs.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {});
    const repeated = Object.entries(counts).filter(([, n]) => n >= 3).map(([v]) => v);
    checks.push(check("variety", "Varied verbs", repeated.length ? WARN : PASS, repeated.length ? `Used 3+ times: ${list(repeated)}. Vary them.` : "Good variety of verbs.", 0.5));
  }

  const fullText = lower([resume.summary, ...allBullets].join(" "));
  const cliches = CLICHES.filter((c) => fullText.includes(c));
  checks.push(check("cliches", "No clichés", cliches.length ? WARN : PASS, cliches.length ? `Show it instead of saying it: ${list(cliches)}.` : "No filler buzzwords.", 1));

  const skills = splitList(resume.skills);
  checks.push(
    check("skills", "Skills list", skills.length >= 6 && skills.length <= 25 ? PASS : skills.length ? WARN : FAIL, !skills.length ? "Add a Skills section — ATS match it directly against the job." : skills.length < 6 ? `${skills.length} skill${skills.length === 1 ? "" : "s"} — add more relevant tools and technologies.` : skills.length > 25 ? `${skills.length} skills — trim to the most relevant 10–20.` : `${skills.length} skills.`, 1)
  );

  // Dates: parseable, consistent, reverse-chronological, sane.
  const dated = exp.map((e) => ({ e, s: parseDate(e.startDate), f: parseDate(e.endDate) }));
  const unparsed = dated.filter(({ s, f }) => !s || s.value == null || (f && f.value == null)).map(({ e }) => e.title || e.company || "Untitled");
  const backwards = dated.filter(({ s, f }) => s?.value != null && f?.value != null && f.value < s.value).map(({ e }) => e.title || "Untitled");
  const starts = dated.map(({ s }) => s?.value).filter((v) => v != null);
  const chronological = starts.every((v, i) => i === 0 || v <= starts[i - 1] + 0.01);
  checks.push(
    check(
      "dates",
      "Dates ATS can read",
      !exp.length ? PASS : backwards.length ? FAIL : unparsed.length ? WARN : PASS,
      !exp.length ? "No dates to check." : backwards.length ? `End date is before start date: ${list(backwards)}.` : unparsed.length ? `Use a clear format like “Jan 2023 – Present” for: ${list(unparsed)}.` : "Every job has a start and end date ATS can read.",
      1
    )
  );
  const formats = new Set(dated.flatMap(({ s, f }) => [s?.format, f?.format]).filter((x) => x && x !== "present" && x !== "unknown"));
  checks.push(check("dateformat", "Consistent date format", formats.size <= 1 ? PASS : WARN, formats.size <= 1 ? "Dates use one format." : "Dates mix formats (e.g. “2022” and “Jan 2023”). Pick one.", 0.5));
  checks.push(check("chronology", "Most recent first", chronological ? PASS : WARN, chronological ? "Jobs are in reverse-chronological order." : "List your most recent job first — ATS and recruiters expect it.", 1));

  const totalWords = words([resume.summary, ...allBullets, resume.skills].join(" ")).length;
  checks.push(check("words", "Overall length", totalWords >= 200 && totalWords <= 900 ? PASS : WARN, totalWords < 200 ? `${totalWords} words — add more detail about your impact.` : totalWords > 900 ? `${totalWords} words — too long to skim; cut to your strongest material.` : `${totalWords} words.`, 1));

  checks.push(check("education", "Education", resume.education.length ? PASS : WARN, resume.education.length ? "Education is listed." : "Add your education — many ATS filter on degree.", 1));
  return checks;
}

// ---------- 3. Job match ----------

const ROLE_WORDS = /(engineer|developer|manager|analyst|designer|specialist|consultant|intern|officer|lead|architect|scientist|coordinator|associate|assistant|representative|executive|administrator|technician|nurse|accountant|teacher|director|writer|marketer|programmer|researcher|strategist|agent|advisor|operator)/i;

function jobTitleFrom(jd) {
  const explicit = jd.match(/(?:job title|position|role)\s*[:\-–]\s*(.+)/i);
  if (explicit) return explicit[1].trim();
  const first = jd.split(/\n/).map((l) => l.trim()).find(Boolean) || "";
  return first.split(/\s+/).length <= 8 && ROLE_WORDS.test(first) ? first : "";
}

/** Extracts weighted keywords from a job description. */
export function jobKeywords(jd) {
  const lines = String(jd || "").split(/\n/);
  let sectionWeight = 1;
  const weighted = lines.map((line) => {
    const l = line.trim();
    if (/^(requirements?|qualifications?|what you('ll)? (need|bring)|must have|you have|skills|about you)\b.*:?$/i.test(l)) sectionWeight = 1.6;
    else if (/^(nice to have|bonus|preferred|good to have|pluses?)\b.*:?$/i.test(l)) sectionWeight = 0.6;
    else if (/^(responsibilities|what you('ll)? do|the role|about the role|duties)\b.*:?$/i.test(l)) sectionWeight = 1;
    let w = sectionWeight;
    if (/\b(required|must|minimum|essential|proficien|strong (experience|knowledge))/i.test(l)) w = Math.max(w, 1.8);
    if (/\b(nice to have|bonus|preferred|a plus|desirable|ideally)\b/i.test(l)) w = Math.min(w, 0.6);
    return { line, w };
  });

  const found = new Map();
  const add = (name, kind, weight, aliases) => {
    const prev = found.get(name);
    if (prev) {
      prev.importance = Math.max(prev.importance, weight) + 0.15;
      prev.count++;
    } else found.set(name, { name, kind, importance: weight, count: 1, aliases });
  };
  for (const { line, w } of weighted) {
    for (const [name, aliases] of Object.entries(SKILLS)) if (countAny(line, [name, ...aliases])) add(name, "hard", w, [name, ...aliases]);
    for (const [name, aliases] of Object.entries(SOFT_SKILLS)) if (countAny(line, [name, ...aliases])) add(name, "soft", w * 0.4, [name, ...aliases]);
  }
  // Acronyms and product names the dictionary doesn't know (e.g. HIPAA, PostGIS, SAP BW).
  const known = new Set([...found.values()].flatMap((k) => k.aliases.map((a) => lower(a.replace(/^=/, "")))));
  const COMMON = new Set(["us", "usa", "uk", "eu", "ok", "it", "we", "our", "the", "a", "an", "id", "pto", "401k", "eeo", "fte", "dei", "ceo", "cto", "ai"]);
  for (const { line, w } of weighted) {
    const tokens = line.match(/\b(?:[A-Z][A-Z0-9+#&/.]{1,7}|[a-z]+[A-Z][A-Za-z0-9]+|[A-Z][a-z]+[A-Z][A-Za-z0-9]*)\b/g) || [];
    for (const t of tokens) {
      const key = lower(t);
      if (known.has(key) || COMMON.has(key) || STOPWORDS.has(key) || t.length < 2) continue;
      add(t, "term", w * 0.8, [`=${t}`]);
    }
  }
  return [...found.values()].map((k) => ({ ...k, importance: Math.round(Math.min(k.importance, 3) * 100) / 100 })).sort((a, b) => b.importance - a.importance);
}

function degreeLevel(text) {
  const tokens = new Set(words(lower(text)).map((w) => w.replace(/\./g, "")));
  let best = 0;
  for (const { level, words: ws } of DEGREE_LEVELS) if (ws.some((w) => tokens.has(w.replace(/\./g, "")))) best = Math.max(best, level);
  return best;
}

function jdDegreeLevel(jd) {
  const t = lower(jd);
  const levels = [];
  if (/\b(phd|ph\.d|doctorate)\b/.test(t)) levels.push(4);
  if (/\b(master'?s|mba|m\.sc|msc)\b/.test(t)) levels.push(3);
  if (/\b(bachelor'?s|b\.sc|bsc|undergraduate degree|degree in)\b/.test(t)) levels.push(2);
  return levels.length ? Math.min(...levels) : 0; // "Bachelor's or Master's" -> Bachelor's is the minimum
}

export function matchChecks({ resume, jobDescription }) {
  const checks = [];
  const keywords = jobKeywords(jobDescription);
  const context = [
    resume.summary,
    resume.personal.title,
    ...resume.experience.map((e) => `${e.title} ${e.company} ${e.description}`),
    ...resume.projects.map((e) => `${e.name} ${e.role} ${e.technologies} ${e.description}`),
    ...resume.volunteering.map((e) => `${e.role} ${e.description}`),
    ...resume.customSections.flatMap((s) => s.items.map((i) => `${i.title} ${i.subtitle} ${i.description}`)),
  ].join("\n");
  const everything = [context, resume.skills, resume.certifications.map((c) => `${c.name} ${c.issuer}`).join(" "), resume.courses.map((c) => c.name).join(" "), resume.education.map((e) => `${e.degree} ${e.details}`).join(" "), resume.languages].join("\n");

  const results = keywords.map((k) => {
    const inResume = countAny(everything, k.aliases) > 0;
    const inContext = countAny(context, k.aliases) > 0;
    return { ...k, matched: inResume, inContext };
  });
  const hard = results.filter((k) => k.kind !== "soft");
  const total = results.reduce((s, k) => s + k.importance, 0);
  const got = results.filter((k) => k.matched).reduce((s, k) => s + k.importance, 0);
  const coverage = total ? got / total : 1;

  checks.push(
    check(
      "keywords",
      "Keyword match",
      !keywords.length ? WARN : coverage >= 0.75 ? PASS : coverage >= 0.5 ? WARN : FAIL,
      !keywords.length
        ? "We couldn't find specific skills in that job description. Paste the full posting, including requirements."
        : `Your resume covers ${pct(coverage)} of the job's keywords, weighted by how much the posting stresses them. ATS rankings rely heavily on this.`,
      4,
      { points: keywords.length ? Math.min(1, coverage / 0.85) : 0.5, coverage: keywords.length ? coverage : null }
    )
  );

  const matchedHard = hard.filter((k) => k.matched);
  const listOnly = matchedHard.filter((k) => !k.inContext).map((k) => k.name);
  checks.push(
    check(
      "context",
      "Skills backed by experience",
      !matchedHard.length ? WARN : listOnly.length / matchedHard.length <= 0.4 ? PASS : WARN,
      !matchedHard.length ? "None of the job's skills appear yet." : listOnly.length ? `Only in your skills list, not in any job or project: ${list(listOnly, 5)}. Show where you used them.` : "Every matched skill appears in your experience or projects, not just the skills list.",
      1.5
    )
  );

  const jdTitle = jobTitleFrom(jobDescription);
  if (jdTitle) {
    const want = words(lower(jdTitle)).filter((w) => !STOPWORDS.has(w) && w.length > 1);
    const have = new Set(words(lower([resume.personal.title, ...resume.experience.map((e) => e.title)].join(" "))));
    const overlap = want.filter((w) => have.has(w));
    const ratio = want.length ? overlap.length / want.length : 0;
    checks.push(
      check("title", "Job title alignment", ratio >= 0.5 ? PASS : ratio > 0 ? WARN : FAIL, ratio >= 0.5 ? `Your titles line up with “${jdTitle}”.` : `The job is “${jdTitle}”. ${ratio > 0 ? "Your titles only partly match" : "None of your titles match"} — if it's honest, align your headline title with it.`, 1.5)
    );
  }

  const yearsMatch = [...jobDescription.matchAll(/(\d{1,2})\s*\+?\s*(?:-|to|–)?\s*(?:\d{1,2}\s*)?\+?\s*years?(?:'|’)?\s*(?:of\s+)?(?:[\w\s/-]{0,30}?)experience/gi)].map((m) => +m[1]);
  if (yearsMatch.length) {
    const need = Math.max(...yearsMatch.filter((n) => n <= 20));
    const have = experienceYears(resume.experience);
    checks.push(
      check("years", "Years of experience", have >= need ? PASS : have >= need * 0.7 ? WARN : FAIL, `The job asks for ${need}+ years; your dated experience adds up to about ${have} year${have === 1 ? "" : "s"}.`, 1)
    );
  }

  const needDegree = jdDegreeLevel(jobDescription);
  if (needDegree) {
    const have = Math.max(0, ...resume.education.map((e) => degreeLevel(`${e.degree} ${e.details}`)));
    const names = { 2: "a bachelor's degree", 3: "a master's degree", 4: "a doctorate" };
    checks.push(check("degree", "Education requirement", have >= needDegree ? PASS : have ? WARN : FAIL, have >= needDegree ? `The job asks for ${names[needDegree]} — you meet it.` : `The job asks for ${names[needDegree]}. ${have ? "Your listed degree looks lower" : "No matching degree found"}; make sure the degree name is spelled out.`, 1));
  }

  return { checks, keywords: results };
}

// ---------- score ----------

const categoryScore = (checks) => {
  const w = checks.reduce((s, c) => s + c.weight, 0);
  return w ? Math.round((checks.reduce((s, c) => s + c.points * c.weight, 0) / w) * 100) : 0;
};

/** Facts gathered along the way, shown step by step while the scan runs. */
function scanStats({ resume, pdfText, pageCount, keywords }) {
  const text = String(pdfText || "");
  const lines = text.split(/\n+/).map((l) => squash(l).replace(/^[\d.)\s-]+/, "").replace(/[:\d.\s]+$/, "").trim());
  const sections = Object.entries(STANDARD_HEADINGS)
    .filter(([, names]) => lines.some((l) => names.includes(l)))
    .map(([id]) => id[0].toUpperCase() + id.slice(1));
  const bullets = [
    ...resume.experience.flatMap((e) => splitBullets(e.description)),
    ...resume.projects.flatMap((e) => splitBullets(e.description)),
    ...resume.volunteering.flatMap((e) => splitBullets(e.description)),
  ];
  const p = resume.personal;
  return {
    pages: pageCount,
    words: words(text).length,
    characters: text.replace(/\s/g, "").length,
    sections,
    contact: [p.email, p.phone, p.city, p.linkedin].filter(Boolean).length,
    roles: resume.experience.length,
    bullets: bullets.length,
    quantified: bullets.filter((b) => /\d|%|\$|€|£|৳/.test(b)).length,
    actionVerbs: bullets.filter((b) => ACTION_VERBS.has(lower(words(b)[0] || ""))).length,
    skills: splitList(resume.skills).length,
    keywords: keywords ? keywords.length : null,
    matched: keywords ? keywords.filter((k) => k.matched).length : null,
  };
}

export function gradeFor(score) {
  if (score >= 85) return { label: "Excellent", tone: "green" };
  if (score >= 70) return { label: "Good", tone: "teal" };
  if (score >= 50) return { label: "Needs work", tone: "amber" };
  return { label: "Poor", tone: "red" };
}

export function analyzeResume({ resume, pdfText = "", pageCount = 1, template, jobDescription = "", upload = null }) {
  const parsing = parsingChecks({ resume, pdfText, pageCount, template, upload });
  const content = contentChecks({ resume });
  const hasJob = String(jobDescription).trim().length > 40;
  const match = hasJob ? matchChecks({ resume, jobDescription }) : null;

  const categories = [
    { id: "parsing", label: "ATS parsing", description: "Can software read your PDF correctly?", weight: hasJob ? 30 : 40, checks: parsing },
    { id: "content", label: "Content quality", description: "Does it follow what recruiters and ranking engines reward?", weight: hasJob ? 35 : 60, checks: content },
  ];
  if (match) categories.push({ id: "match", label: "Job match", description: "How well does it fit this job description?", weight: 35, checks: match.checks });
  for (const c of categories) c.score = categoryScore(c.checks);

  let score = Math.round(categories.reduce((s, c) => s + c.score * c.weight, 0) / categories.reduce((s, c) => s + c.weight, 0));
  // An unreadable PDF can't score well no matter what else is right.
  if (parsing.some((c) => c.critical)) score = Math.min(score, 15);

  const all = categories.flatMap((c) => c.checks);
  return {
    stats: scanStats({ resume, pdfText, pageCount, keywords: match?.keywords }),
    score,
    grade: gradeFor(score),
    categories,
    keywords: match?.keywords || null,
    counts: { pass: all.filter((c) => c.status === PASS).length, warn: all.filter((c) => c.status === WARN).length, fail: all.filter((c) => c.status === FAIL).length },
  };
}
