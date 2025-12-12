const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const resumeRoutes = require('./routes/resume');
const publicRoutes = require('./routes/public');
// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected successfully!');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    }
};

connectDB(); 

const app = express();

// --- Middleware Setup ---
app.use(cors());

// Increase payload limit to handle large PDF uploads (base64 encoded)
app.use(express.json({ limit: '20mb' })); 

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });


// --- Route Setup --- 

// Mount the authentication router
app.use('/api/auth', authRoutes.router);
app.use('/api/public', publicRoutes);
app.use('/api/resumes', resumeRoutes);

app.post('/api/ai/parse', authRoutes.protect, upload.single('resumeFile'), (req, res, next) => {
    aiRoutes(req, res, next);
});

// Mount the AI router for /refine and /chat
app.use('/api/ai', aiRoutes);

// --- Default Route ---
app.get('/', (req, res) => {
    res.send('AI Resume Builder API is running...');
});


// --- Start Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});