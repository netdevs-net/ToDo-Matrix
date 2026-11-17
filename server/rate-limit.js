/**
 * Fixed-window rate limiting, per client address.
 *
 * Lifted out of server.js so it can be tested: that file calls app.listen() at
 * import time, so nothing in it could be exercised without starting a server
 * on a real port.
 *
 * This is a brake, not a defence. The counters live in this process's memory,
 * so they reset on restart and are not shared between replicas. What it buys
 * is that one client looping on the sync API cannot keep the server busy
 * indefinitely.
 *
 * Which address a request is attributed to is decided by Express's `trust
 * proxy` setting, not here -- see the note in server.js. Get that wrong and
 * every request behind a reverse proxy lands in one bucket, so the first
 * hundred requests from anyone exhaust the limit for everyone.
 */

export const RATE_LIMIT_WINDOW = 60_000;
export const RATE_LIMIT_MAX = 100;

export function createRateLimiter({
  windowMs = RATE_LIMIT_WINDOW,
  max = RATE_LIMIT_MAX,
  now = Date.now,
} = {}) {
  const hits = new Map();

  const middleware = (req, res, next) => {
    const ip = req.ip;
    const at = now();
    const entry = hits.get(ip);

    if (!entry) {
      hits.set(ip, { count: 1, timestamp: at });
      return next();
    }

    if (at - entry.timestamp > windowMs) {
      // Window expired: start a new one rather than topping up the old count.
      hits.set(ip, { count: 1, timestamp: at });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    // Keep the original timestamp, so the window is fixed from the first
    // request rather than sliding forward with every one that follows.
    hits.set(ip, { count: entry.count + 1, timestamp: entry.timestamp });
    return next();
  };

  const timer = setInterval(() => {
    const at = now();
    for (const [ip, entry] of hits.entries()) {
      if (at - entry.timestamp > windowMs) hits.delete(ip);
    }
  }, windowMs);

  // Without this the interval alone keeps Node alive, so a test run or a
  // graceful shutdown would hang waiting for a timer that never matters.
  timer.unref?.();

  middleware.stop = () => clearInterval(timer);
  middleware.size = () => hits.size;

  return middleware;
}
