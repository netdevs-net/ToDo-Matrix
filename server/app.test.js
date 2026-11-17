import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createApp } from './app.js';

/**
 * The real app, assembled exactly as server.js assembles it.
 *
 * The pieces have their own tests; what is checked here is the wiring those
 * tests cannot see -- the trust proxy setting, the security headers, and the
 * order things are mounted in. All three have been wrong at some point, and
 * all three are invisible until a request goes through the whole stack.
 */

const started = [];
const dirs = [];

async function serve({ token = 'test-token', withStatic = true } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'app-test-'));
  dirs.push(dataDir);

  let staticDir;
  if (withStatic) {
    staticDir = join(dataDir, 'dist');
    await mkdir(staticDir, { recursive: true });
    await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>ToDo Matrix</title>');
    await writeFile(join(staticDir, 'app.js'), 'console.log(1)');
  }

  const app = await createApp({ dataDir: join(dataDir, 'data'), token, staticDir });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  started.push({ server, app });

  return { base: `http://127.0.0.1:${server.address().port}`, token };
}

afterEach(async () => {
  for (const { server, app } of started.splice(0)) {
    app.stopRateLimiter();
    await new Promise((r) => server.close(r));
  }
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('proxy handling', () => {
  it('trusts a loopback proxy, so clients are counted separately', async () => {
    // Behind nginx every request arrives from 127.0.0.1. Without this setting
    // req.ip is the proxy for everyone and one caller's burst locks out the
    // rest -- the whole reason the setting is there.
    const { base } = await serve();

    const burst = [];
    for (let i = 0; i < 101; i += 1) {
      burst.push(
        await fetch(`${base}/api/blob`, {
          headers: { 'X-Forwarded-For': '1.2.3.4', Authorization: 'Bearer nope' },
        }).then((r) => r.status)
      );
    }
    expect(burst.at(-1)).toBe(429);

    const other = await fetch(`${base}/api/blob`, {
      headers: { 'X-Forwarded-For': '5.6.7.8', Authorization: 'Bearer nope' },
    });
    expect(other.status).not.toBe(429);
  });

  it('leaves the app reachable for a client that tripped the limit', async () => {
    const { base } = await serve();
    const client = { 'X-Forwarded-For': '9.8.7.6' };

    for (let i = 0; i < 101; i += 1) {
      await fetch(`${base}/api/blob`, { headers: { ...client, Authorization: 'Bearer nope' } });
    }

    expect((await fetch(`${base}/api/blob`, { headers: client })).status).toBe(429);
    // Static files and /health are mounted above the limiter on purpose.
    expect((await fetch(`${base}/health`, { headers: client })).status).toBe(200);
    expect((await fetch(`${base}/`, { headers: client })).status).toBe(200);
  });
});

describe('security headers', () => {
  it('sends a script policy with no unsafe-inline or unsafe-eval', async () => {
    const { base } = await serve();
    const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    // Styles legitimately need it; scripts must not have it, because the
    // cached sync key is what script injection would steal.
    expect(csp.match(/script-src[^;]*/)[0]).not.toContain('unsafe-inline');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('still allows inline styles, which React and dnd-kit need', async () => {
    const { base } = await serve();
    const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');
    expect(csp.match(/style-src[^;]*/)[0]).toContain("'unsafe-inline'");
  });
});

describe('mount order', () => {
  it('answers the sync API rather than falling through to the SPA', async () => {
    // The SPA fallback matches every GET, so a blob router mounted after it
    // would never be reached and sync would silently return HTML.
    const { base } = await serve();
    const res = await fetch(`${base}/api/blob`);

    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('serves index.html for an unknown path', async () => {
    const { base } = await serve();
    const res = await fetch(`${base}/some/deep/route`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('ToDo Matrix');
  });

  it('serves a real asset rather than the fallback', async () => {
    const { base } = await serve();
    expect(await (await fetch(`${base}/app.js`)).text()).toBe('console.log(1)');
  });

  it('does not cache the HTML, which names the hashed assets', async () => {
    const { base } = await serve();
    expect((await fetch(`${base}/`)).headers.get('cache-control')).toContain('no-cache');
  });
});

describe('an unconfigured deployment', () => {
  it('serves the app but refuses sync', async () => {
    // null, not undefined: undefined would fall back to the default above.
    const { base } = await serve({ token: null });

    expect((await fetch(`${base}/`)).status).toBe(200);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/api/blob`)).status).toBe(503);
  });
});
