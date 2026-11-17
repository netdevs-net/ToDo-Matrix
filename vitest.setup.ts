import { webcrypto } from 'node:crypto';

/**
 * src/sync/crypto.ts uses the Web Crypto API through the global `crypto`,
 * which is how it is reached in a browser. Node only exposed that global from
 * v19; on v18 -- the floor named in package.json engines, and so part of CI --
 * the module is present as node:crypto's `webcrypto` but not bound globally.
 *
 * The app itself is unaffected: the only consumer of this module is the
 * browser, and the server uses node:crypto directly. This closes the gap for
 * tests alone rather than changing what the app depends on.
 */
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
