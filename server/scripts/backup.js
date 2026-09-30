/**
 * A full copy of the database (Atlas M0 keeps no backups): every collection written to
 * `<collection>.jsonl.gz` in a new dated folder, one document per line in Extended JSON
 * (ids and dates kept exactly), so `npm run restore` can load it back.
 *
 *   MONGO_URI="mongodb+srv://backup-user:…@cluster…/resumex" npm run backup [-- ./backups]
 *
 * Use a read-only database user for this (docs/backups.md). Nothing is sent anywhere: the
 * files stay on the machine that runs it.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const mongoose = require('mongoose');
const { EJSON } = require('mongodb').BSON;

(async () => {
    if (!process.env.MONGO_URI) {
        console.error('Set MONGO_URI to the database to back up (see docs/backups.md).');
        process.exit(1);
    }
    const root = path.resolve(process.argv[2] || './backups');
    const dir = path.join(root, `resumex-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
    fs.mkdirSync(dir, { recursive: true });
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.'));
    let total = 0;
    for (const name of collections.sort()) {
        let n = 0;
        const cursor = db.collection(name).find({});
        const lines = Readable.from(
            (async function* () {
                for await (const doc of cursor) {
                    n++;
                    yield `${EJSON.stringify(doc, { relaxed: false })}\n`;
                }
            })()
        );
        await pipeline(lines, zlib.createGzip(), fs.createWriteStream(path.join(dir, `${name}.jsonl.gz`)));
        console.log(`${name.padEnd(20)} ${n} documents`);
        total += n;
    }
    fs.writeFileSync(path.join(dir, 'backup.json'), JSON.stringify({ at: new Date().toISOString(), collections, documents: total }, null, 2));
    console.log(`\nSaved ${total} documents from ${collections.length} collections to ${dir}`);
    await mongoose.disconnect();
})().catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
});
