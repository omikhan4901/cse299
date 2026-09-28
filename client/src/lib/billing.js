import { API_URL } from "./config";

/** Plans and prices from the admin settings (server-side fetch, always fresh). */
export async function getPlans() {
  try {
    const res = await fetch(`${API_URL}/billing/plans`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return (await res.json()).data;
  } catch {
    return null;
  }
}

/** Public details of a campaign code, or { error }. */
export async function getCampaign(code) {
  try {
    const res = await fetch(`${API_URL}/billing/campaign/${encodeURIComponent(code)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { campaign: body.data } : { error: body.error || "That campaign code isn't valid." };
  } catch {
    return { error: "We couldn't check this code right now. Please try again in a moment." };
  }
}
