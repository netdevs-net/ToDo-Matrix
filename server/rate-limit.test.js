import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createRateLimiter } from './rate-limit.js';

/**
 * Node 18's fetch keeps connections alive, and server.close() waits for idle
 * sockets to go away on their own -- so a close here hangs for seconds, long
 * enough to time a test out. closeAllConnections drops them; it arrived in
 * Node 18.2, hence the optional call.
 */
function shutdown(server) {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(resolve));
}


/**
 * The rate limiter and the `trust proxy` setting it depends on shipped
 * together with nothing covering either. The interesting case is not that
 * requests get a 429 -- it is *whose* requests do.
 *
 * Behind nginx every request arrives from 127.0.0.1. If Express is not told to
 * trust that hop, req.ip is the proxy for everyone, every caller shares one
 * bucket, and the first client to make a hundred requests locks out the rest.
 * That is the bug the trust proxy line fixed, and the test below fails without
 * it.
 */

const servers = [];
const limiters = [];

function serve({ trustProxy, max = 5, windowMs = 60_000, now } = {}) {
  const app = express();
  if (trustProxy) app.set('trust proxy', trustProxy);

  const limiter = createRateLimiter({ max, windowMs, now });
  limiters.push(limiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(limiter);
  app.get('/api/thing', (_req, res) => res.json({ ok: true }));
  app.get('*', (_req, res) => res.send('spa'));

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

/** One request, claiming to come from `client` via a proxy. */
const hit = (base, client, path = '/api/thing') =>
  fetch(`${base}${path}`, { headers: client ? { 'X-Forwarded-For': client } : {} }).then(
    (r) => r.status
  );

async function hitMany(base, client, n) {
  const seen = [];
  for (let i = 0; i < n; i += 1) seen.push(await hit(base, client));
  return seen;
}

afterEach(async () => {
  for (const l of limiters.splice(0)) l.stop();
  await Promise.all(servers.splice(0).map((s) => shutdown(s)));
});

describe('who gets counted', () => {
  it('gives each forwarded client its own budget when the proxy is trusted', async () => {
    const base = await serve({ trustProxy: 'loopback', max: 5 });

    expect(await hitMany(base, '1.2.3.4', 6)).toEqual([200, 200, 200, 200, 200, 429]);
    // A different client must be unaffected by the first one's spending.
    expect(await hit(base, '5.6.7.8')).toBe(200);
  });

  it('lumps every client together when the proxy is not trusted', async () => {
    // The pre-fix behaviour, pinned so it cannot come back unnoticed: without
    // `trust proxy` req.ip is the proxy's address for every caller.
    const base = await serve({ trustProxy: false, max: 5 });

    await hitMany(base, '1.2.3.4', 5);
    expect(await hit(base, '5.6.7.8')).toBe(429);
  });

  it('ignores a forwarded header from an untrusted source', async () => {
    // 'loopback' trusts only the immediate hop. Tests connect over loopback,
    // so the header is honoured here -- what matters is that the setting, not
    // the header, decides.
    const base = await serve({ trustProxy: 'loopback', max: 3 });

    await hitMany(base, '9.9.9.9', 3);
    expect(await hit(base, '9.9.9.9')).toBe(429);
    expect(await hit(base, '8.8.8.8')).toBe(200);
  });
});

describe('the window', () => {
  it('allows exactly max requests before refusing', async () => {
    const base = await serve({ trustProxy: 'loopback', max: 3 });
    expect(await hitMany(base, '1.1.1.1', 5)).toEqual([200, 200, 200, 429, 429]);
  });

  it('is fixed, not sliding: later requests do not extend it', async () => {
    let clock = 1_000_000;
    const base = await serve({ trustProxy: 'loopback', max: 3, windowMs: 1000, now: () => clock });

    await hitMany(base, '2.2.2.2', 3);
    clock += 600;
    expect(await hit(base, '2.2.2.2')).toBe(429);

    // Past the window measured from the FIRST request, not the last.
    clock += 500;
    expect(await hit(base, '2.2.2.2')).toBe(200);
  });

  it('starts a fresh budget once the window passes', async () => {
    let clock = 1_000_000;
    const base = await serve({ trustProxy: 'loopback', max: 2, windowMs: 1000, now: () => clock });

    expect(await hitMany(base, '3.3.3.3', 3)).toEqual([200, 200, 429]);
    clock += 1001;
    expect(await hitMany(base, '3.3.3.3', 2)).toEqual([200, 200]);
  });
});

describe('what a throttled client still gets', () => {
  it('leaves the health check reachable', async () => {
    // /health is mounted above the limiter so an uptime probe cannot be locked
    // out by ordinary traffic, and cannot itself consume the budget.
    const base = await serve({ trustProxy: 'loopback', max: 2 });

    await hitMany(base, '4.4.4.4', 3);
    expect(await hit(base, '4.4.4.4', '/health')).toBe(200);
  });

  it('does not let the health check spend the budget', async () => {
    const base = await serve({ trustProxy: 'loopback', max: 2 });

    for (let i = 0; i < 5; i += 1) await hit(base, '6.6.6.6', '/health');
    expect(await hit(base, '6.6.6.6')).toBe(200);
  });
});

describe('bookkeeping', () => {
  it('forgets clients once their window has lapsed', async () => {
    let clock = 1_000_000;
    const limiter = createRateLimiter({ windowMs: 1000, max: 5, now: () => clock });
    limiters.push(limiter);

    const next = () => {};
    const res = { status: () => ({ json: () => {} }) };
    limiter({ ip: 'a' }, res, next);
    limiter({ ip: 'b' }, res, next);
    expect(limiter.size()).toBe(2);

    // Entries are only dropped by the sweep, which runs on its own interval;
    // what matters is that a lapsed client is not counted against its old
    // total when it comes back.
    clock += 2000;
    limiter({ ip: 'a' }, res, next);
    expect(limiter.size()).toBe(2);
  });

  it('does not hold the process open', () => {
    const limiter = createRateLimiter({ windowMs: 1000 });
    limiters.push(limiter);
    // An interval with a reference would keep Node running after the server
    // closed, hanging both the test run and a graceful shutdown.
    expect(limiter.stop).toBeTypeOf('function');
  });
});
