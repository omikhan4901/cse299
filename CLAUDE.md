# Working on ResumeX

The plan for ResumeX V2 (Career Profile, applications, tailoring) is in `docs/v2/SPEC.md`.
Read it before building anything in that area. It is a living document: before each phase,
re-check its assumptions, and update the spec (and tell the owner) instead of building around
something that no longer holds.

## Features must work together

When adding or changing a feature, even from a short or vague request, always work out how
it connects to the features that already exist, and wire those connections up yourself
without being asked. A request for a feature always implies it must fit with everything
else. Before calling a feature done, go through this list and handle each point that applies:

- **Plans, credits and locks**: does it belong to a plan? Put it in the plan settings
  (`server/lib/settings.js` APP_FEATURES / AI_FEATURES), enforce it on the server, and show
  the lock up front in the UI (`BillingProvider`, `PlanTag`, upgrade dialog). AI features
  charge credits and refund them on failure (`lib/credits.js`).
- **Free mode and campaigns**: free mode opens every feature; campaign plans and credits
  must keep working alongside it.
- **Admin console**: anything an admin could reasonably want to adjust (limits, prices,
  access, templates) goes in the admin settings, not a constant.
- **Rate limits**: every new endpoint gets a `limit()` from `lib/rateLimit.js`, so it
  appears in the admin Rate limits tab.
- **Payments (Paddle)**: if it touches plans, respect subscriptions, the refund policy and
  its records (`lib/refunds.js`), and plans given by admins or campaigns.
- **Templates**: respect template tiers (categories and overrides) on client and server.
- **Builder states**: signed out, a browser-only draft, a private session (stores nothing),
  a saved resume (autosave with revisions and conflict handling), and the "Open builder"
  dialog, which must warn before unsaved work is lost.
- **Stale state across tabs**: settings and billing refresh on focus; saves never
  overwrite newer work silently.
- **Legal and public pages**: update the privacy policy, terms, refund policy, FAQ, pricing
  page and sitemap when what the product does or collects changes.
- **Tests**: add server tests in `server/test/`; the fuzz test covers new routes on its own.
  Keep `client/src/lib/access.js` and the server's rules identical (checked by the parity
  test). Check user-facing changes in a real browser.

If a connection is a real product decision (pricing, what's free, legal wording), ask; otherwise decide and say what you did.

## Conventions

- Commit as the owner:
  `git -c user.name=omikhan4901 -c user.email=mehboobehsankhan@gmail.com commit ...`
  with no AI co-author lines and no model names.
- Work on and push to `main` (Cloud Build deploys the API and Vercel the site from it).
- Never commit secrets: API keys, database passwords, SMTP passwords, Paddle keys or
  webhook secrets.
- `client/AGENTS.md` and `client/CLAUDE.md` are written by `next dev`; commit them when they change.
- Before pushing: `npm test` in `server/`, and `npx eslint src` plus `npx next build` in `client/`.

## Working with the owner (keep this section short; add only what changes how work is done)

- Keep this file current: when you learn how the owner wants things done, add it here in one
  line. Remove anything that stops being true. Don't pad it.
- The owner's "go ahead" starts work. If they interrupt a tool call, stop and wait.
- Beta work (docs/v2/BETA-PLAN.md): the owner put me in charge; decide details myself, log decisions in
  the plan, keep improving it, and only ask about pricing, what's free and legal wording.
- **Look and feel:** calm, uncluttered screens with little text. Heavy features still show
  one clear next action at a time; details appear only when needed (progressive disclosure).
  Match the existing design (antd + Tailwind, motion); make it eye-catching but easy on the eyes.
  New sections reuse the existing markup (white/slate-50 bands, bordered cards, brand-50 icon
  tiles); no dark gradient bands, glows or illustrated mock-ups: the owner reads those as "AI-looking".
  Paid features are shown to Free users as small animated replicas of the real UI with sample
  data (`billing/FeaturePreview.jsx`, in the upgrade dialog and pricing "See it"); add one per new paid feature.
  Dialogs never fill the screen: cap their height and scroll inside.
- **Tests:** rigorous and edge-case heavy, but fast (the whole server suite runs in ~4 min;
  never add slow tests). Don't call the live AI or run `server/eval` unless asked: AI
  credit is limited. AI routes are tested with the stubbed model only.
- **V2 is the main version** (owner, Sep 2026): design, copy, tests and new work assume it; the
  admin switch stays only to open it to everyone at launch and as a kill switch (the owner flips it).
- **V2** is built behind the admin "V2 preview" switch, in the order of `docs/v2/PLAN.md`,
  keeping the spec's philosophy (deterministic first, AI proposes and the user approves).
  Paddle goes live only after V2 is complete and tested. No separate Job Search Pass: V2 tools are the
  Pro/Premium incentive (limits and V2 plan features in Admin › Plans).
- The owner isn't a cloud-console expert: give exact click paths or commands, and always
  the least-privilege option (e.g. `roles/aiplatform.user`, not admin).
- Credentials the owner shares live only in the session scratchpad; never print or commit them.
- Public pages and marketing only claim what every visitor can use now: V2 copy is gated on
  `settings.v2.enabled` (see `JobSearchShowcase`), and launch posts wait for that switch.
- Local tests run on FerretDB: avoid `$group` with expressions or `$ne` inside it, and
  `findOneAndUpdate` with a projection; sum in JS or update then read. Real MongoDB in CI.
- Never `pkill -f` a pattern that appears in your own command line (it kills the shell); the
  scratchpad's `killsrv.sh` stops the local API and site safely.
