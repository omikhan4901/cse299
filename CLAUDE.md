# Working on ResumeX

The plan for ResumeX V2 (Career Profile, applications, tailoring) is in `docs/v2/SPEC.md`.
Read it before building anything in that area, and keep it up to date when decisions change.

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
