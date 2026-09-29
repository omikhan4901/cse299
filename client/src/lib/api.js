import { API_URL } from "./config";
import { trackAi } from "./aiActivity";

export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data; // e.g. the latest copy of a resume on a "conflict"
  }
}

/** Fired when an admin saves plan settings, so open pages reload them. */
export const SETTINGS_CHANGED = "resumex:settings-changed";

/** Fired when the server refuses something because of the plan; BillingProvider shows the upgrade dialog. */
export const UPGRADE_NEEDED = "resumex:upgrade-needed";

/**
 * fetch() wrapper for the Express API. Throws ApiError with the server's
 * message on failure and returns the parsed JSON body on success.
 */
// AI requests the server treats as long tasks (a 100 s budget): the browser waits longer for them.
const LONG_AI = ["/ai/parse", "/ai/ingest", "/ai/polish", "/ai/interview-prep"];

export async function api(path, { token, method = "GET", body, timeout = LONG_AI.includes(path) ? 110000 : 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  // AI requests can be slow when the provider is busy: show them in the status card, with a
  // Cancel button. The server gives up within its time budget (45 s; 100 s for imports and other long tasks) and
  // refunds anything that doesn't finish, including cancelled requests.
  const isAi = path.startsWith("/ai/") && method !== "GET" && typeof window !== "undefined";
  let cancelled = false;
  const untrack = isAi
    ? trackAi({ path, startedAt: Date.now(), budgetMs: LONG_AI.includes(path) ? 100000 : 45000, cancel: () => ((cancelled = true), controller.abort()) })
    : null;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      if (data.code === "upgrade" && data.feature && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(UPGRADE_NEEDED, { detail: { feature: data.feature, plan: data.plan, template: data.template } }));
      }
      throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code, data.data);
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      if (cancelled) throw new ApiError("Cancelled. You weren't charged for this.", 0, "cancelled");
      if (isAi) throw new ApiError("The AI took too long to answer. You weren't charged for this. Please try again.", 0, "timeout");
      throw new ApiError("The server took too long to respond. It may be waking up — please try again.", 0);
    }
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
    untrack?.();
    // AI requests may have spent credits: let the credit meter refresh.
    if (path.startsWith("/ai/") && typeof window !== "undefined") window.dispatchEvent(new Event("resumex:credits-changed"));
  }
}
