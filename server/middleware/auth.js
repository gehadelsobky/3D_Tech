import jwt from 'jsonwebtoken';
import db from '../db.js';
import { ALL_PERMISSIONS } from '../permissions.js';

export const JWT_SECRET = process.env.JWT_SECRET || '3dtech_jwt_secret_key_2024';
// In production, JWT_SECRET MUST be set as an environment variable

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);

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
