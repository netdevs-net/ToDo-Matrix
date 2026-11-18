/** Quiet period after the last change before a push goes out. */
export const DEBOUNCE_MS = 3000;

/**
 * Longest a change may sit unsent while the snapshot keeps changing.
 *
 * A plain debounce restarts on every change, so anything that writes to the
 * state faster than the quiet period starves it and nothing is ever pushed.
 * The time tracker does exactly that: while a task's timer runs it rewrites
 * `timeSpent` and `updatedAt` once a second, which is three times faster than
 * the quiet period, and a device with a running timer went a full minute
 * without syncing -- every edit made in that window waited with it.
 */
export const MAX_WAIT_MS = 10000;

/**
 * How long to wait before pushing, given when the oldest unsent change
 * arrived. Normally the quiet period, but never past the deadline measured
 * from that first change, so a stream of changes is pushed periodically
 * instead of never.
 */
export function nextSyncDelay(
  pendingSince: number,
  now: number,
  debounceMs = DEBOUNCE_MS,
  maxWaitMs = MAX_WAIT_MS
): number {
  const waited = Math.max(0, now - pendingSince);
  return Math.max(0, Math.min(debounceMs, maxWaitMs - waited));
}
