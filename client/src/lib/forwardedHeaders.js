import { headers } from "next/headers";

/**
 * Headers for API calls made by the Next.js server on a visitor's behalf.
 * With INTERNAL_API_KEY set (server-only, same value on the API), the API rate
 * limits by the visitor's IP instead of Vercel's.
 */
export async function forwardedHeaders() {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return {};
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim();
  return ip ? { "x-internal-key": key, "x-client-ip": ip } : {};
}
