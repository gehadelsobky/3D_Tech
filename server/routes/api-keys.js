import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/api-keys — list all API keys (never returns full key)
router.get('/', authenticate, requirePermission('api_keys.view'), (_req, res) => {
  const rows = db.prepare(`
    SELECT ak.id, ak.name, ak.key_prefix, ak.permissions, ak.is_active, ak.last_used_at, ak.created_at, u.username as created_by_name
    FROM api_keys ak
    LEFT JOIN users u ON ak.created_by = u.id
    ORDER BY ak.created_at DESC
  `).all();

  res.json(rows.map(r => ({ ...r, permissions: JSON.parse(r.permissions) })));
});

// POST /api/api-keys — create a new API key (returns full key ONCE)
router.post('/', authenticate, requirePermission('api_keys.manage'), (req, res) => {
  const { name, permissions } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ error: 'At least one permission is required' });
  }

  // Generate a secure random key with recognizable prefix
  const rawKey = '3dt_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12); // "3dt_" + first 8 hex chars

  const result = db.prepare(`
    INSERT INTO api_keys (name, key_hash, key_prefix, permissions, created_by) VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), keyHash, keyPrefix, JSON.stringify(permissions), req.user.id);

  res.status(201).json({
    id: result.lastInsertRowid,
    name: name.trim(),
    key: rawKey, // Shown ONLY on creation
    key_prefix: keyPrefix,
    permissions,
    is_active: 1,
    created_at: new Date().toISOString(),
  });
});

// PATCH /api/api-keys/:id — update name, permissions, or toggle active
router.patch('/:id', authenticate, requirePermission('api_keys.manage'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'API key not found' });

  const { name, permissions, is_active } = req.body;

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    db.prepare('UPDATE api_keys SET name = ? WHERE id = ?').run(name.trim(), id);
  }
  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'Permissions must be an array' });
    db.prepare('UPDATE api_keys SET permissions = ? WHERE id = ?').run(JSON.stringify(permissions), id);
  }
  if (is_active !== undefined) {
    db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
  }

  const updated = db.prepare(`
    SELECT ak.id, ak.name, ak.key_prefix, ak.permissions, ak.is_active, ak.last_used_at, ak.created_at, u.username as created_by_name
    FROM api_keys ak LEFT JOIN users u ON ak.created_by = u.id WHERE ak.id = ?
  `).get(id);

  res.json({ ...updated, permissions: JSON.parse(updated.permissions) });
});

// DELETE /api/api-keys/:id — permanently delete an API key
router.delete('/:id', authenticate, requirePermission('api_keys.manage'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM api_keys WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'API key not found' });

  db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
