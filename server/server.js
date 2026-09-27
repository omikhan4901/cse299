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

for (const key of ['MONGO_URI', 'JWT_SECRET']) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable ${key}. See Readme.md.`);
        process.exit(1);
    }
}

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch((err) => {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });

const app = express();

// CLIENT_ORIGIN can be a comma-separated list to restrict CORS; open by default.
const origins = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim()) : null;
app.use(cors(origins ? { origin: origins } : undefined));

// Resumes can carry a profile photo as a data URL, so allow larger JSON bodies.
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes.router);
app.use('/api/public', publicRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => {
    res.json({ success: true, db: mongoose.connection.readyState === 1, ai: aiRoutes.aiEnabled() });
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
