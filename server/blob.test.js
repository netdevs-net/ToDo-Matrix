import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import express from 'express';
import { createBlobRouter } from './blob.js';

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
 * The server is the one part a self-hoster exposes to the internet, so these
 * cover the two jobs it actually has: refusing everyone without the token, and
 * never losing a write to a race. Everything else about the data is the
 * browser's problem -- the server cannot read it.
 */

const TOKEN = 'test-token-0123456789';

let dataDir;
let server;
let base;

async function start(token = TOKEN) {
  dataDir = await mkdtemp(join(tmpdir(), 'blob-test-'));
  const app = express();
  const { router, ensureDataDir } = createBlobRouter({ dataDir, token });
  await ensureDataDir();
  app.use('/api/blob', router);

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/blob`;
}

const auth = (extra = {}) => ({ Authorization: `Bearer ${TOKEN}`, ...extra });
const body = (overrides = {}) =>
  JSON.stringify({ salt: 's', iv: 'i', ciphertext: 'c', ...overrides });

const put = (version, overrides = {}, token = TOKEN) =>
  fetch(base, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'If-Match': String(version),
    },
    body: body(overrides),
  });

afterEach(async () => {
  if (server) await shutdown(server);
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  server = undefined;
  dataDir = undefined;
});

describe('authentication', () => {
  beforeEach(() => start());

  it('rejects a request with no token', async () => {
    expect((await fetch(base)).status).toBe(401);
  });

  it('rejects a wrong token', async () => {
    expect((await fetch(base, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
  });

  it('rejects a token that is a prefix of the real one', async () => {
    const short = TOKEN.slice(0, -1);
    expect((await fetch(base, { headers: { Authorization: `Bearer ${short}` } })).status).toBe(401);
  });

  it('rejects a non-Bearer scheme', async () => {
    expect((await fetch(base, { headers: { Authorization: `Basic ${TOKEN}` } })).status).toBe(401);
  });

  it('refuses writes without a token', async () => {
    expect((await put(0, {}, 'wrong')).status).toBe(401);
    expect(await readdir(dataDir)).toEqual([]);
  });

  it('accepts the right token', async () => {
    expect((await fetch(base, { headers: auth() })).status).toBe(404);
  });
});

describe('an unconfigured server', () => {
  beforeEach(() => start(null));

  it('fails closed rather than serving an open endpoint', async () => {
    // A deploy that forgot SYNC_TOKEN must not become a public read/write store.
    expect((await fetch(base, { headers: auth() })).status).toBe(503);
    expect((await put(0)).status).toBe(503);
  });
});

describe('reading', () => {
  beforeEach(() => start());

  it('reports an empty store as version 0', async () => {
    const res = await fetch(base, { headers: auth() });
    expect(res.status).toBe(404);
    expect((await res.json()).version).toBe(0);
  });

  it('returns exactly what was stored', async () => {
    await put(0, { salt: 'SALT', iv: 'IV', ciphertext: 'CIPHER' });
    const stored = await (await fetch(base, { headers: auth() })).json();
    expect(stored).toEqual({ version: 1, salt: 'SALT', iv: 'IV', ciphertext: 'CIPHER' });
  });
});

describe('optimistic concurrency', () => {
  beforeEach(() => start());

  it('requires an If-Match header', async () => {
    const res = await fetch(base, {
      method: 'PUT',
      headers: auth({ 'Content-Type': 'application/json' }),
      body: body(),
    });
    expect(res.status).toBe(428);
  });

  it('rejects a non-numeric If-Match', async () => {
    expect((await put('banana')).status).toBe(428);
  });

  it('increments the version on each accepted write', async () => {
    expect((await (await put(0)).json()).version).toBe(1);
    expect((await (await put(1)).json()).version).toBe(2);
    expect((await (await put(2)).json()).version).toBe(3);
  });

  it('refuses a stale write and hands back the winning blob', async () => {
    await put(0, { ciphertext: 'first' });
    const res = await put(0, { ciphertext: 'second' });

    expect(res.status).toBe(412);
    // Returning the current blob lets the loser merge and retry in one round
    // trip instead of two.
    expect(await res.json()).toEqual({ version: 1, salt: 's', iv: 'i', ciphertext: 'first' });
  });

  it('leaves the stored blob untouched after a stale write', async () => {
    await put(0, { ciphertext: 'keep' });
    await put(0, { ciphertext: 'discard' });
    expect((await (await fetch(base, { headers: auth() })).json()).ciphertext).toBe('keep');
  });

  it('serialises concurrent writes so exactly one wins', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => put(0, { ciphertext: `writer-${i}` }))
    );
    const ok = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 412);

    expect(ok).toHaveLength(1);
    expect(conflicts).toHaveLength(9);
    expect((await (await fetch(base, { headers: auth() })).json()).version).toBe(1);
  });

  it('never leaves a partial file behind', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => put(i, { ciphertext: `w${i}` })));
    // The temp-file-plus-rename write means a reader can only ever see a whole
    // blob; no .tmp files should survive either.
    const files = await readdir(dataDir);
    expect(files).toEqual(['blob.json']);
    const raw = await readFile(join(dataDir, 'blob.json'), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('validation', () => {
  beforeEach(() => start());

  it('rejects a body that is missing fields', async () => {
    const res = await fetch(base, {
      method: 'PUT',
      headers: auth({ 'Content-Type': 'application/json', 'If-Match': '0' }),
      body: JSON.stringify({ salt: 's' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-string fields', async () => {
    expect((await put(0, { ciphertext: 12345 })).status).toBe(400);
  });

  it('stores nothing when the body is rejected', async () => {
    await put(0, { ciphertext: null });
    expect(await readdir(dataDir)).toEqual([]);
  });
});
