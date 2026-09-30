/**
 * Error reports (docs/v2/BETA-PLAN.md, Phase 6): browser errors (sent by the site) and
 * server 500s, grouped by a fingerprint with counts (Admin › Errors), and an alert to the
 * owner when one spikes. Nothing personal is kept: emails, long numbers and tokens are
 * masked, pages keep only their path, sizes are capped.
 */
const crypto = require('crypto');
const ErrorGroup = require('../models/ErrorGroup');
const { raise } = require('./alerts');

const scrub = (s, max) =>
    String(s || '')
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
        .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [token]')
        .replace(/\b[0-9a-f]{24}\b/gi, ':id')
        .replace(/\d{5,}/g, '#')
        .slice(0, max);
const pathOnly = (s) => scrub(String(s || '').split(/[?#]/)[0], 300);
const hourKey = (d = new Date()) => d.toISOString().slice(0, 13);

/**
 * Records one error. `where` is a page path (browser) or "METHOD /route" (server).
 * Returns the group id. Never throws.
 */
const ERROR_KEEP_DAYS = 90;

async function recordError({ kind, message, where, stack }, settings) {
    try {
        const msg = scrub(message, 300) || 'Unknown error';
        const firstLine = scrub(String(stack || '').split('\n').find((l) => /at |@/.test(l)) || '', 200).replace(/:\d+:\d+/g, '');
        const id = crypto.createHash('sha1').update(`${kind}|${msg.replace(/\d+/g, '#')}|${firstLine}`).digest('hex').slice(0, 16);
        const now = new Date();
        const hour = hourKey(now);
        await ErrorGroup.updateOne(
            { _id: id },
            {
                $inc: { count: 1, [`hours.${hour}`]: 1 },
                $set: { lastAt: now, expireAt: new Date(now.getTime() + ERROR_KEEP_DAYS * 864e5), message: msg, where: pathOnly(where), stack: scrub(stack, 2000) },
                $setOnInsert: { kind, firstAt: now },
                $unset: { resolvedAt: 1 },
            },
            { upsert: true }
        );
        const doc = await ErrorGroup.findById(id).lean();
        const inHour = doc?.hours?.[hour] || 0;
        const spike = settings?.errors?.spikePerHour ?? 20;
        if (spike > 0 && inHour >= spike) {
            raise(`errors-${id}-${now.toISOString().slice(0, 10)}`, {
                kind: 'errors',
                subject: `an error happened ${inHour} times in an hour`,
                text: `A ${kind} error happened ${inHour} times in the last hour: "${msg}" (${pathOnly(where) || 'unknown place'}). Admin > Errors has the details.`,
            });
        }
        // Keep only the last day of hourly counts.
        const old = Object.keys(doc?.hours || {}).filter((k) => k < hourKey(new Date(now - 24 * 3600 * 1000)));
        if (old.length) await ErrorGroup.updateOne({ _id: id }, { $unset: Object.fromEntries(old.map((k) => [`hours.${k}`, 1])) });
        return id;
    } catch (err) {
        console.error('Recording an error failed:', err.message);
        return null;
    }
}

module.exports = { recordError, scrub, pathOnly };
