import { API_URL } from "./config";

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
export async function api(path, { token, method = "GET", body, timeout = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
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
    if (err.name === "AbortError") throw new ApiError("The server took too long to respond. It may be waking up — please try again.", 0);
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
    // AI requests may have spent credits: let the credit meter refresh.
    if (path.startsWith("/ai/") && typeof window !== "undefined") window.dispatchEvent(new Event("resumex:credits-changed"));
  }
}
