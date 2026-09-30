/**
 * Runs one account's creates one after another on this server (new resume, duplicate, new
 * application), so "check the limit, then insert" can't interleave: ten clicks at once make
 * exactly as many as the plan allows. Across two servers the after-insert checks
 * (lib/resumeLimit.js keptWithinLimit, routes/applications.js) are the backstop.
 */
const chains = new Map();

function withUserLock(userId, fn) {
    const key = String(userId);
    const prev = chains.get(key) || Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => {});
    chains.set(key, tail);
    tail.then(() => chains.get(key) === tail && chains.delete(key));
    return run;
}

/** Express wrapper: the handler runs inside the account's lock. */
const lockedByUser = (handler) => (req, res, next) => withUserLock(req.userId, () => handler(req, res, next));

module.exports = { withUserLock, lockedByUser };
