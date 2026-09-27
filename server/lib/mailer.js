const nodemailer = require('nodemailer');

/**
 * Outgoing email (password resets). Configure SMTP_URL, e.g.
 *   smtps://USER:PASSWORD@smtp.example.com:465
 * and MAIL_FROM ("ResumeX <no-reply@yourdomain.com>"). Without SMTP_URL,
 * development prints emails to the console and production reports email as off.
 */
let transport = null;

const mailEnabled = () => !!process.env.SMTP_URL;
const devFallback = () => !mailEnabled() && process.env.NODE_ENV !== 'production';

async function sendMail({ to, subject, text, html }) {
    if (!mailEnabled()) {
        if (devFallback()) {
            console.log(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
            return;
        }
        throw new Error('Email is not configured (SMTP_URL).');
    }
    if (!transport) transport = nodemailer.createTransport(process.env.SMTP_URL);
    await transport.sendMail({ from: process.env.MAIL_FROM || 'ResumeX <support@resumex.cc>', to, subject, text, html });
}

module.exports = { sendMail, mailEnabled, canSendMail: () => mailEnabled() || devFallback() };
