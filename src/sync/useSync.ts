import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyncConfig, SyncState, SyncStatus } from '../types';
import { importKey } from './crypto';
import { SyncError, syncOnce, unlock as unlockKey } from './client';
import { clearCachedKey, loadCachedKey, loadConfig, saveConfig } from './storage';
import { nextSyncDelay } from './debounce';

const POLL_MS = 60000;

interface Options {
  /** The current local snapshot. Read through a ref, so it is always fresh. */
  state: SyncState;
  /** Applies a merged snapshot back into the app. */
  apply: (merged: SyncState) => void;
  /** Suppresses syncing until the app has finished loading from localStorage. */
  ready: boolean;
}

function describe(error: unknown): string {
  if (error instanceof SyncError) return error.message;
  if (error instanceof TypeError) return 'Could not reach the sync server';
  return error instanceof Error ? error.message : 'Sync failed';
}

export function useSync({ state, apply, ready }: Options) {
  const [config, setConfigState] = useState<SyncConfig>(loadConfig);
  const [status, setStatus] = useState<SyncStatus>({ phase: 'disabled' });
  const [locked, setLocked] = useState(true);

  const keyRef = useRef<CryptoKey | null>(null);
  const saltRef = useRef<string>('');
  const stateRef = useRef(state);
  const applyRef = useRef(apply);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);
  /** When the oldest unpushed change arrived, or null if there is none. */
  const pendingSinceRef = useRef<number | null>(null);

  stateRef.current = state;
  applyRef.current = apply;

  // Restore the cached key so an existing browser does not ask for the
  // passphrase again.
  useEffect(() => {
    const cached = loadCachedKey();
    if (!cached) {
      setLocked(true);
      return;
    }
    let cancelled = false;
    importKey(cached.key)
      .then((key) => {
        if (cancelled) return;
        keyRef.current = key;
        saltRef.current = cached.salt;
        setLocked(false);
      })
      .catch(() => {
        clearCachedKey();
        if (!cancelled) setLocked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sync = useCallback(async () => {
    const key = keyRef.current;
    if (!config.enabled || !key || !config.token || !ready) return;

    // Collapse overlapping runs: remember that another one is wanted and do it
    // once the current one finishes.
    if (runningRef.current) {
      pendingRef.current = true;
      return;
    }

    runningRef.current = true;
    setStatus((prev) => ({ ...prev, phase: 'syncing', error: undefined }));

    try {
      await syncOnce(config, key, saltRef.current, stateRef.current, (merged) =>
        applyRef.current(merged)
      );
      setStatus({ phase: 'idle', lastSyncedAt: Date.now() });
    } catch (error) {
      setStatus((prev) => ({ ...prev, phase: 'error', error: describe(error) }));
    } finally {
      runningRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void sync();
      }
    }
  }, [config, ready]);

  // Debounced push whenever the local snapshot changes, with a ceiling on how
  // long a change may sit unsent.
  //
  // Restarting the timer on every change alone is not enough: the time tracker
  // rewrites the todos once a second while a task's timer runs, which is
  // faster than the quiet period, so the push was pushed back forever and the
  // device only synced when the slow poll came round. Measuring the deadline
  // from the first unsent change puts a floor under that.
  useEffect(() => {
    if (!config.enabled || locked || !ready) {
      pendingSinceRef.current = null;
      return;
    }

    const now = Date.now();
    if (pendingSinceRef.current === null) pendingSinceRef.current = now;

    const timer = setTimeout(() => {
      pendingSinceRef.current = null;
      void sync();
    }, nextSyncDelay(pendingSinceRef.current, now));

    return () => clearTimeout(timer);
  }, [state, config.enabled, locked, ready, sync]);

  // Pull on focus, push on hide, and poll slowly while visible.
  useEffect(() => {
    if (!config.enabled || locked || !ready) return;

    const onVisibility = () => void sync();
    const onFocus = () => void sync();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void sync();
    }, POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      clearInterval(poll);
    };
  }, [config.enabled, locked, ready, sync]);

  useEffect(() => {
    if (!config.enabled) setStatus({ phase: 'disabled' });
    else if (status.phase === 'disabled') setStatus({ phase: 'idle' });
  }, [config.enabled, status.phase]);

  const setConfig = useCallback((next: SyncConfig) => {
    saveConfig(next);
    setConfigState(next);
  }, []);

  const unlock = useCallback(
    async (passphrase: string) => {
      setStatus((prev) => ({ ...prev, phase: 'syncing', error: undefined }));
      try {
        const { key, salt } = await unlockKey(config, passphrase);
        keyRef.current = key;
        saltRef.current = salt;
        setLocked(false);
        setStatus({ phase: 'idle' });
        await sync();
      } catch (error) {
        setStatus({ phase: 'error', error: describe(error) });
        throw error;
      }
    },
    [config, sync]
  );

  const forget = useCallback(() => {
    clearCachedKey();
    keyRef.current = null;
    saltRef.current = '';
    setLocked(true);
  }, []);

  return { config, setConfig, status, locked, unlock, forget, sync };
}
