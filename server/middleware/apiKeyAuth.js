import crypto from 'crypto';
import db from '../db.js';
import { authenticate } from './auth.js';

// In-memory rate limiter per API key (60 req/min)
const rateLimits = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000;

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.start > RATE_WINDOW) rateLimits.delete(key);
  }
}, 5 * 60 * 1000);

function checkRateLimit(keyPrefix) {
  const now = Date.now();
  let entry = rateLimits.get(keyPrefix);

  if (!entry || now - entry.start > RATE_WINDOW) {
    entry = { count: 1, start: now };
    rateLimits.set(keyPrefix, entry);
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export function authenticateApiKeyOrJwt(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    // No API key — fall back to JWT auth
    return authenticate(req, res, next);
  }

  // Hash the provided key and look it up
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1').get(keyHash);

  if (!row) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Rate limit check
  if (!checkRateLimit(row.key_prefix)) {
    return res.status(429).json({ error: 'API key rate limit exceeded. Max 60 requests per minute.' });
  }

  // Update last_used_at (fire and forget)
  try {
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  } catch {}

  // Populate req.user for compatibility with requirePermission()
  req.user = {
    id: `apikey:${row.id}`,
    username: `apikey:${row.name}`,
    isApiKey: true,
    permissions: JSON.parse(row.permissions),
    role: null,
  };

  next();
}
