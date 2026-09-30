/**
 * When what a campaign (or an admin) gave runs out, the account becomes an ordinary account
 * on its own plan: an ended plan goes back to Free, and ended credit allowances and feature
 * switches are removed, so nothing from the campaign lingers on the account. Access already
 * stops at the end date (lib/credits.js reads the dates); this tidies the data afterwards.
 * Campaign members are marked finished (campaignEndedAt) once their campaign days are over;
 * the link to the campaign stays, for Admin › Campaigns and Sign-ups.
 *
 * Credits used this month still count after the switch: someone who used 30 campaign credits
 * this month, now on a Free plan of 20 a month, has none left until the 1st.
 */
const User = require('../models/User');
const Campaign = require('../models/Campaign');

async function endExpiredGrants(now = new Date()) {
    const past = { $lte: now };
    // Finished campaign members first, while their campaign fields still show what they had.
    const open = await User.find({ campaign: { $ne: null }, campaignEndedAt: null }).select('campaign createdAt').limit(20000).lean();
    const days = new Map((await Campaign.find({ _id: { $in: [...new Set(open.map((u) => String(u.campaign)))] } }).select('durationDays').lean()).map((c) => [String(c._id), c.durationDays || 0]));
    const finished = open.filter((u) => days.has(String(u.campaign)) && new Date(u.createdAt).getTime() + days.get(String(u.campaign)) * 864e5 <= now.getTime()).map((u) => u._id);
    const [members, plans, credits, features] = [
        finished.length ? await User.updateMany({ _id: { $in: finished } }, { $set: { campaignEndedAt: now } }) : { modifiedCount: 0 },
        // Plans with an end date come from a campaign or an admin (Paddle's have none).
        await User.updateMany({ plan: { $ne: 'free' }, planExpiresAt: past, planSource: { $ne: 'paddle' } }, { $set: { plan: 'free' }, $unset: { planExpiresAt: 1 } }),
        await User.updateMany({ creditLimitExpiresAt: past }, { $unset: { creditLimit: 1, creditPeriod: 1, creditLimitExpiresAt: 1 } }),
        await User.updateMany({ featuresExpireAt: past }, { $unset: { features: 1, featuresExpireAt: 1 } }),
    ];
    return { finished: members.modifiedCount, plans: plans.modifiedCount, credits: credits.modifiedCount, features: features.modifiedCount };
}

module.exports = { endExpiredGrants };
