import type { EncryptedBlob, SyncConfig, SyncState } from '../types';
import { deriveKey, exportKey, fromBase64, open, randomSalt, seal, toBase64 } from './crypto';
import { mergeStates } from './merge';
import { saveCachedKey } from './storage';

export class SyncError extends Error {}

interface Remote {
  version: number;
  state: SyncState | null;
  salt: string;
}

function headers(config: SyncConfig, extra: Record<string, string> = {}): HeadersInit {
  return {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchBlob(config: SyncConfig): Promise<EncryptedBlob | null> {
  const response = await fetch(config.endpoint, { headers: headers(config) });

  if (response.status === 404) return null;
  if (response.status === 401) throw new SyncError('Sync token rejected by the server');
  if (response.status === 503) throw new SyncError('Sync is not configured on the server');
  if (!response.ok) throw new SyncError(`Server returned ${response.status}`);

  return (await response.json()) as EncryptedBlob;
}

async function decryptBlob(key: CryptoKey, blob: EncryptedBlob): Promise<SyncState> {
  try {
    return await open<SyncState>(key, blob);
  } catch {
    throw new SyncError(
      'Could not decrypt the stored data. The passphrase does not match the one it was saved with.'
    );
  }
}

async function readRemote(config: SyncConfig, key: CryptoKey): Promise<Remote> {
  const blob = await fetchBlob(config);
  if (!blob) return { version: 0, state: null, salt: '' };
  return { version: blob.version, state: await decryptBlob(key, blob), salt: blob.salt };
}

/**
 * Derive a key from the passphrase and prove it against whatever is on the
 * server. A blob already stored carries the salt it was written with, so a new
 * browser only needs the passphrase.
 */
export async function unlock(
  config: SyncConfig,
  passphrase: string
): Promise<{ key: CryptoKey; salt: string }> {
  const blob = await fetchBlob(config);
  const salt = blob ? fromBase64(blob.salt) : randomSalt();
  const key = await deriveKey(passphrase, salt);

  // Proves the passphrase before it gets cached, so a typo surfaces here
  // instead of on the next sync.
  if (blob) await decryptBlob(key, blob);

  const encoded = toBase64(salt);
  saveCachedKey(await exportKey(key), encoded);
  return { key, salt: encoded };
}

async function putBlob(
  config: SyncConfig,
  key: CryptoKey,
  salt: string,
  state: SyncState,
  ifMatch: number
): Promise<{ ok: true; version: number } | { ok: false; conflict: EncryptedBlob }> {
  const sealed = await seal(key, state);

  const response = await fetch(config.endpoint, {
    method: 'PUT',
    headers: headers(config, { 'If-Match': String(ifMatch) }),
    body: JSON.stringify({ salt, ...sealed }),
  });

  if (response.status === 412) {
    return { ok: false, conflict: (await response.json()) as EncryptedBlob };
  }
  if (response.status === 401) throw new SyncError('Sync token rejected by the server');
  if (!response.ok) throw new SyncError(`Server returned ${response.status}`);

  const body = (await response.json()) as { version: number };
  return { ok: true, version: body.version };
}

/**
 * One full sync: pull, merge, push.
 *
 * The merged result is handed back through `apply` before the push, so the
 * local UI reflects the remote edits even if the push then fails.
 */
export async function syncOnce(
  config: SyncConfig,
  key: CryptoKey,
  salt: string,
  local: SyncState,
  apply: (merged: SyncState) => void
): Promise<void> {
  const remote = await readRemote(config, key);
  const merged = remote.state ? mergeStates(local, remote.state) : local;
  apply(merged);

  // Nothing to push if the server already holds exactly this.
  if (remote.state && JSON.stringify(merged) === JSON.stringify(remote.state)) return;

  const effectiveSalt = remote.salt || salt;
  const first = await putBlob(config, key, effectiveSalt, merged, remote.version);
  if (first.ok) return;

  // Lost the race. The 412 carried the blob that won, so merge against that and
  // retry once rather than starting the round trip again.
  const winner = await decryptBlob(key, first.conflict);
  const remerged = mergeStates(merged, winner);
  apply(remerged);

  const second = await putBlob(config, key, effectiveSalt, remerged, first.conflict.version);
  if (!second.ok) {
    throw new SyncError('Could not save: the server copy kept changing. It will retry shortly.');
  }
}
