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

// Atlas M0 allows 500 connections in all; two server instances with 20 each stay far below it.
// A slow database fails requests in seconds instead of piling them up.
mongoose
    .connect(process.env.MONGO_URI, {
        maxPoolSize: Number(process.env.MONGO_POOL) || 20,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
    })
    .then(() => console.log('MongoDB connected successfully!'))
    .catch((err) => {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });

const app = require('./app');

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
// No request may hang forever (AI imports take the longest, about 2 minutes).
server.requestTimeout = 180_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 65_000;

// Cloud Run sends SIGTERM before replacing an instance: finish what's in flight, then stop.
let closing = false;
const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal}: finishing requests, then stopping.`);
    server.close(() => mongoose.connection.close(false).finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 9_000).unref(); // Cloud Run allows 10 seconds
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
