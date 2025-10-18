const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import the User model
const User = require('../models/User');

// --- Middleware to Protect Routes ---
// This function verifies the JWT token sent in the Authorization header.
const protect = (req, res, next) => {
    let token;

    // Check for token in headers (Bearer <token>)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route (No token).' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the user ID to the request object for use in subsequent middleware/routes
        req.userId = decoded.id;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route (Invalid token).' });
    }
};


// --- Helper function to generate JWT ---
const getSignedJwtToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d' // Token expires in 30 days
    });
};


// @route   POST /api/auth/register
// @desc    Register user and return token
// @access  Public
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Simple validation
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Please enter all fields.' });
    }

    try {
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ success: false, error: 'User already exists.' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        user = await User.create({
            name,
            email,
            password: hashedPassword // Store the hashed password
        });

        // Generate JWT token
        const token = getSignedJwtToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error during registration.' });
    }
});


// @route   POST /api/auth/login
// @desc    Login user and return token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Simple validation
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Please provide an email and password.' });
    }

    try {
        // Find user by email, explicitly select the password field
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }

        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }

        // Generate JWT token
        const token = getSignedJwtToken(user._id);

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error during login.' });
    }
});


// @route   GET /api/auth/me
// @desc    Get current user data using JWT
// @access  Private (uses the 'protect' middleware)
router.get('/me', protect, async (req, res) => {
    try {
        // Find user by ID attached to the request by the 'protect' middleware
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error fetching user data.' });
    }
});

// Export the protect middleware so it can be used for other private routes later
module.exports = {
    router,
    protect
};
