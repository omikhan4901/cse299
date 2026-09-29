# ResumeX V2: product specification and roadmap

Status: agreed direction, revised after the owner's review (28 September 2026); build order
in `PLAN.md` (29 September 2026).

**This is a living document, not a contract.** Before each phase starts, re-read the parts
it depends on, re-check the assumptions against what we've learned (usage data, user
feedback, what the previous phase revealed), and change the spec first if something no
longer holds. Flag the change to the owner rather than building around it.

---

## 1. The thesis in one paragraph

V1 answers "make me a good resume". V2 should answer **"help me get this job, and the next
one"**: one **Career Profile** holds everything true about the person; every application
gets a **tailored resume generated from it**; every application is **tracked** until it ends;
and the product tells the person, from their own data, what to do next. AI is used where it
removes real work (turning messy text into structured data, polishing the few lines that
matter). The workspace itself (profile, tailoring by selection, tracking, reminders, checks)
is deterministic, so it costs almost nothing to run and still feels like a lot of product.

**Career Profile ≠ resume.** The Career Profile is *everything I could truthfully say about
myself*. A resume is *the subset of it this particular employer should see*. The magic of
ResumeX is that selection, not the AI. AI is the interface that makes the profile easy to
fill and the chosen lines read well.

```
                         RESUMEX
                            │
            ┌───────────────┴───────────────┐
      CAREER PROFILE                   APPLICATIONS
   "everything true about me"    "everything I'm applying to"
            └───────────────┬───────────────┘
                        TAILORING
             ┌──────────────┼──────────────┐
          Resume       Cover letter    Job match
             └──────────────┼──────────────┘
                       APPLICATION
             ┌──────────────┼──────────────┐
         Follow-up      Interview       Outcome
             └──────────────┼──────────────┘
                     (outcomes feed back
                      into insights, later)
```

AI sits underneath as an acceleration layer; it is never the product itself.

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
| AI prep sheet for one job (owner's request, Sept 2026) | ●● | People with interviews | 1 call, credits | ● (reuses the checks) | ●● | ● | ● | **Yes, one call**: likely questions and answer outlines for that job; quotes must be the person's own lines and outline lines that name facts from neither the resume nor the job are dropped. A one-shot sheet, not a coach |
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
  - **No sensitive biodata stored (for now).** Some Bangladeshi employers ask for a
    "biodata" with father's and mother's names, date of birth, NID, religion, addresses and
    marital status. Until real users show it's needed often, ResumeX does **not** keep
    these in the profile. A **biodata mode** asks for the fields when someone makes a
    biodata CV, keeps them in that document only, and **never stores an NID** anywhere.
    They are never sent to the AI.
- **Completeness meter:** deterministic ("Add dates to 2 jobs", "3 bullets have no
  numbers"), reusing the ATS content checks.
- **Where it's edited:** a Profile page with the same section editors as the builder
  (same components), plus the import and the assistant.
- **Migration:** on first visit, the profile is created from the master resume, or the
  most recently edited resume, with the user's confirmation. Existing resumes keep their
  content and keep working unchanged.

### 5.2 Getting information in: the whole profile is conversationally ingestible

The answer to "people won't edit twelve fields". Not an "import" button: **anywhere the
user can type, they can paste or describe anything**, and ResumeX files it in the right place.

**Ingestion (one AI call per message):**

1. The user pastes or writes anything: an old CV, a LinkedIn "About", "During my third
   year I worked on a project where I…", or a PDF/DOCX.
2. The model receives the text **and a compact outline of the existing profile, with item
   ids**, and returns **operations**, not a new resume: *add a job*, *add a bullet to
   project #p3*, *set the end date of job #e1*, *add skills*. That is how "I forgot to
   mention I presented this project at ICCIT" lands on the right project.
3. Deterministic checks run on every operation: duplicates are detected (same company and
   overlapping dates, same institution, same skill), and **any number, date, name or
   organisation not found in the user's text or the existing profile is flagged**.
4. **Review:** "I found 4 things: Project: University attendance system · Technology:
   Python, OpenCV · Role: Backend developer · Achievement: cut processing time by 40%."
   **[Add all]** **[Review one by one]**. Flagged items are unticked by default.
5. Accepted operations are applied. The source text is kept for 30 days for reference.
6. **Removing and replacing** (owner's request, Sept 2026): the same operations can remove
   an item, clear a whole part or take values out of a list, but only when the person's
   own words ask for it ("remove my job at X", "cancel the whole experience part"); a
   pasted CV or a file is never an instruction. "This is my previous resume" with a file
   proposes one "Start over" change, then the file's content as new items. Removals are
   shown in red and apply first. The builder's untouched example is simply replaced.

**Two AI editing modes, clearly separated:**

- **Rewrite (truth-preserving):** "Make this bullet professional." The output may reword
  and restructure only; no new facts. Anything that looks new is flagged.
- **Strengthen (ask, don't invent):** "This bullet is weak; what would make it stronger?"
  The assistant **asks questions** ("Did you reduce the loading time? By roughly how
  much? Was it deployed? Did you work in a team?") and only writes the stronger bullet
  from the user's answers.

The assistant chat uses the same machinery: its replies can carry proposed operations,
shown as cards with **Apply** / **Dismiss**. Nothing changes until the user applies it.
One credit per message, as today.

**Definition of success (measured, see §12):** a user who pastes a messy paragraph about
their work reaches an accurate structured profile with **no more than 1–2 manual
corrections**, and **nothing invented** reaches the profile without being flagged.

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

**Capture in one step:** **+ Add application** → one box: "Paste job link or job circular"
→ **Analyze**. Rules extract title, organisation, deadline ("Application deadline: 15
October 2026", "আবেদনের শেষ তারিখ"), location, type and keywords, shown as a small card
with **Save application**. That's all; every other field appears later, only when it
becomes relevant (progressive disclosure). (Image and PDF circulars: optional AI
extraction for 1 credit, later.)

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
created; **job match reviewed**; cover letter (if asked); submitted; follow-up sent;
interview prepared. The next unchecked item is shown on the card as the "next step".

**No score thresholds as tasks.** ResumeX's match score is an internal indicator, not a
validated prediction of any employer's ATS, so the checklist never says "reach 70%". The
job match shows evidence instead:

```
Job match
✓ 8 of the requested skills are shown in your resume
⚠ 3 requested skills not found: Docker, AWS, Kubernetes
✓ Education requirement met (BSc in CSE)
⚠ The job asks for 3 years; your dated experience adds up to 2
```

The numeric score can still be shown as information, never as a pass mark.

**The resume sent, frozen:** once an application is marked Applied, its card shows
"**Resume sent:** Software Engineer, Google, 14 Jan · **View exact copy**", which opens the
snapshot exactly as it was sent, whatever happened to the resume afterwards.

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
  personal { …today's fields }   (no biodata: see §5.1; biodata lives only in a biodata
                                  resume, and there is never an NID field)
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

**One content format.** The profile has the same content shape as a resume (points as
lines, skills as a list), so the builder's editors, templates, ATS checks and PDF engine work
on it untouched. Each resume item made from it keeps its `profileItemId`; points are matched
by wording when syncing (see `client/src/lib/profile.js`).

**Shipping in pieces.** Every push to `main` deploys, so V2 screens sit behind an admin
setting, **V2 preview** (admins and listed accounts only), until V2 is switched on.

### Integration checklist (per CLAUDE.md), per feature

Every V2 feature must handle: plan limits (admin-editable) and up-front locks; credit
costs shown before use, refunded on failure; rate limits in the catalogue; free mode and
campaigns; private sessions (the profile and tracker need an account; private sessions
keep working as today); stale tabs (profile and applications use revisions like resumes);
privacy policy (profile biodata, job descriptions, contacts stored), terms and pricing
page; server tests and the fuzz test; a browser check.

---

## 7. Pricing and unit economics

- **AI economics dashboard: a hard requirement before launch.** At Flash-class prices a
  typical call costs roughly a cent or less, but a Premium user spending 1,000 credits on
  output-heavy calls could approach the plan's net revenue. Every AI call records its
  real input and output tokens; the admin console shows, per feature: calls, average
  cost; and overall: average AI cost per paying user, net revenue per paying user and the
  **AI cost ratio**. Credit allowances are set from this, not guessed.
- **Prices are tested, not decided.** $6.99 is a lot in Bangladesh, but the right local
  price is unknown. Test real options with real users, for example Free, ৳199/month,
  ৳299/month and a **৳499 3-month Job Search Pass**, and see what people choose. Paddle
  supports country prices (no code change).
- **Job Search Pass.** A one-time 3-month plan matches how people search: someone happily
  paying ৳499 while actively hunting may refuse ৳299 every month forever. Paddle supports
  one-time prices; needs a small change so a one-time purchase sets `planExpiresAt`.
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

AI mock interviews or a many-turn interview coach (the one-call prep sheet in §4 is not one); salary predictor; scraping job boards or LinkedIn;
auto-apply; document vault for sensitive files; email, calendar or LinkedIn integrations;
networking CRM; community features; gamification; a native mobile app (the site works on
mobile); more AI features of the "AI ___ generator" kind.

---

## 10. Roadmap

Each phase ships on its own, passes the integration checklist, and is useful even if the
next one slips.

| Phase | Scope | Why this order | Size |
| --- | --- | --- | --- |
| **0. Get information in** | Context-aware ingestion (operations, flags, review, merge) into the open resume first; assistant proposes operations with Apply/Dismiss; Rewrite and Strengthen modes; token usage per AI call and the AI economics dashboard; the import evaluation (§12) passing | Fixes the complaint users already have; the operations and merge logic are reused unchanged by the profile | ~1.5–2 weeks |
| **1. Career Profile** | Profile model and page, migration from master/latest resume, completeness meter, import targets the profile, "Fill from profile" replaces "Fill from master", biodata fields | The foundation everything else reads from | ~2 weeks |
| **2. Applications** | Tracker (capture from text/link, statuses, board and list, snapshot on Applied, checklist, contacts, notes), home "what to do today", in-app reminders, free limit of 5 active | The retention engine; no AI cost | ~2–3 weeks |
| **3. Tailoring** | Deterministic tailoring from profile to job with match report; Pull updates / Save to profile; AI polish priced up front; batch with estimate and per-job refunds; cover letter from application | The "n resumes from one profile" promise, cheap to run | ~2–3 weeks |
| **4. Bangladesh and reach** | Biodata templates, Bangla/English circular parsing, email digests (Cloud Scheduler), country pricing, Job Search Pass | Differentiation and conversion | ~2 weeks |
| **V2.1** | Version compare, public profile page, deterministic interview prep per role (**built**: prep sheet per application, Pro; plus an optional one-call AI sheet for the job, 3 credits by default), .ics export (**built**), Bangla CV (spike failed: not yet) | Valuable, not foundational | partly done |
| **V2.2 Outcome insights** (**built early**: dashboard, after 8 applications sent, groups of 3+, Pro) | Learn from the user's own history: "23 software applications, 5 interviews; resume B → 3 interviews"; "interviews from 4 of 12 applications that included Project X". Shown only above a minimum sample, worded as observations, never as advice | A moat built from first-party outcome data; needs months of tracked applications first | later |

### Success measures

- Activation: % of new accounts with a profile at least 60% complete within a day.
- Depth: % of active users tracking 3+ applications.
- Retention: users who return in weeks 2–4 of their first month.
- Conversion: free → paid, and where people hit the paywall (tracker limit, tailoring, credits).
- Cost: AI cost per paying user under ~20% of their net revenue.
- Import quality: the §12 evaluation, re-run whenever the prompt or model changes.

**Before each phase:** re-read its section, re-check assumptions against usage and
feedback, update this spec, then build.

**Order of work (29 September 2026):** while AI testing is paused, the non-AI parts of every
phase are built first, and AI parts are verified later from a queue. See `PLAN.md`.

---

## 11. Decisions needed, and risks

**Decisions for the owner:**

1. Free tier for the tracker (recommended: 5 active applications) and tailoring (1 resume).
2. Prices: run a real test (e.g. ৳199 / ৳299 monthly, ৳499 3-month pass) before choosing.
3. Biodata: decided for now: no stored sensitive fields, a biodata mode that asks at
   export, never an NID. Revisit only with evidence from users.
4. Premium's credit allowance, from the AI economics dashboard.

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

---

## 12. Phase 0: re-evaluation and definition of done

**Re-checked assumptions before starting:**

- *"Import into the open resume first, the profile later"* still holds: the operations
  target the resume's sections, which are the same sections the profile will have, so the
  profile (Phase 1) reuses the operations, flags and review screen unchanged.
- *"One call per message"*: ingestion needs the existing outline in the prompt so updates
  can target items; a compact outline (ids, titles, dates, no full text) keeps the input
  small. Very long pastes (a whole CV) are clipped to ~30k characters as today.
- *"Replace import"*: the file import (PDF/DOCX) moves onto the same path, so it merges
  into what's there instead of overwriting it.

**Import evaluation (the success criterion made measurable):**

A fixed set of realistic messy inputs, each with the expected result, run against the real
model and scored automatically (`server/eval/ingest/`):

- a chronological paragraph about several jobs; a skills dump; a Bangla–English mix;
  a student with projects and no jobs; a lecturer with publications and teaching; a
  bulleted old CV pasted as text; follow-ups that must attach to an existing item
  ("I forgot to mention I presented BondhuKoi at…", "my job at X ended in March 2024");
  repeated information that must not create duplicates.

For each case the scorer counts **corrections**: fields that are missing, in the wrong
place, wrong, or duplicated, compared with the expected result; and **invented facts**:
numbers, dates, names or organisations in the output that aren't in the input or the
existing profile *and* weren't flagged.

**Phase 0 is done when:**

- median corrections per case ≤ 1, and no case above 2;
- zero unflagged invented facts across the whole set;
- follow-up cases attach to the correct existing item every time (no duplicates);
- accepting everything takes one click, and the review screen works on a phone;
- every AI call in the app records its token usage, and the admin AI economics view shows
  cost per feature and the AI cost ratio.
