import { describe, expect, it } from 'vitest';
import { deriveKey, exportKey, importKey, open, randomSalt, seal } from './crypto';

/**
 * These cover the properties that make the stored blob safe to hand to a
 * server: that a wrong passphrase cannot read it, that a tampered blob is
 * rejected rather than silently decoded, and above all that a nonce is never
 * reused. Reusing an AES-GCM IV under one key leaks the plaintext relationship
 * and destroys the authentication guarantee, so that one is asserted directly.
 */

const PASSPHRASE = 'correct horse battery staple';

describe('seal and open', () => {
  it('round-trips a value', async () => {
    const key = await deriveKey(PASSPHRASE, randomSalt());
    const value = { todos: [{ id: 'x', text: 'hello' }], n: 42 };
    expect(await open(key, await seal(key, value))).toEqual(value);
  });

  it('uses a fresh IV on every call', async () => {
    const key = await deriveKey(PASSPHRASE, randomSalt());
    const ivs = new Set<string>();
    for (let i = 0; i < 50; i += 1) ivs.add((await seal(key, { i })).iv);
    expect(ivs.size).toBe(50);
  });

  it('produces different ciphertext for the same plaintext', async () => {
    const key = await deriveKey(PASSPHRASE, randomSalt());
    const a = await seal(key, { same: true });
    const b = await seal(key, { same: true });
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('refuses to decrypt with a key derived from another passphrase', async () => {
    const salt = randomSalt();
    const sealed = await seal(await deriveKey(PASSPHRASE, salt), { secret: 1 });
    const wrong = await deriveKey('not the passphrase', salt);
    await expect(open(wrong, sealed)).rejects.toThrow();
  });

  it('refuses to decrypt with the right passphrase under a different salt', async () => {
    const sealed = await seal(await deriveKey(PASSPHRASE, randomSalt()), { secret: 1 });
    const other = await deriveKey(PASSPHRASE, randomSalt());
    await expect(open(other, sealed)).rejects.toThrow();
  });

  it('rejects a tampered ciphertext instead of returning garbage', async () => {
    const key = await deriveKey(PASSPHRASE, randomSalt());
    const sealed = await seal(key, { secret: 'value' });
    const bytes = [...atob(sealed.ciphertext)].map((c) => c.charCodeAt(0));
    bytes[0] ^= 0xff;
    const tampered = { ...sealed, ciphertext: btoa(String.fromCharCode(...bytes)) };
    await expect(open(key, tampered)).rejects.toThrow();
  });

  it('rejects a blob replayed under a different IV', async () => {
    const key = await deriveKey(PASSPHRASE, randomSalt());
    const a = await seal(key, { secret: 'a' });
    const b = await seal(key, { secret: 'b' });
    await expect(open(key, { iv: b.iv, ciphertext: a.ciphertext })).rejects.toThrow();
  });
});

describe('key derivation', () => {
  it('is deterministic for one passphrase and salt', async () => {
    const salt = randomSalt();
    expect(await exportKey(await deriveKey(PASSPHRASE, salt))).toBe(
      await exportKey(await deriveKey(PASSPHRASE, salt))
    );
  });

  it('gives a different key per salt, so one blob cannot unlock another', async () => {
    expect(await exportKey(await deriveKey(PASSPHRASE, randomSalt()))).not.toBe(
      await exportKey(await deriveKey(PASSPHRASE, randomSalt()))
    );
  });

  it('survives the export/import used to cache it between sessions', async () => {
    const key = await deriveKey(PASSPHRASE, randomSalt());
    const sealed = await seal(key, { cached: true });
    const restored = await importKey(await exportKey(key));
    expect(await open(restored, sealed)).toEqual({ cached: true });
  });

  it('produces a 256-bit key', async () => {
    const raw = await exportKey(await deriveKey(PASSPHRASE, randomSalt()));
    expect(atob(raw).length).toBe(32);
  });

  it('generates a 16-byte salt that differs each time', async () => {
    expect(randomSalt()).toHaveLength(16);
    expect(Buffer.from(randomSalt()).equals(Buffer.from(randomSalt()))).toBe(false);
  });
});
