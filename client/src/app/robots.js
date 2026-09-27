import { SITE_URL } from "@/lib/config";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
