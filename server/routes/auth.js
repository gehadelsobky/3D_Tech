import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET, authenticate } from '../middleware/auth.js';
import { ALL_PERMISSIONS } from '../permissions.js';

const router = Router();

function getUserResponse(user) {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(user.role_id);
  const permissions = role?.is_system
    ? ALL_PERMISSIONS
    : db.prepare('SELECT permission FROM role_permissions WHERE role_id = ?')
        .all(user.role_id).map(r => r.permission);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role_id: user.role_id,
    role_name: role?.name || 'Unknown',
    is_system: !!role?.is_system,
    permissions,
  };
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role_id: user.role_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: getUserResponse(user) });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(getUserResponse(user));
});

// PUT /api/auth/password — change own password
router.put('/password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

  res.json({ success: true });
});

// PUT /api/auth/profile — update own email
router.put('/profile', authenticate, (req, res) => {
  const { email } = req.body;

  if (email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, req.user.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(getUserResponse(user));
});

export default router;
