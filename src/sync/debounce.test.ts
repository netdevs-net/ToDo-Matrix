import { describe, expect, it } from 'vitest';
import { DEBOUNCE_MS, MAX_WAIT_MS, nextSyncDelay } from './debounce';

describe('nextSyncDelay', () => {
  it('waits the full quiet period for a change that just arrived', () => {
    expect(nextSyncDelay(1000, 1000)).toBe(DEBOUNCE_MS);
  });

  it('still waits the quiet period while the deadline is far off', () => {
    expect(nextSyncDelay(1000, 1000 + 2000)).toBe(DEBOUNCE_MS);
  });

  it('shortens the wait as the deadline approaches', () => {
    expect(nextSyncDelay(1000, 1000 + 8500)).toBe(1500);
  });

  it('pushes immediately once the deadline has passed', () => {
    expect(nextSyncDelay(1000, 1000 + MAX_WAIT_MS)).toBe(0);
    expect(nextSyncDelay(1000, 1000 + MAX_WAIT_MS + 60000)).toBe(0);
  });

  it('never returns a negative delay', () => {
    expect(nextSyncDelay(5000, 0)).toBeGreaterThanOrEqual(0);
  });

  /**
   * The bug this exists to stop: a change arriving every second resets a plain
   * debounce forever. Replaying that stream must still reach a push.
   */
  it('reaches a push under a change every second, which a plain debounce never does', () => {
    const start = 0;
    let fired = -1;
    for (let tick = 0; tick <= 60; tick += 1) {
      const now = start + tick * 1000;
      if (nextSyncDelay(start, now) === 0) {
        fired = now;
        break;
      }
    }
    expect(fired).toBe(MAX_WAIT_MS);
  });
});
