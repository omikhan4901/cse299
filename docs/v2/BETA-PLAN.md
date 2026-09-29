# Beta readiness plan

Goal: open ResumeX (V2 included) to a few hundred university students, many of them CSE
graduates who will poke at it, without losing money, data or uptime. Nothing here is
built until the owner says go. Each phase ends with its tests green, lint and build
clean, a browser check, and a push.

Principles: money is protected by the server, never only the UI; every limit is an
admin setting, not a constant; anything that can be abused gets a limit and a test; the
calm, uncluttered look stays.

---

## Phase 1. Money safety (first, because it protects everything else)

**1.1 Monthly AI spending cap (item A)**
- Admin › Credits & access: "Pause AI when this month's AI cost reaches $___" and "Email me
  at __%". Defaults: $40 cap, 80% alert.
- The cost is the real one: tokens logged per request × the model prices in the AI cost
  table. A running month total is kept in the database (one document per month, added to
  after each call), so it holds across server instances and restarts.
- When the cap is reached: AI requests are refused before any credit or token is spent,
  with a calm "AI is paused until {date}" message; the builder, ATS check, tracker and
  everything else keep working. Admins are exempt so you can test.
- Option to pause only Free and campaign users first (soft cap), everyone at the hard cap.
- Admin also gets a manual "Pause AI now" switch (an emergency brake).
- Overrun is bounded: at most the requests already running when the cap is hit, which the
  input and output limits below keep to cents.

**1.2 Input and output limits on every AI feature (your "word limit" idea)**
Yes, and it's the best cost control there is. Three layers, all admin-adjustable per feature:
- **Input limits, in characters** (words don't work for Bangla or pasted code): e.g.
  assistant message 1,500 and the last 10 turns only; rewrite 3,000; job descriptions
  8,000; Add anything text 15,000; files 10 pages. The UI shows a live counter
  ("1,240 / 1,500") and the server refuses anything longer before calling the AI, with no
  charge. A pasted Bee Movie script is stopped at the door.
- **Output caps** (`maxOutputTokens`) per feature, sized to what each really needs.
- **Thinking budget**: Gemini 2.5 Flash "thinks" before answering and bills those tokens as
  output (the expensive side). Simple tasks (rewrite, assistant, cover letter) get a small
  or zero thinking budget; imports keep enough to stay accurate. I'll check each feature's
  quality with the stubbed tests and a small live comparison you approve first.
- Result: every feature has a known **worst-case cost per request**, which makes 1.1 and
  1.3 exact instead of guesses.

**1.3 Campaign feature switches + worst-case cost (item C)**
- Campaigns get "AI features members can use": ticks per feature (e.g. everything except
  interview prep and cover letters), on top of the plan. Enforced on the server, shown up
  front in the UI (locks, plan tags, upgrade dialog), and kept identical in
  `client/src/lib/access.js` (parity test).
- The campaign form shows, as you type: **worst case** = places × credits per period ×
  periods in the campaign × the highest worst-case cost per credit among the allowed
  features, next to a **typical** figure (25% use) and your remaining monthly AI cap. A
  warning appears when the worst case is above the cap, and a louder one for "per day"
  credits.
- Campaign list shows spend so far (from the AI cost logs) per campaign.

**1.4 Payments switch (item 3)**
- Admin › Payments: Off / Test / Live. Off: no checkout, no plan changes, no pass; the
  pricing page shows plans with "Coming soon" instead of buttons; the server refuses
  checkout and change-plan too (so nobody can call the API directly). Webhooks still
  processed, so test data stays consistent. Test mode shows a small "test" note to admins.

## Phase 2. Plans and storage

**2.1 Resumes per plan (item 1)**
- New plan limit "Resumes": Pro 15, Premium 30, Free: your call (I suggest 3). Editable in
  Admin › Plans, shown on the pricing page, enforced on create/duplicate/import/tailor on
  the server, with the upgrade dialog (and its preview) when reached. Existing resumes over
  the limit are kept, only new ones are blocked. Replaces today's flat 50 cap.
- Campaign plans and free mode follow the same rules as every other limit.

**2.2 Storage**
- Photos are stored inside each resume (up to 3 MB each today). Compress on upload to about
  200 KB and leave them out of application snapshots (the snapshot keeps a reference), which
  is most of the storage per user.
- Admin overview gets "storage used" and "biggest accounts".

## Phase 3. Hardening against abuse and load

**3.1 Heavy work off the main thread**
- Today PDF and Word reading runs on the server's only thread: a crafted PDF can freeze the
  API for everyone even after the 20 s timeout (the timeout stops waiting, not the work).
  Move file reading to a worker pool with a hard kill, memory and page limits. Covers the
  ATS checker, imports and Add anything. Also a zip-bomb guard for Word files.

**3.2 Sign-up farming** (someone making 50 accounts for free credits)
- AI credits only after the email is verified (the verification code already exists).
- Block throwaway email domains (a maintained list, admin-editable).
- Per-network sign-up limit already exists; campaigns can require a university domain.

**3.3 Campus networks**
- A whole lab behind one Wi-Fi address shares one per-address limit today (600 requests a
  minute for everything). Raise per-address ceilings for signed-in traffic and lean on
  per-account limits, so one campus doesn't lock itself out; keep strict per-address limits
  for sign-up, login and the public ATS checker.

**3.4 Many server instances**
- Cloud Run is set to 1 instance. For the beta: 3 to 5 instances, concurrency tuned, 1 GB
  memory. Rate limits are counted in memory per instance, so the important ones (AI burst,
  sign-up, login) move to the database; the rest stay in memory (fine per instance).
- Check database indexes on every hot query, connection pool size, and slow-query logging.
- Graceful shutdown and a readiness check so deploys don't drop requests.

**3.5 Security review** (written up, each finding fixed or explained)
OWASP top ten against every route: access to other people's data (IDOR), NoSQL injection,
XSS on public resume pages and in PDF text, CSRF (token auth), open redirects, JWT and
session revocation, 2FA bypass, password reset, campaign code guessing, share-link
enumeration, webhook signatures, file uploads, headers (CSP, HSTS), secrets, error messages
that leak internals, and the admin console.

## Phase 4. Testing, rigorously

- **Load tests** (autocannon, against a local copy with the stubbed AI): 300 users signing
  in, editing, autosaving, capturing jobs and exporting at once; spikes; a slow database;
  the AI slow or down; Paddle down. Targets: no errors under the expected peak, p95 under
  300 ms for normal requests, graceful "busy" messages above it, memory flat over 30 min.
- **Abuse tests**: huge and malformed bodies, deep JSON, crafted PDFs and Word files,
  endless redirects on job links, parallel requests racing for credits, campaign places and
  plan limits, many tabs editing the same resume, clock edge cases (month end, time zones).
- **End-to-end browser tests** (Playwright) for every main journey on desktop and phone:
  sign up, verify, build, import, ATS, tailor, applications, interview prep, share, export,
  upgrade prompts, free mode on and off, campaign sign-up, deleting an account.
- **AI routes** keep using the stubbed model; one small live check at the end, only with your OK.
- Everything added to the suite stays fast (the suite stays around 4 to 5 minutes).

## Phase 5. Beta finishing touches (my additions)

- **In-app feedback**: a small "Feedback" button (with an optional screenshot of the page and
  the page address), stored for you in an Admin › Feedback inbox. Beta testers will find
  things; this makes them easy to report.
- **Error reporting**: browser errors and server 500s collected (rate-limited, no personal
  data) into an Admin › Errors view, so you see problems before users tell you.
- **Beta label** and a short "what's new / known issues" note.
- **Maintenance switch**: read-only mode with a banner, for risky moments.
- **Backups**: confirm the database's automatic backups, and a one-command export for you.
- **Status**: a simple public status line on the site when AI is paused or in maintenance.

## Phase 6. Public pages (item 2)

- Pricing: resumes per plan, applications, tailored resumes, batches, interview prep (and
  the AI one), insights, the new "See it" previews, credit costs, the payments switch state.
- Home, About, FAQ, templates, guides: an applications/tailoring section and FAQ entries
  (the "Job search" content exists but is hidden until V2 is on for everyone, as the
  standing rule says public pages only claim what visitors can use). For the beta you
  switch V2 on, and all of it appears together. Sitemap, meta descriptions and structured
  data updated.
- Legal: privacy policy (job descriptions and recruiter contacts people store; feedback and
  error reports; AI limits), terms (beta, fair use, limits), refunds (payments off during beta).

## Phase 7. Marketing (items 4 and 5)

- Update the marketing plan, Facebook posts, outreach templates and README with everything
  since the last pass: V2 (profile, tracker, tailoring, interview prep, insights, previews,
  Add anything, the assistant), a beta launch sequence for universities, ambassador and
  campaign codes.
- **Animated mockups for Facebook**: short loops (8 to 15 s) made from the real app with sample
  data, recorded in the browser and exported as MP4 (square 1080×1080 and 4:5 1080×1350) plus
  GIF: the builder with live preview, the ATS scan, job capture to board, tailoring for a job,
  interview prep, and the templates carousel. Each with post copy.

---

## Order and rough effort

| Phase | What | Effort |
|---|---|---|
| 1 | Money safety: cap, limits, campaign switches + estimate, payments switch | 2–3 days |
| 2 | Resumes per plan, storage | 1 day |
| 3 | Hardening: workers, sign-ups, campus limits, instances, security review | 2–3 days |
| 4 | Load, abuse and end-to-end tests (and fixing what they find) | 2–3 days |
| 5 | Feedback, errors, beta label, maintenance, backups | 1–2 days |
| 6 | Pricing and public pages, legal | 1 day |
| 7 | Marketing refresh and animated mockups | 1–2 days |

Phases 1 to 4 are what make the beta safe; 5 to 7 make it good. I'd do them in this order
and report after each.

## Decisions needed from you

1. **Free plan resumes**: how many? (I suggest 3.)
2. **AI cap**: $40 of your $50 as the default? Pause everyone, or Free and campaign users
   first and paying users only at the hard cap?
3. **Verified email before AI credits**: OK? (Recommended for the beta.)
4. **Database**: which MongoDB Atlas tier are you on (the free M0 has 512 MB)? That sets how
   hard to push on storage.
5. **Cloud Run**: OK to allow up to 3–5 instances? They cost nothing when idle, a little when busy.
6. **Beta and V2**: will V2 be on for everyone at the beta? (Decides what the public pages show.)
7. **Payments off**: pricing page shows plans with "Coming soon", or hides prices entirely?
8. **Facebook videos**: MP4 in 1:1 and 4:5 OK? Any posts or features you want first?
