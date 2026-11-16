/**
 * End-to-end encryption for the synced blob.
 *
 * The server only ever stores ciphertext: the passphrase never leaves the
 * browser and the key is derived locally. Losing the passphrase means losing
 * the remote copy -- the JSON export in the menu is the plaintext escape hatch.
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * Derive the AES key from a passphrase.
 *
 * `extractable` is true so the derived key can be cached in localStorage and
 * the passphrase does not have to be retyped every session. That means anything
 * with access to localStorage on this device has the key -- the same exposure
 * the todos already have, since they are stored there in plaintext today. The
 * gain is that the server and the network only ever see ciphertext.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(new Uint8Array(raw));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    fromBase64(raw) as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export interface Sealed {
  iv: string;
  ciphertext: string;
}

/**
 * Encrypt a value. A fresh IV is generated on every call: reusing a nonce with
 * AES-GCM under the same key breaks the cipher, so this must never be hoisted
 * or cached.
 */
export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource
  );

  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

/** Decrypt a value. Throws if the key is wrong or the blob was tampered with. */
export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv) as unknown as BufferSource },
    key,
    fromBase64(sealed.ciphertext) as unknown as BufferSource
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
