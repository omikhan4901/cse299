/**
 * Applies verified Paddle webhook events to the database. Deliveries can repeat and
 * arrive out of order, so every write is an upsert keyed on the Paddle ID and ignores
 * an event older than the one already applied. After each change the account's plan is
 * recomputed from all its subscriptions (never "switched" by a single event), so the
 * result doesn't depend on the order events arrive in.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PaddleCustomer = require('../models/PaddleCustomer');
const { paddle, planForPrice, grantsAccess, PLAN_RANK } = require('./paddle');
const { emailQuery, validEmail } = require('./email');
const { effectivePlanId } = require('./credits');

const toDate = (v) => (v ? new Date(v) : null);

/** The account for a Paddle customer: from the checkout's customData, a linked record, or the email. */
async function findUser({ userId, customerId, email }) {
    if (userId && mongoose.isValidObjectId(userId)) {
        const u = await User.findById(userId).select('_id paddleCustomerId').lean();
        if (u) return u;
    }
    if (customerId) {
        const byCustomer = await User.findOne({ paddleCustomerId: customerId }).select('_id paddleCustomerId').lean();
        if (byCustomer) return byCustomer;
        const linked = await PaddleCustomer.findOne({ customerId, user: { $ne: null } }).lean();
        if (linked) return { _id: linked.user };
    }
    if (validEmail(email)) return User.findOne({ email: emailQuery(validEmail(email)) }).select('_id paddleCustomerId').lean();
    return null;
}

/** Records which Paddle customer an account is (only the first one, so it can't be taken over). */
async function linkCustomer(userId, customerId) {
    if (!userId || !customerId) return;
    await User.updateOne({ _id: userId, $or: [{ paddleCustomerId: null }, { paddleCustomerId: { $exists: false } }] }, { paddleCustomerId: customerId });
    await Subscription.updateMany({ customerId, user: null }, { user: userId });
    await PaddleCustomer.updateOne({ customerId, user: null }, { user: userId });
}

/** Sets the account's plan from its subscriptions: the best one that grants access, else back to Free. */
async function syncPlan(userId) {
    if (!userId) return;
    const [subs, user] = await Promise.all([Subscription.find({ user: userId }).lean(), User.findById(userId).select('plan planExpiresAt planSource').lean()]);
    if (!user) return;
    const best = subs.filter((s) => s.plan && grantsAccess(s)).sort((a, b) => PLAN_RANK[b.plan] - PLAN_RANK[a.plan])[0];
    if (best) {
        // A higher plan an admin or a campaign gave (and that hasn't ended) isn't replaced by a lower paid one.
        const other = user.planSource !== 'paddle' ? effectivePlanId(user) : 'free';
        if (PLAN_RANK[other] > PLAN_RANK[best.plan]) return;
        await User.updateOne({ _id: userId }, { plan: best.plan, planExpiresAt: null, planSource: 'paddle' });
    } else {
        // Only undo a plan that came from Paddle; one set by an admin or a campaign stays.
        await User.updateOne({ _id: userId, planSource: 'paddle' }, { plan: 'free', planExpiresAt: null, planSource: null });
    }
}

/** Upserts unless a newer event has already been applied. Returns false for a stale event. */
async function upsertIfNewer(Model, key, eventAt, fields) {
    try {
        await Model.updateOne({ ...key, eventAt: { $lte: eventAt } }, { $set: { ...fields, eventAt } }, { upsert: true });
        return true;
    } catch (err) {
        if (err.code === 11000) return false; // a newer copy exists, so the filter missed and the insert clashed
        throw err;
    }
}

/** Mirrors a Paddle subscription (from a webhook, or an API response) as of `eventAt`. */
async function applySubscription(s, eventAt) {
    const item = s.items?.[0];
    const priceId = item?.price?.id || '';
    const mapped = planForPrice(priceId);
    let user = await findUser({ userId: s.customData?.userId, customerId: s.customerId });
    if (!user) {
        // Not linked yet: the customer's email can tell us whose it is.
        const customer = await paddle().customers.get(s.customerId).catch(() => null);
        user = await findUser({ customerId: s.customerId, email: customer?.email });
    }
    const applied = await upsertIfNewer(Subscription, { subscriptionId: s.id }, eventAt, {
        customerId: s.customerId,
        ...(user ? { user: user._id } : {}),
        status: s.status,
        priceId,
        productId: item?.price?.productId || null,
        plan: mapped?.plan || null,
        interval: mapped?.interval || item?.price?.billingCycle?.interval || null,
        currentPeriodEnd: toDate(s.currentBillingPeriod?.endsAt),
        scheduledChange: s.scheduledChange ? { action: s.scheduledChange.action, effectiveAt: toDate(s.scheduledChange.effectiveAt) } : null,
    });
    if (!mapped) console.warn(`Paddle subscription ${s.id} uses price ${priceId}, which isn't one of the PADDLE_PRICE_* prices.`);
    if (user) {
        await linkCustomer(user._id, s.customerId);
        await syncPlan(user._id);
    }
    return applied;
}

const onSubscription = (event) => applySubscription(event.data, toDate(event.occurredAt));

async function onCustomer(event) {
    const c = event.data;
    const user = await findUser({ userId: c.customData?.userId, customerId: c.id, email: c.email });
    await upsertIfNewer(PaddleCustomer, { customerId: c.id }, toDate(event.occurredAt), { email: c.email, ...(user ? { user: user._id } : {}) });
    if (user) {
        await linkCustomer(user._id, c.id);
        await syncPlan(user._id);
    }
}

async function onTransaction(event) {
    const t = event.data;
    const user = await findUser({ userId: t.customData?.userId, customerId: t.customerId });
    if (user) {
        await linkCustomer(user._id, t.customerId);
        await syncPlan(user._id);
    }
}

/**
 * Refunds and chargebacks. Paddle doesn't cancel a subscription when it refunds it, so an
 * approved full refund or a chargeback cancels it here, straight away: the plan ends
 * with the money (partial refunds, e.g. a goodwill credit, leave it running).
 */
async function onAdjustment(event) {
    const a = event.data;
    const fullRefund = a.action === 'refund' && a.type === 'full' && a.status === 'approved';
    if (!(fullRefund || a.action === 'chargeback') || !a.subscriptionId) return;
    const sub = await Subscription.findOne({ subscriptionId: a.subscriptionId }).lean();
    if (sub?.status === 'canceled') return;
    try {
        const canceled = await paddle().subscriptions.cancel(a.subscriptionId, { effectiveFrom: 'immediately' });
        await applySubscription(canceled, new Date());
    } catch (err) {
        // Already canceled in Paddle: its subscription.canceled webhook ends the plan.
        console.error(`Could not cancel ${a.subscriptionId} after ${a.action} ${a.id}:`, err.message);
        if (sub?.user) {
            await Subscription.updateOne({ subscriptionId: a.subscriptionId }, { status: 'canceled' });
            await syncPlan(sub.user);
        }
    }
}

/** Routes a verified event. Unknown types are ignored (Paddle only needs a 2xx). */
async function handleEvent(event) {
    const type = event.eventType || '';
    if (type.startsWith('subscription.')) return onSubscription(event);
    if (type === 'customer.created' || type === 'customer.updated') return onCustomer(event);
    if (type === 'transaction.completed') return onTransaction(event);
    if (type === 'adjustment.created' || type === 'adjustment.updated') return onAdjustment(event);
    return null;
}

module.exports = { handleEvent, applySubscription, syncPlan };
