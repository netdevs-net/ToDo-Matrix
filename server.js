import express from 'express';
import { fileURLToPath } from 'url';
import { createBlobRouter } from './server/blob.js';
import { dirname, join } from 'path';
import compression from 'compression';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// nginx proxies from loopback and appends the address it saw to
// X-Forwarded-For. Trusting that one hop makes req.ip the forwarded address
// instead of 127.0.0.1, so the rate limiter below buckets per client rather
// than lumping every request behind the proxy into a single counter.
//
// Cloudflare sits in front of nginx, so the address we get is the Cloudflare
// edge, not the end user. That is deliberate: CF-Connecting-IP would name the
// real client but is forgeable by anything that reaches the origin directly,
// and trusting a fixed hop count breaks the moment Cloudflare is bypassed.
// Per-edge buckets are the finest grain we can derive without trusting a
// header an attacker controls.
app.set('trust proxy', 'loopback');

// Enable security headers
// The sync key is cached in localStorage so the passphrase is typed once per
// browser, which makes script injection the way that key gets stolen. The
// build emits no inline or eval'd script -- index.html loads one module by src
// -- so the script policy is tight enough to be worth having. Styles still
// need 'unsafe-inline': React writes element styles directly, and dnd-kit sets
// a transform on every frame of a drag.
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

// Enable gzip compression
app.use(compression());

// Serve static files with caching
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // Don't cache HTML files
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API rate limiting
const apiLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per minute

app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  
  if (apiLimiter.has(ip)) {
    const { count, timestamp } = apiLimiter.get(ip);
    
    if (now - timestamp > RATE_LIMIT_WINDOW) {
      apiLimiter.set(ip, { count: 1, timestamp: now });
    } else if (count >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Too many requests' });
    } else {
      apiLimiter.set(ip, { count: count + 1, timestamp });
    }
  } else {
    apiLimiter.set(ip, { count: 1, timestamp: now });
  }
  
  next();
});

// Clean up expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of apiLimiter.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
      apiLimiter.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

// Sync API. Must be mounted before the SPA fallback below, which otherwise
// answers every GET with index.html.
const { router: blobRouter, ensureDataDir } = createBlobRouter({
  dataDir: process.env.DATA_DIR || join(__dirname, 'data'),
  token: process.env.SYNC_TOKEN,
});
await ensureDataDir();
app.use('/api/blob', blobRouter);

// SPA fallback - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Eisenhower Matrix Todo App is now available!');
});