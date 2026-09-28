/**
 * Turns the text extracted from an uploaded resume PDF into the resume structure the
 * ATS analysis uses, the way an ATS parser does it: find the standard section headings,
 * then split each section into entries by their dates and bullet points. A resume the
 * parser can't make sense of scores lower, which is exactly what an ATS would do to it.
 */
import { normalizeResume } from "../resume.js";
import { STANDARD_HEADINGS } from "./dictionary.js";

const HEADINGS = {
  ...STANDARD_HEADINGS,
  experience: [...STANDARD_HEADINGS.experience, "experience and internships", "internships", "internship experience", "relevant experience", "work"],
  skills: [...STANDARD_HEADINGS.skills, "technologies", "tools", "technical expertise", "skills and tools", "areas of expertise"],
  languages: ["languages", "language skills"],
  volunteering: ["volunteering", "volunteer experience", "volunteer work", "community involvement", "leadership and volunteering"],
  awards: ["awards", "honors", "honours", "achievements", "awards and honors", "awards and achievements"],
  interests: ["interests", "hobbies", "hobbies and interests"],
  references: ["references"],
  publications: ["publications", "research"],
  courses: ["courses", "relevant coursework", "coursework", "training"],
  contact: ["contact", "contact information", "contact details", "personal details", "details"],
};
const HEADING_OF = new Map(Object.entries(HEADINGS).flatMap(([section, names]) => names.map((n) => [n, section])));

const BULLET = /^\s*([•·▪‣◦●○■□►▶✓✔*]|[-–—](?=\s)|o(?=\s))\s*/;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?,?";
const DATE = `(?:${MONTH}\\s+\\d{4}|\\d{1,2}[/.-]\\d{4}|\\d{4})`;
const RANGE = new RegExp(`(${DATE})\\s*(?:–|—|-|to|until)\\s*(${DATE}|present|current|now|ongoing|today)`, "i");
const LONE_DATE = new RegExp(`(?:^|\\s|[|·•,(])(${DATE}|present)\\s*\\)?$`, "i");
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
// Links: a scheme or www, or a known top-level domain (so "B.S." and "Node.js" aren't links).
const URL_LIKE = /\b(?:https?:\/\/\S+|www\.\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|dev|io|org|net|app|me|co|ai|edu|gov|xyz|info|tech|cc|bd|uk|in|ca|au|de|site|page|link|so|sh)(?:\/[^\s·|]*)?)(?![\w.])/i;
const SEP = /\s*[·|•]\s*|\s{2,}/;

const clean = (s) => s.replace(/\s+/g, " ").trim();
const despace = (s) => s.replace(/\b(\p{L}) (?=\p{L}\b)/gu, "$1"); // "E X P E R I E N C E"

/** The section a line introduces, or null. */
export function headingOf(line) {
  const bare = clean(despace(line)).toLowerCase().replace(/^[\d.)\s-]+/, "").replace(/[:\s]+$/, "").replace(/&/g, "and");
  if (!bare || bare.split(" ").length > 5) return null;
  return HEADING_OF.get(bare) || null;
}

/** Splits the text into the top block (name and contact details) and sections. */
function splitSections(text) {
  const lines = String(text || "").split(/\n+/).map(clean).filter(Boolean);
  const sections = { top: [] };
  const order = [];
  let current = "top";
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      current = h;
      if (!sections[current]) {
        sections[current] = [];
        order.push(current);
      }
      continue;
    }
    sections[current].push(line);
  }
  return { sections, order, lines };
}

const splitHeader = (s) => clean(s).split(SEP).map((x) => x.replace(/^[,|·]+|[,|·]+$/g, "").trim()).filter(Boolean);

/**
 * Entries: header lines (title, company…), dates, and points. Points come either with
 * bullet characters, or (when a template draws its bullets) one per line starting with a
 * capital letter; wrapped lines are joined back on.
 */
function parseEntries(lines, { single = false } = {}) {
  const entries = [];
  let cur = null;
  const newEntry = (header, dates) => {
    cur = { headers: header ? [header] : [], dates, points: [], bulleted: false };
    entries.push(cur);
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const bullet = BULLET.test(raw);
    const text = bullet ? raw.replace(BULLET, "") : raw;
    const words = text.split(" ").length;
    const range = !bullet && text.match(RANGE);
    const lone = single && !bullet && !range && words <= 10 && text.match(LONE_DATE);
    if (range || lone) {
      const m = range || lone;
      const header = clean(text.replace(m[0], " ")).replace(/[|·,(–—-]+$/, "").trim();
      // Lines just before the dates with nothing under them belong to this entry (e.g. a
      // certificate name, then "Issuer · 2023").
      const carried = cur && !cur.points.length && !cur.dates[0] ? entries.pop().headers : [];
      newEntry(header, range ? [range[1], range[2]] : [lone[1], ""]);
      cur.headers.unshift(...carried);
      continue;
    }
    if (!cur) {
      newEntry(text, ["", ""]);
      continue;
    }
    if (bullet) {
      cur.points.push(text);
      cur.bulleted = true;
      continue;
    }
    const last = cur.points[cur.points.length - 1];
    const lastHeader = cur.headers[cur.headers.length - 1];
    // A line right before a dated line starts the next entry (e.g. "Acme Ltd." then "Engineer  2020 – 2022").
    const next = lines[i + 1] || "";
    const wrapped = last !== undefined && (/^[a-z(&,]/.test(text) || /(,|\b(and|or|with|of|the|to|for|in|on|by|a|an|from|using|across|into))$/i.test(last));
    if (!wrapped && cur.points.length && !BULLET.test(next) && (RANGE.test(next) || (single && LONE_DATE.test(next) && next.split(" ").length <= 10)) && words <= 10) {
      newEntry(text, ["", ""]);
      continue;
    }
    if (!cur.points.length && lastHeader && /[–—,&-]$/.test(lastHeader)) {
      cur.headers[cur.headers.length - 1] = `${lastHeader} ${text}`; // a header that wrapped
    } else if (!cur.points.length && cur.headers.length < 2 && words <= 12) {
      cur.headers.push(text);
    } else if (wrapped || (last !== undefined && cur.bulleted && !/[.!?]$/.test(last) && words <= 3)) {
      cur.points[cur.points.length - 1] = `${last} ${text}`; // a wrapped line
    } else if (cur.bulleted || (cur.points.length && (URL_LIKE.test(text) || / · | \| /.test(text)) && words <= 10)) {
      newEntry(text, ["", ""]); // the next entry, without dates (e.g. a project name)
    } else {
      cur.points.push(text);
    }
  }
  return entries.map((e) => {
    const parts = e.headers.flatMap(splitHeader);
    const link = parts.join(" ").match(URL_LIKE)?.[0] || "";
    const named = parts.map((p) => clean(p.replace(link, " "))).filter(Boolean);
    return { first: named[0] || "", second: named[1] || "", rest: named.slice(2), link, dates: e.dates, description: e.points.join("\n") };
  });
}

const ROLE = /\b(engineer|developer|manager|analyst|designer|specialist|consultant|intern|officer|lead|architect|scientist|coordinator|associate|assistant|representative|executive|administrator|technician|nurse|accountant|teacher|director|writer|marketer|programmer|researcher|strategist|agent|advisor|operator|head|founder|trainee|volunteer|tutor|instructor)s?\b/i;
const DEGREE = /\b(ph\.?d|doctorate|master|m\.?sc|m\.?s\b|m\.?a\b|mba|bachelor|b\.?sc|b\.?s\b|b\.?a\b|bba|b\.?tech|b\.?eng|diploma|degree|associate|hsc|ssc|a[- ]levels?|o[- ]levels?|high school|certificate)/i;

/** Of an entry's two header parts, the one matching `pattern` first (e.g. the job title). */
const byPattern = (e, pattern) => (pattern.test(e.second) && !pattern.test(e.first) ? [e.second, e.first] : [e.first, e.second]);

const listOf = (lines) =>
  lines
    .map((l) => l.replace(BULLET, "").replace(/^[^:,]{1,30}:\s*/, "")) // "Languages: JavaScript, Go"
    .flatMap((l) => l.split(/\s*[,;|·•]\s*/))
    // Skill chips come out as one long line: split it into words (but keep "English (Native)").
    .flatMap((part) => (part.split(" ").length > 3 && !/[()]/.test(part) ? part.split(/\s+/) : [part]))
    .map((s) => s.replace(/^[^\p{L}\p{N}+#.]+|[^\p{L}\p{N}+#)]+$/gu, "").trim())
    .filter((s) => s && s.length < 60 && !/:$/.test(s));

/** The resume an ATS would build from this text. */
export function resumeFromText(text) {
  const { sections, lines } = splitSections(text);
  const all = lines.join("\n");
  const contactLines = [...sections.top, ...(sections.contact || [])];

  const email = all.match(EMAIL)?.[0] || "";
  const phone = (contactLines.join(" ").match(PHONE) || all.match(PHONE))?.[1]?.trim() || "";
  // Contact details, with emails taken out first so "jane.doe" in an address isn't read as a website.
  const contactText = contactLines.join("  ").replace(new RegExp(EMAIL, "g"), " ");
  const urls = contactText.match(new RegExp(URL_LIKE, "gi")) || [];
  const linkedin = urls.find((u) => /linkedin\./i.test(u)) || "";
  const github = urls.find((u) => /github\./i.test(u)) || "";
  const website = urls.find((u) => u !== linkedin && u !== github && /\.[a-z]{2,}/i.test(u)) || "";
  // Location: a short "City, Region" left once phone, email and links are removed.
  const leftovers = contactText.replace(new RegExp(URL_LIKE, "gi"), " ").replace(new RegExp(PHONE, "g"), " ");
  const location = leftovers.split(/\s*[·|•]\s*|\s{2,}/).map(clean).find((x) => /^[\p{L}][\p{L} .'-]+, ?[\p{L}][\p{L} .'-]+$/u.test(x) && x.split(" ").length <= 5) || "";

  // The name is the first line of the top block that reads like one.
  const isContact = (l) => EMAIL.test(l) || PHONE.test(l) || URL_LIKE.test(l);
  const nameIndex = sections.top.findIndex((l) => !isContact(l) && /^[\p{L}][\p{L}.'’ -]+$/u.test(l) && l.split(" ").length >= 2 && l.split(" ").length <= 5);
  const name = nameIndex >= 0 ? sections.top[nameIndex] : "";
  const titleLine = nameIndex >= 0 ? sections.top[nameIndex + 1] : "";
  const title = titleLine && !isContact(titleLine) && titleLine.split(" ").length <= 8 ? titleLine : "";

  const experience = parseEntries(sections.experience || []).map((e) => ({
    title: byPattern(e, ROLE)[0],
    company: byPattern(e, ROLE)[1],
    location: e.rest[0] || "",
    startDate: e.dates[0],
    endDate: e.dates[1],
    description: e.description,
  }));
  const education = parseEntries(sections.education || [], { single: true }).map((e) => ({
    degree: byPattern(e, DEGREE)[0],
    institution: byPattern(e, DEGREE)[1],
    startYear: e.dates[1] ? e.dates[0] : "",
    endYear: e.dates[1] || e.dates[0],
    details: e.description,
  }));
  const projects = parseEntries(sections.projects || []).map((e) => ({
    name: e.first,
    role: "",
    link: e.link,
    startDate: e.dates[0],
    endDate: e.dates[1],
    description: e.description,
  }));
  const volunteering = parseEntries(sections.volunteering || []).map((e) => ({ role: e.first, organization: e.second, startDate: e.dates[0], endDate: e.dates[1], description: e.description }));
  const certifications = parseEntries(sections.certifications || [], { single: true }).map((e) => ({ name: e.first, issuer: e.second, date: e.dates[0] }));
  const awards = parseEntries(sections.awards || [], { single: true }).map((e) => ({ title: e.first, issuer: e.second, date: e.dates[0], description: e.description }));

  return normalizeResume({
    personal: { name, title, email, phone, city: location, linkedin, github, website },
    summary: (sections.summary || []).join(" "),
    experience,
    education,
    projects,
    volunteering,
    certifications,
    awards,
    skills: listOf(sections.skills || []).join(", "),
    languages: listOf(sections.languages || []).join(", "),
    interests: listOf(sections.interests || []).join(", "),
  });
}

/** Which of the main sections were found under a standard heading. */
export function sectionsFound(text) {
  return new Set(splitSections(text).order);
}
