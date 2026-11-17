import { describe, expect, it } from 'vitest';
import {
  TOMBSTONE_TTL_MS,
  ensurePositions,
  mergeStates,
  nextPosition,
  purgeTombstones,
  reindexQuadrant,
  sortTodos,
} from './merge';
import type { QuadrantType, SyncState, Todo } from '../types';

/**
 * The merge is the only place where a bug silently loses a todo: it runs on
 * every sync, on data the server cannot read, and a wrong answer overwrites the
 * blob that both devices then adopt. Two real bugs have shipped from here --
 * order was dropped entirely, and tied timestamps made devices push to each
 * other forever -- so the properties below are the ones worth asserting:
 * convergence (both devices reach the same state) and fixed point (re-merging
 * that state changes nothing). Everything else is detail.
 */

const Q: QuadrantType = 'urgentImportant';
const OTHER: QuadrantType = 'importantNotUrgent';

function todo(id: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    text: id,
    completed: false,
    quadrant: Q,
    createdAt: 100,
    updatedAt: 1000,
    position: 0,
    timeSpent: 0,
    ...overrides,
  };
}

/** A todo as written by a client that predates `position`. */
function legacyTodo(id: string, overrides: Partial<Todo> = {}): Todo {
  const { position: _drop, ...rest } = todo(id, overrides);
  return rest as Todo;
}

function state(todos: Todo[], overrides: Partial<SyncState> = {}): SyncState {
  return {
    todos,
    settings: { darkMode: false } as SyncState['settings'],
    quadrantConfigs: [],
    meta: { settingsUpdatedAt: 0, quadrantConfigsUpdatedAt: 0 },
    ...overrides,
  };
}

/** The visible sequence, which is what a user notices when it changes. */
const seq = (s: SyncState) => s.todos.map((t) => t.id).join(',');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

describe('convergence', () => {
  it('produces the same result whichever side is local', () => {
    const a = state([todo('a', { position: 0 }), todo('b', { position: 1 })]);
    const b = state([todo('b', { position: 1 }), todo('a', { position: 0 })]);
    expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
  });

  it('converges when two devices edit the same todo at the same instant', () => {
    const a = state([todo('x', { updatedAt: 500, text: 'from A' })]);
    const b = state([todo('x', { updatedAt: 500, text: 'from B' })]);
    expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
  });

  it('converges when settings tie, which is the common case at 0', () => {
    // settingsUpdatedAt is 0 on any device that has not touched its settings
    // since sync was added, so a tie here is normal rather than rare.
    const a = state([], { settings: { darkMode: true } as SyncState['settings'] });
    const b = state([], { settings: { darkMode: false } as SyncState['settings'] });
    expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
  });

  it('converges when quadrantConfigs tie', () => {
    const a = state([], { quadrantConfigs: [{ id: Q, title: 'A' } as never] });
    const b = state([], { quadrantConfigs: [{ id: Q, title: 'B' } as never] });
    expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
  });

  it('still lets a newer timestamp beat the content tiebreak', () => {
    const a = state([], {
      settings: { darkMode: true } as SyncState['settings'],
      meta: { settingsUpdatedAt: 100, quadrantConfigsUpdatedAt: 0 },
    });
    const b = state([], {
      settings: { darkMode: false } as SyncState['settings'],
      meta: { settingsUpdatedAt: 50, quadrantConfigsUpdatedAt: 0 },
    });
    expect(mergeStates(a, b).settings).toEqual({ darkMode: true });
    expect(mergeStates(b, a).settings).toEqual({ darkMode: true });
  });
});

describe('fixed point', () => {
  it('re-merging a merged state changes nothing', () => {
    const a = state([todo('x', { updatedAt: 500, text: 'A' })], {
      settings: { darkMode: true } as SyncState['settings'],
    });
    const b = state([todo('x', { updatedAt: 500, text: 'B' })], {
      settings: { darkMode: false } as SyncState['settings'],
    });
    const merged = mergeStates(a, b);
    // Each device pulls the merged blob and merges it into its own copy. If
    // either produces something different it will push again, and the two
    // devices write to each other forever.
    expect(mergeStates(a, merged)).toEqual(merged);
    expect(mergeStates(b, merged)).toEqual(merged);
  });

  it('settles after one exchange instead of ping-ponging', () => {
    let a = state([], { settings: { darkMode: true } as SyncState['settings'] });
    let b = state([], { settings: { darkMode: false } as SyncState['settings'] });
    let server = a;

    for (let i = 0; i < 6; i += 1) {
      a = mergeStates(a, server);
      server = a;
      b = mergeStates(b, server);
      server = b;
    }

    expect(a).toEqual(b);
    expect(same(mergeStates(a, server), server)).toBe(true);
  });

  it('merging a state with itself is a no-op', () => {
    const a = state([todo('x'), todo('y', { position: 1 })]);
    expect(mergeStates(a, a)).toEqual(mergeStates(mergeStates(a, a), a));
  });
});

describe('last write wins', () => {
  it('keeps the newer edit', () => {
    const a = state([todo('x', { updatedAt: 100, text: 'old' })]);
    const b = state([todo('x', { updatedAt: 200, text: 'new' })]);
    expect(mergeStates(a, b).todos[0].text).toBe('new');
    expect(mergeStates(b, a).todos[0].text).toBe('new');
  });

  it('unions todos that only one side has', () => {
    const a = state([todo('x'), todo('y')]);
    const b = state([todo('z')]);
    expect(mergeStates(a, b).todos.map((t) => t.id).sort()).toEqual(['x', 'y', 'z']);
  });

  it('lets a delete beat an older edit', () => {
    const now = Date.now();
    const a = state([todo('x', { updatedAt: now - 1000, text: 'edited' })]);
    const b = state([todo('x', { updatedAt: now, deletedAt: now })]);
    expect(mergeStates(a, b).todos[0].deletedAt).toBeDefined();
    expect(mergeStates(b, a).todos[0].deletedAt).toBeDefined();
  });

  it('lets an edit after a delete revive the todo', () => {
    // Deliberate: the rule is last-write-wins, not delete-always-wins, so a
    // device that edits after seeing the delete gets its edit back.
    const now = Date.now();
    const a = state([todo('x', { updatedAt: now + 1000, text: 'revived' })]);
    const b = state([todo('x', { updatedAt: now, deletedAt: now })]);
    expect(mergeStates(a, b).todos[0].deletedAt).toBeUndefined();
  });

  it('resolves settings and configs on their own timestamps', () => {
    const a = state([], {
      settings: { tag: 'newer-settings' } as never,
      quadrantConfigs: [{ id: Q, tag: 'older-config' } as never],
      meta: { settingsUpdatedAt: 500, quadrantConfigsUpdatedAt: 10 },
    });
    const b = state([], {
      settings: { tag: 'older-settings' } as never,
      quadrantConfigs: [{ id: Q, tag: 'newer-config' } as never],
      meta: { settingsUpdatedAt: 100, quadrantConfigsUpdatedAt: 900 },
    });
    const merged = mergeStates(a, b);
    expect((merged.settings as never as { tag: string }).tag).toBe('newer-settings');
    expect((merged.quadrantConfigs[0] as never as { tag: string }).tag).toBe('newer-config');
    expect(merged.meta).toEqual({ settingsUpdatedAt: 500, quadrantConfigsUpdatedAt: 900 });
  });
});

describe('ordering', () => {
  it('gives both directions the same sequence', () => {
    const a = state([todo('a', { position: 0 }), todo('b', { position: 1 }), todo('c', { position: 2 })]);
    const b = state([todo('c', { position: 2 }), todo('a', { position: 0 }), todo('b', { position: 1 })]);
    expect(seq(mergeStates(a, b))).toBe('a,b,c');
    expect(seq(mergeStates(b, a))).toBe('a,b,c');
  });

  it('carries a reorder made on one device to the other', () => {
    // A drags c to the front; the move stamps updatedAt on what it touched.
    const a = state([
      todo('c', { position: 0, updatedAt: 2000 }),
      todo('a', { position: 1, updatedAt: 2000 }),
      todo('b', { position: 2, updatedAt: 2000 }),
    ]);
    const b = state([todo('a', { position: 0 }), todo('b', { position: 1 }), todo('c', { position: 2 })]);
    expect(seq(mergeStates(a, b))).toBe('c,a,b');
    expect(seq(mergeStates(b, a))).toBe('c,a,b');
  });

  it('does not let a reorder clobber an unrelated edit', () => {
    const a = state([
      todo('c', { position: 0, updatedAt: 2000 }),
      todo('a', { position: 1, updatedAt: 2000 }),
      todo('b', { position: 2, updatedAt: 2000 }),
    ]);
    const b = state([
      todo('a', { position: 0 }),
      todo('b', { position: 1, updatedAt: 3000, text: 'edited on B' }),
      todo('c', { position: 2 }),
    ]);
    expect(mergeStates(a, b).todos.find((t) => t.id === 'b')?.text).toBe('edited on B');
  });

  it('produces one total order even when positions are equal', () => {
    const a = state([todo('a'), todo('b'), todo('c')]);
    const b = state([todo('c'), todo('b'), todo('a')]);
    expect(seq(mergeStates(a, b))).toBe(seq(mergeStates(b, a)));
  });

  it('sorts by position, then createdAt, then id', () => {
    const out = sortTodos([
      todo('z', { position: 1 }),
      todo('b', { position: 0, createdAt: 50 }),
      todo('a', { position: 0, createdAt: 50 }),
      todo('y', { position: 0, createdAt: 10 }),
    ]);
    expect(out.map((t) => t.id)).toEqual(['y', 'a', 'b', 'z']);
  });
});

describe('reindexQuadrant', () => {
  it('renumbers from array order and stamps only what moved', () => {
    const before = [todo('a', { position: 0 }), todo('b', { position: 1 }), todo('c', { position: 2 })];
    const moved = [before[2], before[0], before[1]];
    const out = reindexQuadrant(moved, Q, 5000);

    expect(out.map((t) => [t.id, t.position])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
    expect(out.find((t) => t.id === 'c')?.updatedAt).toBe(5000);
  });

  it('leaves other quadrants untouched', () => {
    const out = reindexQuadrant([todo('a', { position: 3 }), todo('z', { quadrant: OTHER, position: 7 })], Q, 5000);
    expect(out.find((t) => t.id === 'z')?.position).toBe(7);
    expect(out.find((t) => t.id === 'a')?.position).toBe(0);
  });

  it('skips tombstones so they do not consume a rank', () => {
    const out = reindexQuadrant([todo('d', { deletedAt: 9000 }), todo('a', { position: 5 })], Q, 5000);
    expect(out.find((t) => t.id === 'a')?.position).toBe(0);
  });
});

describe('nextPosition', () => {
  it('appends after the highest rank in the quadrant', () => {
    expect(nextPosition([todo('a', { position: 0 }), todo('b', { position: 4 })], Q)).toBe(5);
  });

  it('starts at 0 in an empty quadrant', () => {
    expect(nextPosition([], Q)).toBe(0);
    expect(nextPosition([todo('x', { quadrant: OTHER, position: 9 })], Q)).toBe(0);
  });

  it('ignores tombstones', () => {
    expect(nextPosition([todo('d', { position: 9, deletedAt: 1 }), todo('a', { position: 1 })], Q)).toBe(2);
  });
});

describe('legacy blobs without position', () => {
  it('keeps the order the array already had', () => {
    const remote = state([legacyTodo('x'), legacyTodo('y'), legacyTodo('z')]);
    expect(seq(mergeStates(state([]), remote))).toBe('x,y,z');
    expect(seq(mergeStates(remote, state([])))).toBe('x,y,z');
  });

  it('gives every merged todo a numeric position', () => {
    // Without this, sorting compares undefined and the sequence is arbitrary.
    const merged = mergeStates(state([legacyTodo('x'), legacyTodo('y')]), state([]));
    for (const t of merged.todos) expect(typeof t.position).toBe('number');
  });

  it('converges when an upgraded device meets a legacy blob', () => {
    const upgraded = state([
      todo('b', { position: 0, updatedAt: 3000 }),
      todo('a', { position: 1, updatedAt: 3000 }),
    ]);
    const legacy = state([legacyTodo('a'), legacyTodo('b')]);
    expect(seq(mergeStates(upgraded, legacy))).toBe(seq(mergeStates(legacy, upgraded)));
    expect(seq(mergeStates(upgraded, legacy))).toBe('b,a');
  });

  it('numbers each quadrant independently', () => {
    const out = ensurePositions([legacyTodo('a'), legacyTodo('x', { quadrant: OTHER }), legacyTodo('b')]);
    expect(out.find((t) => t.id === 'b')?.position).toBe(1);
    expect(out.find((t) => t.id === 'x')?.position).toBe(0);
  });

  it('leaves an existing position alone', () => {
    const out = ensurePositions([todo('a', { position: 7 })]);
    expect(out[0].position).toBe(7);
  });
});

describe('tombstones', () => {
  it('drops expired tombstones and keeps fresh ones', () => {
    const old = Date.now() - TOMBSTONE_TTL_MS - 1000;
    const a = state([
      todo('x', { updatedAt: old, deletedAt: old }),
      todo('y', { updatedAt: Date.now(), deletedAt: Date.now() }),
    ]);
    expect(mergeStates(a, state([])).todos).toHaveLength(1);
    expect(purgeTombstones(a.todos)).toHaveLength(1);
  });

  it('keeps a tombstone that is still inside the TTL', () => {
    const recent = Date.now() - TOMBSTONE_TTL_MS + 60_000;
    // Dropping this too early would resurrect the todo on a device that has
    // been offline and still holds the pre-delete copy.
    expect(purgeTombstones([todo('x', { deletedAt: recent })])).toHaveLength(1);
  });
});
