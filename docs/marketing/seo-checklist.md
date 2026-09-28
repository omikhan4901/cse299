# SEO checklist

Search traffic is slow to start (usually 2 to 4 months) but it's free and it compounds. The site is now built for it. This file covers what to set up once and what to do each month.

## What's already built into the site

- **72 indexable pages:** home, 50 template pages (`/templates/<name>`), 7 template-style pages (`/templates/category/<style>`), the ATS checker landing page, the resume guide, a guides index, 6 career guides, plus pricing, about and the legal pages.
- **A unique title, description and canonical URL on every page.** Titles target real searches such as "free ATS resume checker", "student resume templates" and "how to write a resume as a fresh graduate".
- **Structured data (JSON-LD):** Organization, WebSite, SoftwareApplication, Article, FAQPage, ItemList, CreativeWork and BreadcrumbList.
- **`/sitemap.xml`** lists every public page. **`/robots.txt`** keeps crawlers out of account pages.
- **Private pages are noindex:** builder, dashboard, account, admin and shared resumes (so people's CVs never show up in Google).
- **Internal links** between templates, styles, guides and the ATS checker, plus breadcrumbs.
- **Social preview images** for every template and page.
- **Fast static pages:** every marketing page is pre-rendered.

## One-time setup (about 30 minutes)

### 1. Domain
- [ ] In **Vercel → Project → Settings → Domains**, make `resumex.cc` the primary domain and set `www.resumex.cc` to **redirect** to it. One canonical domain avoids duplicate pages.
- [ ] In **Vercel → Settings → Environment Variables**, set `NEXT_PUBLIC_SITE_URL` = `https://resumex.cc` (Production). It already defaults to this in production, but setting it is explicit.

### 2. Google Search Console
1. Go to https://search.google.com/search-console and click **Add property**.
2. **Easiest:** choose **URL prefix**, enter `https://resumex.cc`, then choose the **HTML tag** method. Copy only the `content="…"` value.
3. In Vercel, add the env var `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` = *that value*, then **redeploy**.
4. Back in Search Console, click **Verify**.
   - *Alternative:* choose **Domain** and add the TXT record it gives you in Spaceship's DNS settings. This covers `www` and every subdomain too.
5. Open **Sitemaps** and submit `https://resumex.cc/sitemap.xml`.
6. Use **URL inspection → Request indexing** for your most important pages:
   - `https://resumex.cc/`
   - `https://resumex.cc/ats-checker`
   - `https://resumex.cc/templates`
   - `https://resumex.cc/guides/fresh-graduate-resume`
   - `https://resumex.cc/templates/category/ats-friendly`

### 3. Bing (also powers DuckDuckGo and Yahoo)
- [ ] Go to https://www.bing.com/webmasters and choose **Import from Google Search Console** (the quickest way). Or verify with the meta tag by setting `NEXT_PUBLIC_BING_SITE_VERIFICATION` in Vercel and redeploying.
- [ ] Submit the sitemap there too.

### 4. Check it works
- [ ] **Rich Results Test** (https://search.google.com/test/rich-results): test `/ats-checker`, a guide and a template page. They should show valid Article, Breadcrumb, SoftwareApplication and FAQ items. Google now shows FAQ rich results mainly for government and health sites, so don't expect FAQ drop-downs in results. The markup still helps search engines understand the page.
- [ ] **PageSpeed Insights** (https://pagespeed.web.dev): test the home page on mobile.
- [ ] Share a link on Facebook to check the preview image: https://developers.facebook.com/tools/debug/ (click "Scrape again" after changes).

### 5. Get your first backlinks
Links from other sites are the biggest ranking factor you can influence. Easy ones:
- [ ] Your Facebook page, LinkedIn company page and both founders' LinkedIn profiles (Contact info → Website).
- [ ] The GitHub repository description and README.
- [ ] Free directories: Product Hunt (plan a launch day), AlternativeTo (list as an alternative to Canva, Zety and Resume.io), SaaSHub, BetaList, and "There's An AI For That" (if AI is on).
- [ ] University club websites and partner pages (ask partners to link to you).
- [ ] Answer CV questions on Quora and Reddit (r/resumes, r/bangladesh) *helpfully*, linking a guide only where it truly answers the question.

## Monthly routine (about 2 hours)

1. **Search Console → Performance → Queries.** Look for:
   - queries with many impressions but a low click rate → improve that page's title and description to match the query more closely;
   - queries in positions 8 to 20 → add a section to that page answering the query, or write a guide on it.
2. **Publish one new guide.** Add an entry to `client/src/content/guides.js` (it appears on `/guides`, in the sitemap and in structured data automatically). Aim for 1,200+ words, real examples, and links to relevant templates and the ATS checker.
3. **Share each new guide** on the Facebook page and in one or two groups. Traffic signals help.
4. **Check Search Console → Pages** for errors or pages "Discovered – currently not indexed". Request indexing for important ones.

### Guide ideas (with the search they target)

| Guide title | Target search |
|---|---|
| CV Format for Fresh Graduates in Bangladesh (with Examples) | cv format for fresh graduate bangladesh |
| How Long Should a Resume Be? | how long should a resume be |
| 30 Resume Summary Examples for Every Field | resume summary examples |
| Should You Put Your CGPA on Your CV? | cgpa on cv / gpa on resume |
| How to Write a Cover Letter (with Templates) | how to write a cover letter |
| Software Engineer Resume: Examples and Tips | software engineer resume |
| BBA Fresh Graduate CV: What to Include | bba cv / business graduate resume |
| Best Skills to Put on a Resume in 2026 | skills to put on resume |
| How to List Projects on a Resume | projects on resume |
| CV for Bank Jobs in Bangladesh | cv for bank job bangladesh |
| How to Explain a Gap in Your CV | gap in cv / employment gap resume |
| LinkedIn Profile Tips for Students | linkedin profile tips for students |

Write for people first: specific, honest and full of examples. Google rewards content that actually helps.
