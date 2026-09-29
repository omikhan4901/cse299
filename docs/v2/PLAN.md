# ResumeX V2: build plan while AI testing is paused

Written 29 September 2026. Companion to `SPEC.md` (the what and why); this is the order of
work. While the AI account is being refilled, everything that doesn't need a live model
is built and tested now. AI parts are still written, tested against the stubbed model, and
put on the **AI verification queue** (§4) to be checked against the real model later.

## Status (29 September 2026)

| Step | State |
| --- | --- |
| A. Bank what exists, V2 preview switch | Done |
| B. Phase 0 non-AI half (review screen, token logging, AI economics) | Done |
| C. Phase 1 Career Profile | Done |
| D. Phase 2 Applications and home | Done |
| E. Phase 3 deterministic tailoring (and batch) | Done |
| F. AI plumbing (polish, Rewrite and Strengthen, assistant proposals) | Built, stub-tested; real-model checks on the queue (§4) |
| G. Phase 4 (biodata, Bangla spike, reminders, Job Search Pass, .ics) | Done; Bangla CV decided against for now (`spikes/bangla-pdf.md`) |
| H. Whole-product pass | Automated and browser checks done; go-live list below |
| I. V2.1 and V2.2 early | Interview prep per application and search insights (Pro/Premium plan features); "Got the job?" adds an offer to the profile |

**Before switching V2 on for everyone:** run the AI queue (§4); set up email (SMTP) and the
two Cloud Scheduler jobs; review pricing-page wording once V2 shows its limits there; then turn on "V2 workspace for
everyone" in Admin › Plans. The home page and About FAQ then show the job-search tools on
their own; post the launch kit in `docs/marketing` (J1–J7, B7–B8).

## 0. Ground rules for this stretch

- **V2 stays hidden in production until it's ready.** Every push to `main` deploys, so V2
  screens sit behind a new admin setting, **V2 preview**: off for everyone except admins
  (and accounts an admin adds). Nothing changes for current users until it's switched on.
- **Additive data changes only.** New collections (`CareerProfile`, `Application`);
  existing resumes gain optional fields. No migration rewrites existing documents.
- **Each step ships whole:** server + tests, client, the CLAUDE.md integration checklist,
  a browser check, then a commit to `main`.
- **Deterministic first.** Where the spec offers an AI option, the rule-based version is
  built first and is complete on its own.

## 1. Changes to the spec (flagged for the owner)

Re-checking the spec against the code before building turned up these; `SPEC.md` is
updated to match.

1. **Biodata is not stored in the profile.** §6's data model still listed `biodata { …
   nid … }` inside the Career Profile, which contradicts the decision in §5.1 and §11. The
   profile keeps no biodata. Biodata mode asks for the fields when a biodata CV is made,
   keeps them in that one resume only, and never has an NID field.
2. **One content format.** The profile uses the same content shape as a resume (points as
   lines, skills as a list), so the builder's editors, the ATS checks and the PDF engine work
   on it unchanged. Resume items made from it keep `profileItemId`; points are matched by
   wording when syncing ("Pull updates", "Save to profile"), and items made before the link
   existed are matched by what they are (same employer, school, project). *(Changed while
   building Phase 1: separate ids per point added complexity with no user-visible gain.)*
3. **Order changed** from 0→1→2→3→4 to "every non-AI part first". Phase 0's review screen,
   token logging and economics dashboard are built now with a stubbed AI. The import
   evaluation passing is still required before import is switched on for users.
4. **Fetching job links is best-effort.** Many job pages need JavaScript, block bots or
   need a login. The server tries a safe fetch (public addresses only, size and time
   limits, never LinkedIn, whose terms forbid it). If that fails, it asks the person to
   paste the text. Pasted text is the main path.
5. **A "V2 preview" switch** is added (§0); the spec didn't plan how to ship V2 in pieces
   without showing half-built features.

## 2. Order of work

### Step A: bank what exists (first)

- Commit the pending work: the import evaluation and scorer, ingestion fixes, the Vertex
  AI switch and its tests, and the 402/403 billing messages.
- Add the **V2 preview** setting (admin toggle + per-user access list), with tests.

### Step B: Phase 0, the non-AI half (#40, #42, part of #41)

- **Review screen** for imports: "I found N things", Add all / one by one, flagged items
  unticked and highlighted, works on a phone. Applies the operations to the open resume
  (`applyOperations`, already tested). File import (PDF/DOCX) moves onto the same path,
  so it merges into what's there instead of replacing it.
- **Assistant proposal cards:** chat replies can carry operations with Apply / Dismiss,
  using the same review components. The Rewrite and Strengthen prompts are written, but
  their quality waits for the queue.
- **Token usage on every AI call:** store Gemini's input and output tokens and the
  model on each `AiEvent` (the stub returns fake counts in tests).
- **AI economics (admin):** model prices per million tokens (admin-editable), then per
  feature: calls, tokens, average cost; overall: AI cost per paying user, revenue per
  paying user (from Paddle transactions) and the AI cost ratio.
- The old file import stays available until the evaluation passes.

### Step C: Phase 1, Career Profile (all non-AI)

- `CareerProfile` model: one per user, `rev` concurrency like resumes; same sections as
  resumes, with bullets and skills as items with ids, summary variants and tags. No biodata.
- API: get / save with revisions and conflict handling; rate limits; tests.
- **Profile page:** reuses the builder's section editors (same components), with the same
  autosave, conflict dialog and stale-tab refresh.
- **Migration:** first visit offers "Create your profile from *<master resume>*" (or the
  most recently edited one); existing resumes are untouched.
- **Completeness meter:** deterministic, reusing the ATS content checks ("2 jobs have no
  dates", "3 bullets have no numbers").
- **"Fill from profile"** replaces "Fill from master" in the builder and the "Open
  builder" dialog; the master flag keeps working until the profile exists.
- **New resume from profile** (untailored): copies with `profileItemId` on every item.
- **Pull updates / Save to profile** between a resume and the profile, matched by
  `profileItemId`, shown as a reviewable list (the same review cards as import).
- Import and the assistant can target the profile (same operations, same review screen).
- Account deletion and data export include the profile; privacy policy updated.

### Step D: Phase 2, Applications (all non-AI)

- `Application` model (spec §6) with `rev`, status history, checklist, contacts, links,
  interviews, notes, and a **frozen snapshot** of the resume sent.
- **Capture in one step:** "Paste job link or circular" → Analyze → Save. A new
  `lib/capture.js` pulls out title, organisation, deadline (English and Bangla phrases,
  Bangla digits), location, job type, salary text and keywords (`jobKeywords`), and
  detects "apply through Teletalk/Bdjobs" to add matching checklist items. Built against
  a set of 20+ real-style circulars (Bdjobs, university, government, private), with
  tests; §11's "test capture on 20 circulars first" is done here, before the rest of the
  tracker.
- Safe link fetch (§1.4) with SSRF protection and tests.
- **Statuses** Saved → Preparing → Applied → Interviewing → Offer, plus Rejected, Withdrawn
  and No response (suggested after N days, admin-editable).
- **Board** (drag between statuses) and **list** (sort, filter by status, deadline, role);
  mobile layout.
- **Snapshot on Applied:** "Resume sent: … · View exact copy" opens the frozen PDF view.
- **Checklist** with "next step" on each card; **Job match** as evidence (skills shown and
  missing, education, years of experience), with no pass mark.
- One click from an application to: a new resume for it, a cover letter (existing AI
  feature, now given the job text), and the ATS check with its description.
- **Plan limits:** free = 5 active applications (admin-editable; a new numeric `limits`
  block on each plan), enforced on the server, lock shown up front, free mode opens it.
- **Home, "What to do today":** due soon (deadlines, follow-ups, interviews), next steps,
  the funnel (counts, no rates below the minimum sample), and profile health.
- **In-app reminders**, worked out when the page loads (no infrastructure).
- Privacy policy (job descriptions, contacts), terms, pricing page and FAQ updated.

### Step E: Phase 3, Tailoring (deterministic part)

- `lib/tailor.js`, shared client/server like `access.js`, with a parity test. It scores
  every profile item and bullet against the job's keywords and tags, with a small bonus
  for recency. It picks what fits one or two pages, orders sections for the role
  (academic-first for lecturer jobs), chooses the summary variant and suggests a template
  category.
- **Match report before and after**, with one-click "include" for missing keywords the
  profile does have.
- Tailored resume = a normal resume with `profileItemId`s and a link to its application.
- **Batch:** several jobs → one tailored resume each, free.
- Free plan: 1 tailored resume (admin-editable limit).
- The AI parts (polish, batch polish) are covered separately below.

### Step F: AI plumbing built now, verified later

*(Changed while building: batch polish sends one request per resume instead of one
variable-cost request, so each job is charged and refunded on its own with the existing
credit middleware, and no single request risks the time limit. The cost of the whole batch
is shown before it starts, from the admin's per-feature cost and the account's balance.)*

- `aiQuota` with a **cost function** (cost = per job × jobs), an **estimate endpoint**
  ("Polish 3 resumes: 6 credits. You have 240") and **per-job refunds**, all tested with
  the stub.
- AI polish (summary + top bullets) as reviewable proposals, reusing the Rewrite rules.

### Step G: Phase 4, Bangladesh and reach (non-AI)

- **Biodata mode and 2–3 biodata templates:** fields asked for at export and kept only in
  that resume; no NID field; never sent to the AI.
- **Bangla PDF spike (one day):** can react-pdf shape Bengali conjuncts correctly? The
  result decides whether a Bangla CV is ever promised.
- **Email reminders and weekly digest:** an internal endpoint for Cloud Scheduler
  (`INTERNAL_API_KEY`), per-type unsubscribe in Account. Built and tested now; switched on
  once the support mailbox and SMTP are set up.
- **Job Search Pass mechanism:** a one-time Paddle purchase sets `planExpiresAt`, with
  expiry handling and refund-policy records. Tested in the Paddle sandbox by you; the
  price itself is left to the pricing test.
- **.ics calendar export** for deadlines and interviews (small; pulled forward from V2.1
  because it's cheap and deterministic).

### Step H: before switching V2 on

- A whole-product pass: fuzz test over new routes; a browser walkthrough on desktop and
  phone. Check signed-out, private-session, draft and saved states against the profile
  and the tracker, plus stale tabs.
- Legal pages, sitemap and pricing page final review.
- Your go-live checklist (Paddle live, Vertex billing, email) merged with V2's.

## 3. What each step needs from you

| Step | From you |
| --- | --- |
| A–E | Nothing. Optional: look at the preview as an admin when a step lands. |
| D | Optional: send a few real circulars you've seen (links or text) to add to the capture tests. |
| G, Job Search Pass | A sandbox one-time price in Paddle (like the monthly ones), and one test purchase. |
| G, email | The support mailbox and SMTP settings, when you set them up. |
| Queue (§4) | Billing enabled on the Google Cloud project (or the AI Studio key topped up). |

## 4. AI verification queue (run once AI access is back)

In order, each against the real model, on both the main and the fallback model:

1. Import evaluation (`server/eval/ingest/`): median ≤ 1, max ≤ 2, zero unflagged
   invented facts, twice in a row. Then switch the builder's import to the new path.
2. A small evaluation for the assistant's proposals: Rewrite adds no facts; Strengthen
   asks questions instead of inventing.
3. The AI polish of tailored resumes: no new facts, and it improves the keyword match.
4. The first week of real token numbers in the economics dashboard, used to set the
   Premium credit allowance.

Estimated cost of the whole queue, including repeats: $10–20 (see the conversation estimate).

## 5. Tracking

The session task list mirrors these steps. `SPEC.md` §10 keeps the phases; this file
keeps the order of work and is updated as steps land.
