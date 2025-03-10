import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5531;

// Enable security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
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

// SPA fallback - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
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