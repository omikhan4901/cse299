/**
 * Paddle.js in the browser: checkout and localized price previews. The environment,
 * client token and price IDs come from the API (/billing/plans → config.paddle), so
 * the site and the server always use the same Paddle account. The API key never
 * reaches the browser.
 */
import { initializePaddle } from "@paddle/paddle-js";

let instance = null;
let instanceKey = "";

/** The Paddle.js instance for this configuration (loaded once). */
async function getPaddle(cfg) {
  if (!cfg) throw new Error("Payments aren't available right now.");
  // Never guess the environment: a wrong one would charge real cards while "testing", or the reverse.
  if (cfg.environment !== "sandbox" && cfg.environment !== "production") throw new Error(`Unknown Paddle environment "${cfg.environment}".`);
  const key = `${cfg.environment}:${cfg.clientToken}`;
  if (!instance || instanceKey !== key) {
    instance = initializePaddle({ environment: cfg.environment, token: cfg.clientToken });
    instanceKey = key;
  }
  // Blocked by an ad blocker or a flaky connection: paddle-js remembers the failure, so a reload is needed.
  const paddle = await instance.catch(() => null);
  if (!paddle) throw new Error("The checkout couldn't load. Check your connection or turn off an ad blocker for this site, then reload the page.");
  return paddle;
}

/** Opens Paddle's one-page checkout over the page for one price; success goes to /welcome. */
export async function openCheckout(cfg, { priceId, email, userId }) {
  const paddle = await getPaddle(cfg);
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(email ? { customer: { email } } : {}),
    // Links the subscription to this account when Paddle's webhook arrives.
    ...(userId ? { customData: { userId } } : {}),
    settings: { displayMode: "overlay", variant: "one-page", successUrl: `${window.location.origin}/welcome` },
  });
}

/**
 * Paddle's own formatted totals for each price in the visitor's currency: { [priceId]: "$6.99" }.
 * Without a country, Paddle works out the visitor's location from their IP.
 */
export async function previewPrices(cfg, priceIds, country) {
  const paddle = await getPaddle(cfg);
  const preview = await paddle.PricePreview({
    items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
    ...(country ? { address: { countryCode: country } } : {}),
  });
  return Object.fromEntries(preview.data.details.lineItems.map((li) => [li.price.id, li.formattedTotals.total]));
}
