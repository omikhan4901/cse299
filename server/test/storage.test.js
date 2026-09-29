/**
 * Storage on the free database (lib/storage.js): usage against the quota, what uses it and the
 * biggest accounts for the admin; one alert email a month past the alert level; photos capped
 * on the server; application snapshots keep the cropped photo but not the original.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, register, superadmin, setSettings, resetState } = require('./helpers');

const photo = (bytes) => `data:image/jpeg;base64,${'A'.repeat(bytes)}`;

describe('storage', () => {
    before(() => start('storage'));
    after(stop);
    beforeEach(async () => {
        await resetState();
        await setSettings({ v2: { enabled: true }, freeMode: { enabled: true } });
    });

    it('the admin sees usage against the quota, bytes by kind (photos too) and the biggest accounts', async () => {
        const admin = await superadmin();
        const big = await register({ name: 'Big' });
        const small = await register({ name: 'Small' });
        await api('POST', '/resumes', { token: big.token, body: { nickname: 'A', personal: { name: 'Big', profilePic: photo(50_000), profilePicSource: photo(150_000) } } });
        await api('POST', '/resumes', { token: small.token, body: { nickname: 'B', summary: 'short' } });
        const r = await api('GET', '/admin/storage?fresh=1', { token: admin.token });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const d = r.body.data;
        assert.equal(d.usage.quota, 512 * 1024 * 1024);
        assert.equal(d.kinds.resumes.count, 2);
        assert.ok(d.kinds.resumes.photos >= 200_000, 'photo bytes counted');
        assert.equal(d.biggest[0].email, big.email, 'biggest first');
        assert.ok(d.biggest[0].bytes > d.biggest[1].bytes);
        assert.equal((await api('GET', '/admin/storage', { token: big.token })).status, 403, 'admins only');
    });

    it('quota and alert level are admin settings, kept in range', async () => {
        const { getSettings } = require('../lib/settings');
        await setSettings({ storage: { quotaMb: 5, alertAt: 150 } });
        const s = await getSettings();
        assert.deepEqual(s.storage, { quotaMb: 64, alertAt: 99 });
    });

    it('past the alert level the owner is emailed once a month, whichever server notices', async () => {
        const { checkStorage } = require('../lib/storage');
        const Alert = require('../models/Alert');
        const { getSettings } = require('../lib/settings');
        await setSettings({ storage: { quotaMb: 64, alertAt: 0 } });
        const s = await getSettings();
        const u = await checkStorage(s, { force: true });
        assert.ok(u.used > 0 && u.pct > 0);
        assert.equal(await Alert.countDocuments({ _id: /^storage-/ }), 0, 'alert level 0 is off');
        // An alert level below today's usage; three servers check at once.
        const low = { ...s, storage: { quotaMb: 64, alertAt: u.pct / 2 } };
        await Promise.all([1, 2, 3].map(() => checkStorage(low, { force: true })));
        assert.equal(await Alert.countDocuments({ _id: /^storage-/ }), 1, 'claimed once');
    });

    it('photos over 1 MB are dropped on save; normal ones kept', async () => {
        const { token } = await register();
        const r = await api('POST', '/resumes', { token, body: { nickname: 'P', personal: { profilePic: photo(1_100_000), profilePicSource: photo(200_000) } } });
        assert.equal(r.status, 201);
        const got = (await api('GET', `/resumes/${r.body.data._id}`, { token })).body.data;
        assert.equal(got.personal.profilePic, '');
        assert.equal(got.personal.profilePicSource.length, photo(200_000).length);
    });

    it('a resume or profile over 300 KB of text is refused (photos not counted); bodies over 3 MB too', async () => {
        const { token } = await register();
        const long = 'x'.repeat(310 * 1024);
        const r = await api('POST', '/resumes', { token, body: { nickname: 'L', summary: long } });
        assert.equal(r.status, 413);
        assert.match(r.body.error, /too long to save/);
        const ok = await api('POST', '/resumes', { token, body: { nickname: 'P', summary: 'x'.repeat(250 * 1024), personal: { profilePic: photo(400_000), profilePicSource: photo(900_000) } } });
        assert.equal(ok.status, 201, 'photos do not count toward the text limit');
        const got = (await api('GET', `/resumes/${ok.body.data._id}`, { token })).body.data;
        assert.equal((await api('PUT', `/resumes/${got._id}`, { token, body: { summary: long, baseRev: got.rev } })).status, 413, 'updates too');
        assert.equal((await api('PUT', '/profile', { token, body: { summary: long } })).status, 400);
        const huge = await api('POST', '/resumes', { token, body: { nickname: 'H', personal: { profilePic: photo(3_500_000) } } });
        assert.equal(huge.status, 413, 'body limit');
    });

    it('an application snapshot keeps the cropped photo, not the original', async () => {
        const { token } = await register();
        const resume = (await api('POST', '/resumes', { token, body: { nickname: 'CV', summary: 'x', personal: { name: 'A', profilePic: photo(1000), profilePicSource: photo(5000), photoCrop: { zoom: 2 } } } })).body.data;
        const a = await api('POST', '/applications', { token, body: { job: { title: 'Engineer', organisation: 'Acme' }, status: 'applied', resume: resume._id } });
        assert.equal(a.status, 201, JSON.stringify(a.body));
        const Application = require('../models/Application');
        const app = await Application.findById(a.body.data._id).lean();
        assert.equal(app.snapshot.content.personal.profilePic, photo(1000));
        assert.ok(!app.snapshot.content.personal.profilePicSource);
        assert.ok(!app.snapshot.content.personal.photoCrop);
    });
});
