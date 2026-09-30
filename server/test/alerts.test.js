/**
 * Alerts for the owner (lib/alerts.js): each raised once however many servers notice,
 * listed under the admin console's bell: sign-ups nearly full and full, a burst of sign-ups
 * from one network, and the AI spend thresholds.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState, signUp } = require('./helpers');

const until = async (fn, ms = 2000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const v = await fn();
        if (v) return v;
        await new Promise((r) => setTimeout(r, 25));
    }
    return fn();
};

describe('owner alerts', () => {
    before(() => start('alerts'));
    after(stop);
    beforeEach(resetState);
    const bell = async (admin) => (await api('GET', '/admin/alerts', { token: admin.token })).body.data;

    it('raise() happens once per id, even when several servers race', async () => {
        const { raise } = require('../lib/alerts');
        const results = await Promise.all([1, 2, 3, 4].map(() => raise('test-once', { kind: 'test', subject: 's', text: 'Once only', email: false })));
        assert.equal(results.filter(Boolean).length, 1);
        const admin = await superadmin();
        assert.equal((await bell(admin)).filter((a) => a.text === 'Once only').length, 1);
    });

    it('sign-ups nearly full, then full, each alerted once', async () => {
        const admin = await superadmin();
        const User = require('../models/User');
        const now = await User.countDocuments();
        await setSettings({ signups: { cap: now + 3 } });
        await register();
        const closing = await until(async () => (await bell(admin)).find((a) => a.kind === 'signups' && /left/.test(a.text)));
        assert.ok(closing, 'nearly full');
        assert.match(closing.text, /Only 2 of \d+ places are left/);
        await register();
        await register();
        const full = await until(async () => (await bell(admin)).find((a) => a.kind === 'signups' && /closed/.test(a.text)));
        assert.ok(full, 'full');
        assert.equal((await bell(admin)).filter((a) => a.kind === 'signups').length, 2, 'no repeats');
        assert.equal((await signUp({ name: 'Late', email: 'late@test.dev', password: 'password123' })).body.code, 'signups-full');
    });

    it('5 sign-ups in an hour from one network raise one burst alert', async () => {
        const admin = await superadmin();
        await setSettings({ signups: { cap: null } });
        for (let i = 0; i < 6; i++) await register();
        const burst = await until(async () => (await bell(admin)).find((a) => a.kind === 'burst'));
        assert.ok(burst);
        assert.match(burst.text, /signed up from the same network in the last hour/);
        assert.equal((await bell(admin)).filter((a) => a.kind === 'burst').length, 1, 'once a day per network');
    });

    it('AI spend thresholds show under the bell; the bell is admins only', async () => {
        const admin = await superadmin();
        const { recordSpend } = require('../lib/aiSpend');
        const { getSettings } = require('../lib/settings');
        await setSettings({ aiSpend: { enabled: true, cap: 1, alertAt: 50 } });
        await recordSpend({ model: 'default', inputTokens: 2_000_000, outputTokens: 0 }, await getSettings());
        const a = await until(async () => (await bell(admin)).find((x) => x.kind === 'ai'));
        assert.ok(a);
        assert.match(a.text, /50% of the monthly cap/);
        const user = await register();
        assert.equal((await api('GET', '/admin/alerts', { token: user.token })).status, 403);
    });
});
