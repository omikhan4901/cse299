/**
 * Interview prep (V2.1, docs/v2/SPEC.md §4): a prep sheet for one application, made from the
 * job text and the person's own material, with no AI. It never writes answers; it points at
 * what they already did that fits, names the gaps honestly, and lists the questions this kind
 * of role usually brings.
 *
 *   prepFor({ job, source, sent }) → { family, focus, stories, questions, ask, checklist }
 *     job:    { title, organisation, description }
 *     source: resume-shaped content to find evidence in (the copy sent, else the profile)
 *     sent:   true when `source` is the exact resume that was sent
 * Pure; shared by the app and the tests.
 */
import { countAny, jobKeywords } from "./ats/analyze.js";
import { normalizeResume, splitBullets, splitList } from "./resume.js";

const GENERAL = [
  { q: "Tell me about yourself.", tip: "About a minute: what you do now, one or two things you're proud of, and why this job is the next step." },
  { q: "Why do you want to work here?", tip: "Name something specific about the organisation or the role, not just the salary or location." },
  { q: "What are your strengths, and one thing you're working on?", tip: "Back each strength with an example; pick a real weakness and what you're doing about it." },
  { q: "Where do you see yourself in a few years?", tip: "Show you'd grow in this kind of role." },
  { q: "What are your salary expectations?", tip: "Know the range for the role and your minimum before you go in." },
];

// Question banks by kind of role. The first matching family wins; `general` always applies.
const FAMILIES = [
  {
    id: "academic", label: "Teaching and research",
    test: /\b(lecturer|professor|faculty|teacher|teaching|instructor|research (fellow|associate|assistant)|postdoc)\b/i,
    questions: [
      { q: "Which courses could you teach, and how would you teach one of them?", tip: "Pick one course and walk through a class: goals, activities, how you'd check learning." },
      { q: "Tell us about your research and what you'd work on here.", tip: "One sentence on the question, one on what you found, one on what's next." },
      { q: "How do you handle a large class, or students who are struggling?" },
      { q: "How would you supervise student projects or theses?" },
      { q: "Could you give a short demo lecture?", tip: "Prepare 10 minutes on a core topic, with one board diagram." },
    ],
    ask: ["What would my teaching load be in the first year?", "How is research supported (time, funding, labs)?"],
  },
  {
    id: "software", label: "Software and engineering",
    // Not a bare "engineer": civil, electrical and site engineers get the general questions.
    test: /\b(software|developer|programmer|devops|sre|site reliability|frontend|front-end|backend|back-end|full[ -]?stack|web|mobile app|android|ios|qa engineer|test automation|platform engineer|cloud engineer)\b/i,
    questions: [
      { q: "Walk us through a project you built. What was hard, and what would you change?", tip: "Use a project from your resume; know its architecture and your part in it." },
      { q: "How would you design a system like the one this team builds?", tip: "Clarify requirements first, then data, APIs, scaling and failure cases." },
      { q: "Tell us about a bug or outage you fixed.", tip: "What broke, how you found it, the fix, and what you changed so it doesn't happen again." },
      { q: "How do you test and review code?" },
      { q: "Expect a coding exercise.", tip: "Practise a few problems out loud: explain your thinking before you type." },
    ],
    ask: ["What does a normal week look like for the team?", "How are code reviews and releases done here?"],
  },
  {
    id: "data", label: "Data and analysis",
    test: /\b(data(?! entry)|analyst|analytics|business intelligence|machine learning|ml engineer|data scientist|statistic)/i,
    questions: [
      { q: "Tell us about an analysis that changed a decision.", tip: "The question, the data, what you found, and what happened because of it." },
      { q: "How do you check that data is right before you use it?" },
      { q: "Explain a technical result to someone non-technical.", tip: "Lead with the answer, then one chart's worth of evidence." },
      { q: "Expect a SQL or spreadsheet exercise." },
    ],
    ask: ["Which decisions does this role's work feed into?", "Where does the team's data come from, and how clean is it?"],
  },
  {
    id: "design", label: "Design",
    test: /\b(designer|design|ux|ui|graphic|product design|illustrat)/i,
    questions: [
      { q: "Walk us through your portfolio: pick one project end to end.", tip: "Problem, who it was for, options you tried, the result." },
      { q: "How do you handle feedback you disagree with?" },
      { q: "How do you work with developers or clients?" },
    ],
    ask: ["Who gives design feedback here, and how often?", "What tools and design system does the team use?"],
  },
  {
    id: "commercial", label: "Sales, marketing and business",
    test: /\b(sales|marketing|brand|business development|growth|account manager|relationship manager|digital marketing|content|social media|merchandis)/i,
    questions: [
      { q: "Tell us about a target or campaign you're proud of, with numbers." },
      { q: "How would you sell our product to a new customer?", tip: "Learn the product and one competitor before the interview." },
      { q: "Tell us about a deal or campaign that didn't work, and what you learned." },
      { q: "How do you plan your week and track results?" },
    ],
    ask: ["How is success in this role measured in the first six months?", "Who are the main customers and competitors?"],
  },
  {
    id: "finance", label: "Finance, banking and accounts",
    test: /\b(accounts?|accountant|finance|financial|audit(or)?|bank|banking|credit|treasury|tax)\b/i,
    questions: [
      { q: "Walk us through a set of accounts or a report you prepared." },
      { q: "How do you make sure your numbers are accurate?" },
      { q: "Tell us about a mistake you caught (or made) and how it was fixed." },
      { q: "Expect questions on current rules or regulations for this role.", tip: "Read up on anything the circular mentions (e.g. IFRS, tax, Bangladesh Bank rules)." },
    ],
    ask: ["What does the first month in the role involve?", "Which systems and software does the team use?"],
  },
];
const GENERAL_FAMILY = { id: "general", label: "General", questions: [], ask: ["What would success look like in this role after six months?", "What are the next steps after this interview?"] };

/** The kind of role, from the job title (then the start of the description). */
export function familyFor(job) {
  const title = String(job?.title || "");
  const head = String(job?.description || "").slice(0, 400);
  return FAMILIES.find((f) => f.test.test(title)) || FAMILIES.find((f) => f.test.test(head)) || GENERAL_FAMILY;
}

/** Every point in the content with where it came from ("Pathao · Software Engineer"). */
function pointsOf(content) {
  const r = normalizeResume(content);
  const out = [];
  const add = (lines, where) => splitBullets(lines).forEach((text) => text.trim() && out.push({ text: text.trim(), where }));
  for (const e of r.experience) add(e.description, [e.company, e.title].filter(Boolean).join(" · "));
  for (const p of r.projects) add(p.description, p.name || "Project");
  for (const v of r.volunteering) add(v.description, [v.organization, v.role].filter(Boolean).join(" · "));
  for (const a of r.awards) if (a.title) out.push({ text: [a.title, a.description].filter(Boolean).join(": "), where: a.issuer || "Award" });
  return { points: out, skills: splitList(r.skills), resume: r };
}

const hasNumber = (t) => /\d/.test(t);

/** The prep sheet. Returns null without a job title or description to work from. */
export function prepFor({ job, source, sent = false } = {}) {
  if (!job || !(job.title || job.description)) return null;
  const family = familyFor(job);
  const text = [job.title, job.description].filter(Boolean).join("\n");
  const keywords = text.trim().length >= 40 ? jobKeywords(text).filter((k) => k.kind !== "soft") : [];
  const { points, skills, resume } = pointsOf(source || {});

  // What they'll look for: the job's strongest skills, each with the person's own evidence.
  const used = new Set();
  const focus = [...keywords]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 6)
    .map((k) => {
      const evidence = points.find((p) => !used.has(p.text) && countAny(p.text, k.aliases)) || points.find((p) => countAny(p.text, k.aliases)) || null;
      if (evidence) used.add(evidence.text);
      const listed = skills.some((s) => countAny(s, k.aliases));
      return { name: k.name, evidence, listed, gap: !evidence && !listed };
    });

  // Stories to have ready: points with results (numbers) that touch the job's skills first.
  const score = (p) => keywords.reduce((s, k) => s + (countAny(p.text, k.aliases) ? k.importance : 0), 0) + (hasNumber(p.text) ? 1 : 0);
  const stories = points
    .map((p, i) => ({ ...p, i, s: score(p) }))
    .filter((p) => hasNumber(p.text) || p.s > 1)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, 3)
    .map(({ text: t, where }) => ({ text: t, where }));

  // Likely questions: the role's usual ones, one per skill they have evidence for, and the general set.
  const questions = [
    ...family.questions,
    ...focus.filter((f) => f.evidence).slice(0, 3).map((f) => ({ q: `Tell us about your experience with ${f.name}.`, tip: `Use: "${f.evidence.text}"` })),
    ...focus.filter((f) => f.gap).slice(0, 2).map((f) => ({ q: `The job mentions ${f.name}. What do you know about it?`, tip: "Be honest about your level, and say how you'd get up to speed." })),
    ...GENERAL,
  ];

  const org = job.organisation || "the organisation";
  const checklist = [
    `Re-read the job circular and your ${sent ? "resume as you sent it" : "resume"}`,
    `Look up ${org}: what they do, and any recent news`,
    "Prepare a one-minute introduction",
    "Bring printed copies of your resume, and certificates if they ask for originals",
    "Plan your route (or test your camera and link for an online interview) and arrive early",
  ];

  return {
    family: { id: family.id, label: family.label },
    focus,
    stories,
    questions,
    ask: [...family.ask, ...(family === GENERAL_FAMILY ? [] : GENERAL_FAMILY.ask)].slice(0, 4),
    checklist,
    sent,
    empty: !resume.experience.length && !resume.projects.length && !skills.length,
  };
}

/** The sheet as plain text, for copying or printing. */
export function prepText(prep, job) {
  if (!prep) return "";
  const name = [job?.title, job?.organisation].filter(Boolean).join(" · ");
  const lines = [`Interview prep: ${name}`, ""];
  if (prep.focus.length) {
    lines.push("What they'll look for");
    for (const f of prep.focus) lines.push(`- ${f.name}: ${f.evidence ? f.evidence.text : f.listed ? "in your skills; have an example ready" : "not on your resume; be honest about your level"}`);
    lines.push("");
  }
  if (prep.stories.length) {
    lines.push("Stories to have ready");
    for (const s of prep.stories) lines.push(`- ${s.text} (${s.where})`);
    lines.push("");
  }
  lines.push("Likely questions");
  for (const q of prep.questions) lines.push(`- ${q.q}${q.tip ? `\n  ${q.tip}` : ""}`);
  lines.push("", "Questions to ask them");
  for (const q of prep.ask) lines.push(`- ${q}`);
  lines.push("", "Before you go");
  for (const c of prep.checklist) lines.push(`- ${c}`);
  return lines.join("\n");
}
