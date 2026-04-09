import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../permissions.js';

const router = Router();

// GET /api/roles/permissions — return permission definitions for the UI
router.get('/permissions', authenticate, requirePermission('roles.manage'), (_req, res) => {
  res.json({ all: ALL_PERMISSIONS, groups: PERMISSION_GROUPS });
});

// GET /api/roles — list all roles with their permissions and user count
router.get('/', authenticate, requirePermission('roles.manage'), (_req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  const result = roles.map((role) => {
    const permissions = role.is_system
      ? ALL_PERMISSIONS
      : db.prepare('SELECT permission FROM role_permissions WHERE role_id = ?')
          .all(role.id).map(r => r.permission);
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(role.id).count;
    return { ...role, permissions, userCount };
  });
  res.json(result);
});

// POST /api/roles — create a new role
router.post('/', authenticate, requirePermission('roles.manage'), (req, res) => {
  const { name, permissions } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  const slug = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!slug) {
    return res.status(400).json({ error: 'Invalid role name' });
  }

  const existing = db.prepare('SELECT id FROM roles WHERE name = ? OR slug = ?').get(name.trim(), slug);
  if (existing) {
    return res.status(409).json({ error: 'A role with this name already exists' });
  }

  const validPerms = (permissions || []).filter(p => ALL_PERMISSIONS.includes(p));

  const create = db.transaction(() => {
    const result = db.prepare('INSERT INTO roles (name, slug) VALUES (?, ?)').run(name.trim(), slug);
    const roleId = result.lastInsertRowid;
    const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)');
    for (const p of validPerms) insertPerm.run(roleId, p);
    return roleId;
  });

  const roleId = create();
  res.status(201).json({ id: roleId, name: name.trim(), slug, permissions: validPerms });
});

// PUT /api/roles/:id — update role name and permissions
router.put('/:id', authenticate, requirePermission('roles.manage'), (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body;

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  if (!role) {
    return res.status(404).json({ error: 'Role not found' });
  }

  if (role.is_system) {
    return res.status(400).json({ error: 'Cannot modify the system role' });
  }

  const newName = name?.trim() || role.name;
  const newSlug = newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  // Check uniqueness (excluding self)
  const dup = db.prepare('SELECT id FROM roles WHERE (name = ? OR slug = ?) AND id != ?').get(newName, newSlug, id);
  if (dup) {
    return res.status(409).json({ error: 'A role with this name already exists' });
  }

  const validPerms = (permissions || []).filter(p => ALL_PERMISSIONS.includes(p));

  const update = db.transaction(() => {
    db.prepare('UPDATE roles SET name = ?, slug = ? WHERE id = ?').run(newName, newSlug, id);
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
    const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)');
    for (const p of validPerms) insertPerm.run(id, p);
  });

  update();
  res.json({ id: Number(id), name: newName, slug: newSlug, permissions: validPerms });
});

// DELETE /api/roles/:id — delete role (only if no users assigned)
router.delete('/:id', authenticate, requirePermission('roles.manage'), (req, res) => {
  const { id } = req.params;

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  if (!role) {
    return res.status(404).json({ error: 'Role not found' });
  }

  if (role.is_system) {
    return res.status(400).json({ error: 'Cannot delete the system role' });
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?').get(id).count;
  if (userCount > 0) {
    return res.status(400).json({ error: `Cannot delete role — ${userCount} user(s) are still assigned to it. Reassign them first.` });
  }

  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
