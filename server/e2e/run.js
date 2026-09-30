/**
 * End-to-end check of the beta in a real browser (docs/v2/BETA-PLAN.md, Phase 5), against a
 * running API and site. It prepares the settings and a campaign directly in the database,
 * then goes through what a beta student and a Free visitor do, on desktop and on a phone:
 *
 *   sign up with a campaign code (and the emailed code) → build a resume (autosave) → download the PDF →
 *   Career Profile and Applications open (campaign Pro) → add an application →
 *   ATS checker → pricing says "Coming soon" → AI paused notice →
 *   campaign ends → back to Free: Profile and Applications locked, a second resume refused →
 *   delete the account.
 *
 *   MONGO_URI=... JWT_SECRET=... SITE=http://localhost:3400 node e2e/run.js
 *
 * Needs Playwright (PLAYWRIGHT_PATH, or a global install) and Chromium (CHROMIUM_PATH).
 * Screenshots of failures go to E2E_OUT (default /tmp/resumex-e2e). The AI is never
 * called. Exit code 1 when a step fails. Not part of `npm test`.
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const SITE = process.env.SITE || 'http://localhost:3400';
const OUT = process.env.E2E_OUT || '/tmp/resumex-e2e';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PDF = path.join(__dirname, '../test/fixtures/single-column.pdf');

const results = [];
async function step(page, name, fn) {
    const t = Date.now();
    try {
        await fn();
        results.push({ name, ok: true, ms: Date.now() - t });
        console.log(`  ✓ ${name}`);
    } catch (err) {
        const file = path.join(OUT, `${results.length + 1}-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 50)}.png`);
        await page.screenshot({ path: file, fullPage: true }).catch(() => {});
        results.push({ name, ok: false, error: err.message.split('\n')[0] });
        console.log(`  ✗ ${name}: ${err.message.split('\n')[0]}\n    ${file}`);
    }
}

async function setup() {
    await mongoose.connect(process.env.MONGO_URI);
    const { updateSettings } = require('../lib/settings');
    await updateSettings({ v2: { enabled: true }, freeMode: { enabled: false }, payments: { mode: 'off' }, registration: 'campaign', signups: { cap: null, requireVerifiedEmail: false }, aiSpend: { enabled: true, cap: 40, alertAt: 80, paused: false } }, 'e2e');
    const Campaign = require('../models/Campaign');
    const code = `E2E-${Date.now().toString(36).toUpperCase()}`;
    await Campaign.create({ name: 'E2E beta', code, plan: 'pro', maxUses: 5, durationDays: 30, creditLimit: 60, creditPeriod: 'month' });
    console.log('Waiting 31 s for the API to pick up the settings…');
    await new Promise((r) => setTimeout(r, 31_000));
    return code;
}

async function student(browser, code, { phone = false } = {}) {
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const email = `e2e-${Date.now()}${phone ? '-m' : ''}@e2e.test`;
    const tag = phone ? '(phone) ' : '';
    const User = require('../models/User');

    await step(page, `${tag}join with a campaign code and sign up`, async () => {
        await page.goto(`${SITE}/join/${code}`);
        await page.getByRole('button', { name: 'Create my account' }).click();
        await page.getByPlaceholder('Full name').fill('E2E Student');
        await page.getByPlaceholder('Email').fill(email);
        await page.getByPlaceholder('Password', { exact: true }).fill('password123');
        const confirm = page.getByPlaceholder('Confirm password');
        if (await confirm.count()) await confirm.fill('password123');
        await page.getByRole('button', { name: 'Create account' }).click();
        // The code goes by email; here a known code is put on the pending sign-up instead.
        await page.getByText('Check your email').waitFor({ timeout: 20000 });
        const PendingSignup = require('../models/PendingSignup');
        await PendingSignup.updateOne({ email }, { $set: { codeHash: require('crypto').createHash('sha256').update('123456').digest('hex') } });
        await page.locator('.ant-otp input').first().click();
        await page.keyboard.type('123456');
        await page.waitForURL(/builder|dashboard|welcome/, { timeout: 20000 });
        const u = await User.findOne({ email }).lean();
        if (!u || u.plan !== 'pro' || u.source !== 'campaign') throw new Error(`account not set up by the campaign: ${JSON.stringify(u && { plan: u.plan, source: u.source })}`);
    });

    await step(page, `${tag}a campaign member is welcomed once`, async () => {
        await page.getByText('Welcome to the ResumeX beta').waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: "Let's go" }).click();
        await page.reload();
        await page.waitForTimeout(2500);
        if (await page.getByText('Welcome to the ResumeX beta').count()) throw new Error('shown again');
    });

    await step(page, `${tag}feedback from the Beta tag`, async () => {
        await page.getByRole('button', { name: /Beta/ }).first().click();
        await page.getByRole('button', { name: 'Send feedback' }).click();
        await page.locator('.ant-modal textarea').fill('E2E: everything went fine.');
        await page.getByRole('button', { name: 'Send', exact: true }).click();
        const Feedback = require('../models/Feedback');
        const u = await User.findOne({ email }).lean();
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline && !(await Feedback.exists({ user: u._id }))) await page.waitForTimeout(500);
        if (!(await Feedback.exists({ user: u._id }))) throw new Error('not saved');
    });

    await step(page, `${tag}build a resume and it autosaves`, async () => {
        await page.goto(`${SITE}/builder?new=1`);
        // Phones show the form first (the preview is a tab), so wait for the form.
        await page.getByPlaceholder('Jane Doe').waitFor({ timeout: 60000 });
        const empty = page.getByRole('button', { name: 'Start empty' });
        if (await empty.count()) await empty.click();
        await page.getByPlaceholder('Jane Doe').fill('E2E Student');
        await page.getByPlaceholder('Full Stack Developer').fill('Software Engineer');
        const Resume = require('../models/Resume');
        const u = await User.findOne({ email }).lean();
        const deadline = Date.now() + 20000;
        let saved = null;
        while (Date.now() < deadline && !saved) {
            await page.waitForTimeout(1000);
            saved = await Resume.findOne({ user: u._id, 'personal.name': 'E2E Student' }).lean();
        }
        if (!saved) throw new Error('the resume never reached the account');
    });

    if (!phone) {
        await step(page, 'download the PDF', async () => {
            const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: 'Download PDF' }).first().click()]);
            const file = await download.path();
            const head = fs.readFileSync(file).subarray(0, 5).toString();
            if (head !== '%PDF-') throw new Error(`not a PDF: ${head}`);
        });
    }

    await step(page, `${tag}Career Profile opens for a campaign member`, async () => {
        await page.goto(`${SITE}/career`);
        await page.waitForTimeout(3000);
        if (await page.getByText('Part of Pro').count()) throw new Error('shown as locked');
    });

    await step(page, `${tag}add an application`, async () => {
        await page.goto(`${SITE}/applications`);
        await page.waitForTimeout(3000);
        if (await page.getByText('Part of Pro').count()) throw new Error('shown as locked');
        await page.getByRole('button', { name: /Add application/ }).first().click();
        await page.getByPlaceholder(/https:\/\/… or the full job post/).fill('Junior Software Engineer at Acme Ltd, Dhaka. Requirements: JavaScript, React, SQL. Apply by 30 October 2026.');
        await page.getByRole('button', { name: 'Analyze' }).click();
        const title = page.getByPlaceholder('Job title');
        await title.waitFor({ timeout: 10000 });
        if (!(await title.inputValue())) await title.fill('Junior Software Engineer');
        const org = page.getByPlaceholder('Organisation');
        if (!(await org.inputValue())) await org.fill('Acme Ltd');
        await page.getByRole('button', { name: 'Save application' }).click();
        const Application = require('../models/Application');
        const u = await User.findOne({ email }).lean();
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline && !(await Application.exists({ user: u._id }))) await page.waitForTimeout(500);
        if (!(await Application.exists({ user: u._id }))) throw new Error('not saved');
    });

    if (!phone) {
        await step(page, 'ATS checker reads an uploaded PDF', async () => {
            await page.goto(`${SITE}/ats-checker`);
            await page.locator('input[type=file]').first().setInputFiles(PDF);
            await page.getByText(/score|ATS/i).first().waitFor({ timeout: 30000 });
            await page.waitForTimeout(4000);
            const text = await page.locator('main').innerText();
            if (!/\d+\s*(\/\s*100|%)/.test(text) && !/score/i.test(text)) throw new Error('no report shown');
        });

        await step(page, 'pricing says "Coming soon" while payments are off', async () => {
            await page.goto(`${SITE}/pricing`);
            await page.getByText('Coming soon').first().waitFor({ timeout: 10000 });
        });

        await step(page, 'AI paused: the builder says so', async () => {
            const { updateSettings } = require('../lib/settings');
            await updateSettings({ aiSpend: { enabled: true, cap: 40, alertAt: 80, paused: true } }, 'e2e');
            await new Promise((r) => setTimeout(r, 31_000)); // the API's settings cache
            await page.goto(`${SITE}/builder`);
            await page.waitForTimeout(4000);
            const shown = await page.getByText(/AI features are paused/i).count();
            await updateSettings({ aiSpend: { enabled: true, cap: 40, alertAt: 80, paused: false } }, 'e2e');
            if (!shown) throw new Error('no paused notice');
        });
    }

    await step(page, `${tag}campaign ends: back to Free, paid areas locked, one resume`, async () => {
        const past = new Date(Date.now() - 1000);
        await User.updateOne({ email }, { planExpiresAt: past, featuresExpireAt: past, creditLimitExpiresAt: past });
        await page.goto(`${SITE}/applications`);
        await page.getByText('Part of Pro').first().waitFor({ timeout: 15000 });
        await page.goto(`${SITE}/career`);
        await page.getByText('Part of Pro').first().waitFor({ timeout: 15000 });
        await page.goto(`${SITE}/dashboard`);
        await page.getByRole('button', { name: /New resume/ }).first().click();
        await page.getByText(/is part of Pro/).first().waitFor({ timeout: 10000 });
        await page.keyboard.press('Escape');
    });

    await step(page, `${tag}delete the account`, async () => {
        await page.goto(`${SITE}/account`);
        await page.getByRole('button', { name: 'Delete my account' }).click();
        await page.locator('.ant-modal').getByPlaceholder('Password').fill('password123');
        await page.locator('.ant-modal').getByRole('button', { name: /delete/i }).last().click();
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline && (await User.exists({ email }))) await page.waitForTimeout(500);
        if (await User.exists({ email })) throw new Error('account still there');
    });

    await step(page, `${tag}no page errors`, async () => {
        if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
    });
    await ctx.close();
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const code = await setup();
    const browser = await chromium.launch({ executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined });
    console.log('Desktop');
    await student(browser, code);
    console.log('Phone');
    await student(browser, code, { phone: true });
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length} of ${results.length} steps passed.`);
    await mongoose.disconnect();
    process.exit(failed.length ? 1 : 0);
})();
