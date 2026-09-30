import { API_URL } from "./config";

/**
 * Sends an error the site hit to Admin › Errors (production only): the message, the stack and
 * the page path (never the query string). The server masks anything personal. At most 5
 * different errors per page load, each once, and known browser noise is skipped.
 */
const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i, /Non-Error promise rejection captured/i];
const seen = new Set();

export function reportError(err) {
  if (process.env.NODE_ENV !== "production" || typeof window === "undefined") return;
  const message = String(err?.message || err || "").slice(0, 300);
  const stack = String(err?.stack || "").slice(0, 2000);
  if (!message || NOISE.some((r) => r.test(message) || r.test(stack))) return;
  if (seen.has(message) || seen.size >= 5) return;
  seen.add(message);
  fetch(`${API_URL}/reports/error`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, stack, page: window.location.pathname }),
    keepalive: true,
  }).catch(() => {});
}

/** Opens the feedback dialog from anywhere (menu, Beta popover, error screen). */
export const FEEDBACK_EVENT = "resumex:feedback";
export const openFeedback = () => typeof window !== "undefined" && window.dispatchEvent(new Event(FEEDBACK_EVENT));
