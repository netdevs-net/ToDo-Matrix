import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Server } from 'http';
import express from 'express';
// @ts-expect-error -- the server is plain JS with no types of its own.
import { createBlobRouter } from '../../server/blob.js';
import type { QuadrantType, SyncConfig, SyncState, Todo } from '../types';

/**
 * Node 18's fetch keeps connections alive, and server.close() waits for idle
 * sockets to go away on their own -- so a close here hangs for seconds, long
 * enough to time a test out. closeAllConnections drops them; it arrived in
 * Node 18.2, hence the optional call.
 */
function shutdown(server: Server): Promise<void> {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(() => resolve()));
}


/**
 * The whole feature, end to end, against the real Express router rather than a
 * stub: two browsers with the same passphrase, a conflicting write, and the
 * wrong passphrase. The unit tests cover the merge and the crypto separately;
 * this is the one that would have caught them being wired together wrongly.
 */

const TOKEN = 'round-trip-token';
const PASSPHRASE = 'correct horse battery staple';
const Q: QuadrantType = 'urgentImportant';

let server: Server;
let dataDir: string;
let config: SyncConfig;

// The sync modules cache the derived key through localStorage, which does not
// exist under Node. A Map is enough, and clearing it between tests is what
// makes a device "a browser that has never synced before".
const store = new Map<string, string>();
beforeAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
});

beforeEach(async () => {
  store.clear();
  if (server) await shutdown(server);
  if (dataDir) await rm(dataDir, { recursive: true, force: true });

  dataDir = await mkdtemp(join(tmpdir(), 'client-test-'));
  const app = express();
  const { router, ensureDataDir } = createBlobRouter({ dataDir, token: TOKEN });
  await ensureDataDir();
  app.use('/api/blob', router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as { port: number };
  config = { enabled: true, endpoint: `http://127.0.0.1:${port}/api/blob`, token: TOKEN };
});

afterAll(async () => {
  if (server) await shutdown(server);
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

/** Imported fresh so module-level state cannot leak between tests. */
async function client() {
  return import('./client');
}

function todo(id: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    text: id,
    completed: false,
    quadrant: Q,
    createdAt: 1,
    updatedAt: 1000,
    position: 0,
    timeSpent: 0,
    ...overrides,
  };
}

function state(todos: Todo[]): SyncState {
  return {
    todos,
    settings: { darkMode: true } as SyncState['settings'],
    quadrantConfigs: [{ id: Q } as SyncState['quadrantConfigs'][number]],
    meta: { settingsUpdatedAt: 1, quadrantConfigsUpdatedAt: 1 },
  };
}

const ids = (s: SyncState) => s.todos.map((t) => t.id).sort();

describe('two devices, one passphrase', () => {
  it('carries a todo from one browser to the other', async () => {
    const { syncOnce, unlock } = await client();

    const a = await unlock(config, PASSPHRASE);
    let deviceA = state([todo('from-a')]);
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });

    // A different browser: nothing cached, same passphrase.
    store.clear();
    const b = await unlock(config, PASSPHRASE);
    expect(b.salt).toBe(a.salt);

    let deviceB = state([todo('from-b', { updatedAt: 2000 })]);
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });
    expect(ids(deviceB)).toEqual(['from-a', 'from-b']);

    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });
    expect(ids(deviceA)).toEqual(['from-a', 'from-b']);
  });

  it('reuses the salt the first device stored', async () => {
    const { syncOnce, unlock } = await client();
    const a = await unlock(config, PASSPHRASE);
    let s = state([todo('x')]);
    await syncOnce(config, a.key, a.salt, s, (m) => { s = m; });

    store.clear();
    // A second salt would mean a second key, and the blob would be unreadable.
    expect((await unlock(config, PASSPHRASE)).salt).toBe(a.salt);
  });

  it('settles instead of two devices writing to each other forever', async () => {
    const { syncOnce, unlock } = await client();
    const version = async () =>
      (
        await fetch(config.endpoint, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(
          (r) => r.json() as Promise<{ version: number }>
        )
      ).version;

    // The states have to differ on a field whose timestamps tie, which is what
    // the loop needed: settingsUpdatedAt is equal while settings are not.
    const a = await unlock(config, PASSPHRASE);
    let deviceA: SyncState = {
      ...state([todo('x')]),
      settings: { darkMode: true } as SyncState['settings'],
    };
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });

    store.clear();
    const b = await unlock(config, PASSPHRASE);
    let deviceB: SyncState = {
      ...state([todo('x')]),
      settings: { darkMode: false } as SyncState['settings'],
    };
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });

    // Let them exchange until they should have agreed...
    for (let i = 0; i < 3; i += 1) {
      await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });
      await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });
    }

    // ...then prove that further syncs write nothing at all.
    const settled = await version();
    for (let i = 0; i < 3; i += 1) {
      await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });
      await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });
    }

    expect(await version()).toBe(settled);
    expect(deviceA).toEqual(deviceB);
  });

  it('propagates a delete rather than letting the other device revive it', async () => {
    const { syncOnce, unlock } = await client();
    const now = Date.now();

    const a = await unlock(config, PASSPHRASE);
    let deviceA = state([todo('shared')]);
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });

    store.clear();
    const b = await unlock(config, PASSPHRASE);
    let deviceB = state([todo('shared')]);
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });

    deviceA = {
      ...deviceA,
      todos: deviceA.todos.map((t) =>
        t.id === 'shared' ? { ...t, deletedAt: now, updatedAt: now } : t
      ),
    };
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });

    // B edited the same todo, but earlier than the delete.
    deviceB = {
      ...deviceB,
      todos: deviceB.todos.map((t) =>
        t.id === 'shared' ? { ...t, text: 'stale edit', updatedAt: now - 5000 } : t
      ),
    };
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });

    expect(deviceB.todos.find((t) => t.id === 'shared')?.deletedAt).toBe(now);
  });

  it('keeps both edits when two devices write between syncs', async () => {
    const { syncOnce, unlock } = await client();

    const a = await unlock(config, PASSPHRASE);
    let deviceA = state([todo('base')]);
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });

    store.clear();
    const b = await unlock(config, PASSPHRASE);
    let deviceB = state([todo('base')]);
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });

    // Both add something before either syncs again.
    deviceA = { ...deviceA, todos: [...deviceA.todos, todo('only-a', { updatedAt: 3000 })] };
    deviceB = { ...deviceB, todos: [...deviceB.todos, todo('only-b', { updatedAt: 3000 })] };

    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });

    expect(ids(deviceA)).toEqual(['base', 'only-a', 'only-b']);
    expect(ids(deviceB)).toEqual(['base', 'only-a', 'only-b']);
  });
});

describe('failures a user can actually hit', () => {
  it('rejects the wrong passphrase instead of overwriting the blob', async () => {
    const { syncOnce, unlock } = await client();
    const a = await unlock(config, PASSPHRASE);
    let s = state([todo('precious')]);
    await syncOnce(config, a.key, a.salt, s, (m) => { s = m; });

    store.clear();
    await expect(unlock(config, 'wrong passphrase')).rejects.toThrow(/passphrase does not match/);

    // The stored blob must still open with the original key.
    store.clear();
    const again = await unlock(config, PASSPHRASE);
    let restored = state([]);
    await syncOnce(config, again.key, again.salt, restored, (m) => { restored = m; });
    expect(ids(restored)).toEqual(['precious']);
  });

  it('reports a bad token clearly', async () => {
    const { unlock } = await client();
    await expect(unlock({ ...config, token: 'nope' }, PASSPHRASE)).rejects.toThrow(/token rejected/);
  });

  it('reports a server with sync switched off', async () => {
    const { unlock } = await client();
    const app = express();
    const { router } = createBlobRouter({ dataDir, token: undefined });
    app.use('/api/blob', router);
    const off = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = off.address() as { port: number };

    await expect(
      unlock({ ...config, endpoint: `http://127.0.0.1:${port}/api/blob` }, PASSPHRASE)
    ).rejects.toThrow(/not configured/);

    await shutdown(off);
  });
});

describe('an idle device', () => {
  it('stops calling apply once there is nothing new', async () => {
    const { syncOnce, unlock } = await client();
    const a = await unlock(config, PASSPHRASE);

    let current = state([todo('x')]);
    const apply = (merged: SyncState) => { current = merged; };

    // First sync establishes the blob; after that nothing changes.
    await syncOnce(config, a.key, a.salt, current, apply);

    let applied = 0;
    const counting = (merged: SyncState) => { applied += 1; current = merged; };
    for (let i = 0; i < 5; i += 1) {
      await syncOnce(config, a.key, a.salt, current, counting);
    }

    // apply() replaces the app's state objects. React keys the debounce that
    // schedules the next sync on those objects, so applying an unchanged
    // snapshot re-arms the timer and the device syncs again forever -- which
    // is what production did, one request every four seconds with nothing
    // happening.
    expect(applied).toBe(0);
  });

  it('still applies when the other device changed something', async () => {
    const { syncOnce, unlock } = await client();
    const a = await unlock(config, PASSPHRASE);

    let deviceA = state([todo('x')]);
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { deviceA = m; });

    store.clear();
    const b = await unlock(config, PASSPHRASE);
    let deviceB = state([todo('x')]);
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });
    deviceB = { ...deviceB, todos: [...deviceB.todos, todo('from-b', { updatedAt: 9000 })] };
    await syncOnce(config, b.key, b.salt, deviceB, (m) => { deviceB = m; });

    let applied = 0;
    await syncOnce(config, a.key, a.salt, deviceA, (m) => { applied += 1; deviceA = m; });

    expect(applied).toBe(1);
    expect(ids(deviceA)).toEqual(['from-b', 'x']);
  });
});
