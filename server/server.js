const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables before anything reads them.
dotenv.config();

// A bug in one request should never take the whole API down.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

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

const app = require('./app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
