const express = require('express');
const { paddle, paddleConfig, paddleIps } = require('../lib/paddle');
const { handleEvent } = require('../lib/paddleEvents');

/**
 * Paddle's webhook deliveries (Developer tools > Notifications in Paddle points here:
 * https://<api>/api/paddle/webhook). Mounted before the JSON parser: the signature
 * covers the exact bytes Paddle sent, so the raw body must be verified as-is.
 */
const router = express.Router();

router.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    const cfg = paddleConfig();
    if (!cfg.enabled) return res.status(503).json({ success: false, error: 'Payments are not set up.' });

    // In production, only Paddle's own servers may deliver (their list is fetched, not hard-coded).
    if (cfg.environment === 'production') {
        const ips = await paddleIps();
        if (ips && !ips.has(req.ip?.replace(/^::ffff:/, ''))) {
            console.warn(`Paddle webhook refused from ${req.ip}`);
            return res.status(403).json({ success: false });
        }
    }

    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const signature = req.get('paddle-signature') || '';
    let event;
    try {
        event = await paddle().webhooks.unmarshal(raw, process.env.PADDLE_WEBHOOK_SECRET, signature);
    } catch {
        // Not a 2xx: a genuine delivery that failed verification gets retried by Paddle.
        return res.status(401).json({ success: false, error: 'Invalid signature.' });
    }
    try {
        await handleEvent(event);
    } catch (err) {
        console.error(`Paddle ${event.eventType} ${event.eventId} failed:`, err);
        return res.status(500).json({ success: false }); // Paddle retries
    }
    res.json({ success: true });
});

module.exports = router;
