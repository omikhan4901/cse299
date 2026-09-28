const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Resume = require('../models/Resume');
const Usage = require('../models/Usage');
const Campaign = require('../models/Campaign');
const { limit, clientIp } = require('../lib/rateLimit');
const { effectivePlanId } = require('../lib/credits');
const { getSettings } = require('../lib/settings');
const { sendMail, canSendMail } = require('../lib/mailer');

const MIN_PASSWORD = 8;

// --- Middleware to Protect Routes ---
// Verifies the JWT and that the account still exists. Each token carries the
// account's session version; changing or resetting the password bumps it, which
// signs out every other device.
const protect = async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route (No token).' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route (Invalid token).' });
    }

    try {
        const user = await User.findById(decoded.id).select('sessionVersion banned bannedReason').lean();
        if (!user) return res.status(401).json({ success: false, error: 'This account no longer exists.' });
        if (user.banned) return res.status(403).json({ success: false, code: 'banned', error: bannedMessage(user) });
        if ((decoded.v || 0) !== (user.sessionVersion || 0)) {
            return res.status(401).json({ success: false, error: 'Your session has expired. Please log in again.' });
        }
        req.userId = decoded.id;
        next();
    } catch (err) {
        next(err);
    }
};

// Matches an email case-insensitively, so accounts created before emails were
// lowercased can still log in.
const emailQuery = (email) =>
    new RegExp(`^${String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

const getSignedJwtToken = (user) => jwt.sign({ id: user._id, v: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '30d' });

// Super admins are set by email in SUPERADMIN_EMAILS (comma-separated). They can
// do everything, including making other people admins.
const superadminEmails = () => (process.env.SUPERADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isSuperadmin = (user) => !!user?.email && superadminEmails().includes(String(user.email).toLowerCase());
const roleOf = (user) => (isSuperadmin(user) ? 'superadmin' : user?.role || 'user');

const bannedMessage = (user) => `This account has been suspended${user.bannedReason ? `: ${user.bannedReason}` : '.'} Contact support if you think this is a mistake.`;

const publicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    plan: effectivePlanId(user),
    planExpiresAt: user.planExpiresAt || null,
    role: roleOf(user),
    createdAt: user.createdAt,
});

/** For /api/admin: the signed-in account must be an admin or a super admin. */
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('email role').lean();
        const role = roleOf(user);
        if (role !== 'admin' && role !== 'superadmin') return res.status(403).json({ success: false, error: 'Admins only.' });
        req.role = role;
        req.adminEmail = user.email;
        next();
    } catch (err) {
        next(err);
    }
};

const hashPassword = async (password) => bcrypt.hash(String(password), await bcrypt.genSalt(10));

// Invalidates every token issued so far (the caller then issues a new one).
const markPasswordChanged = (user) => {
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.passwordChangedAt = new Date();
};

const emailKey = (req) => (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null);

// --- Brute-force protection ---
const loginByIp = limit({ name: 'login-ip', windowMs: 15 * 60 * 1000, max: 30, key: clientIp, message: 'Too many login attempts.' });
const loginByEmail = limit({ name: 'login-email', windowMs: 15 * 60 * 1000, max: 8, key: emailKey, message: 'Too many login attempts for this account.' });
const registerByIp = limit({ name: 'register-ip', windowMs: 60 * 60 * 1000, max: 10, key: clientIp, message: 'Too many accounts created from this network.' });
const resetByIp = limit({ name: 'reset-ip', windowMs: 60 * 60 * 1000, max: 10, key: clientIp, message: 'Too many password reset requests.' });
const resetByEmail = limit({ name: 'reset-email', windowMs: 60 * 60 * 1000, max: 3, key: emailKey, message: 'Too many password reset requests for this email.' });
const sensitiveByUser = limit({ name: 'account', windowMs: 15 * 60 * 1000, max: 10, key: (req) => req.userId, message: 'Too many attempts.' });

// @route   POST /api/auth/register
router.post('/register', registerByIp, async (req, res) => {
    const { name, email, password } = req.body;
    const code = typeof req.body.campaignCode === 'string' ? req.body.campaignCode.trim().toUpperCase() : '';

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Please enter all fields.' });
    }
    if (String(password).length < MIN_PASSWORD) {
        return res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD} characters.` });
    }

    try {
        let user = await User.findOne({ email: emailQuery(email) });
        if (user) {
            return res.status(400).json({ success: false, error: 'User already exists.' });
        }

        const settings = await getSettings();
        const lowerEmail = String(email).trim().toLowerCase();
        if (settings.registration === 'closed' && !isSuperadmin({ email: lowerEmail })) {
            return res.status(403).json({ success: false, error: 'Sign-ups are closed right now. Please check back soon.' });
        }
        // A campaign code gives the campaign's plan and credits. Claiming a place is atomic,
        // so a campaign never goes over its limit.
        let campaign = null;
        if (code) {
            campaign = await Campaign.findOne({ code }).lean();
            const problem = campaignProblem(campaign, lowerEmail);
            if (problem) return res.status(400).json({ success: false, error: problem });
            campaign = await Campaign.findOneAndUpdate({ _id: campaign._id, uses: { $lt: campaign.maxUses } }, { $inc: { uses: 1 } }, { new: true });
            if (!campaign) return res.status(400).json({ success: false, error: 'This campaign is full.' });
        } else if (settings.registration === 'campaign' && !isSuperadmin({ email: lowerEmail })) {
            return res.status(403).json({ success: false, error: 'Sign-ups need a campaign code right now.' });
        }

        try {
            user = await User.create({
                name: String(name),
                email: String(email),
                password: await hashPassword(password),
                lastLoginAt: new Date(),
                ...(campaign
                    ? {
                          campaign: campaign._id,
                          plan: campaign.plan,
                          planExpiresAt: campaign.plan !== 'free' ? new Date(Date.now() + campaign.durationDays * 864e5) : undefined,
                          creditLimit: campaign.creditLimit,
                          creditPeriod: campaign.creditPeriod,
                      }
                    : {}),
            });
        } catch (err) {
            if (campaign) await Campaign.updateOne({ _id: campaign._id }, { $inc: { uses: -1 } });
            throw err;
        }
        res.status(201).json({ success: true, token: getSignedJwtToken(user), user: publicUser(user) });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: Object.values(err.errors)[0].message });
        }
        if (err.code === 11000) {
            return res.status(400).json({ success: false, error: 'User already exists.' });
        }
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error during registration.' });
    }
});

// @route   POST /api/auth/login
router.post('/login', loginByIp, loginByEmail, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Please provide an email and password.' });
    }

    try {
        const user = await User.findOne({ email: emailQuery(email) }).select('+password');
        if (!user || !(await bcrypt.compare(String(password), user.password))) {
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }
        if (user.banned) return res.status(403).json({ success: false, code: 'banned', error: bannedMessage(user) });
        User.updateOne({ _id: user._id }, { lastLoginAt: new Date() }).catch(() => {});
        res.status(200).json({ success: true, token: getSignedJwtToken(user), user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error during login.' });
    }
});

// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        res.status(200).json({ success: true, user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error fetching user data.' });
    }
});

// @route   PUT /api/auth/me
// @desc    Update your name
router.put('/me', protect, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'Please enter your name.' });
    try {
        const user = await User.findById(req.userId);
        user.name = name;
        await user.save();
        res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        if (err.name === 'ValidationError') return res.status(400).json({ success: false, error: Object.values(err.errors)[0].message });
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// @route   PUT /api/auth/password
// @desc    Change password (signs out other devices). Returns a fresh token.
router.put('/password', protect, sensitiveByUser, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Please fill in both passwords.' });
    }
    if (String(newPassword).length < MIN_PASSWORD) {
        return res.status(400).json({ success: false, error: `Your new password must be at least ${MIN_PASSWORD} characters.` });
    }
    try {
        const user = await User.findById(req.userId).select('+password');
        if (!(await bcrypt.compare(String(currentPassword), user.password))) {
            return res.status(400).json({ success: false, error: 'Your current password is incorrect.' });
        }
        user.password = await hashPassword(newPassword);
        markPasswordChanged(user);
        await user.save();
        res.json({ success: true, token: getSignedJwtToken(user), user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// @route   GET /api/auth/export
// @desc    Download everything stored about you (account + resumes) as JSON.
router.get('/export', protect, async (req, res) => {
    try {
        const [user, resumes] = await Promise.all([
            User.findById(req.userId).lean(),
            Resume.find({ user: req.userId }).select('-__v -user').lean(),
        ]);
        const { password, resetTokenHash, resetTokenExpires, sessionVersion, __v, ...account } = user;
        res.set('Content-Disposition', `attachment; filename="resumex-data-${new Date().toISOString().slice(0, 10)}.json"`);
        res.json({ exportedAt: new Date().toISOString(), account, resumes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// @route   DELETE /api/auth/me
// @desc    Permanently delete the account and all its resumes. Needs the password.
router.delete('/me', protect, sensitiveByUser, async (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ success: false, error: 'Please enter your password to confirm.' });
    try {
        const user = await User.findById(req.userId).select('+password');
        if (!(await bcrypt.compare(String(password), user.password))) {
            return res.status(400).json({ success: false, error: 'That password is incorrect.' });
        }
        await Promise.all([Resume.deleteMany({ user: user._id }), Usage.deleteMany({ user: user._id })]);
        await user.deleteOne();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Emails a one-hour reset link. Always answers the same way, so it
//          can't be used to find out which emails have accounts.
router.post('/forgot-password', resetByIp, resetByEmail, async (req, res) => {
    const email = emailKey(req);
    if (!email) return res.status(400).json({ success: false, error: 'Please enter your email.' });
    if (!canSendMail()) {
        return res.status(503).json({ success: false, error: "Password reset by email isn't available yet. Please contact support." });
    }
    const done = () => res.json({ success: true, message: 'If an account exists for that email, a reset link is on its way.' });
    try {
        const user = await User.findOne({ email: emailQuery(email) });
        if (!user) return done();

        const token = crypto.randomBytes(32).toString('hex');
        user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();

        const appUrl = (process.env.APP_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',')[0]).trim().replace(/\/$/, '');
        const link = `${appUrl}/reset-password?token=${token}`;
        await sendMail({
            to: user.email,
            subject: 'Reset your ResumeX password',
            text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your ResumeX password. Open this link within an hour to choose a new one:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email — your password won't change.`,
            html: `<p>Hi ${user.name.replace(/[<>&"]/g, '')},</p><p>Someone (hopefully you) asked to reset your ResumeX password. This link works for one hour:</p><p><a href="${link}">Choose a new password</a></p><p>If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
        });
        done();
    } catch (err) {
        console.error('Password reset email failed:', err.message);
        res.status(500).json({ success: false, error: "We couldn't send the email. Please try again later." });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Sets a new password from a reset link and signs the user in.
router.post('/reset-password', resetByIp, async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || typeof token !== 'string' || !password) {
        return res.status(400).json({ success: false, error: 'This reset link is invalid.' });
    }
    if (String(password).length < MIN_PASSWORD) {
        return res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD} characters.` });
    }
    try {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires');
        if (!user) {
            return res.status(400).json({ success: false, error: 'This reset link has expired or was already used. Please request a new one.' });
        }
        user.password = await hashPassword(password);
        user.resetTokenHash = undefined;
        user.resetTokenExpires = undefined;
        markPasswordChanged(user);
        await user.save();
        res.json({ success: true, token: getSignedJwtToken(user), user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

/** Why a campaign code can't be used by this email, or null if it can. */
function campaignProblem(campaign, email) {
    if (!campaign || !campaign.active) return "That campaign code isn't valid.";
    if (campaign.expiresAt && new Date(campaign.expiresAt) < new Date()) return 'That campaign has ended.';
    if (campaign.uses >= campaign.maxUses) return 'This campaign is full.';
    if (campaign.emailDomain && email && !email.endsWith(`@${campaign.emailDomain}`) && !email.endsWith(`.${campaign.emailDomain}`)) {
        return `This campaign is for @${campaign.emailDomain} email addresses.`;
    }
    return null;
}

module.exports = {
    router,
    protect,
    requireAdmin,
    publicUser,
    roleOf,
    isSuperadmin,
    campaignProblem,
    hashPassword,
};
