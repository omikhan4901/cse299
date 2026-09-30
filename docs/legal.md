# Legal checklist

What ResumeX does to stay on the right side of the law, and what still needs a lawyer.
Checked 30 September 2026. This is not legal advice: a one-time review by a Bangladeshi lawyer
(about data protection and consumer law) before paid plans open is still worth it.

## The laws that matter

- **Bangladesh, Personal Data Protection Act 2026** (the ordinance of November 2025, made an
  Act on 15 April 2026). Most users are here. It asks for consent that is informed and can
  be withdrawn; telling people the purpose, how long data is kept and whether it leaves the
  country; access, correction, deletion and portability on request; telling the authority
  about serious breaches; and a parent's consent for anyone **under 18**. Some sections apply
  from about May 2027, but we follow it now. Fines go up to 25 lakh Taka.
- **EU/UK GDPR and ePrivacy**, only if people there use it. The Privacy Policy is written to
  meet them too: legal bases, rights, retention, transfers.
- **Cookie consent** laws (the ones people get sued over) apply to cookies and trackers
  that aren't needed for the site to work: analytics, ads, pixels. ResumeX has none, so it
  needs no cookie banner. **If you ever add Google Analytics, a Facebook pixel or similar,
  a consent banner is needed first.** Ask before adding one.
- **Payments:** Paddle is the merchant of record: it sells to the customer and handles tax,
  invoices and chargebacks, which removes most consumer-sales duties from us.

## What's in place

| Need | Where |
|---|---|
| Terms of Service (age 18+, acceptable use, IP, suspension, liability cap, indemnity, governing law Bangladesh/Dhaka, severability) | `/terms` |
| Privacy Policy (who is responsible, what and why, legal bases, processors by name, transfers abroad, retention per kind of data, rights with a 30-day reply, breach notice, children) | `/privacy` |
| Cookie notice (what's stored in the browser and why; no banner needed) | `/privacy#cookies`, footer "Cookies" |
| Refund Policy (Paddle's required wording, 14 days, what counts as use) | `/refunds` |
| Agreement at sign-up, shown right above the button, with the age confirmation | `AuthModal.jsx` |
| Proof of agreement: each account stores the terms version and time it agreed | `User.termsAccepted`, `server/lib/legal.js` |
| Retention actually enforced: feedback 2 years, error reports 90 days, AI records 180 days, downloads 12 months, backups about 5 weeks | TTL indexes, `docs/backups.md` |
| Data export and account deletion | Account settings |
| Unsubscribe in every reminder email; no marketing email without consent | reminders |
| Content reports and takedown | Terms › Reporting content |

## When the legal pages change

Change the wording, then set `LEGAL_UPDATED` in `client/src/lib/config.js` and
`TERMS_VERSION` in `server/lib/legal.js` to the same date (a test checks they match).
Announce significant changes in the app before they take effect.

## Open questions for a lawyer

1. Whether the Personal Data Protection Act needs registration with the authority, or a
   named data protection officer, for a service of this size.
2. Whether resume data counts as "confidential" under the Act's data classes (that would
   require storage in Bangladesh). Our reading: it's ordinary personal data, so storage
   abroad with safeguards is fine.
3. Whether Bangladesh's Digital Commerce guidelines apply to a subscription sold through
   Paddle as merchant of record (for example showing a trade licence).
4. The 16–17 year-old question: accounts are 18+ for now (the Act needs a parent's consent
   under 18). A parent-consent flow could open it to younger students later.
