/**
 * Job capture (V2, docs/v2/SPEC.md §5.4): reads a pasted job post or circular (English or
 * Bangla: Bdjobs, LinkedIn, university and government circulars) and pulls out what the
 * tracker needs. Rule-based: no AI, no credits. Pure; shared by the app and the tests.
 *
 *   captureJob(text, { now }) → { title, organisation, deadline ("YYYY-MM-DD"), location,
 *     jobType, salary, applyVia: [...], email, url, keywords: [...] }
 * Anything it can't find is left empty for the person to fill in.
 */
import { jobKeywords } from "./ats/analyze.js";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const asciiDigits = (s) => String(s ?? "").replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  জানুয়ারি: 1, জানুয়ারী: 1, ফেব্রুয়ারি: 2, ফেব্রুয়ারী: 2, মার্চ: 3, এপ্রিল: 4, মে: 5, জুন: 6, জুলাই: 7, আগস্ট: 8, আগষ্ট: 8,
  সেপ্টেম্বর: 9, অক্টোবর: 10, নভেম্বর: 11, ডিসেম্বর: 12,
};
const MONTH_WORDS = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const pad = (n) => String(n).padStart(2, "0");
const validDate = (y, m, d) => {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
};
const fullYear = (y) => (y < 100 ? 2000 + y : y);

/** Every date written in the text, in order: { iso, index }. Day-first for numeric dates (as in Bangladesh). */
export function findDates(text) {
  const t = asciiDigits(text);
  const out = [];
  const push = (iso, index) => iso && out.push({ iso, index });
  const patterns = [
    // 15 October 2026, 15th Oct, 2026, 15 অক্টোবর ২০২৬
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/.,]*(${MONTH_WORDS})\\.?[\\s\\-/.,]*(\\d{2,4})`, "giu"), (m) => validDate(fullYear(+m[3]), MONTHS[m[2].toLowerCase()], +m[1])],
    // October 15, 2026
    [new RegExp(`(${MONTH_WORDS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, "giu"), (m) => validDate(+m[3], MONTHS[m[1].toLowerCase()], +m[2])],
    // 2026-10-15
    [/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, (m) => validDate(+m[1], +m[2], +m[3])],
    // 15/10/2026, 15-10-26, 15.10.2026 (day first; month first only when the first number can't be a month)
    [/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g, (m) => (+m[2] > 12 ? validDate(fullYear(+m[3]), +m[1], +m[2]) : validDate(fullYear(+m[3]), +m[2], +m[1]))],
  ];
  const taken = [];
  for (const [re, toIso] of patterns) {
    for (const m of t.matchAll(re)) {
      if (taken.some(([a, b]) => m.index < b && m.index + m[0].length > a)) continue;
      taken.push([m.index, m.index + m[0].length]);
      push(toIso(m), m.index);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

const DEADLINE_WORDS = /(deadline|last date|closing date|apply (?:by|before|within)|application(?:s)? (?:must|should) (?:reach|be (?:submitted|received))|submission date|valid (?:till|until)|expires?|\b(?:by|before|until|till)(?=\s+\d)|শেষ তারিখ|আবেদনের শেষ|শেষ সময়|আবেদন করা যাবে|তারিখের মধ্যে|পর্যন্ত)/i;

/** The application deadline: the date closest after a deadline phrase (else none). */
export function findDeadline(text) {
  const t = asciiDigits(text);
  const dates = findDates(t);
  if (!dates.length) return "";
  let best = null;
  for (const m of t.matchAll(new RegExp(DEADLINE_WORDS.source, "gi"))) {
    // A date within ~120 characters after the phrase, or on the same line before it ("১৫/১০/২০২৬ তারিখের মধ্যে").
    const after = dates.find((d) => d.index >= m.index && d.index - m.index <= 120);
    const lineStart = t.lastIndexOf("\n", m.index) + 1;
    const before = [...dates].reverse().find((d) => d.index < m.index && d.index >= lineStart);
    const pick = after || before;
    if (pick && (!best || pick.index > best.index)) best = pick;
  }
  return best?.iso || "";
}

const clean = (s) => String(s || "").replace(/\s+/g, " ").replace(/^[\s:–\-•*|]+|[\s:–\-•*|.,]+$/g, "").trim();
const field = (text, labels) => {
  // At the start of a line, or after a sentence ("We are hiring! Position: …").
  const re = new RegExp(`(?:^|\\n|[.!?]\\s+)\\s*(?:${labels})\\s*[:：\\-–]\\s*(.+)`, "iu");
  const m = text.match(re);
  return m ? clean(m[1]).slice(0, 140) : "";
};

const ROLE = /(engineer|developer|manager|analyst|designer|specialist|consultant|intern(ship)?|officer|lead|architect|scientist|coordinator|associate|assistant|representative|executive|administrator|technician|nurse|accountant|teacher|lecturer|professor|instructor|director|writer|marketer|programmer|researcher|strategist|agent|advisor|operator|trainee|head|supervisor|clerk|doctor|pharmacist|editor|tutor|faculty)\b/i;

function findTitle(text, lines) {
  const labelled = field(text, "job title|position|post name|name of (?:the )?post|designation|job position|role|পদের নাম|পদবি|পদ");
  if (labelled) return labelled.replace(/\s*\(.*?\)\s*$/, "").trim();
  const invited = text.match(/(?:for the (?:post|position)s? of|position of|post of|hiring|looking for(?: our next)?|seeking|vacancy for)\s+(?:an?\s+)?([A-Z][\w&/().,' -]{2,70}?)(?=\s+(?:at|in|for|to|who|with|on)\b|[.,:;\n(]|$)/);
  if (invited && ROLE.test(invited[1])) return clean(invited[1]);
  // A short line near the top that names a role (Bdjobs and LinkedIn start with the title).
  const line = lines.slice(0, 6).find((l) => l.split(/\s+/).length <= 9 && ROLE.test(l) && !/[.!?]$/.test(l) && !/^(about|we|our|job description|responsibilities)/i.test(l));
  return line ? clean(line) : "";
}

const ORG_SUFFIX = /\b(ltd|limited|plc|inc|llc|corp(?:oration)?|company|group|bank|university|college|school|institute|foundation|ngo|agency|ministry|directorate|department|bureau|authority|commission|hospital|pvt|private|telecom|bangladesh|technologies|solutions|software|systems|labs?|studio|consult(?:ing|ants)?)\b/i;

// Email providers anyone can use: their domain says nothing about the employer.
const FREE_MAIL = new Set(["gmail", "yahoo", "hotmail", "outlook", "live", "icloud", "aol", "proton", "protonmail", "ymail", "mail", "gmx", "zoho", "bdjobs", "linkedin", "google", "forms", "docs", "bit", "tinyurl"]);

function findOrganisation(text, lines, title) {
  const labelled = field(text, "company(?: name)?|organi[sz]ation(?: name)?|employer|institution|প্রতিষ্ঠানের নাম|প্রতিষ্ঠান|অফিসের নাম");
  if (labelled) return labelled;
  const at = text.match(/(?:\bat|\bjoin|\bby)\s+((?:[A-Z][\w&.'-]*[ ]?){1,6})(?=[,.\n]|\s+(?:is|are|as|in|and|we)\b)/);
  if (at && ORG_SUFFIX.test(at[1])) return clean(at[1]);
  const invites = text.match(/((?:[A-Z][\w&.'-]*[ ]?){1,7})\s+(?:is (?:looking|seeking|hiring)|invites|is inviting|seeks)/);
  if (invites) return clean(invites[1]);
  const org = lines.slice(0, 8).find((l) => l !== title && ORG_SUFFIX.test(l) && l.split(/\s+/).length <= 10 && !ROLE.test(l.replace(ORG_SUFFIX, "")));
  if (org) return clean(org);
  // Last resort: the company's own email or web domain ("career@relisource.com" → "Relisource").
  const domain = text.match(/@([a-z0-9-]+)\.[a-z.]{2,}|https?:\/\/(?:www\.)?([a-z0-9-]+)\./i);
  const name = (domain?.[1] || domain?.[2] || "").toLowerCase();
  return name && name.length >= 3 && !FREE_MAIL.has(name) ? name[0].toUpperCase() + name.slice(1) : "";
}

const CITIES = ["Dhaka", "Chattogram", "Chittagong", "Sylhet", "Khulna", "Rajshahi", "Barishal", "Barisal", "Rangpur", "Mymensingh", "Gazipur", "Narayanganj", "Cumilla", "Comilla", "Cox's Bazar", "Bogura", "Savar", "Jessore", "Jashore", "Dinajpur"];
const CITIES_BN = { ঢাকা: "Dhaka", চট্টগ্রাম: "Chattogram", সিলেট: "Sylhet", খুলনা: "Khulna", রাজশাহী: "Rajshahi", বরিশাল: "Barishal", রংপুর: "Rangpur", ময়মনসিংহ: "Mymensingh", গাজীপুর: "Gazipur", নারায়ণগঞ্জ: "Narayanganj", কুমিল্লা: "Cumilla" };

function findLocation(text) {
  const labelled = field(text, "job location|location|work(?:ing)? location|place of (?:work|posting)|কর্মস্থল|কর্মস্থলের নাম");
  if (labelled) return labelled.slice(0, 80);
  if (/\b(remote|work from home|wfh)\b/i.test(text)) return "Remote";
  const city = CITIES.find((c) => new RegExp(`\\b${c.replace("'", "'?")}\\b`, "i").test(text));
  if (city) return city;
  const bn = Object.keys(CITIES_BN).find((c) => text.includes(c));
  return bn ? CITIES_BN[bn] : "";
}

function findJobType(text) {
  const t = text.toLowerCase();
  if (/\binternship\b|\bintern\b|ইন্টার্ন/.test(t)) return "Internship";
  if (/\bpart[- ]time\b|খণ্ডকালীন/.test(t)) return "Part-time";
  if (/\bcontract(ual)?\b|চুক্তিভিত্তিক/.test(t)) return "Contract";
  if (/\bfull[- ]time\b|পূর্ণকালীন|স্থায়ী/.test(t)) return "Full-time";
  return "";
}

function findSalary(text) {
  const labelled = field(text, "salary(?: range)?|compensation|remuneration|pay scale|monthly salary|বেতন(?: স্কেল)?|বেতন ও ভাতা");
  if (labelled) return labelled.slice(0, 80);
  const t = asciiDigits(text);
  const grade = t.match(/\b(?:grade|গ্রেড)[\s-]*(\d{1,2})\b|\b(\d{1,2})(?:th|ম|তম)?\s*গ্রেড/i);
  if (grade) return `Grade ${grade[1] || grade[2]}`;
  const tk = t.match(/(?:tk\.?|bdt|৳)\s*[\d,]+(?:\s*(?:-|–|to)\s*(?:tk\.?|bdt|৳)?\s*[\d,]+)?/i);
  if (tk) return clean(tk[0]);
  if (/\bnegotiable\b|আলোচনা সাপেক্ষে/i.test(text)) return "Negotiable";
  return "";
}

/** How to apply, for the checklist: Teletalk (government), Bdjobs, email, post or an online form. */
function findApplyVia(text) {
  const t = text.toLowerCase();
  const via = [];
  if (/teletalk\.com\.bd|টেলিটক/.test(t)) via.push("teletalk");
  if (/bdjobs/.test(t)) via.push("bdjobs");
  // An address with "send", "email", "apply"… shortly before it.
  if (/\b(e-?mail(?:ing)?|send|submit|forward|apply|cv|resume)\b[^\n@]{0,80}[\w.+-]+@[\w-]+\.|ই-?মেইল/.test(t)) via.push("email");
  if (/\bby post\b|hard ?copy|courier|ডাকযোগে|সরাসরি জমা/.test(t)) via.push("post");
  if (!via.length && /\bapply (online|now|here|through)\b|অনলাইনে আবেদন/.test(t)) via.push("online");
  return via;
}

export function captureJob(input, { now = new Date() } = {}) {
  const text = String(input || "").replace(/\r/g, "").slice(0, 30000);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = findTitle(text, lines);
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] || "";
  const url = text.match(/https?:\/\/[^\s<>"')]+/)?.[0]?.replace(/[.,;]+$/, "") || "";
  let deadline = findDeadline(text);
  // A deadline long past is more likely a misread (e.g. a publication date) than a real one.
  if (deadline && new Date(deadline) < new Date(now.getTime() - 365 * 864e5)) deadline = "";
  const organisation = findOrganisation(text, lines, title);
  return {
    title,
    organisation,
    deadline,
    location: findLocation(text),
    jobType: findJobType(text),
    salary: findSalary(text),
    applyVia: findApplyVia(text),
    email,
    url,
    keywords: jobKeywords(text, { ignore: [organisation].filter(Boolean) }).slice(0, 25).map((k) => k.name),
  };
}
