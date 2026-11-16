import type { QuadrantConfig, QuadrantType, SyncState, Todo } from '../types';

/**
 * How long a deleted todo is kept as a tombstone before it is dropped for good.
 * It has to outlive the longest plausible gap between two devices syncing,
 * otherwise a device that has been offline for a while would resurrect the todo.
 */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Last-write-wins on a single todo. Ties keep `a`, so the merge is stable. */
function mergeTodo(a: Todo, b: Todo): Todo {
  if (b.updatedAt > a.updatedAt) return b;
  return a;
}

/**
 * Sort todos into the order the UI shows them.
 *
 * `position` is the rank a device gave the todo inside its quadrant. Ties fall
 * back to `createdAt` and then `id` so the result is total and identical on
 * every device -- without the final tiebreak two devices could agree on every
 * todo and still disagree on the sequence.
 */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Renumber one quadrant from the order the todos appear in `todos`, stamping
 * `updatedAt` only on the ones that actually moved. Touching just the movers
 * keeps a reorder from beating unrelated edits made on another device.
 */
export function reindexQuadrant(
  todos: Todo[],
  quadrant: QuadrantType,
  now = Date.now()
): Todo[] {
  let next = 0;
  return todos.map((todo) => {
    if (todo.quadrant !== quadrant || todo.deletedAt) return todo;
    const position = next++;
    if (todo.position === position) return todo;
    return { ...todo, position, updatedAt: now };
  });
}

/** Rank for a todo appended to the end of a quadrant. */
export function nextPosition(todos: Todo[], quadrant: QuadrantType): number {
  let max = -1;
  for (const todo of todos) {
    if (todo.quadrant === quadrant && !todo.deletedAt && todo.position > max) {
      max = todo.position;
    }
  }
  return max + 1;
}

/**
 * Give positions to todos saved before ordering was tracked, derived from the
 * array order they already had, so an existing list keeps the arrangement the
 * user built by hand.
 */
export function ensurePositions(todos: Todo[]): Todo[] {
  const next = new Map<QuadrantType, number>();
  return todos.map((todo) => {
    const n = next.get(todo.quadrant) ?? 0;
    next.set(todo.quadrant, n + 1);
    return typeof todo.position === 'number' ? todo : { ...todo, position: n };
  });
}

/**
 * Merge two snapshots into one. Deterministic and order-independent:
 * merge(x, y) and merge(y, x) produce the same result, so it does not matter
 * which side is "local" and which is "remote". That now covers the sequence as
 * well as the contents -- the output is sorted by `position`, so it no longer
 * depends on which side's array was walked first.
 *
 * Conflicts resolve by `updatedAt`, which comes from whichever device made the
 * edit. Clock skew between devices can therefore pick the wrong winner; for a
 * single user this is seconds at worst and is an accepted trade-off against
 * carrying a CRDT.
 */
export function mergeStates(a: SyncState, b: SyncState): SyncState {
  const byId = new Map<string, Todo>();

  for (const todo of a.todos) byId.set(todo.id, todo);
  for (const todo of b.todos) {
    const existing = byId.get(todo.id);
    byId.set(todo.id, existing ? mergeTodo(existing, todo) : todo);
  }

  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const todos = sortTodos(
    [...byId.values()].filter((todo) => !(todo.deletedAt && todo.deletedAt < cutoff))
  );

  const settingsFromB = b.meta.settingsUpdatedAt > a.meta.settingsUpdatedAt;
  const configsFromB = b.meta.quadrantConfigsUpdatedAt > a.meta.quadrantConfigsUpdatedAt;

  return {
    todos,
    settings: settingsFromB ? b.settings : a.settings,
    quadrantConfigs: mergeQuadrantConfigs(
      configsFromB ? b.quadrantConfigs : a.quadrantConfigs,
      configsFromB ? a.quadrantConfigs : b.quadrantConfigs
    ),
    meta: {
      settingsUpdatedAt: Math.max(a.meta.settingsUpdatedAt, b.meta.settingsUpdatedAt),
      quadrantConfigsUpdatedAt: Math.max(
        a.meta.quadrantConfigsUpdatedAt,
        b.meta.quadrantConfigsUpdatedAt
      ),
    },
  };
}

/**
 * The quadrants are a fixed set, so the winning side supplies the values but the
 * losing side fills in any quadrant the winner is missing. That keeps an older
 * client that does not know about a quadrant from dropping it.
 */
function mergeQuadrantConfigs(
  winner: QuadrantConfig[],
  loser: QuadrantConfig[]
): QuadrantConfig[] {
  const seen = new Set(winner.map((config) => config.id));
  return [...winner, ...loser.filter((config) => !seen.has(config.id))];
}

/** Todos that should be shown in the UI. */
export function visibleTodos(todos: Todo[]): Todo[] {
  return todos.filter((todo) => !todo.deletedAt);
}

/** Drop tombstones that are past the TTL. Called once on load. */
export function purgeTombstones(todos: Todo[], now = Date.now()): Todo[] {
  const cutoff = now - TOMBSTONE_TTL_MS;
  return todos.filter((todo) => !(todo.deletedAt && todo.deletedAt < cutoff));
}
