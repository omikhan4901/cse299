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
