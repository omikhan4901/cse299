# Security review (beta)

A review of the API and site against the OWASP Top 10 (2021) before the invite-only beta,
done in Phase 4 of `docs/v2/BETA-PLAN.md`. Each area lists what protects it, what was fixed
in this review, and any risk accepted for now (with the reason). Server tests named in
brackets cover the behaviour.

## A01 Broken access control

- Every resume, profile, application and share route loads records by id **and** the
  signed-in account (`findOwned`, `{ user: req.userId }`); another account's id is a 404.
  [resumes, applications, profile, fuzz]
- Paid areas are refused on the server, not only hidden: Career Profile, Applications,
  tailoring and interview prep return 403 with an upgrade prompt without the plan or a
  switch. [paidAreas, userOverrides]
- Admin routes sit behind `protect` + `requireAdmin`, which requires a verified email and a
  session that passed two-factor for admins; super-admin-only actions (roles, 2FA reset,
  deleting admins) are checked again per route. Every admin change is in the audit log. [admin]
- Public share links expose only the fields meant for the page (no photo original, crop,
  biodata, tailoring source). Share codes are 48 random bits, and the route is rate limited.
- **Fixed:** the applications routes loaded the account without its held plan, so its
  plan limits could be wrong after a downgrade. [userOverrides]

## A02 Cryptographic failures

- Passwords: bcrypt. Password-reset tokens: random, stored only as a SHA-256 hash, one
  hour, single use. Two-factor secrets: AES-GCM encrypted; recovery codes hashed.
- Sessions: HS256 JWTs with the algorithm pinned, a 32+ character secret required in
  production, 14 days for users and 12 hours for admins, revoked by `sessionVersion`
  (password change, ban, 2FA reset).
- HSTS in production; the network of a sign-up is kept only as a salted hash, never the
  address. [signupsFeed]

## A03 Injection

- MongoDB operator injection: every body and query string is stripped of `$` keys and
  dotted keys before any route runs; ids are validated with `isValidObjectId`. [fuzz]
- Regex search input is escaped (`escapeRe`); searches are literal. [signupsFeed]
- HTML emails escape everything users typed (names, job titles). CSV exports neutralise
  formula characters.
- AI prompt injection: the AI only *proposes* changes that the person approves; removals
  must quote the person's own words; claims about the person must be supported by their
  resume (`checkOperations`, `checkPrep`). [removals, ingest, interviewAi]
- **Fixed:** two public pages embedded structured data without escaping `<` (static
  content, but now the same safe helper as the rest of the site).

## A04 Insecure design

- Money is enforced by the server: credits are charged before an AI call and refunded on
  failure; a monthly AI spending cap pauses AI for everyone but admins; per-feature input,
  output and thinking limits bound what one request can cost. [aiSpend, aiLimits]
- Sign-up abuse: a hard account cap, campaign places claimed atomically, AI only after
  email verification, throwaway email domains refused, per-network sign-up limits and an
  alert on bursts from one network. [signups, hardening, alerts]
- **Fixed:** campaign codes were whatever the admin typed ("BETA80" is guessable, and
  anyone with it takes a place). New campaigns now get a random code (`BETA-7KQ2XM`), and
  short codes show a warning.

## A05 Security misconfiguration

- `x-powered-by` off; `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a
  content security policy on the site; API responses are `no-store`.
- CORS is limited to `CLIENT_ORIGIN` (a warning is logged in production when it's unset).
- Errors: 5xx answers say only "Server error"; details go to the server log.
- Request bodies are capped per route (3 MB for resumes and the profile, 1 MB for
  applications and the admin console, 2 MB for AI).
- **Accepted:** the site's CSP allows inline scripts (`'unsafe-inline'`), which Next.js
  needs without per-request nonces. React escapes all rendered text and no user content
  is rendered as HTML, so this only matters if an XSS bug appears. Moving to nonce-based
  CSP is listed for the production build.

## A06 Vulnerable and outdated components

- Dependencies are locked (`npm ci`). PDF reading uses pdf.js with `isEvalSupported:
  false` and no font loading.
- `npm audit --omit=dev` on 29 Sep 2026: 0 vulnerabilities in `server/` and `client/`.
  Run it again before the production launch and after dependency updates.

## A07 Identification and authentication failures

- Login: a constant-time comparison against a dummy hash for unknown emails; per-email and
  per-network attempt limits, now **counted in the database** so they hold across server
  instances. [hardening]
- Two-factor (TOTP) with replay protection (last used step); required for admins.
- Password rules and a reset that signs out every other session.
- **Accepted:** sign-up says "User already exists" for a taken email (reveals that an
  address has an account). The sign-up limit per network makes this slow to abuse, and a
  vaguer message would confuse students who forgot they signed up.

## A08 Software and data integrity failures

- Paddle webhooks are verified against the raw body with the webhook secret before
  anything is processed; unverified deliveries get a 401. [paddle]
- Settings changes are validated field by field (`clean()`); unknown fields are dropped.
- Saves carry a revision number, so an old tab can't overwrite newer work silently.

## A09 Security logging and monitoring failures

- Admin actions: the audit log (two years). AI calls: every call with feature, tokens,
  model and cost. Money: payments, refunds and billing events.
- Alerts to the owner by email and in the console: AI spend thresholds, storage 70% and
  90%, sign-ups nearly full and full, sign-up bursts from one network. [alerts]
- To come in Phase 6: browser and server error reports in the admin console.

## A10 Server-side request forgery

- Job pages are fetched through `safeFetch`: http(s) only, DNS resolved first, private,
  loopback, link-local and metadata addresses refused (also after redirects), limited
  size and time. [capture]

## Uploads and denial of service

- **Fixed:** PDFs and Word files were read on the main thread, so one hostile file could
  freeze the API for everyone. They are now read in worker threads with a memory ceiling
  and a hard time limit; a stuck worker is killed and replaced, the queue is bounded, and
  Word files are checked for zip bombs before opening. [files]
- File size limits (5 MB for the ATS checker, 10 MB for imports), page limits before the
  AI is called, and every route has a rate limit that appears in Admin › Rate limits.
- **Fixed:** the whole-API limit counted per address, which would have throttled a campus
  sharing one address. Signed-in traffic now counts per account, with a separate, high
  per-network ceiling for floods across many accounts. [hardening]
- The server finishes in-flight requests on shutdown, times out stuck requests, and uses a
  bounded database connection pool sized for Atlas M0.
