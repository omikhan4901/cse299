const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');

// Load environment variables before anything reads them.
dotenv.config();

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const resumeRoutes = require('./routes/resume');
const publicRoutes = require('./routes/public');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const { canSendMail } = require('./lib/mailer');
const { limit, clientIp } = require('./lib/rateLimit');

for (const key of ['MONGO_URI', 'JWT_SECRET']) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable ${key}. See Readme.md.`);
        process.exit(1);
    }
}
// A short JWT secret can be brute-forced, which would let anyone sign in as anyone.
if (process.env.JWT_SECRET.length < 32) {
    const msg = 'JWT_SECRET should be a random string of at least 32 characters (e.g. `openssl rand -hex 32`).';
    if (process.env.NODE_ENV === 'production') {
        console.error(msg);
        process.exit(1);
    }
    console.warn(`Warning: ${msg}`);
}

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch((err) => {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });

const app = express();
app.disable('x-powered-by');

// Behind a proxy or load balancer (Render, Railway, Nginx…) set TRUST_PROXY=1 so
// rate limits see the visitor's IP rather than the proxy's.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

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

// Resumes can carry a profile photo as a data URL, so allow larger JSON bodies.
app.use(express.json({ limit: '10mb' }));

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
app.use('/api', limit({ name: 'api-ip', windowMs: 60 * 1000, max: 600, key: clientIp, message: 'Too many requests.' }));

// API responses carry personal data: never let browsers or proxies cache them unless a route says otherwise.
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use((req, res, next) => {
    if (req.body) stripOperators(req.body);
    if (req.query) for (const key of Object.keys(req.query)) if (key.startsWith('$')) delete req.query[key];
    next();
});

app.use('/api/auth', authRoutes.router);
app.use('/api/public', publicRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

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
    res.status(status).json({
        success: false,
        error:
            err.type === 'entity.too.large' ? 'That resume is too large to save. Try a smaller photo.'
            : err.type === 'entity.parse.failed' ? 'Invalid request body.'
            : status >= 500 ? 'Server error' : err.message,
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
