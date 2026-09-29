/** Plan perks as the pricing page and upgrade dialog show them (client/src/components/billing/perks.js). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('plan perks as shown', () => {
    it('leave out perks that state a credit amount (the live allowance is shown instead), and the defaults have none', async () => {
        const { perksOf } = await import(require('node:path').join(__dirname, '../../client/src/components/billing/perks.js'));
        const perks = ['Live PDF builder', '10 AI credits a day', '1,000 AI credits a month', '300 credits', 'Credits refresh monthly', 'AI credits for rewrites'];
        assert.deepEqual(perksOf({ perks }), ['Live PDF builder', 'Credits refresh monthly', 'AI credits for rewrites']);
        assert.deepEqual(perksOf(null), []);
        const { DEFAULTS } = require('../lib/settings');
        for (const p of DEFAULTS.plans) assert.deepEqual(perksOf(p), p.perks, p.id);
    });
});
