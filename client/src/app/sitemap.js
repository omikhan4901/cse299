import { SITE_URL } from "@/lib/config";
import { TEMPLATES } from "@/pdf/registry";
import { CATEGORY_PAGES } from "@/lib/seo";
import { GUIDES } from "@/content/guides";

// Bump when the marketing pages or templates change meaningfully.
const UPDATED = new Date("2026-09-28");

export default function sitemap() {
  const page = (path, priority, changeFrequency = "monthly", lastModified = UPDATED) => ({ url: `${SITE_URL}${path}`, lastModified, changeFrequency, priority });
  return [
    page("/", 1, "weekly"),
    page("/templates", 0.9, "weekly"),
    page("/ats-checker", 0.9),
    page("/resume-guide", 0.8),
    page("/guides", 0.8, "weekly"),
    ...CATEGORY_PAGES.map((c) => page(`/templates/category/${c.slug}`, 0.8)),
    ...GUIDES.map((g) => page(`/guides/${g.slug}`, 0.7, "monthly", new Date(g.date))),
    ...TEMPLATES.map((t) => page(`/templates/${t.slug}`, 0.6)),
    page("/pricing", 0.6),
    page("/about", 0.5, "yearly"),
    page("/privacy", 0.2, "yearly"),
    page("/terms", 0.2, "yearly"),
    page("/refunds", 0.2, "yearly"),
  ];
}
