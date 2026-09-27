import { cache } from "react";
import { API_URL } from "./config";
import { normalizeResume } from "./resume";

/**
 * Fetches a shared resume on the server. Returns { resume } on success,
 * { notFound: true } for missing/private ones and { unavailable: true } when
 * the API can't be reached (e.g. the free server is still waking up).
 */
export const getPublicResume = cache(async (id) => {
  if (!/^[\w-]{4,40}$/.test(id)) return { notFound: true };
  try {
    const res = await fetch(`${API_URL}/public/${encodeURIComponent(id)}`, {
      // Always fetch the latest save, so a changed template or colour shows up straight away.
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (res.status === 404 || res.status === 403) return { notFound: true };
    if (!res.ok) return { unavailable: true };
    const { data } = await res.json();
    return { resume: normalizeResume(data) };
  } catch {
    return { unavailable: true };
  }
});
