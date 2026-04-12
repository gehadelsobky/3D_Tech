import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/users — list all users
router.get('/', authenticate, requirePermission('users.view'), (_req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.role_id, r.name as role_name, r.is_system as role_is_system, u.created_at
    FROM users u LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.id
  `).all();
  res.json(users);
});

// POST /api/users — create user
router.post('/', authenticate, requirePermission('users.create'), (req, res) => {
  const { username, email, password, role_id } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Validate role
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id);
  if (!role) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  // Only system-role users can assign system role
  if (role.is_system && !req.user.role?.is_system) {
    return res.status(403).json({ error: 'Only Super Admin can assign the Super Admin role' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  if (email) {
    const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (emailExists) {
      return res.status(409).json({ error: 'Email already in use' });
    }
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare('INSERT INTO users (username, email, password_hash, role_id, role) VALUES (?, ?, ?, ?, ?)').run(
    username, email || null, hash, role_id, role.slug
  );

  res.status(201).json({ id: result.lastInsertRowid, username, email: email || null, role_id, role_name: role.name });
});

// PUT /api/users/:id — update user
router.put('/:id', authenticate, requirePermission('users.edit'), (req, res) => {
  const { id } = req.params;
  const { username, email, password, role_id } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Protect Super Admin users from being edited by non-Super Admins
  const userRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(user.role_id);
  if (userRole?.is_system && !req.user.role?.is_system) {
    return res.status(403).json({ error: 'Cannot edit a Super Admin user' });
  }

  if (role_id !== undefined) {
    const newRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id);
    if (!newRole) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (newRole.is_system && !req.user.role?.is_system) {
      return res.status(403).json({ error: 'Only Super Admin can assign the Super Admin role' });
    }
  }

  if (username && username !== user.username) {
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }
  }

  if (email !== undefined && email !== user.email) {
    if (email) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
      if (emailExists) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }
  }

  if (password && password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const newUsername = username || user.username;
  const newEmail = email !== undefined ? (email || null) : user.email;
  const newRoleId = role_id || user.role_id;
  const newHash = password ? bcrypt.hashSync(password, 12) : user.password_hash;
  const newRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(newRoleId);

  db.prepare('UPDATE users SET username = ?, email = ?, password_hash = ?, role_id = ?, role = ? WHERE id = ?').run(
    newUsername, newEmail, newHash, newRoleId, newRole.slug, Number(id)
  );

  res.json({ id: Number(id), username: newUsername, email: newEmail, role_id: newRoleId, role_name: newRole.name });
});

// DELETE /api/users/:id — delete user
router.delete('/:id', authenticate, requirePermission('users.delete'), (req, res) => {
  const { id } = req.params;

  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Protect Super Admin users from being deleted by non-Super Admins
  const userRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(user.role_id);
  if (userRole?.is_system && !req.user.role?.is_system) {
    return res.status(403).json({ error: 'Cannot delete a Super Admin user' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
