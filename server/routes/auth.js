const express = require('express');
const { validEmail, emailQuery } = require('../lib/email');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { deleteUserData, exportUserData } = require('../lib/userData');
const Campaign = require('../models/Campaign');
const PendingSignup = require('../models/PendingSignup');
const { limit, clientIp } = require('../lib/rateLimit');
const { effectivePlanId } = require('../lib/credits');
const { getSettings } = require('../lib/settings');
const mailer = require('../lib/mailer');
const { sendMail, canSendMail } = mailer;
const totp = require('../lib/totp');
const { audit } = require('../lib/audit');
const { networkOf, cleanRef } = require('../lib/network');
const { TERMS_VERSION } = require('../lib/legal');
const { afterSignup } = require('../lib/alerts');
const sessionCache = require('../lib/sessionCache');

const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything longer, so refuse it rather than silently truncate
const JWT_OPTS = { algorithms: ['HS256'] };

/** A problem with a new password, or null. */
const passwordProblem = (password) => {
    const p = String(password || '');
    if (p.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
    if (Buffer.byteLength(p) > MAX_PASSWORD_BYTES) return `Password must be at most ${MAX_PASSWORD_BYTES} characters.`;
    return null;
};

// Compared against when an email isn't registered, so a login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

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
        decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_OPTS);
        if (decoded.purpose) throw new Error('wrong token type');
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Not authorized to access this route (Invalid token).' });
    }

    try {
        let user = sessionCache.get(decoded.id);
        if (!user) {
            user = await User.findById(decoded.id).select('sessionVersion banned bannedReason lastSeenAt').lean();
            if (user) sessionCache.put(decoded.id, user);
        }
        if (!user) return res.status(401).json({ success: false, error: 'This account no longer exists.' });
        if (user.banned) return res.status(403).json({ success: false, code: 'banned', error: bannedMessage(user) });
        if ((decoded.v || 0) !== (user.sessionVersion || 0)) {
            return res.status(401).json({ success: false, error: 'Your session has expired. Please log in again.' });
        }
        req.userId = decoded.id;
        req.mfa = !!decoded.mfa;
        // "Active" in the admin console: noted at most once an hour, without waiting for it.
        if (!user.lastSeenAt || Date.now() - new Date(user.lastSeenAt) > 60 * 60 * 1000) {
            user.lastSeenAt = new Date(); // the cached copy too, so it's written once an hour
            // Straight to the collection: it changes nothing the cached check depends on.
            User.collection.updateOne({ _id: user._id }, { $set: { lastSeenAt: user.lastSeenAt } }).catch(() => {});
        }
        next();
    } catch (err) {
        next(err);
    }
};

// Sessions: 14 days for users, 12 hours for admins. `mfa` marks a session that passed two-factor.
const getSignedJwtToken = (user, { mfa = false } = {}) =>
    jwt.sign({ id: user._id, v: user.sessionVersion || 0, ...(mfa ? { mfa: true } : {}) }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: ['admin', 'superadmin'].includes(roleOf(user)) ? '12h' : '14d',
    });
// Short-lived ticket between "password OK" and "code OK".
const mfaTicket = (user) => jwt.sign({ id: user._id, v: user.sessionVersion || 0, purpose: 'mfa' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });

/** Response after a correct password: a session, or a request for the 2FA code. */
const signInResponse = (user) =>
    user.twoFactor?.enabled
        ? { success: true, mfaRequired: true, mfaToken: mfaTicket(user) }
        : { success: true, token: getSignedJwtToken(user), user: publicUser(user) };

// Super admins and admins (lib/roles.js).
const { isSuperadmin, roleOf } = require('../lib/roles');

const bannedMessage = (user) => `This account has been suspended${user.bannedReason ? `: ${user.bannedReason}` : '.'} Contact support if you think this is a mistake.`;

const publicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    plan: effectivePlanId(user),
    planExpiresAt: user.planExpiresAt || null,
    role: roleOf(user),
    v2Preview: !!user.v2Preview,
    emailPrefs: { reminders: user.emailPrefs?.reminders !== false, digest: user.emailPrefs?.digest !== false },
    twoFactorEnabled: !!user.twoFactor?.enabled,
    emailVerified: !!user.emailVerifiedAt,
    createdAt: user.createdAt,
    // For the one-time welcome shown to people who joined through a campaign.
    viaCampaign: !!user.campaign,
});

/** For /api/admin: the signed-in account must be an admin or a super admin. */
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('email role twoFactor.enabled emailVerifiedAt').lean();
        const role = roleOf(user);
        if (role !== 'admin' && role !== 'superadmin') return res.status(403).json({ success: false, error: 'Admins only.' });
        // Super admin status comes from the email address, so the owner must prove they receive mail there.
        if (role === 'superadmin' && !user.emailVerifiedAt) {
            return res.status(403).json({ success: false, code: 'email_verification_required', error: 'Verify your email address to use the admin console.' });
        }
        // Every admin must use two-factor authentication, and this session must have passed it.
        if (!user.twoFactor?.enabled) {
            return res.status(403).json({ success: false, code: 'mfa_setup_required', error: 'Set up two-factor authentication to use the admin console.' });
        }
        if (!req.mfa) {
            return res.status(403).json({ success: false, code: 'mfa_required', error: 'Log in again with your authenticator code to use the admin console.' });
        }
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
const loginByIp = limit({ name: 'login-ip', shared: true, windowMs: 15 * 60 * 1000, max: 150, key: clientIp, message: 'Too many login attempts.', label: 'Log in (per IP)', group: 'Sign-in & accounts', description: 'Password attempts from one network.' });
const loginByEmail = limit({ name: 'login-email', shared: true, windowMs: 15 * 60 * 1000, max: 8, key: emailKey, message: 'Too many login attempts for this account.', label: 'Log in (per email)', group: 'Sign-in & accounts', scope: 'email', description: 'Password attempts against one account, from anywhere. Keep this low.' });
const registerByIp = limit({ name: 'register-ip', shared: true, windowMs: 60 * 60 * 1000, max: 40, key: clientIp, message: 'Too many accounts created from this network.', label: 'Sign-ups (per IP)', group: 'Sign-in & accounts', description: 'New accounts from one network. Raise it for campus events on shared Wi-Fi.' });
const resetByIp = limit({ name: 'reset-ip', shared: true, windowMs: 60 * 60 * 1000, max: 10, key: clientIp, message: 'Too many password reset requests.', label: 'Password resets (per IP)', group: 'Sign-in & accounts', description: 'Reset emails requested and reset links used from one network.' });
const resetByEmail = limit({ name: 'reset-email', shared: true, windowMs: 60 * 60 * 1000, max: 3, key: emailKey, message: 'Too many password reset requests for this email.', label: 'Password resets (per email)', group: 'Sign-in & accounts', scope: 'email', description: 'Reset emails sent to one address.' });
const profileByUser = limit({ name: 'profile', windowMs: 15 * 60 * 1000, max: 20, key: (req) => req.userId, message: 'Too many changes.', label: 'Profile updates', group: 'Sign-in & accounts', scope: 'account', description: 'Changing your name on the account page.' });
const unsubscribeByIp = limit({ name: 'unsubscribe-ip', windowMs: 60 * 60 * 1000, max: 60, key: clientIp, message: 'Too many requests.', label: 'Unsubscribe links', group: 'Sign-in & accounts', description: 'Unsubscribe links opened from one network.' });
const exportByUser = limit({ name: 'export', windowMs: 60 * 60 * 1000, max: 5, key: (req) => req.userId, message: 'Too many exports.', label: 'Data exports', group: 'Sign-in & accounts', scope: 'account', description: 'Downloads of everything stored about an account (a heavy request).' });
const sensitiveByUser = limit({ name: 'account', windowMs: 15 * 60 * 1000, max: 10, key: (req) => req.userId, message: 'Too many attempts.', label: 'Sensitive account actions', group: 'Sign-in & accounts', scope: 'account', description: 'Password change, account deletion, sign out everywhere and starting 2FA setup.' });

// Sign-up takes two steps, so every account has a verified email address:
//   POST /register        checks everything and emails a 6-digit code (nothing is created,
//                         no campaign place is taken, the sign-up cap isn't touched);
//   POST /register/verify creates the account once the code is right.
// Without email on the server, only the owner (SUPERADMIN_EMAILS) can sign up, to set it up.
const SIGNUP_CODE_MINUTES = 30;
const signupEmail = (req) => (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 200) : null);
const signupCodeByEmail = limit({ name: 'signup-code', shared: true, windowMs: 60 * 60 * 1000, max: 5, key: signupEmail, message: 'Too many codes sent to this address. Please try again later.', label: 'Sign-up codes (per email)', group: 'Sign-in & accounts', description: 'Sign-up codes emailed to one address in an hour.' });
const signupVerifyByIp = limit({ name: 'signup-verify-ip', shared: true, windowMs: 15 * 60 * 1000, max: 30, key: clientIp, message: 'Too many attempts. Please wait a few minutes.', label: 'Sign-up code checks (per IP)', group: 'Sign-in & accounts', description: 'Sign-up codes entered from one network.' });
const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const fail = (status, error, code) => ({ status, body: { success: false, error, ...(code ? { code } : {}) } });

/** What would stop this sign-up right now ({ status, body }), or null. Checked at both steps. */
async function signupProblem(lowerEmail, code, settings) {
    const owner = isSuperadmin({ email: lowerEmail });
    if (settings.registration === 'closed' && !owner) return fail(403, 'Sign-ups are closed right now. Please check back soon.');
    // Throwaway email services (Admin › Credits & access), subdomains included.
    const domain = lowerEmail.split('@')[1] || '';
    if (!owner && (settings.signups.blockedDomains || []).some((d) => domain === d || domain.endsWith(`.${d}`))) {
        return fail(400, "Temporary email addresses can't be used. Please sign up with your university or personal email.", 'email-blocked');
    }
    // The hard cap on accounts (Admin › Credits & access).
    if (settings.signups.cap != null && !owner && (await User.countDocuments()) >= settings.signups.cap) {
        return fail(403, 'Sign-ups are full for now. Please check back soon.', 'signups-full');
    }
    if (code) {
        const problem = campaignProblem(await Campaign.findOne({ code }).lean(), lowerEmail);
        if (problem) return fail(400, problem);
    } else if (settings.registration === 'campaign' && !owner) {
        return fail(403, 'Sign-ups need a campaign code right now.');
    }
    return null;
}

/** Creates the account (claiming its campaign place atomically) → { status, body }. */
async function createAccount({ name, email, passwordHash, code, ref, net, verifiedAt }, settings) {
    const lowerEmail = String(email).trim().toLowerCase();
    let campaign = null;
    if (code) {
        campaign = await Campaign.findOne({ code }).lean();
        const problem = campaignProblem(campaign, lowerEmail);
        if (problem) return fail(400, problem);
        campaign = await Campaign.findOneAndUpdate({ _id: campaign._id, uses: { $lt: campaign.maxUses } }, { $inc: { uses: 1 } }, { new: true });
        if (!campaign) return fail(400, 'This campaign is full.');
    }
    let user;
    try {
        const until = campaign ? new Date(Date.now() + campaign.durationDays * 864e5) : null;
        user = await User.create({
            name: String(name),
            email: String(email),
            password: passwordHash,
            emailVerifiedAt: verifiedAt || undefined,
            lastLoginAt: new Date(),
            source: campaign ? 'campaign' : 'organic',
            ref: ref || undefined,
            signupNet: net || undefined,
            termsAccepted: { version: TERMS_VERSION, at: new Date() },
            ...(campaign
                ? {
                      campaign: campaign._id,
                      plan: campaign.plan,
                      planExpiresAt: campaign.plan !== 'free' ? until : undefined,
                      creditLimit: campaign.creditLimit,
                      creditPeriod: campaign.creditPeriod,
                      creditLimitExpiresAt: campaign.creditLimit != null ? until : undefined,
                      // The campaign's feature switches, for as long as the campaign gives.
                      ...(campaign.features && Object.keys(campaign.features).length ? { features: campaign.features, featuresExpireAt: until } : {}),
                  }
                : {}),
        });
    } catch (err) {
        if (campaign) await Campaign.updateOne({ _id: campaign._id }, { $inc: { uses: -1 } });
        throw err;
    }
    // The cap check can be raced by sign-ups arriving together: an account past the cap in
    // creation order is undone (and its campaign place given back).
    if (settings.signups.cap != null && !isSuperadmin({ email: lowerEmail }) && (await User.countDocuments({ _id: { $lte: user._id } })) > settings.signups.cap) {
        await User.deleteOne({ _id: user._id });
        if (campaign) await Campaign.updateOne({ _id: campaign._id }, { $inc: { uses: -1 } });
        return fail(403, 'Sign-ups are full for now. Please check back soon.', 'signups-full');
    }
    afterSignup(user, settings);
    return { status: 201, body: { success: true, token: getSignedJwtToken(user), user: publicUser(user) } };
}

const signupError = (res, err) => {
    if (err.name === 'ValidationError') return res.status(400).json({ success: false, error: Object.values(err.errors)[0].message });
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'User already exists.' });
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error during registration.' });
};

// @route   POST /api/auth/register — step 1: checks, then emails a code
router.post('/register', registerByIp, signupCodeByEmail, async (req, res) => {
    const { name, email, password } = req.body;
    const code = typeof req.body.campaignCode === 'string' ? req.body.campaignCode.trim().toUpperCase() : '';

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Please enter all fields.' });
    }
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, error: 'Please enter your name.' });
    if (!validEmail(email)) return res.status(400).json({ success: false, error: 'Please enter a valid email.' });
    if (passwordProblem(password)) {
        return res.status(400).json({ success: false, error: passwordProblem(password) });
    }

    try {
        if (await User.exists({ email: emailQuery(email) })) {
            return res.status(400).json({ success: false, error: 'User already exists.' });
        }
        const settings = await getSettings();
        const lowerEmail = String(email).trim().toLowerCase();
        const problem = await signupProblem(lowerEmail, code, settings);
        if (problem) return res.status(problem.status).json(problem.body);
        const details = { name: String(name).trim().slice(0, 200), code, ref: cleanRef(req.body.ref) || undefined, net: networkOf(clientIp(req)) || undefined };

        if (!mailer.canSendMail()) {
            if (!isSuperadmin({ email: lowerEmail })) {
                return res.status(503).json({ success: false, code: 'email-off', error: 'Sign-ups are paused for a moment while we set up email. Please check back soon.' });
            }
            const out = await createAccount({ ...details, email: String(email).trim(), passwordHash: await hashPassword(password) }, settings);
            return res.status(out.status).json(out.body);
        }

        const six = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
        await PendingSignup.updateOne(
            { email: lowerEmail },
            {
                $set: {
                    typedEmail: String(email).trim(),
                    name: details.name,
                    passwordHash: await hashPassword(password),
                    campaignCode: code || null,
                    ref: details.ref || null,
                    net: details.net || null,
                    codeHash: hashCode(six),
                    attempts: 0,
                    expiresAt: new Date(Date.now() + SIGNUP_CODE_MINUTES * 60 * 1000),
                },
            },
            { upsert: true }
        );
        await mailer.sendMail({
            to: String(email).trim(),
            subject: `${six} is your ResumeX sign-up code`,
            text: `Your ResumeX sign-up code is ${six}. Enter it to create your account. It expires in ${SIGNUP_CODE_MINUTES} minutes. If you didn't try to sign up, you can ignore this email.`,
            html: `<p>Your ResumeX sign-up code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${six}</p><p>Enter it to create your account. It expires in ${SIGNUP_CODE_MINUTES} minutes. If you didn't try to sign up, you can ignore this email.</p>`,
        });
        res.json({ success: true, pending: true, email: lowerEmail, minutes: SIGNUP_CODE_MINUTES });
    } catch (err) {
        signupError(res, err);
    }
});

// @route   POST /api/auth/register/verify — step 2: { email, code } creates the account
router.post('/register/verify', signupVerifyByIp, async (req, res) => {
    const lowerEmail = signupEmail(req) || '';
    const given = String(req.body?.code ?? '').trim();
    try {
        const p = lowerEmail ? await PendingSignup.findOne({ email: lowerEmail }).select('+passwordHash +codeHash') : null;
        if (!p || !p.expiresAt || p.expiresAt < new Date() || p.attempts >= 5) {
            return res.status(400).json({ success: false, code: 'code-expired', error: 'That code has expired. Go back and send a new one.' });
        }
        if (!/^\d{6}$/.test(given) || !crypto.timingSafeEqual(Buffer.from(hashCode(given)), Buffer.from(p.codeHash))) {
            await PendingSignup.updateOne({ _id: p._id }, { $inc: { attempts: 1 } });
            return res.status(400).json({ success: false, error: 'That code is not right.' });
        }
        // Used once: a second request with the same code finds nothing.
        const { deletedCount } = await PendingSignup.deleteOne({ _id: p._id });
        if (!deletedCount) return res.status(400).json({ success: false, code: 'code-expired', error: 'That code has expired. Go back and send a new one.' });
        if (await User.exists({ email: emailQuery(p.typedEmail || lowerEmail) })) return res.status(400).json({ success: false, error: 'User already exists.' });
        // Things may have changed while the email was on its way (cap, campaign places).
        const settings = await getSettings();
        const problem = await signupProblem(lowerEmail, p.campaignCode || '', settings);
        if (problem) return res.status(problem.status).json(problem.body);
        const out = await createAccount({ name: p.name, email: p.typedEmail || lowerEmail, passwordHash: p.passwordHash, code: p.campaignCode || '', ref: p.ref, net: p.net, verifiedAt: new Date() }, settings);
        res.status(out.status).json(out.body);
    } catch (err) {
        signupError(res, err);
    }
});

// @route   POST /api/auth/login
router.post('/login', loginByIp, loginByEmail, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Please provide an email and password.' });
    }
    if (!validEmail(email)) return res.status(401).json({ success: false, error: 'Invalid credentials.' });

    try {
        const user = await User.findOne({ email: emailQuery(email) }).select('+password');
        const ok = await bcrypt.compare(String(password), user?.password || DUMMY_HASH);
        if (!user || !ok) {
            return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }
        if (user.banned) return res.status(403).json({ success: false, code: 'banned', error: bannedMessage(user) });
        if (!user.twoFactor?.enabled) await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() }).catch(() => {});
        res.status(200).json(signInResponse(user));
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
        res.status(200).json({ success: true, user: { ...publicUser(user), sessionMfa: req.mfa } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error fetching user data.' });
    }
});

// @route   PUT /api/auth/me
// @desc    Update your name
router.put('/me', protect, profileByUser, async (req, res) => {
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

// @route   PUT /api/auth/email-prefs — which reminder emails to get ({ reminders, digest })
router.put('/email-prefs', protect, profileByUser, async (req, res) => {
    try {
        const set = {};
        for (const k of ['reminders', 'digest']) if (typeof req.body?.[k] === 'boolean') set[`emailPrefs.${k}`] = req.body[k];
        if (!Object.keys(set).length) return res.status(400).json({ success: false, error: 'Nothing to change.' });
        await User.updateOne({ _id: req.userId }, { $set: set });
        const user = await User.findById(req.userId);
        res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// @route   GET /api/auth/unsubscribe?t=… — the link in reminder emails: turns that kind off, no sign-in needed
router.get('/unsubscribe', unsubscribeByIp, async (req, res) => {
    const page = (title, body) =>
        res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Inter,Arial,sans-serif;color:#0f1f2a;display:grid;place-items:center;min-height:90vh;margin:0;background:#f8fafc"><div style="max-width:420px;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;text-align:center"><h1 style="font-size:20px">${title}</h1><p style="color:#475569">${body}</p><p><a href="${(process.env.APP_URL || 'https://resumex.cc').replace(/\/$/, '')}/account" style="color:#007b7b">Email settings</a></p></div></body>`);
    try {
        const p = jwt.verify(String(req.query.t || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (p.purpose !== 'unsubscribe' || !['reminders', 'digest'].includes(p.kind)) throw new Error('bad token');
        await User.updateOne({ _id: p.sub }, { $set: { [`emailPrefs.${p.kind}`]: false } });
        page("You're unsubscribed", p.kind === 'digest' ? "You won't get the weekly digest any more." : "You won't get deadline and interview reminders any more.");
    } catch {
        res.status(400);
        page('That link has expired', 'You can turn emails on or off in your account settings.');
    }
});

// @route   PUT /api/auth/password
// @desc    Change password (signs out other devices). Returns a fresh token.
router.put('/password', protect, sensitiveByUser, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Please fill in both passwords.' });
    }
    if (passwordProblem(newPassword)) {
        return res.status(400).json({ success: false, error: passwordProblem(newPassword) });
    }
    try {
        const user = await User.findById(req.userId).select('+password');
        if (!(await bcrypt.compare(String(currentPassword), user.password))) {
            return res.status(400).json({ success: false, error: 'Your current password is incorrect.' });
        }
        user.password = await hashPassword(newPassword);
        markPasswordChanged(user);
        await user.save();
        res.json({ success: true, token: getSignedJwtToken(user, { mfa: req.mfa }), user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// @route   GET /api/auth/export
// @desc    Download everything stored about you (account + resumes) as JSON.
router.get('/export', protect, exportByUser, async (req, res) => {
    try {
        const [user, data] = await Promise.all([User.findById(req.userId).lean(), exportUserData(req.userId)]);
        // Internal fields stay out: secrets (even encrypted or hashed) and the network hash.
        const { password, resetTokenHash, resetTokenExpires, sessionVersion, __v, twoFactor, signupNet, ...account } = user;
        account.twoFactorEnabled = !!twoFactor?.enabled;
        res.set('Content-Disposition', `attachment; filename="resumex-data-${new Date().toISOString().slice(0, 10)}.json"`);
        res.json({ exportedAt: new Date().toISOString(), account, ...data });
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
        await deleteUserData(user._id);
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
    const email = validEmail(emailKey(req));
    if (!email) return res.status(400).json({ success: false, error: 'Please enter a valid email.' });
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
    if (passwordProblem(password)) {
        return res.status(400).json({ success: false, error: passwordProblem(password) });
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
        // With 2FA on, a reset link alone doesn't sign you in: the code is still needed.
        res.json(signInResponse(user));
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ---------- Two-factor authentication (authenticator apps) ----------

const mfaByIp = limit({ name: 'mfa-ip', shared: true, windowMs: 15 * 60 * 1000, max: 20, key: clientIp, message: 'Too many verification attempts.', label: 'Two-factor codes (per IP)', group: 'Security codes', description: 'Authenticator and recovery codes entered at log in from one network.' });
const mfaByUser = limit({
    name: 'mfa-user',
    windowMs: 15 * 60 * 1000,
    max: 10,
    key: (req) => req.userId || req.mfaUserId,
    message: 'Too many wrong codes. For your security, wait before trying again.',
    label: 'Wrong codes (per account)',
    group: 'Security codes',
    scope: 'account',
    description: 'Authenticator, recovery and email codes tried on one account.',
});
const is2faAdmin = (user) => ['admin', 'superadmin'].includes(roleOf(user));

/** Checks an authenticator code (with replay protection) or a one-time recovery code. */
async function checkSecondFactor(user, { code, recoveryCode }) {
    if (recoveryCode) {
        const hash = totp.hashCode(recoveryCode);
        const idx = (user.twoFactor.recoveryCodes || []).indexOf(hash);
        if (idx === -1) return false;
        user.twoFactor.recoveryCodes.splice(idx, 1);
        user.markModified('twoFactor.recoveryCodes');
        return 'recovery';
    }
    const step = totp.verifyTotp(totp.decrypt(user.twoFactor.secret), code);
    if (step === null || step <= (user.twoFactor.lastStep || 0)) return false; // wrong, or already used
    user.twoFactor.lastStep = step;
    return 'code';
}

const withSecrets = '+twoFactor.secret +twoFactor.pendingSecret +twoFactor.lastStep +twoFactor.recoveryCodes';

// @route POST /api/auth/2fa/verify — second step of logging in (or of a password reset)
router.post(
    '/2fa/verify',
    mfaByIp,
    (req, res, next) => {
        try {
            const decoded = jwt.verify(String(req.body?.mfaToken || ''), process.env.JWT_SECRET, JWT_OPTS);
            if (decoded.purpose !== 'mfa') throw new Error('wrong token type');
            req.mfaUserId = decoded.id;
            req.mfaVersion = decoded.v || 0;
            next();
        } catch {
            res.status(401).json({ success: false, code: 'mfa_expired', error: 'Your sign-in took too long. Please log in again.' });
        }
    },
    mfaByUser,
    async (req, res, next) => {
        try {
            const user = await User.findById(req.mfaUserId).select(withSecrets);
            if (!user || user.banned || (user.sessionVersion || 0) !== req.mfaVersion || !user.twoFactor?.enabled) {
                return res.status(401).json({ success: false, code: 'mfa_expired', error: 'Please log in again.' });
            }
            const how = await checkSecondFactor(user, req.body || {});
            if (!how) {
                req.userId = String(user._id);
                req.actorEmail = user.email;
                if (is2faAdmin(user)) await audit(req, 'security.2fa_failed', user.email);
                return res.status(401).json({ success: false, error: 'That code is not right. Check the time on your phone and try again.' });
            }
            user.lastLoginAt = new Date();
            await user.save();
            req.userId = String(user._id);
            req.actorEmail = user.email;
            if (is2faAdmin(user)) await audit(req, how === 'recovery' ? 'security.login_recovery_code' : 'security.login', user.email);
            res.json({
                success: true,
                token: getSignedJwtToken(user, { mfa: true }),
                user: publicUser(user),
                ...(how === 'recovery' ? { recoveryCodesLeft: user.twoFactor.recoveryCodes.length } : {}),
            });
        } catch (err) {
            next(err);
        }
    }
);

// @route POST /api/auth/2fa/setup — start enabling 2FA: returns a secret and an otpauth:// link for the QR code
router.post('/2fa/setup', protect, sensitiveByUser, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select(withSecrets);
        if (user.twoFactor?.enabled) return res.status(400).json({ success: false, error: 'Two-factor authentication is already on.' });
        const secret = totp.generateSecret();
        user.set('twoFactor.pendingSecret', totp.encrypt(secret));
        await user.save();
        res.json({ success: true, data: { secret, otpauthUrl: totp.otpauthUrl(secret, user.email) } });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/auth/2fa/enable — confirm with a code; returns recovery codes and a 2FA-verified session
router.post('/2fa/enable', protect, mfaByUser, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select(withSecrets);
        if (user.twoFactor?.enabled) return res.status(400).json({ success: false, error: 'Two-factor authentication is already on.' });
        if (!user.twoFactor?.pendingSecret) return res.status(400).json({ success: false, error: 'Start the setup again.' });
        const secret = totp.decrypt(user.twoFactor.pendingSecret);
        const step = totp.verifyTotp(secret, req.body?.code);
        if (step === null) return res.status(400).json({ success: false, error: 'That code is not right. Make sure your phone’s clock is set automatically.' });
        const codes = totp.generateRecoveryCodes();
        user.twoFactor = { enabled: true, secret: totp.encrypt(secret), lastStep: step, recoveryCodes: codes.map(totp.hashCode), enabledAt: new Date() };
        markPasswordChanged(user); // sign out other devices; they'll need the code from now on
        await user.save();
        req.actorEmail = user.email;
        await audit(req, 'security.2fa_enabled', user.email);
        res.json({ success: true, token: getSignedJwtToken(user, { mfa: true }), user: publicUser(user), recoveryCodes: codes });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/auth/2fa/recovery-codes — new recovery codes (the old ones stop working)
router.post('/2fa/recovery-codes', protect, mfaByUser, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select(withSecrets);
        if (!user.twoFactor?.enabled) return res.status(400).json({ success: false, error: 'Two-factor authentication is off.' });
        if (!(await checkSecondFactor(user, { code: req.body?.code }))) return res.status(400).json({ success: false, error: 'That code is not right.' });
        const codes = totp.generateRecoveryCodes();
        user.twoFactor.recoveryCodes = codes.map(totp.hashCode);
        await user.save();
        res.json({ success: true, recoveryCodes: codes });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/auth/2fa/disable — needs the password and a code; not allowed for admins
router.post('/2fa/disable', protect, mfaByUser, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select(`+password ${withSecrets}`);
        if (is2faAdmin(user)) return res.status(403).json({ success: false, error: 'Admins must keep two-factor authentication on.' });
        if (!user.twoFactor?.enabled) return res.status(400).json({ success: false, error: 'Two-factor authentication is already off.' });
        if (!(await bcrypt.compare(String(req.body?.password || ''), user.password))) return res.status(400).json({ success: false, error: 'That password is incorrect.' });
        if (!(await checkSecondFactor(user, req.body || {}))) return res.status(400).json({ success: false, error: 'That code is not right.' });
        user.twoFactor = { enabled: false };
        await user.save();
        res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        next(err);
    }
});

// ---------- Email verification ----------

const emailCodeLimit = limit({ name: 'email-code', shared: true, windowMs: 60 * 60 * 1000, max: 4, key: (req) => req.userId, message: 'Too many codes requested.', label: 'Email verification codes sent', group: 'Security codes', scope: 'account', description: 'Verification emails one account can request.' });

// @route POST /api/auth/email/send-code — emails a 6-digit code (valid 15 minutes)
router.post('/email/send-code', protect, emailCodeLimit, async (req, res, next) => {
    try {
        if (!canSendMail()) return res.status(503).json({ success: false, error: "Email isn't set up on the server yet (SMTP_URL)." });
        const user = await User.findById(req.userId);
        if (user.emailVerifiedAt) return res.json({ success: true, alreadyVerified: true });
        const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
        user.emailCode = crypto.createHash('sha256').update(code).digest('hex');
        user.emailCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
        user.emailCodeAttempts = 0;
        await user.save();
        await sendMail({
            to: user.email,
            subject: `${code} is your ResumeX verification code`,
            text: `Your ResumeX verification code is ${code}. It expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
            html: `<p>Your ResumeX verification code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>`,
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/auth/email/verify — { code }
router.post('/email/verify', protect, mfaByUser, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('+emailCode +emailCodeExpires +emailCodeAttempts');
        if (user.emailVerifiedAt) return res.json({ success: true, user: publicUser(user) });
        const expired = !user.emailCode || !user.emailCodeExpires || user.emailCodeExpires < new Date() || user.emailCodeAttempts >= 5;
        if (expired) return res.status(400).json({ success: false, error: 'That code has expired. Send a new one.' });
        const hash = crypto.createHash('sha256').update(String(req.body?.code || '').trim()).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.emailCode))) {
            user.emailCodeAttempts += 1;
            await user.save();
            return res.status(400).json({ success: false, error: 'That code is not right.' });
        }
        user.emailVerifiedAt = new Date();
        user.emailCode = undefined;
        user.emailCodeExpires = undefined;
        await user.save();
        req.actorEmail = user.email;
        await audit(req, 'security.email_verified', user.email);
        res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/auth/logout-all — sign out every other device; returns a fresh session for this one
router.post('/logout-all', protect, sensitiveByUser, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        markPasswordChanged(user);
        await user.save();
        res.json({ success: true, token: getSignedJwtToken(user, { mfa: req.mfa }), user: publicUser(user) });
    } catch (err) {
        next(err);
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
    passwordProblem,
};
