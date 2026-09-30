/**
 * What the legal pages promise, checked in code: sign-up records which version of the Terms
 * and Privacy Policy was agreed to (the same date the pages show), and feedback and error
 * reports are deleted after the time the Privacy Policy states.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { start, stop, api, register, resetState } = require('./helpers');

describe('legal records', () => {
    before(() => start('legal'));
    after(stop);
    beforeEach(resetState);

    it('the terms version is the date the legal pages show', () => {
        const { TERMS_VERSION } = require('../lib/legal');
        const config = fs.readFileSync(path.join(__dirname, '../../client/src/lib/config.js'), 'utf8');
        const shown = config.match(/LEGAL_UPDATED = "([^"]+)"/)[1];
        assert.equal(new Date(`${shown} UTC`).toISOString().slice(0, 10), TERMS_VERSION);
    });

    it('sign-up records which terms were agreed to and when; the export includes it', async () => {
        const { TERMS_VERSION } = require('../lib/legal');
        const t = Date.now();
        const u = await register();
        const User = require('../models/User');
        const saved = await User.findById(u.user.id).lean();
        assert.equal(saved.termsAccepted.version, TERMS_VERSION);
        assert.ok(saved.termsAccepted.at.getTime() >= t - 1000);
        const exp = await api('GET', '/auth/export', { token: u.token });
        assert.equal(exp.body.account.termsAccepted.version, TERMS_VERSION);
    });

    it('feedback expires after two years and error reports 90 days after they last happened', async () => {
        await api('POST', '/reports/feedback', { body: { message: 'Keep this a while' } });
        const Feedback = require('../models/Feedback');
        const fb = await Feedback.findOne({ message: 'Keep this a while' }).lean();
        const days = (d, from) => Math.round((d - from) / 864e5);
        assert.equal(days(fb.expireAt, fb.createdAt), 730);
        const { recordError } = require('../lib/errors');
        const { getSettings } = require('../lib/settings');
        await recordError({ kind: 'server', message: 'Expiring error', where: 'GET /api/x' }, await getSettings());
        const ErrorGroup = require('../models/ErrorGroup');
        const g = await ErrorGroup.findOne({ message: 'Expiring error' }).lean();
        assert.equal(days(g.expireAt, g.lastAt), 90);
    });
});
