const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');


const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected successfully!');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        // Exit process with failure
        process.exit(1);
    }
};

connectDB();

const app = express();

// --- Middleware Setup ---
// Enable CORS for frontend communication (allows all origins for now)
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();

const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // Limit file size to 10MB


// --- Route Setup --- 

// Mount the authentication router
app.use('/api/auth', authRoutes.router);
 

app.post('/api/ai/parse', authRoutes.protect, upload.single('resumeFile'), (req, res, next) => {
    // Manually call the route handler from the aiRoutes file
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
