import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

const VALID_ROLES = ['super_admin', 'admin', 'editor'];

// GET /api/users — list all users (super_admin only)
router.get('/', authenticate, requireSuperAdmin, (_req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

// POST /api/users — create user (super_admin only)
router.post('/', authenticate, requireSuperAdmin, (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);

  res.status(201).json({ id: result.lastInsertRowid, username, role });
});

// PUT /api/users/:id — update user (super_admin only)
router.put('/:id', authenticate, requireSuperAdmin, (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
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

  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const newUsername = username || user.username;
  const newRole = role || user.role;
  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare('UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?').run(newUsername, newHash, newRole, id);

  res.json({ id: Number(id), username: newUsername, role: newRole });
});

// DELETE /api/users/:id — delete user (super_admin only)
router.delete('/:id', authenticate, requireSuperAdmin, (req, res) => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
