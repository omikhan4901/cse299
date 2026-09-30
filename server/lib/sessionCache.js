/**
 * The few account fields every signed-in request checks (session version, ban), kept for
 * 30 seconds per server so an autosave costs one database read less (Atlas M0 allows about
 * 100 operations a second). Any change to an account on this server forgets its entry at
 * once (hooks in models/User.js); another instance picks it up within 30 seconds.
 */
const TTL = 30_000;
const MAX = 5000;
const cache = new Map();

const get = (id) => {
    const e = cache.get(String(id));
    if (!e) return null;
    if (Date.now() - e.at > TTL) {
        cache.delete(String(id));
        return null;
    }
    return e.user;
};
const put = (id, user) => {
    if (cache.size >= MAX) cache.delete(cache.keys().next().value);
    cache.set(String(id), { user, at: Date.now() });
};
const forget = (id) => id != null && cache.delete(String(id));
const clear = () => cache.clear();

module.exports = { get, put, forget, clear };
