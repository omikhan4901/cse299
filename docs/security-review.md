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

- **Fixed:** limits checked before creating could be raced (ten "New resume" clicks at
  once on Free made ten). Resumes and applications are now re-checked after creating; the
  ones past the limit, in creation order, are removed and refused. [abuse]
- **Accepted:** the account cap ("close sign-ups after N") can be passed by a few when many
  sign up in the same instant; undone sign-ups give their campaign place back. Campaign
  places themselves are exact (claimed atomically), and the beta is campaign-only.

## A05 Security misconfiguration

- `x-powered-by` off; `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a
  content security policy on the site; API responses are `no-store`.
- CORS is limited to `CLIENT_ORIGIN` (a warning is logged in production when it's unset).
- Errors: 5xx answers say only "Server error"; details go to the server log.
- **Fixed:** a request nested 20,000 levels deep crashed the injection filter (a 500). Bodies
  and query strings deeper than 40 levels are now refused with a 400. [abuse]
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
- The per-request session check (session version, ban) is cached for 30 seconds per server
  to spare the database; changes on the same server apply at once, so a ban or "sign out
  everywhere" can take up to 30 seconds to reach the other instance. [hardening]
- Two-factor (TOTP) with replay protection (last used step); required for admins.
- Password rules and a reset that signs out every other session.
- **Fixed (30 Sep):** sign-up said "User already exists" for a taken email. A taken address
  now gets the same answer as a new one, and an email saying how to log in or reset the
  password. Every account's email is verified by a code before it exists.

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

## Network attacks (30 Sep)

What happens when someone floods the site, by kind of attack:

| Attack | What stops it |
|---|---|
| Many requests from one network or account | Whole-API ceiling (600 a minute per account or network) and a stricter limit on every route; login, codes and sign-ups are counted in the database, so they hold on both servers |
| Many requests from many networks (a botnet) | Per-account and per-email limits; hourly **whole-site** ceilings on the emails signed-out visitors can trigger (sign-up 300, password reset 200, adjustable in Admin › Rate limits), counted only when an email is really sent, with an alert to the owner |
| Password guessing and credential stuffing | 8 attempts per account per 15 minutes from anywhere, plus per network; 2FA for admins |
| Guessing sign-up or login codes | 5 tries per code, codes expire, 30 checks per 15 minutes per network |
| Fake accounts and campaign squatting | No account without an emailed code; campaign places only for verified addresses; admins delete accounts from the lists and the place comes back |
| Finding out who has an account | Sign-up and password reset give the same answer either way |
| Running up the AI bill | Credits per account, 8 AI requests a minute per account, the monthly AI cap (AI pauses for everyone at the cap) |
| Running up the server bill | At most 2 Cloud Run instances; bounded database pool |
| Slow or huge requests | Header and request timeouts, body limits per route, depth limits, files read in worker threads with memory and time limits |
| Our server fetching internal addresses (SSRF) | `safeFetch` refuses private, loopback and metadata addresses, also after redirects |
| Forged payment events | Paddle signatures checked on the raw body |
| Other websites using the API from a browser | CORS limited to `CLIENT_ORIGIN` |
| Known vulnerable packages | `npm audit --omit=dev`: 0 in server and client (30 Sep) |

**What code can't stop:** a very large flood can still make the site slow while it lasts
(the limits refuse the extra requests, but they still arrive). The website on Vercel sits
behind Vercel's own DDoS protection; the API on Cloud Run behind Google's front end, which
absorbs network-level floods. For more, see the owner settings below.

**Owner settings** (outside the code, least privilege):
1. **Google Cloud → Billing → Budgets & alerts**: a budget (e.g. $10 a month) with email
   alerts at 50%, 90% and 100%.
2. **Gemini key**: Google Cloud → APIs & Services → Credentials → the key → *API
   restrictions*: only "Generative Language API". Set a daily request quota in
   Google AI Studio (or Vertex AI quotas) as a second brake behind the AI cap.
3. **Two-factor on every account** that can change the site: Google, GitHub, Vercel,
   MongoDB Atlas, Paddle, the email provider and the domain registrar.
4. **MongoDB Atlas**: the app's database user has only *readWrite* on the ResumeX database
   (not *atlasAdmin*), with a long generated password; backups use the read-only user
   (docs/backups.md).
5. **Secrets** only in Cloud Run / Vercel settings or a password manager; a leaked one is
   replaced at once (new `JWT_SECRET` signs everyone out).
6. **Optional, for large floods**: put the free Cloudflare plan in front of resumex.cc
   (and a custom API domain), or Google Cloud Armor (a paid load balancer).
