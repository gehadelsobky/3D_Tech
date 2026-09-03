import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET, authenticate, bumpTokenVersion } from '../middleware/auth.js';
import { ALL_PERMISSIONS } from '../permissions.js';
import { sendPasswordResetEmail } from '../email.js';
import {
  RESET_TOKEN_TTL_MINUTES,
  generateResetToken,
  hashResetToken,
  getResetBaseUrl,
} from '../passwordReset.js';

const router = Router();

/**
 * Mints a session token stamped with the account's current token version, so
 * authenticate() can tell it apart from one issued before a password change.
 */
function signSession(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role_id: user.role_id, tv: user.token_version ?? 0 },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

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

  const token = signSession(user);

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
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);

  // Every other session for this account is now dead. Hand back a fresh token
  // so the person who just changed their own password is not signed out too.
  const tokenVersion = bumpTokenVersion(req.user.id);
  const token = signSession({ ...user, token_version: tokenVersion });

  res.json({ success: true, token });
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

// ---------------------------------------------------------------------------
//  Password reset
// ---------------------------------------------------------------------------

/**
 * Looks up a live reset token. Returns the row joined with its user, or null.
 * Expiry is compared in SQL so it uses the database's UTC clock throughout.
 */
function findLiveReset(token) {
  if (typeof token !== 'string' || !token) return null;
  return db.prepare(
    `SELECT pr.id, pr.user_id, u.username, u.email
     FROM password_resets pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.token_hash = ?
       AND pr.used_at IS NULL
       AND pr.expires_at > datetime('now')`
  ).get(hashResetToken(token)) || null;
}

// POST /api/auth/forgot-password — email a reset link
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  // Always the same answer, whether or not the address belongs to an account:
  // a different response here would turn this into an account-enumeration oracle.
  const genericResponse = { success: true };

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.prepare('SELECT id, username, email FROM users WHERE email = ?').get(email.trim());
  if (!user) {
    console.warn(`[auth] Password reset requested for unknown address: ${email.trim()}`);
    return res.json(genericResponse);
  }

  const baseUrl = getResetBaseUrl(req);
  if (!baseUrl) {
    console.error('[auth] PUBLIC_URL is not set — refusing to build a reset link from the Host header in production.');
    return res.json(genericResponse);
  }

  // Any link already in flight becomes dead the moment a new one is issued.
  db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL")
    .run(user.id);

  const token = generateResetToken();
  db.prepare(
    `INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
     VALUES (?, ?, datetime('now', ?), ?)`
  ).run(user.id, hashResetToken(token), `+${RESET_TOKEN_TTL_MINUTES} minutes`, req.ip || null);

  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    const result = await sendPasswordResetEmail(user.email, user.username, resetUrl, RESET_TOKEN_TTL_MINUTES);
    if (!result?.success) {
      console.error(`[auth] Reset email to ${user.email} failed: ${result?.error || 'unknown error'}`);
    }
  } catch (err) {
    console.error(`[auth] Reset email to ${user.email} threw: ${err.message}`);
  }

  res.json(genericResponse);
});

// GET /api/auth/reset-password/:token — is this link still good?
// Lets the page say "expired" before the user types a new password.
router.get('/reset-password/:token', (req, res) => {
  const reset = findLiveReset(req.params.token);
  if (!reset) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  }
  res.json({ valid: true, username: reset.username });
});

// POST /api/auth/reset-password — set the new password
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const reset = findLiveReset(token);
  if (!reset) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  }

  const hash = bcrypt.hashSync(password, 12);
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, reset.user_id);
    // Burn this link and every other one outstanding for the account.
    db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL")
      .run(reset.user_id);
    // Sign out every existing session. A reset is the one moment where someone
    // else may be holding a live token for this account — that is the point.
    db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(reset.user_id);
  })();

  console.log(`[auth] Password reset completed for user ${reset.username} (id ${reset.user_id})`);
  res.json({ success: true });
});

export default router;
