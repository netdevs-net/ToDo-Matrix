import express from 'express';
import { randomUUID, timingSafeEqual } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

/**
 * Storage for the synced blob.
 *
 * The server is deliberately dumb: it holds one opaque encrypted value and a
 * version number, and refuses a write whose If-Match does not name the version
 * it currently holds. All merging happens in the browser, which is the only
 * place that can read the plaintext.
 */

const MAX_BODY = '5mb';

/**
 * Single place where a request is authorised.
 *
 * Today that is a shared bearer token. If the endpoint ever moves to being
 * tailnet-only this is the one function that changes -- it would resolve the
 * caller's tailnet identity instead and drop the token entirely.
 */
function authenticate(req, token) {
  const header = req.get('authorization') || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;

  const presented = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(token);

  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

async function readBlob(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Write via a temp file in the same directory plus a rename, so a crash or a
 * concurrent read can never observe a half-written blob.
 */
async function writeBlob(file, blob) {
  const tmp = join(dirname(file), `.blob.${randomUUID()}.tmp`);
  await writeFile(tmp, JSON.stringify(blob), 'utf8');
  await rename(tmp, file);
}

export function createBlobRouter({ dataDir, token }) {
  const router = express.Router();
  const file = join(dataDir, 'blob.json');

  // Serialises writes within this process so two in-flight PUTs cannot
  // interleave their read-compare-write.
  let queue = Promise.resolve();
  const serialise = (task) => {
    const run = queue.then(task, task);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };

  router.use(express.json({ limit: MAX_BODY }));

  router.use((req, res, next) => {
    // Fail closed: an unconfigured deploy rejects everything rather than
    // serving an open endpoint.
    if (!token) {
      return res.status(503).json({ error: 'Sync is not configured on this server' });
    }
    if (!authenticate(req, token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  });

  router.get('/', async (_req, res, next) => {
    try {
      const blob = await readBlob(file);
      if (!blob) return res.status(404).json({ error: 'No blob stored yet', version: 0 });
      return res.json(blob);
    } catch (error) {
      return next(error);
    }
  });

  router.put('/', async (req, res, next) => {
    const { salt, iv, ciphertext } = req.body || {};
    if (typeof salt !== 'string' || typeof iv !== 'string' || typeof ciphertext !== 'string') {
      return res.status(400).json({ error: 'Expected salt, iv and ciphertext' });
    }

    const ifMatch = Number.parseInt(req.get('if-match') ?? '', 10);
    if (!Number.isInteger(ifMatch) || ifMatch < 0) {
      return res.status(428).json({ error: 'If-Match header with the expected version is required' });
    }

    try {
      const result = await serialise(async () => {
        const current = await readBlob(file);
        const currentVersion = current ? current.version : 0;

        if (currentVersion !== ifMatch) {
          // Hand back what is actually stored so the client can merge and retry
          // in one more round trip instead of two.
          return { status: 412, body: current ?? { version: 0 } };
        }

        const next = { version: currentVersion + 1, salt, iv, ciphertext };
        await writeBlob(file, next);
        return { status: 200, body: { version: next.version } };
      });

      return res.status(result.status).json(result.body);
    } catch (error) {
      return next(error);
    }
  });

  return { router, ensureDataDir: () => mkdir(dataDir, { recursive: true }) };
}
