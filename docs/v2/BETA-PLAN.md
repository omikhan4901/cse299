# Beta readiness plan (revised)

Goal: an invite-only beta for about 80 university students (many CSE graduates who will
poke at everything), with V2 on for everyone, on a budget of about $50 of Google Cloud
credit and the free MongoDB tier, without losing money, data or uptime.

**Rules for the whole plan**
- Money and access are enforced by the server; the UI only explains them up front.
- Every number and switch introduced here is an admin setting with a sensible default,
  shown where it applies, recorded in the audit log when changed.
- Every new route gets a rate limit, server tests and fuzz coverage; `access.js` stays
  identical to the server (parity test); every user-facing change is checked in a browser.
- The calm look stays: one clear next action per screen, the site's own card markup.
- I decide the details myself and note each decision here; I only ask about pricing, what's
  free, and legal wording.

## Decisions (from the owner)

| Topic | Decision |
|---|---|
| Beta size | Invite-only, **80 sign-ups** (Registration: campaign only; one campaign, 80 places) |
| Free plan | **Builder only**: 1 resume, ATS check, the assistant and rewrite on its credits. Career Profile, Applications (with tailoring, interview prep, insights) are **paid or campaign only**; Free users see animated previews and an upgrade button in those tabs |
| Resumes per plan | Free 1, Pro 15, Premium 30 (editable) |
| AI spending cap | Default **$40/month**; when reached, **AI pauses for everyone** (admins exempt) |
| AI credits | Only after the **email is verified** |
| Servers | Cloud Run up to **2 instances** for the beta (bounded worst case), budget alerts at $20/$35/$45 |
| Database | MongoDB Atlas **M0 (free)**: 512 MB, no backups, so storage is actively managed |
| V2 | On for everyone at the beta |
| Payments | Admin switch; while off the pricing page says **"Coming soon"** |
| Campaign credits | Suggested **60 per month** each (worst case about $28–48) |
| Mockups | Several formats: 1:1, 4:5, 9:16 MP4 and a wide GIF |

---

## Phase 1. Money safety

1. **Monthly AI spending cap.** The month's real AI cost (tokens × model prices, kept as one
   running total per month in the database, so it holds across instances). Settings: cap
   ($40), alert at (80%), who is exempt (admins). At the cap every AI request is refused
   before any credit or token is spent ("AI is paused until 1 Nov"); everything else keeps
   working. Email to the owner at the alert and at the cap. Admin › AI costs shows spend vs
   cap with a bar, the day it will run out at the current rate, and a manual **Pause AI** /
   **Resume** switch.
2. **Input, output and thinking limits per AI feature** (Admin › Credits & access, one row per
   feature): max characters in (the assistant also: max message length and turns kept), max
   file pages, max output tokens, thinking budget. Live counters in the UI; over-long input
   refused before the AI is called, with no charge. Each feature then has a computed
   **worst-case cost per request**, shown next to its credit cost, with a warning when a
   credit is priced below what it can cost.
3. **Model prices kept right.** The AI cost table gets `gemini-2.5-flash` and the fallback
   model by default, and warns (as now) about unpriced models, since the cap depends on them.
4. **Campaign feature switches and cost estimate.** Per campaign: the AI and app features its
   members get (overriding the plan either way), credits and period, places, duration,
   email domain, end date. The form computes, live: worst case (places × credits × periods ×
   the highest worst-case cost per credit among allowed features), a typical case (25% use),
   and how it compares to the remaining AI cap, with warnings. The campaign list shows
   sign-ups, active members and AI spend so far.
5. **Payments switch**: Off / Test / Live. Off: no checkout, plan changes or passes (server
   refuses them); pricing shows "Coming soon". Webhooks still processed. Test: only admins
   (and accounts you mark as testers) can open checkout.
6. **Sign-up controls**: registration mode (open / campaign only / closed, exists), a hard
   **"close sign-ups after N accounts"**, the campaign's own places, and email verification
   required before credits.

## Phase 2. Plans, access and storage

1. **Resumes per plan** as a plan limit (Free 1, Pro 15, Premium 30), replacing the flat 50.
   Enforced on create, duplicate, import and tailoring; existing resumes over the limit are
   kept, only new ones blocked; upgrade dialog with preview; shown on pricing.
2. **Career Profile and Applications as plan features** (off on Free). Server refuses every
   profile/applications/tailoring/prep/insights route for accounts without it. Free users
   see a promo page in those tabs (the animated previews, what they get, upgrade button), a
   small promo in the dashboard's Today panel, and plan tags in the menu. Campaign switches
   can turn them on.
3. **Per-user overrides** in Admin › Users: plan and expiry (exists), credits (exists),
   resume limit, features on/off, AI blocked, V2 on/off, "tester" (can use test payments).
4. **Storage**: photos compressed on upload (about 200 KB, done in the browser, server
   refuses larger), photos left out of application snapshots, per-account storage caps
   (resumes × size), and Admin › Overview storage meter (MB used of 512, biggest accounts),
   alert at 70%.

## Phase 3. Admin visibility ("see everything")

1. **Sign-ups feed**: newest accounts first with how they came in (campaign code, invite,
   organic, created by admin), verified or not, plan, first actions (made a resume, used AI).
   Filters by date range, source, campaign, plan, verified.
2. **User detail**: timeline (signed up, verified, logins, resumes, applications, AI use per
   feature with credits and real cost, plan changes, payments, admin actions), storage used,
   devices/networks count (for spotting farms), quick actions.
3. **Overview**: sign-ups per day, active users today/7d, AI spend today/month vs cap,
   storage, errors today, feedback waiting, sign-ups left in the beta.
4. **Campaign detail**: members, their activity and cost, places left.
5. **Alerts** by email (and a bell in the console): cap alert, storage 70%, error spikes,
   sign-ups closing, suspicious sign-up bursts from one network.

## Phase 4. Hardening against abuse and load

1. **File reading off the main thread**: PDF/Word parsing in a worker pool with hard
   time/memory/page limits and kill, plus a zip-bomb guard (ATS checker, imports, Add anything).
2. **Sign-up farming**: credits only after verification; throwaway-domain list (admin
   editable); per-network sign-up limit (exists); alert on bursts.
3. **Campus networks**: per-address ceilings raised for signed-in traffic; per-account limits
   do the work; strict per-address limits stay on sign-up, login, reset and the public ATS.
4. **Several instances**: shared (database) counters for the limits that matter (AI burst,
   sign-up, login, reset, verification codes); connection pool sized for M0; indexes on hot
   queries; graceful shutdown; request timeouts; memory checks.
5. **Security review** against the OWASP top ten on every route, written up in
   `docs/security-review.md`, each finding fixed or explained: data of other accounts,
   injection, XSS (public pages, PDF text, names), auth and sessions, 2FA, reset, campaign
   code guessing, share links, webhooks, uploads, headers, error leaks, admin console.

## Phase 5. Testing, rigorously

1. **Load**: 80–300 simulated users (sign in, autosave, capture jobs, export, ATS, AI with the
   stub) on 1 and 2 instances; spikes; slow database; AI slow/down; Paddle down. Pass: no
   5xx at the expected peak, p95 under 300 ms for normal requests, clear "busy" messages
   beyond it, flat memory over 30 minutes, M0 connection count safe.
2. **Abuse**: huge, deep and malformed bodies; crafted PDFs/Word files; redirect loops;
   racing requests for credits, campaign places, resume and application limits, the cap;
   many tabs editing one resume; month-end and time-zone edges; banned and deleted accounts
   mid-session.
3. **End to end** (Playwright, desktop and phone): sign up with a code, verify, build, ATS,
   Add anything, assistant, profile, applications, tailor, prep, share, export, upgrade
   prompts for Free, campaign expiry back to Free, AI paused, payments off, delete account.
4. Everything stays fast; AI stays stubbed; one small live check at the end only with your OK.

## Phase 6. Beta finishing touches

1. **Feedback button** (page address and optional screenshot) → Admin › Feedback inbox with
   status (new / seen / fixed) and a reply by email.
2. **Error reporting**: browser errors and server 500s (no personal data, rate limited) →
   Admin › Errors, grouped, with counts.
3. **Beta label**, a "what's new / known issues" note, and a short welcome for campaign users.
4. **Maintenance mode**: read-only with a banner; **AI paused** banner when the cap hits.
5. **Backups**: a one-command export of the database (M0 has no backups) and instructions.

## Phase 7. Public pages and legal

- Pricing: resumes per plan, Profile and Applications as paid features, credits per feature,
  "See it" previews, "Coming soon" while payments are off.
- Home, About, FAQ, guides: applications, tailoring, interview prep, insights, Add anything
  and the assistant (V2 is on for everyone, so the gated content shows); sitemap and meta.
- Privacy (job descriptions, recruiter contacts, feedback, error reports, limits), Terms
  (beta, fair use, limits), Refunds (payments off during the beta).

## Phase 8. Marketing

- Refresh the marketing plan, Facebook posts, outreach templates and README with everything
  built since the last pass, plus a beta launch sequence for the 80 invites.
- **Animated mockups** from the real app with sample data, recorded in the browser: builder
  with live preview, ATS scan, Add anything, job capture to board, tailoring, interview
  prep, templates carousel, the assistant. Formats: MP4 1:1, 4:5 and 9:16, and a wide GIF
  for GitHub. Each with post copy.

## Order

Phases 1–5 make the beta safe, 6–8 make it good. Each phase is committed and reported
separately. Rough total: 12–16 working days of effort.

---

## Decision log

**Phase 1 (money safety)**
- Spend is tracked per month in its own record keyed by the month (concurrent calls can't
  duplicate it); calls that fail after using tokens still count, since they were paid for.
- The AI pause (cap or manual) is checked before credits are charged; admins are exempt so
  the owner can test. Settings reach every server within 30 seconds (the settings cache).
- Limits default to what each feature needs (assistant: 1,500 characters a message, last 10
  messages; imports: 20,000 characters, 6 pages; thinking off for chat, rewrite and cover
  letters, small for the rest). Worst case counts 3 characters a token (safe for Bangla).
- A model that rejects thinking settings is retried once without them, so switching models
  in the environment can't break every AI feature.
- Found and fixed: model names with dots (gemini-2.5-flash) couldn't be saved as prices;
  PDFs over 10 pages were sent whole to the model as "scanned"; the share-link and template
  checks ignored a plan kept after a downgrade.
- Campaign and admin feature switches live on the account (features + featuresExpireAt), so
  per-user overrides (Phase 2) reuse them. An explicit "off" wins even in free mode.
- The campaign estimate counts calendar-month allowances a window can touch (a 30-day
  campaign can touch 3), so it never under-estimates.
- Payments default to **off**. Test mode shows checkout only to admins and testers (via
  /billing/me, never the public page). Webhooks are processed in every mode.
- Verified email is required for AI only when the server can send email, so a missing SMTP
  setting can't lock AI for everyone.

**Phase 2 (plans, access and storage)**
- Resumes per plan is a plan limit (`resumes`, shown on pricing whether or not V2 is on).
  It counts on create, duplicate and tailoring; nothing existing is removed. Free mode lifts
  it; the hard ceiling per account (50) stays.
- Career Profile and Applications are plan features (off on Free). Every profile,
  applications and interview-prep route refuses without them (403 with an upgrade prompt
  naming the plan that has them); reminders skip those accounts. Admins follow the same rule
  and give themselves a plan to test, so what they see is what members see.
- The site never asks for a locked area: the builder's profile sync, the dashboard and the
  launcher only fetch the profile when the account has it (no 403s in the console).
- Plan cards and the upgrade dialog build "Up to N resumes" and "Career Profile and
  Applications" from the plan's real settings; stored perks stating a number of resumes or
  credits are hidden, so they can't contradict an admin's edit.
- The assistant resends the resume with every message, which made it the dearest feature per
  credit. The resume it gets is capped at 20,000 characters (about three full resumes), and
  earlier replies are kept to the message length, which the worst case previously undercounted.
  Worst case per message: about $0.0105 (was $0.0125).
- Rate limits aren't part of the campaign estimate: they cap speed, not the total, and
  credits always bind first. The estimate says so.
- Per-account overrides (Admin › Users › Access for this account, collapsed unless used):
  feature switches (plan / on / off, with an optional end date), "Turn all AI off", own
  limits that replace the plan's (even in free mode), and the tester flag. They reuse the
  campaign fields, so a campaign member's switches show there and can be edited. V2 on/off
  per account stays the existing "V2 preview" switch.
- Found and fixed: the applications routes loaded the account without its held plan (kept
  after a downgrade), so its applications and tailoring limits fell back to Free.
- Storage: photos are shrunk in the browser (original about 150 KB, cropped about 70 KB, was
  up to 1 MB); the server keeps its per-photo cap at 1 MB so photos saved earlier still
  load. One resume or profile may hold 300 KB of text (a real one is about 10 KB); request
  bodies are capped at 3 MB (was 10). Application snapshots keep the cropped photo, not the
  original. Admin › Overview › Storage shows usage of the quota (data plus indexes, as Atlas
  counts it), bytes by kind (photos too) and the biggest accounts; the owner is emailed once a
  month at the alert level (70%) and at 90%. Checked when resumes are created and when the
  admin opens it, at most hourly per server. Alerts are claimed in their own collection, so
  two servers never send the same one.
- Photos stay in the database for the beta (about 220 KB per resume after compression; 80
  users with 3 photo resumes each is about 50 MB of 512). **Production item:** one photo per
  account in a private Cloud Storage bucket, served through the API after a sign-in check
  (never a public link), fetched by the browser for the PDF, deleted with the account;
  signed-out drafts and private sessions keep theirs in the browser; privacy policy updated.

**Phase 3 (admin visibility)**
- Every new account records how it came in (organic, campaign, added by an admin), the tag
  of the link it arrived by (`?ref=fb-post-3` or `utm_source`, remembered in the browser for
  30 days, first visit wins), and a salted hash of its network (IPv4 /24, IPv6 /48), never
  the address. Older accounts read their source from their campaign. The privacy policy
  says so in one line.
- Admin › Sign-ups: newest first with source, link tag (click to filter), verified, plan,
  first steps (resumes, profile, applications, AI) and "+N from the same network"; filters
  by range, source, campaign, verified and search; sign-ups per day (hover for the split).
- Admin › Users › timeline: sign-up and how, verification, resumes, profile, applications
  and moves, each AI use with its real cost, upgrade prompts and checkouts, payments,
  refunds and admin changes; totals (AI uses, credits, cost, storage, same-network count).
- "Active" means a signed-in request in the period (`lastSeenAt`, noted at most hourly),
  because sessions last two weeks and logins alone undercount. Overview opens with active
  today and this week, sign-ups today and places left, and AI spend against the cap.
- Campaigns expand to their members and what each did, with places left.
- Alerts are raised once by id (two servers never send the same one), listed under a bell
  in the console (a badge for ones not yet seen in this browser) and emailed to the super
  admins: AI spend thresholds, storage 70% and 90%, sign-ups nearly full (10% or 3 left) and
  full, and 5 or more sign-ups from one network within an hour (once a day per network).

**Phase 4 (hardening)**
- PDFs and Word files are read in 2 worker threads (160 MB each, 20 s per file, queue of
  20): a stuck or hungry file is killed with its thread and a fresh one takes over; Word
  files are checked for zip bombs from their table of contents first. Their error
  messages now reach people instead of "AI request failed".
- Sign-up, login, reset, verification codes, 2FA, campaign look-ups and AI bursts are
  counted in the database (one small document per key and window, removed by the
  database), so two instances can't double them; the rest stay in memory.
- Campus sizing: login per address 150 per 15 min (per email stays 8), sign-ups per
  address 40 an hour; the whole-API limit counts signed-in traffic per account, with a
  6,000 a minute per-address ceiling for floods across many accounts.
- Throwaway email domains (40 common ones, editable in Credits & access, subdomains too)
  can't sign up.
- New campaigns get a random, unguessable code (short ones show a warning).
- Database pool 20 per instance (M0 allows 500), request timeouts, graceful shutdown on
  SIGTERM. Deploy doc: 2 instances, 1 GiB each, with the exact console clicks.
- `docs/security-review.md` walks the OWASP Top 10; npm audit is clean.

**Phase 5 (testing)**
- Load (`npm run load` in server/, simulated students autosaving every ~3 s, checking
  credits, tracking applications, scanning PDFs; FerretDB locally): 80 users, 0 errors,
  p95 under 100 ms; 150 users, 0 errors, p95 under about 650 ms; a 10-minute soak with 80
  users, 23,338 requests, 0 errors, memory flat at about 240 MB. Past that the local
  FerretDB is the bottleneck (3 of 4 cores), not the API (under 20%).
- Atlas M0 allows about 100 operations a second, and an autosave cost 3. The per-request
  session check is now cached for 30 s per server (any change to the account on that server
  forgets it at once), so an autosave costs 2.
- The public ATS checker counted 5 checks an hour per address, which a classroom would use
  up in a minute: now 10 per account when signed in and 30 per address when not.
- Abuse (`test/abuse.test.js`): racing "New resume", duplicates and new applications could
  pass plan limits; they're re-checked after creating and the extras (in creation order)
  undone. The account cap can be passed by a few in the same instant (campaign places are
  exact). A body nested 20,000 levels deep crashed the injection filter: bodies deeper than 40
  levels are refused. Prototype pollution and huge lists are handled.
- End to end (`npm run e2e`, Playwright, desktop and phone, 18 steps): campaign sign-up,
  autosave, PDF download, Profile and Applications for campaign members, adding an
  application, ATS checker, "Coming soon" pricing, AI paused notice, campaign end back to
  Free with locks, account deletion, no page errors. Found and fixed: an invite code was lost
  if someone used the menu's "Sign up" on the invite page (the code is now remembered in the
  browser for 30 days and filled into any sign-up, then forgotten); the phone's icon-only
  "Add" and "Tailor" buttons had no accessible names.

**Phase 6 (finishing)**
- Feedback: a "Beta" tag by the logo opens what's new, known issues and "Send feedback"
  (also in the account menu and on the error screen). A note, the page (path only), an
  optional screenshot (shrunk in the browser, 400 KB at most) and, signed out, an email.
  Admin › Feedback: new / seen / fixed, the screenshot on request, and a reply by email
  (recorded; refused when there's no address or no email set up). New feedback shows under
  the bell (not emailed, to keep the inbox quiet). Deleted with the account; in the export.
- Errors: uncaught browser errors (production only, 5 different ones per page load, known
  noise skipped) and every 5xx the API answers are grouped by a fingerprint in Admin ›
  Feedback › Errors, with counts per hour and a resolve switch (a resolved error reopens when
  it happens again). Emails, tokens, ids and long numbers are masked; pages keep only their
  path. The owner is emailed when one error happens 20 times in an hour (Admin › Site).
  Next.js error screens (page and whole layout) report and offer "Try again".
- Admin › Site: the Beta tag and its notes, the campaign welcome note, maintenance mode and
  the error alert level. Maintenance: reads work, writes answer 503 with the message
  (admins exempt; signing in, feedback and error reports stay open), a bar across the site.
- Campaign members see a one-time welcome (plan until when, credits, the note).
- Backups: `npm run backup` / `npm run restore` (Extended JSON, gzip, one file per
  collection; restore refuses to overwrite unless `--replace`), `docs/backups.md` with the
  Atlas clicks for a read-only backup user. `server/backups/` is git-ignored.
- The account export no longer includes internal fields (the encrypted 2FA secret, hashed
  recovery codes, the network hash).
- Found by the full suite: the after-insert resume check could still keep two when a resume
  made first was saved second. Each server now runs one account's creates (new resume,
  duplicate, new application) one at a time; the after-insert check stays for two servers.
- **Legal wording (approved by the owner, 30 Sep):** two privacy policy lines, "Feedback you send"
  and "Error reports".

**Phase 7 (public pages and legal)**
- V2 is the main version: the home page's V1 "Master profile" card is now "Help with the
  words" (the assistant, true for every visitor); the About page no longer explains the
  master profile. The Job Search section (shown when V2 is on) now covers bringing in an old
  CV, a resume per job, the board with reminders, and interview prep, and says plainly that
  it's part of Pro and Premium while the builder, ATS check and first resume stay free. The
  FAQ no longer calls tailoring "free" and adds "What is interview prep?" and "Which plans
  include this?". The pricing subtitle names the job-search tools when V2 is on.
- Builder: with V2 on and no Career Profile on the plan, the old "Fill from master" button
  is replaced by "Profile" with its plan tag, opening the upgrade dialog and its preview.
- **Legal wording (approved by the owner, 30 Sep):** Terms, new "Early access" and "Campaign and
  invite access" sections, and the fair-use line (credits, input size, resume and
  application limits); Refund Policy, new "During early access" section. Last updated 30
  September 2026.
- **Refund policy (owner, 30 Sep):** more than 2 applications added since paying counts as
  "used" for the 14-day refund; the Career Profile doesn't. In `lib/refunds.js`, the admin
  Refund check and the Refund Policy page.

**Phase 8 (marketing)**
- `docs/marketing/beta-launch.md`: set-up clicks for the 80-student beta (campaign-only
  sign-ups, a random code, Pro for 28 days with 40 credits a month: about $67 worst case,
  $17 typical, the $40 cap on top), a four-week sequence, invite messages in English and
  Bangla, and the daily admin check.
- Animated mockups recorded from the real app with sample data (`docs/marketing/video/
  record.mjs`, Chrome screencast frames at full resolution, a drawn pointer and caption
  pill, ffmpeg): build, ats, jobsearch, tailor, prep, templates and private, each as 1:1,
  4:5, 9:16 (phone layout) MP4 and a wide GIF, with post copy (English and Bangla) in
  `docs/marketing/videos/README.md`. Tailor, prep and jobsearch are Pro and wait for V2 to
  be on for everyone.
- A beta post series (BT1–BT5 in `facebook-posts.md`): teaser, invites open,
  the ATS check, week-one fixes, before it ends. The app's "Free, no AI credits" labels on V2 tools now say
  "Uses no AI credits" (the tools are Pro; only the credits are free).
- Job-search posts and the plan no longer call Profile, Applications, tailoring or interview
  prep "free" (they're Pro and Premium, or the beta invite).
- Found while recording and fixed: the job analyzer missed "Junior Software Engineer at
  Pathao, Dhaka…" (a one-paragraph post); "title at company" openings are now read (with
  tests, including sentences that aren't titles). The ATS checker said "5 free checks an
  hour", stale since the limit changed and admin-editable anyway: now "free, no sign-up"
  and "a fair-use limit per hour applies".

**Legal review (owner asked, 30 Sep)** — see `docs/legal.md`.
- No analytics, ad or tracking cookies anywhere, so no cookie banner is needed; the Privacy
  Policy now lists everything kept in the browser (`/privacy#cookies`, footer "Cookies").
- Bangladesh's Personal Data Protection Act 2026 treats under-18s as children needing a
  parent's consent, so accounts are now 18+ (Terms, Privacy, sign-up line); the builder stays
  open to anyone without an account. Revisit with a parent-consent flow if younger students ask.
- Privacy Policy: who is responsible, legal bases, providers by name, storage abroad,
  retention per kind of data (and a wrong "deleted after a few days" for AI records fixed:
  it's 180 days), rights with a 30-day reply, breach notice.
- Terms: our templates and IP, reporting content, suspension and 30 days' notice before any
  shutdown, availability, indemnity, other services, Bangladesh law and Dhaka courts,
  whole agreement.
- Sign-up records the terms version and time (`User.termsAccepted`, `lib/legal.js`, same
  date as `LEGAL_UPDATED`, checked by `test/legal.test.js`). Feedback now expires after 2
  years and error reports 90 days after they last happened, as the policy says; backups keep
  the last four.
- **Needs the owner's OK (legal wording):** the new Privacy and Terms sections above, and 18+.

**Admin tools (owner asked, 30 Sep)**
- Campaign estimate: "Likely" uses real usage (credits an account uses a month, what a
  credit really costs; `GET /admin/ai-usage`), else a stated guess (25 credits a month, a
  request at 35% of its worst case), members joining on different days (1 + days/30.44
  monthly allowances); "At most" is the worst case bounded by the monthly AI cap (what's
  left this month plus a full cap per further month) and by the per-minute AI rate limit
  when that binds. Admin AI calls don't count in the measured cost per credit.
- Plans: "Rewrite with AI" for perks (`POST /admin/perks-draft`, lib/perksDraft.js). Facts
  come from the plan's unsaved settings (features, templates it opens, V2 only when on, the
  plan below); lines stating credits or resumes, or with numbers the facts don't have, are
  dropped; the admin uses or dismisses it. 300 output tokens, 30 an hour per admin, counted
  in the AI cap. The editor also shows what the page adds on its own and which lines it hides.
