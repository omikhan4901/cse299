# Backups

MongoDB Atlas's free tier (M0) keeps **no backups**. If data is deleted by mistake, or the
cluster has a problem, only a copy you made yourself can bring it back. Take one **every
week during the beta**, and always before a big change (a migration, a new deploy of
something risky, deleting lots of accounts).

A backup is a folder of compressed files, one per collection, holding everything: accounts,
resumes, photos, applications, settings. **It contains personal data**, so keep it on your
own computer or a private drive, never in the repository, a public folder or a chat.

## 1. Once: a read-only user for backups

A backup only needs to read, so it gets its own user that can't change anything.

1. Open [cloud.mongodb.com](https://cloud.mongodb.com) → your project → **Database Access**
   (left menu, under Security).
2. **Add New Database User** → Authentication Method: **Password**.
   - Username: `resumex-backup`
   - Password: **Autogenerate Secure Password**, then **Copy** it somewhere safe (a password
     manager).
3. **Database User Privileges** → **Built-in Role** → **Only read any database**.
4. **Add User**.
5. Your connection string is the same as the app's (`MONGO_URI` in Cloud Run), with
   `resumex-backup` and the new password in place of the app's user and password:
   `mongodb+srv://resumex-backup:<password>@<your-cluster>.mongodb.net/resumex`

If you'll run the backup from your own computer, Atlas must allow its address:
**Network Access** → **Add IP Address** → **Add Current IP Address** → **Confirm**. (Remove
it again afterwards if you like.)

## 2. Taking a backup

You need [Node.js](https://nodejs.org) (version 22) and this repository on your computer.

```bash
cd server
npm ci
MONGO_URI="mongodb+srv://resumex-backup:<password>@<your-cluster>.mongodb.net/resumex" npm run backup -- ~/resumex-backups
```

On Windows PowerShell:

```powershell
cd server
npm ci
$env:MONGO_URI="mongodb+srv://resumex-backup:<password>@<your-cluster>.mongodb.net/resumex"; npm run backup -- $HOME\resumex-backups
```

It prints each collection with its number of documents and ends with
`Saved N documents … to <folder>`. The folder name has the date and time. Keep the **last
four** and delete older ones: the Privacy Policy promises that deleted data is gone from
backups within about five weeks.

## 3. Restoring

Restoring writes to a database, so it needs a user that can write (the app's own
`MONGO_URI` works).

- **To look at a backup safely**, restore it into a new, empty database: change the name at
  the end of the connection string (for example `…mongodb.net/resumex-check`) and run:

  ```bash
  MONGO_URI="mongodb+srv://<app-user>:<password>@<your-cluster>.mongodb.net/resumex-check" npm run restore -- ~/resumex-backups/resumex-2026-10-05T02-00-00
  ```

- **To bring the live database back** to a backup (this replaces what's there now):
  1. Admin console → **Site** → turn **Maintenance mode** on, so nobody saves meanwhile.
  2. Take a fresh backup first (step 2), in case you need today's data after all.
  3. Run the restore against the live database with `--replace`:

     ```bash
     MONGO_URI="<the app's MONGO_URI>" npm run restore -- ~/resumex-backups/<folder> --replace
     ```

  4. Turn maintenance mode off.

Without `--replace`, restore refuses to touch any collection that already has data, so it
can't overwrite anything by accident.
