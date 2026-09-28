import { SITE_URL } from "@/lib/config";

// Account pages are also marked noindex. The builder and shared resumes stay crawlable so
// search engines can see their noindex tags (a disallowed URL can still be indexed from links).
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/account", "/admin", "/join/", "/reset-password"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
