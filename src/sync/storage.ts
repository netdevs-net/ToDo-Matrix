import type { SyncConfig } from '../types';

const CONFIG_KEY = 'todo-matrix-sync-config';
const KEY_KEY = 'todo-matrix-sync-key';
const SALT_KEY = 'todo-matrix-sync-salt';

const defaultConfig: SyncConfig = {
  enabled: false,
  // Same origin as the app, so there is no CORS and no CSP change needed.
  endpoint: '/api/blob',
  token: '',
};

export function loadConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig;
    return { ...defaultConfig, ...(JSON.parse(raw) as Partial<SyncConfig>) };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/**
 * The derived key and its salt are cached so the passphrase only has to be
 * typed once per browser. See the note in crypto.ts about what that exposes.
 */
export function loadCachedKey(): { key: string; salt: string } | null {
  const key = localStorage.getItem(KEY_KEY);
  const salt = localStorage.getItem(SALT_KEY);
  if (!key || !salt) return null;
  return { key, salt };
}

export function saveCachedKey(key: string, salt: string): void {
  localStorage.setItem(KEY_KEY, key);
  localStorage.setItem(SALT_KEY, salt);
}

export function clearCachedKey(): void {
  localStorage.removeItem(KEY_KEY);
  localStorage.removeItem(SALT_KEY);
}
