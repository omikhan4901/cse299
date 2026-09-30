/**
 * Loads a backup made by `npm run backup` into a database.
 *
 *   MONGO_URI="mongodb+srv://…/resumex" npm run restore -- ./backups/resumex-2026-10-01T02-00-00 [--replace]
 *
 * Without --replace it refuses to touch a collection that already has documents, so it can't
 * overwrite live data by accident. With --replace, each collection in the backup is emptied
 * and loaded again. Indexes are rebuilt by the app when it starts.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');
const { EJSON } = require('mongodb').BSON;

(async () => {
    const dir = process.argv[2];
    const replace = process.argv.includes('--replace');
    if (!process.env.MONGO_URI || !dir || !fs.existsSync(path.join(dir, 'backup.json'))) {
        console.error('Usage: MONGO_URI=… npm run restore -- <backup folder> [--replace]');
        process.exit(1);
    }
    const { collections } = JSON.parse(fs.readFileSync(path.join(dir, 'backup.json'), 'utf8'));
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    for (const name of collections) {
        const col = db.collection(name);
        const existing = await col.countDocuments();
        if (existing && !replace) {
            console.error(`${name} already has ${existing} documents. Nothing was changed. Use --replace to overwrite.`);
            process.exit(1);
        }
    }
    for (const name of collections) {
        const col = db.collection(name);
        if (replace) await col.deleteMany({});
        const lines = readline.createInterface({ input: fs.createReadStream(path.join(dir, `${name}.jsonl.gz`)).pipe(zlib.createGunzip()), crlfDelay: Infinity });
        let batch = [];
        let n = 0;
        for await (const line of lines) {
            if (!line.trim()) continue;
            batch.push(EJSON.parse(line, { relaxed: false }));
            if (batch.length >= 500) {
                await col.insertMany(batch, { ordered: false });
                n += batch.length;
                batch = [];
            }
        }
        if (batch.length) await col.insertMany(batch, { ordered: false });
        n += batch.length;
        console.log(`${name.padEnd(20)} ${n} documents`);
    }
    console.log('\nRestored.');
    await mongoose.disconnect();
})().catch((err) => {
    console.error('Restore failed:', err.message);
    process.exit(1);
});
