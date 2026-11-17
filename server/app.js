import express from 'express';
import { join } from 'path';
import compression from 'compression';
import helmet from 'helmet';
import { createBlobRouter } from './blob.js';
import { createRateLimiter } from './rate-limit.js';

/**
 * Builds the app without binding a port, so the wiring below can be tested.
 * server.js is the entry point that calls this and listens.
 *
 * The order the middleware is mounted in is the behaviour, not an accident:
 * static files and /health sit above the rate limiter so a client that trips
 * it loses the sync API rather than the app, and the blob router sits above
 * the SPA fallback, which would otherwise answer every GET with index.html.
 */
export async function createApp({ dataDir, token, staticDir, isDevelopment = false } = {}) {
  const app = express();

  // nginx proxies from loopback and appends the address it saw to
  // X-Forwarded-For. Trusting that one hop makes req.ip the forwarded address
  // instead of 127.0.0.1, so the rate limiter buckets per client rather than
  // lumping every request behind the proxy into a single counter.
  //
  // Cloudflare sits in front of nginx in the author's deployment, so the
  // address we get is the Cloudflare edge, not the end user. That is
  // deliberate: CF-Connecting-IP would name the real client but is forgeable
  // by anything that reaches the origin directly, and trusting a fixed hop
  // count breaks the moment Cloudflare is bypassed. Per-edge buckets are the
  // finest grain we can derive without trusting a header an attacker controls.
  app.set('trust proxy', 'loopback');

  // The sync key is cached in localStorage so the passphrase is typed once per
  // browser, which makes script injection the way that key gets stolen. The
  // build emits no inline or eval'd script -- index.html loads one module by
  // src -- so the script policy is tight enough to be worth having. Styles
  // still need 'unsafe-inline': React writes element styles directly, and
  // dnd-kit sets a transform on every frame of a drag.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(compression());

  if (staticDir) {
    app.use(express.static(staticDir, {
      maxAge: '1y',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        // The HTML names the hashed asset files, so it must not be cached or a
        // deploy would keep serving the previous build's references.
        if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }));
  }

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const limiter = createRateLimiter();
  app.use(limiter);

  const { router: blobRouter, ensureDataDir } = createBlobRouter({ dataDir, token });
  await ensureDataDir();
  app.use('/api/blob', blobRouter);

  if (staticDir) {
    app.get('*', (req, res) => res.sendFile(join(staticDir, 'index.html')));
  }

  app.use((err, req, res, _next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      message: isDevelopment ? err.message : undefined,
    });
  });

  // So a caller can shut down cleanly; the sweep interval is unref'd, but a
  // test that builds many apps should not leave them all ticking.
  app.stopRateLimiter = () => limiter.stop();

  return app;
}
