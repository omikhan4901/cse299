const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Must come before the routes: sends errors from async handlers to the error handler.
require('./lib/asyncErrors');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const resumeRoutes = require('./routes/resume');
const profileRoutes = require('./routes/profile');
const applicationRoutes = require('./routes/applications');
const internalRoutes = require('./routes/internal');
const publicRoutes = require('./routes/public');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const atsRoutes = require('./routes/ats');
const paddleRoutes = require('./routes/paddle');
const { canSendMail } = require('./lib/mailer');
const { limit, clientIp } = require('./lib/rateLimit');

/**
 * The Express app, without connecting to the database or listening, so tests
 * can run it on their own port (server.js does both for real).
 */
const app = express();
app.disable('x-powered-by');

// Behind a proxy or load balancer (Render, Railway, Nginx…) set TRUST_PROXY=1 so
// rate limits see the visitor's IP rather than the proxy's. Cloud Run (which sets
// K_SERVICE) always sits behind exactly one Google front end, so trust that hop by
// default: otherwise every visitor looks like the same IP and shares one limit.
const trustProxy = process.env.TRUST_PROXY || (process.env.K_SERVICE ? '1' : '');
if (trustProxy) app.set('trust proxy', Number(trustProxy) || trustProxy);

// Basic security headers (the API only serves JSON).
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
});

// CLIENT_ORIGIN can be a comma-separated list to restrict CORS; open by default.
const origins = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim()) : null;
if (!origins && process.env.NODE_ENV === 'production') {
    console.warn('Warning: CLIENT_ORIGIN is not set, so any website can call this API from a browser. Set it to your site address.');
}
app.use(cors(origins ? { origin: origins } : undefined));

// Paddle webhooks need the raw body for their signature, so they're handled before any JSON parsing.
app.use('/api/paddle', paddleRoutes);

// Resumes can carry a profile photo as a data URL, so only resume saves get large
// bodies; AI requests carry a resume without photos; everything else is small.
// (Smaller limits mean a flood of huge bodies can't tie up memory.)
// Two photos (up to 1 MB each) and up to 300 KB of text (lib/resumeInput.js).
app.use('/api/resumes', express.json({ limit: '3mb' }));
app.use('/api/profile', express.json({ limit: '3mb' }));
app.use('/api/applications', express.json({ limit: '1mb' }));
app.use('/api/ai', express.json({ limit: '2mb' }));
app.use('/api/admin', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));

// Drop keys starting with "$" (and dotted keys) from request bodies and queries,
// so user input can never smuggle MongoDB operators like {"$gt": ""} into a query.
const stripOperators = (value) => {
    if (Array.isArray(value)) return value.map(stripOperators);
    if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            if (key.startsWith('$') || key.includes('.')) delete value[key];
            else value[key] = stripOperators(value[key]);
        }
    }
    return value;
};
// Per-IP ceiling for the whole API (each route also has its own, stricter limits).
app.use('/api', limit({ name: 'api-ip', windowMs: 60 * 1000, max: 600, key: clientIp, message: 'Too many requests.', label: 'Whole API (per IP)', group: 'Overall', description: 'Ceiling for every request from one network. Every other limit is stricter.', min: 60 }));

// API responses carry personal data: never let browsers or proxies cache them unless a route says otherwise.
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use((req, res, next) => {
    if (req.body) stripOperators(req.body);
    // Query strings can nest too (?q[$ne]=x becomes { q: { $ne: 'x' } }), so clean them the same way.
    if (req.query) stripOperators(req.query);
    next();
});

app.use('/api/auth', authRoutes.router);
app.use('/api/public', publicRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ats', atsRoutes);

app.get('/api/health', (req, res) => {
    res.json({ success: true, db: mongoose.connection.readyState === 1, ai: aiRoutes.aiEnabled(), email: canSendMail() });
});

app.get('/', (req, res) => {
    res.send('ResumeX API is running...');
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// JSON parse errors, payloads that are too large, etc.
app.use((err, req, res, next) => {
    const status = err.name === 'MulterError' ? 400 : err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    if (res.headersSent) return; // the handler already answered before failing
    res.status(status).json({
        success: false,
        error:
            err.type === 'entity.too.large'
                ? req.path.startsWith('/api/resumes') ? 'That resume is too large to save. Try a smaller photo.' : 'That request is too large.'
            : err.type === 'entity.parse.failed' ? 'Invalid request body.'
            : status >= 500 ? 'Server error' : err.message,
    });
});

module.exports = app;
