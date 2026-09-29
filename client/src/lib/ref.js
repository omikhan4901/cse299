/**
 * The marketing tag a visitor first arrived with (?ref=fb-post-3 or utm_source), kept in this
 * browser for 30 days and sent once with sign-up, so Admin › Sign-ups shows which post or
 * link brought people in. Nothing else about the visit is kept.
 */
const KEY = "resumex.ref";
const DAYS = 30;

export function rememberRef() {
  try {
    const p = new URLSearchParams(window.location.search);
    const tag = (p.get("ref") || p.get("utm_source") || "").trim();
    if (!tag) return;
    const had = JSON.parse(localStorage.getItem(KEY) || "null");
    // First touch wins while it's fresh.
    if (had?.ref && Date.now() - had.at < DAYS * 864e5) return;
    localStorage.setItem(KEY, JSON.stringify({ ref: tag.slice(0, 60), at: Date.now() }));
  } catch {
    // Storage blocked: nothing to remember.
  }
}

export function currentRef() {
  try {
    const had = JSON.parse(localStorage.getItem(KEY) || "null");
    return had?.ref && Date.now() - had.at < DAYS * 864e5 ? had.ref : undefined;
  } catch {
    return undefined;
  }
}
