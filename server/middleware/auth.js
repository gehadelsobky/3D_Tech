import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';
import { ALL_PERMISSIONS } from '../permissions.js';

// JWT_SECRET must be set via environment variable in production.
// In development, a random secret is generated per process (tokens won't survive restarts).
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Verify user still exists in database (handles deleted users with active tokens)
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.id);
    if (!userExists) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Enrich with current role + permissions from DB
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(payload.role_id);
    if (!role) {
      return res.status(401).json({ error: 'Invalid role' });
    }

    const permissions = role.is_system
      ? [...ALL_PERMISSIONS]
      : db.prepare('SELECT permission FROM role_permissions WHERE role_id = ?')
          .all(payload.role_id).map(r => r.permission);

    req.user = {
      id: payload.id,
      username: payload.username,
      role_id: payload.role_id,
      role,
      permissions,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Super Admin bypasses all checks
    if (req.user.role?.is_system) return next();

    const hasAll = permissions.every(p => req.user.permissions.includes(p));
    if (!hasAll) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
