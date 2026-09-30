/**
 * The browser (client/src/lib/access.js) and the API decide separately what an
 * account may use. If they ever disagree, people see locks that aren't enforced
 * or get refused things the page said were fine. These tests compare the two on
 * thousands of random admin settings.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { canUse, allowanceFor, planLimit } = require('../lib/credits');
const { hasV2 } = require('../lib/v2');
const { templateAllowed } = require('../lib/templates');
const { DEFAULTS, AI_FEATURES, APP_FEATURES, PLAN_IDS, PLAN_LIMITS } = require('../lib/settings');
const CATEGORY_OF = require('../../shared/templates.json');

const clientAccess = () => import(path.join(__dirname, '../../client/src/lib/access.js'));

// Deterministic pseudo-random numbers, so a failure can be reproduced.
function rng(seed) {
    let s = seed;
    return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

function randomSettings(r) {
    const features = [...AI_FEATURES, ...APP_FEATURES].map((f) => f.key);
    const settings = structuredClone(DEFAULTS);
    settings.freeMode.enabled = r() < 0.3;
    for (const plan of settings.plans) for (const f of features) plan.features[f] = r() < 0.5;
    for (const c of Object.keys(settings.templates.categories)) settings.templates.categories[c] = pick(r, PLAN_IDS);
    for (const plan of settings.plans) for (const { key } of PLAN_LIMITS) plan.limits[key] = r() < 0.3 ? null : Math.floor(r() * 20);
    settings.v2 = { enabled: r() < 0.3 };
    settings.templates.overrides = {};
    for (const id of Object.keys(CATEGORY_OF)) if (r() < 0.2) settings.templates.overrides[id] = pick(r, PLAN_IDS);
    return settings;
}

describe('browser and server agree on access', () => {
    it('plan limits and V2 access: same answer over 1,000 random settings', async () => {
        const { planLimit: browserLimit, canUseV2 } = await clientAccess();
        const r = rng(99);
        for (let i = 0; i < 1000; i++) {
            const settings = randomSettings(r);
            for (const plan of PLAN_IDS) {
                for (const { key } of PLAN_LIMITS) assert.equal(browserLimit(settings, plan, key), planLimit({ plan }, settings, key), `${key} on ${plan}`);
                // An account's own limits (set by an admin) win either way.
                const limits = r() < 0.5 ? null : Object.fromEntries(PLAN_LIMITS.filter(() => r() < 0.5).map(({ key }) => [key, Math.floor(r() * 20)]));
                for (const { key } of PLAN_LIMITS) assert.equal(browserLimit(settings, plan, key, limits), planLimit({ plan, limits }, settings, key), `own ${key} on ${plan}`);
                // Features switched on or off for the account (a campaign or an admin).
                const features = r() < 0.3 ? null : { applications: r() < 0.6, profile: r() < 0.5 };
                for (const { key } of PLAN_LIMITS) assert.equal(browserLimit(settings, plan, key, limits, features), planLimit({ plan, limits, features }, settings, key), `switched ${key} on ${plan}`);
            }
            const user = { email: 'a@b.c', role: pick(r, ['user', 'admin']), v2Preview: r() < 0.3 };
            // The browser sees the role the API reports (publicUser), not the stored one.
            assert.equal(canUseV2(settings, { ...user, role: user.role }), hasV2(user, settings));
        }
        assert.equal(canUseV2({ v2: { enabled: true } }, null), false, 'signed out never sees V2');
    });

    it('features: same answer for every plan and feature over 2,000 random settings', async () => {
        const { canUseFeature } = await clientAccess();
        const r = rng(42);
        const features = [...AI_FEATURES, ...APP_FEATURES].map((f) => f.key);
        let checks = 0;
        for (let i = 0; i < 2000; i++) {
            const settings = randomSettings(r);
            for (const plan of PLAN_IDS) {
                for (const f of features) {
                    const server = canUse({ plan, planExpiresAt: null }, settings, f);
                    const browser = canUseFeature(settings, plan, f);
                    assert.equal(browser, server, `feature ${f} on ${plan} (free mode ${settings.freeMode.enabled})`);
                    checks++;
                }
            }
        }
        assert.ok(checks > 10000);
    });

    it('features with an account\'s own switches (admin or campaign): same answer, and an "off" wins over free mode', async () => {
        const { canUseFeature } = await clientAccess();
        const { activeOverrides } = require('../lib/credits');
        const r = rng(7);
        const features = [...AI_FEATURES, ...APP_FEATURES].map((f) => f.key);
        for (let i = 0; i < 1500; i++) {
            const settings = randomSettings(r);
            const own = Object.fromEntries(features.filter(() => r() < 0.4).map((f) => [f, r() < 0.5]));
            const expired = r() < 0.2;
            const user = { plan: pick(r, PLAN_IDS), planExpiresAt: null, features: own, featuresExpireAt: expired ? new Date(Date.now() - 1000) : r() < 0.5 ? null : new Date(Date.now() + 864e5) };
            for (const f of features) {
                const server = canUse(user, settings, f);
                assert.equal(canUseFeature(settings, user.plan, f, activeOverrides(user)), server, `${f} own=${own[f]} expired=${expired}`);
                if (!expired && own[f] === false) assert.equal(server, false, 'an explicit off wins');
                if (!expired && own[f] === true) assert.equal(server, true, 'an explicit on grants');
            }
        }
    });

    it('templates: same answer for every plan and template over 500 random settings', async () => {
        const { canUseTemplate } = await clientAccess();
        const r = rng(7);
        for (let i = 0; i < 500; i++) {
            const settings = randomSettings(r);
            for (const plan of PLAN_IDS) {
                for (const [id, category] of Object.entries(CATEGORY_OF)) {
                    const server = templateAllowed({ plan }, settings, id);
                    const browser = canUseTemplate(settings, plan, { id, category });
                    assert.equal(browser, server, `template ${id} (${category}) on ${plan}`);
                }
            }
        }
    });

    it('an expired paid plan counts as Free on both sides', async () => {
        const { canUseFeature } = await clientAccess();
        const settings = structuredClone(DEFAULTS);
        settings.freeMode.enabled = false;
        const expired = { plan: 'pro', planExpiresAt: new Date(Date.now() - 1000) };
        // The browser is told the effective plan by the server (usage.plan.id), which must be free here.
        const { effectivePlanId } = require('../lib/credits');
        assert.equal(effectivePlanId(expired), 'free');
        assert.equal(canUseFeature(settings, effectivePlanId(expired), 'parse'), canUse(expired, settings, 'parse'));
        assert.equal(allowanceFor(expired, settings).plan.id, 'free');
    });

    it('the template list the server uses matches the browser registry', async () => {
        // Guards against adding a template without running `npm run templates:export`.
        const fs = require('node:fs');
        const specs = fs.readFileSync(path.join(__dirname, '../../client/src/pdf/engine/specs.js'), 'utf8');
        const registry = fs.readFileSync(path.join(__dirname, '../../client/src/pdf/registry.js'), 'utf8');
        const ids = [...(specs + registry).matchAll(/\bid:\s*"([A-Za-z0-9_-]+)"/g)].map((m) => m[1]).filter((id) => !['ats', 'minimal', 'creative', 'executive', 'academic', 'student', 'twocol'].includes(id));
        for (const id of ids) assert.ok(CATEGORY_OF[id], `template ${id} is missing from shared/templates.json — run npm run templates:export in client/`);
        assert.equal(Object.keys(CATEGORY_OF).length, ids.length);
    });
});

describe('browser and server agree on the tracker', () => {
    it('same statuses, and the same ones count as active', async () => {
        const client = await import(path.join(__dirname, '../../client/src/lib/applications.js'));
        const Application = require('../models/Application');
        assert.deepEqual(client.STATUSES.map((s) => s.id), Application.STATUSES);
        assert.deepEqual(client.ACTIVE, Application.ACTIVE);
    });
});

describe('plan changes: browser and server agree on what is an upgrade', () => {
    it('every pair of paid plans and billing periods', async () => {
        const { planChangeKind } = await clientAccess();
        const { changeKind } = require('../lib/paddle');
        const all = ['pro', 'premium'].flatMap((plan) => ['month', 'year'].map((interval) => ({ plan, interval })));
        for (const from of all) for (const to of all) assert.equal(planChangeKind(from, to), changeKind(from, to), `${from.plan}/${from.interval} → ${to.plan}/${to.interval}`);
        assert.equal(changeKind({ plan: 'premium', interval: 'year' }, { plan: 'pro', interval: 'year' }), 'downgrade');
        assert.equal(changeKind({ plan: 'pro', interval: 'year' }, { plan: 'premium', interval: 'month' }), 'upgrade', 'a higher plan is an upgrade even billed monthly');
    });
});
