const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, resetState, setSettings, needsRealMongo } = require('./helpers');

before(() => start('resumes'));
after(stop);
beforeEach(resetState);

const PHOTO = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;

describe('resumes', () => {
    it('create, read, update, list, duplicate, delete', async () => {
        const { token } = await register();
        const c = await api('POST', '/resumes', { token, body: { nickname: 'Main', summary: 'Hello', personal: { name: 'Ada' } } });
        assert.equal(c.status, 201);
        const id = c.body.data._id;
        assert.equal((await api('GET', `/resumes/${id}`, { token })).body.data.summary, 'Hello');
        assert.equal((await api('PUT', `/resumes/${id}`, { token, body: { summary: 'Changed' } })).body.data.summary, 'Changed');
        const dup = await api('POST', `/resumes/${id}/duplicate`, { token });
        assert.equal(dup.status, 201);
        assert.equal(dup.body.data.isPublic, false);
        assert.equal((await api('GET', '/resumes', { token })).body.count, 2);
        assert.equal((await api('DELETE', `/resumes/${id}`, { token })).status, 200);
        assert.equal((await api('GET', `/resumes/${id}`, { token })).status, 404);
    });

    it("never lets one account read, change or delete another's resume", async () => {
        const a = await register();
        const b = await register();
        const id = (await api('POST', '/resumes', { token: a.token, body: { nickname: 'Private' } })).body.data._id;
        for (const [method, path, body] of [['GET', `/resumes/${id}`], ['PUT', `/resumes/${id}`, { summary: 'hacked' }], ['DELETE', `/resumes/${id}`], ['POST', `/resumes/${id}/duplicate`]]) {
            const r = await api(method, path, { token: b.token, body });
            assert.equal(r.status, 404, `${method} ${path} must look like it doesn't exist`);
        }
        assert.equal((await api('GET', `/resumes/${id}`, { token: a.token })).body.data.summary, '');
    });

    it('ignores fields the client may not set (owner, share id, timestamps)', async () => {
        const a = await register();
        const b = await register();
        const r = await api('POST', '/resumes', { token: a.token, body: { nickname: 'X', user: b.user.id, shortId: 'hijack01', createdAt: '2000-01-01' } });
        assert.notEqual(r.body.data.user, b.user.id);
        assert.notEqual(r.body.data.shortId, 'hijack01');
        assert.notEqual(r.body.data.createdAt.slice(0, 4), '2000');
    });

    it('only accepts real image data URLs for photos', async () => {
        const { token } = await register();
        const ok = await api('POST', '/resumes', { token, body: { nickname: 'P', personal: { profilePic: PHOTO } } });
        assert.equal(ok.body.data.personal.profilePic, PHOTO);
        for (const bad of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'https://evil.example/x.png', `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`]) {
            const r = await api('POST', '/resumes', { token, body: { nickname: 'P', personal: { profilePic: bad } } });
            assert.equal(r.body.data.personal.profilePic, '', `${bad.slice(0, 20)} must be dropped`);
        }
    });

    it('caps resumes per account', async () => {
        process.env.MAX_RESUMES_PER_ACCOUNT = '50';
        const { token } = await register();
        const Resume = require('../models/Resume');
        const User = require('../models/User');
        const u = await User.findOne({}).sort({ createdAt: -1 });
        await Resume.insertMany(Array.from({ length: 50 }, (_, i) => ({ user: u._id, nickname: `R${i}` })));
        const r = await api('POST', '/resumes', { token, body: { nickname: 'one too many' } });
        assert.equal(r.status, 400);
    });
});

describe('sharing', () => {
    it('a public link shows the resume without the owner id or the original photo', async () => {
        const { token } = await register();
        const c = await api('POST', '/resumes', { token, body: { nickname: 'S', personal: { name: 'Ada', profilePic: PHOTO, profilePicSource: PHOTO } } });
        const { _id, shortId } = c.body.data;
        assert.equal((await api('GET', `/public/${shortId}`)).status, 404, 'private by default');
        await api('PUT', `/resumes/${_id}`, { token, body: { isPublic: true } });
        const pub = await api('GET', `/public/${shortId}`);
        assert.equal(pub.status, 200);
        assert.equal(pub.body.data.user, undefined);
        assert.equal(pub.body.data.personal.profilePicSource, undefined);
        assert.equal(pub.body.data.personal.name, 'Ada');
    });

    it("a suspended owner's resumes disappear", async () => {
        const User = require('../models/User');
        const { token, email } = await register();
        const { _id, shortId } = (await api('POST', '/resumes', { token, body: { nickname: 'S', isPublic: true } })).body.data;
        assert.equal((await api('GET', `/public/${shortId}`)).status, 200);
        await User.updateOne({ email }, { banned: true });
        assert.equal((await api('GET', `/public/${shortId}`)).status, 404);
        assert.ok(_id);
    });

    it('the share-links plan feature is enforced by the server', async () => {
        const settings = require('../lib/settings');
        const plans = structuredClone(settings.DEFAULTS.plans);
        plans[0].features.shareLinks = false;
        await setSettings({ freeMode: { enabled: false }, plans });
        const { token } = await register();
        const created = await api('POST', '/resumes', { token, body: { nickname: 'S', isPublic: true } });
        assert.equal(created.status, 403);
        assert.equal(created.body.feature, 'shareLinks');
        const id = (await api('POST', '/resumes', { token, body: { nickname: 'S' } })).body.data._id;
        assert.equal((await api('PUT', `/resumes/${id}`, { token, body: { isPublic: true } })).status, 403);
    });
});

describe('templates by plan (server side)', () => {
    it('refuses switching to a template the plan lacks, keeps existing ones, and frees everything in free mode', async () => {
        const { token } = await register();
        const id = (await api('POST', '/resumes', { token, body: { nickname: 'T', template: 'Sunset' } })).body.data._id; // free mode: allowed
        await setSettings({ freeMode: { enabled: false } }); // Sunset (creative) needs Pro by default
        const switchTo = await api('PUT', `/resumes/${id}`, { token, body: { template: 'Nordic' } }); // minimal: Pro
        assert.equal(switchTo.status, 403);
        assert.equal(switchTo.body.plan, 'pro');
        assert.equal((await api('PUT', `/resumes/${id}`, { token, body: { template: 'Sunset', summary: 'still saves' } })).status, 200, 'unchanged locked template keeps saving');
        assert.equal((await api('PUT', `/resumes/${id}`, { token, body: { template: 'Classic' } })).status, 200);
        assert.equal((await api('POST', '/resumes', { token, body: { nickname: 'N', template: 'Nordic' } })).status, 403);
        await setSettings({ templates: { categories: require('../lib/settings').DEFAULTS.templates.categories, overrides: { Nordic: 'free' } } });
        assert.equal((await api('POST', '/resumes', { token, body: { nickname: 'N', template: 'Nordic' } })).status, 201, 'per-template override applies');
    });
});

describe('editing in two tabs', () => {
    const put = (token, id, body) => api('PUT', `/resumes/${id}`, { token, body });

    it('a save based on an old revision is refused with the latest copy', async () => {
        const { token } = await register();
        const { body } = await api('POST', '/resumes', { token, body: { nickname: 'CV', summary: 'v0' } });
        const id = body.data._id;
        assert.equal(body.data.rev, 0);
        // Both tabs opened revision 0. Tab A saves first.
        const a = await put(token, id, { summary: 'from tab A', baseRev: 0 });
        assert.equal(a.status, 200);
        assert.equal(a.body.data.rev, 1);
        // Tab B still thinks it's editing revision 0: refused, and told what's there now.
        const b = await put(token, id, { summary: 'from tab B', baseRev: 0 });
        assert.equal(b.status, 409);
        assert.equal(b.body.code, 'conflict');
        assert.equal(b.body.data.summary, 'from tab A');
        assert.equal(b.body.data.rev, 1);
        assert.equal((await api('GET', `/resumes/${id}`, { token })).body.data.summary, 'from tab A', 'tab A kept');
        // Tab B chooses to keep its version: it saves on top of revision 1.
        const force = await put(token, id, { summary: 'from tab B', baseRev: 1 });
        assert.equal(force.status, 200);
        assert.equal(force.body.data.rev, 2);
    });

    it('share and master toggles never conflict with an open editor', async () => {
        const { token } = await register();
        const id = (await api('POST', '/resumes', { token, body: { nickname: 'CV' } })).body.data._id;
        const other = (await api('POST', '/resumes', { token, body: { nickname: 'Other', isMaster: true } })).body.data;
        assert.equal((await put(token, id, { isPublic: true })).status, 200);
        assert.equal((await put(token, id, { isMaster: true })).body.data.rev, 0, 'toggles keep the revision');
        const after = (await api('GET', `/resumes/${other._id}`, { token })).body.data;
        assert.equal(after.isMaster, false);
        assert.equal(after.updatedAt, other.updatedAt, "un-mastering another resume doesn't make it look edited");
        assert.equal((await put(token, id, { summary: 'typed', baseRev: 0 })).status, 200, 'the editor still saves');
    });

    it('saves without a revision (older app versions) still work', async () => {
        const { token } = await register();
        const id = (await api('POST', '/resumes', { token, body: { nickname: 'CV' } })).body.data._id;
        assert.equal((await put(token, id, { summary: 'a' })).status, 200);
        const r = await put(token, id, { summary: 'b' });
        assert.equal(r.status, 200);
        assert.equal(r.body.data.rev, 2);
    });

    it('two saves racing from the same revision: exactly one wins', async (t) => {
        if (needsRealMongo()) return t.skip(needsRealMongo());
        const { token } = await register();
        const id = (await api('POST', '/resumes', { token, body: { nickname: 'CV' } })).body.data._id;
        const results = await Promise.all(Array.from({ length: 6 }, (_, i) => put(token, id, { summary: `tab ${i}`, baseRev: 0 })));
        assert.equal(results.filter((r) => r.status === 200).length, 1);
        assert.equal(results.filter((r) => r.status === 409).length, 5);
    });
});
