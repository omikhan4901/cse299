/**
 * Express 4 doesn't catch errors thrown by async route handlers: the rejected
 * promise goes unhandled, the request hangs and Node exits. This makes every
 * handler's rejection go to the error middleware instead (what Express 5 does).
 * Require it before any routes are created.
 */
const Layer = require('express/lib/router/layer');

Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // error-handling middleware is called through handle_error
    try {
        const result = fn(req, res, next);
        if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
        next(err);
    }
};
