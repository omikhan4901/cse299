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

describe('key perks from the plan itself', () => {
    it('resumes from the limit, Profile and Applications only with V2 on; stored resume counts are dropped', async () => {
        const { keyPerks, perksOf } = await import(require('node:path').join(__dirname, '../../client/src/components/billing/perks.js'));
        const { DEFAULTS } = require('../lib/settings');
        const [free, pro] = DEFAULTS.plans;
        assert.deepEqual(keyPerks(free, { v2: true }), ['1 resume']);
        assert.deepEqual(keyPerks(pro, { v2: true }), ['Up to 15 resumes', 'Career Profile and Applications']);
        assert.deepEqual(keyPerks(pro), ['Up to 15 resumes'], 'V2 off: nothing about areas nobody can see');
        assert.deepEqual(keyPerks({ limits: { resumes: null }, features: { applications: true } }, { v2: true }), ['Unlimited resumes', 'Applications']);
        assert.deepEqual(keyPerks(null), []);
        assert.deepEqual(perksOf({ perks: ['Up to 50 resumes', '1 resume', 'Resume import'] }), ['Resume import']);
    });
});
