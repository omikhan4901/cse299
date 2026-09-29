/**
 * AI interview prep (lib/interviewAi.js, POST /ai/interview-prep): one call, a fixed JSON
 * shape, quotes that must really be the person's, nothing invented in their voice, charged
 * and refunded like every AI feature. The model is stubbed.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, setSettings, resetState, ai } = require('./helpers');
const { checkPrep, findLine, sourceLines, prepPrompt } = require('../lib/interviewAi');

const RESUME = {
    personal: { name: 'Tanvir Hasan', title: 'Embedded Engineer', email: 'tanvir@example.com', phone: '+8801700000000' },
    summary: 'Firmware engineer who likes small, reliable systems.',
    experience: [{ id: 1, title: 'Firmware Engineer', company: 'Walton', description: '• Wrote STM32 drivers for UART and SPI sensors\n• Cut boot time from 900 ms to 250 ms' }],
    projects: [{ id: 2, name: 'Line Follower', description: 'Built a PID-controlled robot on an ARM Cortex-M0' }],
    education: [{ id: 3, degree: 'BSc in EEE', institution: 'BUET', details: 'Thesis on low-power sensor nodes' }],
    skills: 'C, C++, STM32, FreeRTOS, Git',
};
const JOB = {
    title: 'Embedded Software Engineer',
    organisation: 'ReliSource',
    description: 'Embedded Software Engineer\n\nRequirements:\n- Strong C and C++\n- Microcontrollers (ARM, STM32), GPIO, interrupts\n- RTOS experience\n- Serial protocols: UART, SPI, I2C\n- Git\nNice to have: Zephyr, Bluetooth Low Energy',
};

const REPLY = {
    summary: 'You will write firmware for connected devices and debug it on real boards.',
    focus: [
        { skill: 'Serial protocols', why: 'Most of the work talks to sensors.', evidence: 'wrote stm32 drivers for UART and SPI sensors', talk: 'Walk through the SPI driver: timing, errors and how you tested it.' },
        { skill: 'RTOS', why: 'Their products run an RTOS.', evidence: 'Led a team of 12 engineers at Samsung', talk: 'Explain task priorities from your FreeRTOS work.' },
        { skill: '', why: 'dropped: no skill', evidence: '', talk: '' },
    ],
    questions: [
        {
            question: 'How would you debug an I2C bus that hangs?',
            type: 'role',
            why: 'Checks hands-on hardware debugging.',
            outline: ['Check the lines with a logic analyser', 'Mention your 5 years at Grameenphone on telecom firmware', 'Relate it to the UART and SPI drivers you wrote', 'Start with the Saleae trace, then check pull-ups at 400 kHz', 'Describe the Nordic nRF52 board you debugged'],
            use: 'Wrote STM32 drivers for UART and SPI sensors',
        },
        { question: 'Why ReliSource?', type: 'culture-fit', why: 'Motivation.', outline: ['Tie it to Zephyr and BLE on their list'], use: 'Something they never wrote down anywhere' },
    ],
    gaps: [{ gap: 'Zephyr', answer: 'I have shipped three Zephyr products at Samsung.' }, { gap: 'I2C', answer: 'Say you have used UART and SPI, and how you would learn I2C.' }],
    ask: ['What boards does the team use?', ''],
    prepare: ['Revise interrupt latency and ISR rules', 'Bring the Line Follower code'],
};

describe('AI interview prep: checks on the answer', () => {
    it('keeps real quotes (returned exactly as written, with where from) and clears made-up ones', () => {
        const lines = sourceLines(RESUME);
        assert.deepEqual(findLine('wrote stm32 drivers for UART and SPI sensors', lines), { text: 'Wrote STM32 drivers for UART and SPI sensors', where: 'Firmware Engineer at Walton' });
        assert.deepEqual(findLine('Thesis on low-power sensor nodes.', lines), { text: 'Thesis on low-power sensor nodes', where: 'BSc in EEE, BUET' });
        assert.equal(findLine('Led a team of 12 engineers', lines), null);
        assert.equal(findLine('C', lines), null, 'too short to be a quote');
        assert.equal(findLine('', lines), null);
    });

    it('drops lines in the person\'s voice that name facts from nowhere, keeps job words, and trims the shape', () => {
        const out = checkPrep(REPLY, RESUME, JOB);
        assert.equal(out.focus.length, 2, 'an item with no skill is dropped');
        assert.equal(out.focus[0].evidence.text, 'Wrote STM32 drivers for UART and SPI sensors');
        assert.equal(out.focus[1].evidence, null, 'Samsung is not theirs');
        assert.match(out.focus[1].talk, /FreeRTOS/, 'FreeRTOS is in their skills');
        const [q1, q2] = out.questions;
        assert.deepEqual(
            q1.outline,
            ['Check the lines with a logic analyser', 'Relate it to the UART and SPI drivers you wrote', 'Start with the Saleae trace, then check pull-ups at 400 kHz'],
            'claims about them (Grameenphone, an nRF52 board) are dropped; general advice stays'
        );
        assert.equal(q1.use.where, 'Firmware Engineer at Walton');
        assert.equal(q2.type, 'role', 'unknown types fall back');
        assert.equal(q2.use, null);
        assert.deepEqual(q2.outline, ['Tie it to Zephyr and BLE on their list'], 'words from the job are fine');
        assert.equal(out.gaps[0].answer, '', 'an honest answer can\'t claim Zephyr products at Samsung');
        assert.match(out.gaps[1].answer, /UART and SPI/);
        assert.deepEqual(out.ask, ['What boards does the team use?']);
        assert.equal(out.dropped, 3);
    });

    it('survives junk: missing fields, wrong types, huge lists and long strings', () => {
        const junk = { summary: 'x'.repeat(2000), focus: 'nope', questions: Array.from({ length: 30 }, (_, i) => ({ question: `Q${i} ${'y'.repeat(900)}`, outline: 'not a list' })), gaps: [null, 5], ask: null };
        const out = checkPrep(junk, RESUME, JOB);
        assert.equal(out.summary.length, 500);
        assert.deepEqual(out.focus, []);
        assert.equal(out.questions.length, 10);
        assert.equal(out.questions[0].question.length, 300);
        assert.deepEqual(out.questions[0].outline, []);
        assert.deepEqual(out.gaps, []);
        assert.deepEqual(out.ask, []);
        assert.deepEqual(checkPrep(null, {}, {}).questions, []);
    });

    it('sends the job and the resume lines, but not contact details', () => {
        const p = prepPrompt(RESUME, JOB);
        assert.match(p, /\[Firmware Engineer at Walton\] Wrote STM32 drivers/);
        assert.match(p, /Applying for: Embedded Software Engineer at ReliSource/);
        assert.match(p, /Nice to have: Zephyr/);
        assert.doesNotMatch(p, /tanvir@example\.com|8801700000000|Tanvir Hasan/);
    });

    it('is a V2 AI feature: 3 credits by default, off on Free, on for Pro and Premium', () => {
        const { AI_FEATURES, DEFAULTS } = require('../lib/settings');
        const f = AI_FEATURES.find((x) => x.key === 'interviewAi');
        assert.ok(f && f.v2 === true && f.name && f.description);
        assert.equal(DEFAULTS.featureCosts.interviewAi, 3);
        const [free, pro, premium] = DEFAULTS.plans;
        assert.equal(free.features.interviewAi, false);
        assert.equal(pro.features.interviewAi, true);
        assert.equal(premium.features.interviewAi, true);
    });
});

describe('POST /ai/interview-prep', () => {
    before(() => start('interviewai'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true } });
        ai.reply = JSON.stringify(REPLY);
        ai.status = 200;
    });

    const setup = async (token, { job = JOB, resume = RESUME } = {}) => {
        const r = resume ? (await api('POST', '/resumes', { token, body: { nickname: 'Firmware', ...resume } })).body.data : null;
        const a = (await api('POST', '/applications', { token, body: { job, ...(r ? { resume: r._id } : {}) } })).body.data;
        return { resume: r, app: a };
    };
    const used = async (token) => (await api('GET', '/billing/me', { token })).body.data.used;

    it('writes the sheet from the linked resume, charges 3 credits and keeps it on the application', async () => {
        const { token } = await register();
        const { app } = await setup(token);
        let prompt = '';
        ai.reply = (payload) => {
            prompt = payload.contents[0].parts[0].text;
            assert.equal(payload.generationConfig.responseMimeType, 'application/json');
            assert.ok(payload.generationConfig.responseSchema.properties.questions);
            return JSON.stringify(REPLY);
        };
        const r = await api('POST', '/ai/interview-prep', { token, body: { applicationId: app._id } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.data.from, 'resume');
        assert.equal(r.body.data.data.questions.length, 2);
        assert.match(prompt, /Wrote STM32 drivers/);
        assert.equal(await used(token), 3);

        const full = (await api('GET', `/applications/${app._id}`, { token })).body.data;
        assert.equal(full.prepAi.data.focus[0].evidence.text, 'Wrote STM32 drivers for UART and SPI sensors');
        assert.equal(full.rev, app.rev, 'not an edit: an open drawer can keep saving');
        const list = (await api('GET', '/applications', { token })).body.data;
        assert.equal(list[0].prepAi?.data, undefined, 'the list stays light');
        // Not something the person can write themselves.
        await api('PUT', `/applications/${app._id}`, { token, body: { prepAi: { data: { summary: 'forged' } }, baseRev: full.rev } });
        assert.equal((await api('GET', `/applications/${app._id}`, { token })).body.data.prepAi.data.summary, REPLY.summary);
    });

    it('uses the copy that was sent when there is one, and the Career Profile when there is no resume', async () => {
        const { token } = await register();
        const { app } = await setup(token);
        const applied = await api('PUT', `/applications/${app._id}`, { token, body: { status: 'applied', baseRev: app.rev } });
        assert.ok(applied.body.data.snapshot?.at);
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: app._id } })).body.data.from, 'sent');

        await api('PUT', '/profile', { token, body: { experience: RESUME.experience, skills: RESUME.skills } });
        const bare = (await setup(token, { resume: null })).app;
        const r = await api('POST', '/ai/interview-prep', { token, body: { applicationId: bare._id } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.data.from, 'profile');
    });

    it('refuses what it can\'t work from, without charging, and refunds a failed answer', async () => {
        const { token } = await register();
        const other = await register();
        const theirs = (await setup(other.token)).app;
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: theirs._id } })).status, 404);
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: 'nope' } })).status, 404);
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: {} })).status, 404);
        const short = (await setup(token, { job: { title: 'Engineer', description: 'Firmware role.' } })).app;
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: short._id } })).status, 400);
        const nothing = (await setup(token, { resume: null })).app;
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: nothing._id } })).status, 400, 'no resume and no profile');
        assert.equal(ai.calls, 0);

        const { app } = await setup(token);
        ai.reply = 'not json';
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: app._id } })).status, 502);
        ai.reply = JSON.stringify({ ...REPLY, questions: [] });
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: app._id } })).status, 502, 'a sheet with no questions is no sheet');
        ai.status = 503;
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: app._id } })).status, 502);
        assert.equal(await used(token), 0, 'every failure refunded');
        assert.equal((await api('GET', `/applications/${app._id}`, { token })).body.data.prepAi, undefined);
    });

    it('follows plans and the V2 switch', async () => {
        await setSettings({ freeMode: { enabled: false } });
        const { token } = await register();
        const { app } = await setup(token);
        const r = await api('POST', '/ai/interview-prep', { token, body: { applicationId: app._id } });
        assert.equal(r.status, 403);
        assert.equal(r.body.feature, 'interviewAi');

        await setSettings({ freeMode: { enabled: true }, v2: { enabled: false } });
        assert.equal((await api('POST', '/ai/interview-prep', { token, body: { applicationId: app._id } })).status, 404);
        assert.equal(await used(token), 0);
        assert.equal(ai.calls, 0);
    });
});
