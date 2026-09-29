/**
 * Paddle Billing: configuration, the API client, which price is which plan, and
 * whether a subscription gives access. Everything comes from environment variables
 * (see Readme.md), so going live means changing variables, not code.
 *
 *   PADDLE_ENV             sandbox | production (required; never assumed)
 *   PADDLE_API_KEY         server-side API key
 *   PADDLE_WEBHOOK_SECRET  the notification destination's signing secret
 *   PADDLE_CLIENT_TOKEN    client-side token for Paddle.js (test_… / live_…), public
 *   PADDLE_PRICE_PRO_MONTH, PADDLE_PRICE_PRO_YEAR, PADDLE_PRICE_PREMIUM_MONTH, PADDLE_PRICE_PREMIUM_YEAR
 *   PADDLE_PRICE_PASS      optional: a one-time price for the Job Search Pass (V2)
 */
const { Paddle, Environment } = require('@paddle/paddle-node-sdk');

const PLANS = ['pro', 'premium'];
const INTERVALS = ['month', 'year'];
const VARS = ['PADDLE_ENV', 'PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET', 'PADDLE_CLIENT_TOKEN', ...PLANS.flatMap((p) => INTERVALS.map((i) => `PADDLE_PRICE_${p.toUpperCase()}_${i.toUpperCase()}`))];

/** The current configuration, or { enabled: false, problems } when it's missing or incomplete. */
function paddleConfig() {
    const env = process.env.PADDLE_ENV;
    const set = VARS.filter((v) => process.env[v]);
    if (!set.length) return { enabled: false, problems: [] };
    const problems = VARS.filter((v) => !process.env[v]).map((v) => `${v} is not set`);
    if (env && !['sandbox', 'production'].includes(env)) problems.push('PADDLE_ENV must be "sandbox" or "production"');
    const token = process.env.PADDLE_CLIENT_TOKEN || '';
    // A token from the other environment is the classic way to charge real cards while "testing".
    if (env === 'sandbox' && token && !token.startsWith('test_')) problems.push('PADDLE_CLIENT_TOKEN must be a sandbox token (test_…) when PADDLE_ENV=sandbox');
    if (env === 'production' && token && !token.startsWith('live_')) problems.push('PADDLE_CLIENT_TOKEN must be a live token (live_…) when PADDLE_ENV=production');
    const prices = Object.fromEntries(PLANS.map((p) => [p, Object.fromEntries(INTERVALS.map((i) => [i, process.env[`PADDLE_PRICE_${p.toUpperCase()}_${i.toUpperCase()}`] || null]))]));
    prices.pass = process.env.PADDLE_PRICE_PASS || null;
    return { enabled: problems.length === 0, problems, environment: env, clientToken: token, prices };
}

// Say loudly at start-up when checkout can't work, instead of failing at the first customer.
const startup = paddleConfig();
if (startup.problems.length) console.error(`Paddle is NOT enabled: ${startup.problems.join('; ')}. Upgrades fall back to email until this is fixed.`);
else if (startup.enabled) console.log(`Paddle checkout enabled (${startup.environment}).`);

let client = null;
let clientKey = '';
/** The Paddle API client for the configured environment. Throws if Paddle isn't configured. */
function paddle() {
    const cfg = paddleConfig();
    if (!cfg.enabled) throw Object.assign(new Error('Payments are not set up yet.'), { status: 503 });
    const key = `${cfg.environment}:${process.env.PADDLE_API_KEY}`;
    if (!client || clientKey !== key) {
        client = new Paddle(process.env.PADDLE_API_KEY, { environment: cfg.environment === 'production' ? Environment.production : Environment.sandbox });
        clientKey = key;
    }
    return client;
}

/** { plan, interval } for one of our Paddle price IDs, or null for any other price. */
function planForPrice(priceId) {
    const { prices } = paddleConfig();
    for (const plan of PLANS) for (const interval of INTERVALS) if (prices?.[plan]?.[interval] && prices[plan][interval] === priceId) return { plan, interval };
    return null;
}

/**
 * Whether a subscription gives paid access. Active and trialing do. So does past_due: Paddle
 * is retrying a failed payment and cancels the subscription if it can't collect, so the
 * customer keeps access meanwhile. Paused and canceled don't. A *scheduled* cancellation
 * or pause doesn't end access: it takes effect when Paddle changes the status.
 */
const grantsAccess = (sub) => ['active', 'trialing', 'past_due'].includes(sub?.status);

/** Higher plans win when someone somehow has more than one subscription. */
const PLAN_RANK = { free: 0, pro: 1, premium: 2 };

/**
 * A plan change is an upgrade (a higher plan, or the same plan billed yearly instead of
 * monthly) or a downgrade (everything else). Upgrades start now and are charged pro rata;
 * downgrades start at the next renewal with no credit, and the paid-for plan is kept until
 * then, so switching up and back down can't buy a higher plan's credits for pennies.
 * Mirrored in client/src/lib/access.js (planChangeKind).
 */
const changeKind = (from, to) =>
    PLAN_RANK[to.plan] > PLAN_RANK[from.plan] || (to.plan === from.plan && to.interval === 'year' && from.interval !== 'year') ? 'upgrade' : 'downgrade';

// ---- Paddle's webhook IP addresses (checked in production) ----
let allowedIps = null;
let ipsFetchedAt = 0;
/** Paddle's current webhook IPs, from its API (the list can change, so it's never hard-coded). */
async function paddleIps() {
    if (allowedIps && Date.now() - ipsFetchedAt < 60 * 60 * 1000) return allowedIps;
    const base = paddleConfig().environment === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
    try {
        const res = await fetch(`${base}/ips`, { signal: AbortSignal.timeout(5000) });
        const body = await res.json();
        const list = (body?.data?.ipv4_cidrs || []).map((c) => String(c).replace(/\/32$/, ''));
        if (list.length) {
            allowedIps = new Set(list);
            ipsFetchedAt = Date.now();
        }
    } catch (err) {
        console.error('Could not fetch Paddle webhook IPs:', err.message);
    }
    return allowedIps;
}

// ---- Prices as Paddle has them, so the site never shows a price Paddle won't charge ----
let priceCache = null;
let priceCachedAt = 0;
/** { pro: { month, year }, premium: {...} } in currency units, from Paddle (cached 10 minutes), or null. */
async function paddlePrices() {
    const cfg = paddleConfig();
    if (!cfg.enabled) return null;
    if (priceCache && Date.now() - priceCachedAt < 10 * 60 * 1000) return priceCache;
    try {
        const out = { currency: null };
        for (const plan of PLANS) {
            out[plan] = {};
            for (const interval of INTERVALS) {
                const price = await paddle().prices.get(cfg.prices[plan][interval]);
                out[plan][interval] = Number(price.unitPrice.amount) / 100;
                out.currency = price.unitPrice.currencyCode;
            }
        }
        if (cfg.prices.pass) out.pass = Number((await paddle().prices.get(cfg.prices.pass)).unitPrice.amount) / 100;
        priceCache = out;
        priceCachedAt = Date.now();
    } catch (err) {
        console.error('Could not load prices from Paddle:', err.message);
    }
    return priceCache;
}

/** Clears cached Paddle data (tests, or after changing variables). */
const resetPaddleCache = () => {
    priceCache = null;
    allowedIps = null;
    client = null;
};

module.exports = { paddleConfig, paddle, planForPrice, grantsAccess, PLAN_RANK, changeKind, paddleIps, paddlePrices, resetPaddleCache, PLANS, INTERVALS };
