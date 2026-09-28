# ResumeX V2: product specification and roadmap

Status: proposal for the owner's decisions (see "Decisions needed").
Written against the code on `main` as of 28 September 2026.

---

## 1. The thesis in one paragraph

V1 answers "make me a good resume". V2 should answer **"help me get this job, and the next
one"**: one **Career Profile** holds everything true about the person; every application
gets a **tailored resume generated from it**; every application is **tracked** until it ends;
and the product tells the person, from their own data, what to do next. AI is used where it
removes real work (turning messy text into structured data, polishing the few lines that
matter). The workspace itself (profile, tailoring by selection, tracking, reminders, checks)
is deterministic, so it costs almost nothing to run and still feels like a lot of product.

Five principles decide every feature below:

1. **Enter once, reuse everywhere.** Nothing the user types should need typing again.
2. **Deterministic first, AI second.** If rules or selection can do it, don't call a model.
3. **AI proposes, the user approves.** AI output lands as a reviewable change, never silently.
4. **Every AI action shows its credit cost before it runs** (batch jobs especially).
5. **Fewer, finished features** beat many half-features. No feature ships without the
   integration checklist in `CLAUDE.md` (plans, credits, admin, rate limits, legal, tests).

---

## 2. What exists today (the parts V2 builds on)

| Area | Today | Relevance to V2 |
| --- | --- | --- |
| Builder | 50 templates, live PDF, autosave with revisions and conflict dialog, private sessions, drafts | Stays the editing surface for every tailored resume |
| "Master resume" | A resume flagged `isMaster`; "Fill from master" copies its content into another resume | Replaced by the Career Profile |
| Import | `/ai/parse` reads a **PDF/DOCX file** (3 credits) and **replaces** the open resume | Becomes "paste or upload anything → review → merge into profile" |
| AI assistant | Chat that answers questions; can only paste a reply into "About me" | Must be able to propose structured edits |
| ATS engine | Deterministic: parsing checks, 30+ content checks, **job keyword extraction and matching** (`jobKeywords`) | The heart of deterministic tailoring and job matching, already built |
| Plans, credits | Free / Pro / Premium, admin-editable costs (chat 1, refine 1, audit 2, parse 3, cover letter 2), refunds on failure | Extended for variable-cost and batch actions |
| Payments | Paddle subscriptions, webhooks, refund policy and checks | Unchanged; pricing recommendations below |
| Campaigns | Invite codes giving a plan and credits (e.g. a university) | The best B2B channel in Bangladesh (see §8) |

---

## 3. The external analysis, challenged

Keep:

- **Career Profile as the single source of truth.** Correct, and it should be the architectural
  foundation.
- **"Messy input → structured profile" as the core AI capability.** Correct. It is the one AI
  feature that removes the most work per credit.
- **Job tracker, checklist, deterministic stats.** Correct direction.

Challenge:

| Claim in the analysis | Problem | What V2 does instead |
| --- | --- | --- |
| A job record with ~25 fields (salary, source, communication history, attachments…) | Long forms kill trackers. People stop updating a tracker that feels like data entry, and then every statistic is wrong. | **Capture in one step**: paste a job link or circular text → title, company, deadline and keywords filled automatically. Everything else is optional and appears only when relevant (e.g. "Add interview" once status is Interviewing). |
| Analytics like "your lecturer applications have a 22% interview rate" | Most people send 10–40 applications. Rates on that volume are noise, and statuses go stale because employers ghost. | Show **counts, a funnel and overdue follow-ups**. Show rates only above a minimum sample (e.g. 15 applications in a group) and treat silence after N days as its own status ("No response"). |
| Evidence and confidence scores on every claim | Heavy to build and to show; users won't manage provenance. | One light rule: **AI-written text is marked "Review"** until the user accepts or edits it. Imports keep the original pasted text for reference. |
| Document vault (certificates, transcripts, recommendation letters) | Storing NIDs and transcripts makes ResumeX a target and a liability, and needs object storage (photos are already stored inside MongoDB, which doesn't scale). | **Not in V2.** Applications store **links** (Drive/Dropbox). Revisit with object storage in V3. |
| Calendar, communication history | Manual logging is a chore; syncing is a large integration. | Dates live on the application (deadline, follow-up, interviews) with **in-app and email reminders**. Calendar export (.ics) later. |
| "Generate N portfolios" by having AI rewrite the whole CV per job | Cost grows linearly, quality drifts, and AI rewriting is where invented facts appear. | **Tailoring is mostly selection**, done deterministically with the existing keyword engine; AI only polishes the summary and the top bullets, optional and priced up front (§5.3). |
| Subscription as the only way to pay | Job searches are episodic (weeks to months); people cancel when hired. | Offer a **Job Search Pass** (e.g. 3 months, one payment) next to monthly (§7). |

Missing from the analysis:

- **Frozen snapshots.** When someone applies, the exact resume sent must be kept. If the
  application points at a live document that later changes, the history is wrong.
- **Payment reality in Bangladesh.** Paddle takes cards and PayPal. Many Bangladeshi job
  seekers pay with bKash/Nagad, not cards. This may limit conversion more than any feature.
- **AI unit economics.** Premium's 1,000 credits/month could cost more than the plan earns
  if they're all spent on output-heavy calls. Measure real cost per call before promising
  more AI (§7).
- **Local formats.** Bangladeshi employers, especially government and many local companies,
  expect a "biodata"-style CV (father's and mother's names, NID, date of birth, permanent
  and present address, photo). No international builder does this well.

---

## 4. Every proposed feature, evaluated

Scale: ●●● high, ●● medium, ● low. AI cost is per use.

| Feature | User value | Target user | AI cost | Build | Retention | Monetization | Differentiation | V2? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Career Profile (one source of truth) | ●●● | Everyone applying to more than one job | none | ●●● | ●●● (the asset they come back to) | ●● (enables paid tailoring) | ●● | **Yes, foundation** |
| Paste-anything import → review → merge | ●●● | Everyone, especially people who won't edit forms | 1 call (≈3 credits) | ●● (parse pipeline exists) | ●● | ●● | ●●● when it merges instead of replacing | **Yes, first** |
| Assistant that edits (proposes changes you apply) | ●●● | The "just tell me what to do" user | 1 call per turn | ●● | ●● | ●● | ●● | **Yes** |
| Deterministic tailoring to a job (select, reorder, keyword report) | ●●● | Active applicants | none | ●● (keyword engine exists) | ●●● | ●●● (Pro) | ●●● | **Yes** |
| AI polish of a tailored resume (summary + top bullets) | ●● | Active applicants | 1 call per job | ● | ● | ●●● (credits) | ● | **Yes, optional** |
| Batch: tailor for several jobs at once | ●● | Heavy applicants (lecturer + teacher + SWE) | per job, shown up front | ● on top of the above | ● | ●● | ●● | **Yes, after single** |
| Application tracker (capture, statuses, board and list) | ●●● | Active applicants | none | ●● | ●●● | ●● | ● alone, ●●● with profile + snapshots | **Yes** |
| Job capture from link or circular text | ●●● | Everyone using the tracker | none (rules); optional 1 call for image/PDF circulars | ●● | ●● | ● | ●● (BD circulars) | **Yes, text first** |
| Snapshot of the resume sent | ●●● | Tracker users | none | ● | ●● | ●● | ●●● | **Yes** |
| Application checklist | ●● | Tracker users | none | ● | ●● | ● | ● | **Yes** |
| Deadlines, follow-ups, interview dates + reminders | ●●● | Tracker users | none (email: pennies) | ●● (needs a scheduler) | ●●● | ●● | ●● | **Yes** (in-app first, email next) |
| Funnel and counts | ●● | Tracker users | none | ● | ●● | ● | ● | **Yes, simple** |
| Rates by role/resume version | ● (noise at low volume) | Heavy applicants | none | ● | ● | ● | ● | Later, with a minimum sample |
| Version compare ("what changed") | ●● | Users with many versions | none | ●● | ● | ● | ●● | V2.1 |
| Cover letter from profile + job | ●● | Applicants to jobs that ask | 1 call (exists) | ● (wire it to jobs) | ● | ●● | ● | **Yes, wiring only** |
| Bangladesh biodata CV format | ●●● for local jobs | Govt/local-company applicants | none | ●● (fields + templates) | ● | ●● | ●●● | **Yes** |
| Bangla-language CV | ●● | Local jobs asking for Bangla | none | ●●● (PDF text shaping risk) | ● | ● | ●●● | **Spike first** (see risks) |
| Public profile page (portfolio link) | ●● | Students, developers | none | ●● (share links exist) | ●● | ● | ● | V2.1 |
| Interview prep (question bank per role, deterministic) | ●● | People with interviews | none | ●● (content work) | ●● | ● | ● | V2.1 |
| AI mock interview / interview coach | ● (quality hard to guarantee) | — | high, many turns | ●●● | ● | ● | ● | **No** |
| Salary predictor | ● (no reliable BD data) | — | — | ●● | ● | ● | ● | **No** |
| Job feed / scraping job boards | ●●● if legal | — | — | ●●● and legal/ToS risk | ●●● | ●● | ●● | **No** until partnerships |
| Auto-apply bots | harmful to users' reputations | — | — | ●●● | — | — | — | **No, ever** |
| LinkedIn scraping | — (ToS) | — | — | — | — | — | — | **No.** LinkedIn's "Save to PDF" works with import |
| Document vault | ●● | — | none | ●●● + liability | ●● | ● | ● | **No** (links only) |
| Email/calendar sync, networking CRM, gamification, community | ● | — | — | ●●● | ● | ● | ● | **No** |

---

## 5. V2 product specification

### 5.1 Career Profile

One per account. It replaces the "master resume" and becomes where everything true about
the person lives.

- **Contents:** everything the resume schema has today (personal, summary, experience,
  education, projects, certifications, volunteering, awards, publications, courses,
  references, links, skills, languages, interests, custom sections), plus:
  - **Bullets as individual items** (each with an id), so a tailored resume can pick some
    bullets of a job and not others.
  - **Skills as a list of items** with an optional group (Languages, Frameworks…), instead
    of one comma-separated string.
  - **Tags on items** (optional, added automatically from keywords): e.g. `teaching`,
    `backend`, which the tailoring engine uses.
  - **Summary variants**: several labelled summaries ("Academic", "Industry").
  - **Bangladesh biodata fields** (optional, hidden unless turned on): father's name,
    mother's name, date of birth, NID, religion, nationality, permanent and present
    address, marital status. Never used by international templates.
- **Completeness meter:** deterministic ("Add dates to 2 jobs", "3 bullets have no
  numbers"), reusing the ATS content checks.
- **Where it's edited:** a Profile page with the same section editors as the builder
  (same components), plus the import and the assistant.
- **Migration:** on first visit, the profile is created from the master resume, or the
  most recently edited resume, with the user's confirmation. Existing resumes keep their
  content and keep working unchanged.

### 5.2 Getting information in: paste anything, and an assistant that edits

**Paste-anything import** (the answer to "people won't edit sections one by one"):

1. One box: paste text of any kind (an old CV, a LinkedIn "About", a paragraph about a
   job, a certificate's text) or drop a PDF/DOCX.
2. One AI call turns it into structured items (the existing transcription schema and
   mapping in `server/lib/resumeImport.js`, extended to accept text).
3. **Review screen, not a silent overwrite:** "We found 2 jobs, 1 degree, 11 skills, 1
   project." Each item shows **new / updates an existing item / duplicate**, matched
   deterministically (same company + overlapping dates, same institution, same
   skill name). The user accepts all, or item by item.
4. Accepted items are merged into the Career Profile. AI-written wording is marked
   "Review" until touched; the original pasted text is kept for 30 days for reference.

Cost: 3 credits per import (today's parse cost), shown on the button. Text input is
cheaper to process than PDFs, so the admin may lower it.

**The assistant becomes an editor.** In the builder and on the Profile, the assistant can
answer with **proposed changes** alongside its text: "Add this job", "Rewrite these 3
bullets", "Move Skills above Education". Each proposal is a small structured patch shown
as a card with **Apply** / **Dismiss**; nothing changes until Apply. One credit per
message, as today. Guardrail: the model may only restructure or reword what the user
provided, and any number or fact not in the user's text is highlighted for review.

### 5.3 Tailored resumes (the "n resumes from one profile" feature)

A tailored resume is a normal ResumeX resume (so the builder, templates, PDF engine, ATS
check, share links and autosave all keep working), **generated from the profile for one
job**.

**Deterministic tailoring (no AI, no credits):**

1. The job description goes through the existing `jobKeywords()` engine.
2. Every profile item (job, bullet, project, skill, certification) is scored by keyword
   overlap and tags; recency gives a small bonus.
3. The generator picks the most relevant items to fit one or two pages, orders sections
   for the role (e.g. Education and Publications first for lecturer jobs, detected from
   the job description), chooses the matching summary variant, and suggests a template
   category (Academic for a lecturer job, ATS-Optimized for corporate).
4. It shows a **match report before and after**: matched and missing keywords, and which
   missing keywords do appear somewhere in the profile, with a one-click "include".

**AI polish (optional, priced):** rewrite the summary and the top N bullets for the
job's language, using only facts from the profile. Shown as proposed changes (§5.2).
Suggested cost: 2 credits per job.

**Batch (the lecturer + teacher + SWE case):** paste several job descriptions (or pick
saved jobs from the tracker). ResumeX creates one tailored resume per job
deterministically for free, then offers AI polish for all of them: "Polish 3 resumes:
6 credits. You have 240." Credits are charged per job; any job that fails is refunded.

**Staying in sync:** each tailored item remembers which profile item it came from. When the
profile changes, the resume shows "3 updates from your profile" with **Pull updates**.
Edits made inside a tailored resume offer **Save to profile** so good rewrites aren't lost.

### 5.4 Applications (job tracker)

**Capture in one step:** paste a job link or the circular's text. Rules extract title,
organisation, deadline ("Application deadline: 15 October 2026", "আবেদনের শেষ তারিখ"),
location, and keywords. The job description is stored. (Image and PDF circulars: optional
AI extraction for 1 credit, later.)

**An application has:** job (title, organisation, link, description, deadline, location,
salary text), status, the resume sent (a **frozen snapshot**, see §6), cover letter, notes,
contacts (name, role, email or phone), dates (applied, follow-up, interviews with notes),
links to documents, and a checklist.

**Statuses:** Saved → Preparing → Applied → Interviewing → Offer, plus Rejected,
Withdrawn and **No response** (suggested automatically N days after applying with no
change). Every status change is recorded with its date.

**Views:** a board (drag between statuses) and a sortable list; filters by status, deadline
and role.

**Checklist per application** (deterministic): job description added; tailored resume
created; ATS match above 70%; cover letter (if asked); submitted; follow-up sent;
interview prepared. The next unchecked item is shown on the card as the "next step".

**From an application, one click to:** tailor a resume for it (§5.3), write a cover letter
from the profile and the job (existing feature, 2 credits), run the ATS check against
its description.

### 5.5 Home: "What should I do today?"

The dashboard becomes a job-search home:

- Due soon: deadlines in the next 7 days, follow-ups due, interviews this week.
- Next steps: applications whose checklist has an obvious next item.
- The funnel: saved / applied / interviewing / offers, and applications this week.
- Profile health: the completeness meter.

**Reminders:** in-app first (computed on load, no infrastructure). Then an **email
digest** (weekly, plus a day-before reminder for deadlines and interviews), sent by a
Cloud Scheduler job calling an internal endpoint; unsubscribe per type in Account.

### 5.6 Bangladesh-first touches

- **Biodata CV format:** 2–3 templates with the biodata fields (§5.1), photo-ready,
  one-page. Deterministic.
- **Circular-aware capture:** Bangla and English deadline phrases, "apply through
  Teletalk/Bdjobs" detection that adds the right checklist items.
- **Lecturer and academic applications:** section ordering and checklist items for
  publications, research statement and teaching experience.
- **Bangla CV:** only after a technical spike (see §11).
- **Campaigns for universities and career clubs:** already built; add a small report for
  the campaign owner (sign-ups, active users) later.

### 5.7 Plans

| | Free | Pro | Premium |
| --- | --- | --- | --- |
| Career Profile, builder, free templates, ATS check | ✓ | ✓ | ✓ |
| Paste-anything import | 1 a month | uses credits | uses credits |
| Tracked applications | **up to 5 active** | unlimited | unlimited |
| Deterministic tailoring | 1 tailored resume | unlimited | unlimited |
| Snapshots, checklist, reminders | in-app only | + email | + email |
| All templates, biodata templates | biodata only | ✓ | ✓ |
| AI credits | 10 a day | 300 a month | 1,000 a month (see §7) |
| Batch tailoring | – | up to 5 jobs at once | up to 15 |

Why the tracker has a free tier (challenging "obviously Pro"): a tracker only pays off
once someone depends on it. Five active applications lets a free user feel the habit and
hit the limit exactly when they're applying seriously, which is when they'll pay.
Everything in this table should be admin-editable, like today's plans.

---

## 6. Data model and architecture

### Key decision: tailored resumes are copies with provenance, not live views

Two options:

1. **Live projection:** a tailored resume stores only references to profile items.
   Elegant, but it means rewriting the builder, PDF engine, ATS check, public links,
   autosave and conflict handling, and a resume already sent could change when the
   profile changes.
2. **Copy with provenance (recommended):** a tailored resume is today's `Resume` document,
   filled from the profile, and every item carries `profileItemId`. The whole V1 stack
   keeps working untouched. Sync is an explicit, reviewable "Pull updates" / "Save to
   profile", done by matching `profileItemId`.

And a second rule: **what was sent is frozen.** Marking an application "Applied" stores a
snapshot of the resume content (and template/theme) on the application. The resume can
keep changing; the application keeps what the employer received.

### Collections

```
CareerProfile      one per user
  user, rev (same optimistic concurrency as resumes)
  personal { …today's fields, biodata: { fatherName, motherName, dob, nid, religion,
             nationality, permanentAddress, presentAddress, maritalStatus } }
  summaries [{ id, label, text }]
  experience [{ id, title, company, location, startDate, endDate,
                bullets: [{ id, text, tags[], review: bool }], tags[] }]
  education / projects / certifications / … [{ id, …fields, tags[] }]
  skills [{ id, name, group }]
  customSections [...]
  importLog [{ at, sourceText (kept 30 days), itemsAdded, itemsUpdated }]

Resume (existing, extended)
  + profileLinked: bool
  + items carry profileItemId (inside the existing arrays)
  + job: ObjectId → Application (the job it was tailored for), optional

Application
  user, rev
  job { title, organisation, url, description, keywords[] (cached), deadline,
        location, salaryText, source }
  status, statusHistory [{ status, at }]
  appliedAt, followUpAt, interviews [{ at, kind, notes }]
  resume: ObjectId → Resume,  snapshot { resume (content JSON), template, theme, at }
  coverLetter { text, at }
  contacts [{ name, role, email, phone, notes }]
  links [{ label, url }]
  checklist { [key]: doneAt }
  notes, archived

Reminder (derived; stored only for email sending state)
  user, application, kind (deadline | followUp | interview), dueAt, sentAt
```

### Server pieces

- `lib/profile.js`: merge logic for imports (match rules, dedupe), provenance matching
  for Pull updates / Save to profile. Pure functions, heavily unit-tested.
- `lib/tailor.js`: scoring and selection on top of `client/src/lib/ats/analyze.js`'s
  `jobKeywords` (shared like `access.js`, with a parity test).
- `lib/capture.js`: job text → fields (deadline, title, organisation), Bangla and English.
- **Variable-cost AI charging:** today `aiQuota(feature)` charges a fixed cost. Batch
  polish needs `cost = perJob × jobs`, an **estimate endpoint** the UI calls before
  confirming, and per-job refunds. Extend `aiQuota` to take a cost function.
- **Measure AI cost:** store Gemini's `usageMetadata` (input and output tokens) on each
  `AiEvent`, with an admin view of real cost per feature. Needed before tuning credits.
- **Scheduler:** Cloud Scheduler → `POST /api/internal/reminders` (authenticated with
  `INTERNAL_API_KEY`) for email digests.

### Integration checklist (per CLAUDE.md), per feature

Every V2 feature must handle: plan limits (admin-editable) and up-front locks; credit
costs shown before use, refunded on failure; rate limits in the catalogue; free mode and
campaigns; private sessions (the profile and tracker need an account; private sessions
keep working as today); stale tabs (profile and applications use revisions like resumes);
privacy policy (profile biodata, job descriptions, contacts stored), terms and pricing
page; server tests and the fuzz test; a browser check.

---

## 7. Pricing and unit economics

- **Measure before promising more AI.** At Flash-class model prices, a typical call
  (a few thousand tokens in, one or two thousand out) costs roughly a cent or less, but a
  Premium user spending 1,000 credits on output-heavy calls could approach the plan's net
  revenue after Paddle's fee and VAT. Log real token usage first (§6), then set credits.
- **Country pricing.** $6.99 is a lot in Bangladesh. Paddle supports country price
  overrides: consider about $2.99 (Pro) for Bangladesh, India and Pakistan. No code change.
- **Job Search Pass.** A one-time 3-month Pro (e.g. $14.99) matches how people search, and
  avoids the "cancel as soon as I'm hired" feeling. Paddle supports one-time prices; needs
  a small change so a one-time purchase sets `planExpiresAt`.
- **Payment methods.** Paddle has no bKash/Nagad. If card access limits conversion, the
  options are institutional deals (campaigns) now, and a local gateway later.

---

## 8. Retention

A job search is episodic: intense for weeks or months, then nothing until the next one.
Design for that instead of fighting it:

- **During a search:** the tracker, deadlines, follow-ups and the "what to do today" home
  are the reasons to return several times a week. Email reminders bring people back.
- **Between searches:** the Career Profile is the asset. A light prompt after an
  application ends ("Got the job? Add it to your profile") and an occasional "update your
  profile" email keep it current, so the next search starts in minutes.
- **Institutionally:** campaigns bring whole cohorts (graduating students) at the moment
  they start searching.

Don't build streaks, badges or daily engagement mechanics; they don't fit the task.

---

## 9. Explicitly not in V2

AI mock interviews or interview coach; salary predictor; scraping job boards or LinkedIn;
auto-apply; document vault for sensitive files; email, calendar or LinkedIn integrations;
networking CRM; community features; gamification; a native mobile app (the site works on
mobile); more AI features of the "AI ___ generator" kind.

---

## 10. Roadmap

Each phase ships on its own, passes the integration checklist, and is useful even if the
next one slips.

| Phase | Scope | Why this order | Size |
| --- | --- | --- | --- |
| **0. Get information in** | Paste-anything import with review and merge (into the open resume first); assistant proposes edits with Apply/Dismiss; log token usage per AI call | Fixes the complaint users already have; the merge logic is reused by the profile | ~1–1.5 weeks |
| **1. Career Profile** | Profile model and page, migration from master/latest resume, completeness meter, import targets the profile, "Fill from profile" replaces "Fill from master", biodata fields | The foundation everything else reads from | ~2 weeks |
| **2. Applications** | Tracker (capture from text/link, statuses, board and list, snapshot on Applied, checklist, contacts, notes), home "what to do today", in-app reminders, free limit of 5 active | The retention engine; no AI cost | ~2–3 weeks |
| **3. Tailoring** | Deterministic tailoring from profile to job with match report; Pull updates / Save to profile; AI polish priced up front; batch with estimate and per-job refunds; cover letter from application | The "n resumes from one profile" promise, cheap to run | ~2–3 weeks |
| **4. Bangladesh and reach** | Biodata templates, Bangla/English circular parsing, email digests (Cloud Scheduler), country pricing, Job Search Pass | Differentiation and conversion | ~2 weeks |
| **V2.1** | Version compare, public profile page, deterministic interview prep per role, rates by role (with minimum sample), .ics export, Bangla CV (if the spike passes) | Valuable, not foundational | later |

### Success measures

- Activation: % of new accounts with a profile at least 60% complete within a day.
- Depth: % of active users tracking 3+ applications.
- Retention: users who return in weeks 2–4 of their first month.
- Conversion: free → paid, and where people hit the paywall (tracker limit, tailoring, credits).
- Cost: AI cost per paying user under ~20% of their net revenue.

---

## 11. Decisions needed, and risks

**Decisions for the owner:**

1. Free tier for the tracker (recommended: 5 active applications) and tailoring (1 resume).
2. Country pricing for Bangladesh / South Asia, and whether to offer a Job Search Pass.
3. Whether biodata fields (NID, religion, marital status) should exist at all. They're
   expected by some Bangladeshi employers but are sensitive personal data; if yes, they
   stay optional, hidden by default, and never sent to the AI.
4. Premium's credit allowance, after a few weeks of real cost data.

**Risks and assumptions to validate:**

- **Bangla in PDFs:** the PDF engine (react-pdf) may not shape Bengali conjuncts correctly.
  A one-day spike decides whether a Bangla CV is feasible; until then, don't promise it.
- **BD market assumptions** (biodata format expectations, circular formats, card access)
  come from general knowledge; confirm with 5–10 real job seekers and a career-office
  contact before Phase 4.
- **Tracker adoption** depends on capture being effortless; test the capture on 20 real
  circulars (Bdjobs, university, government) before building the rest of Phase 2.
- **Import quality:** messy text will produce wrong splits; the review screen is the
  safety net and must be fast to accept or fix.
