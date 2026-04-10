import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { testConnection, refreshTransporter, sendMail } from '../email.js';

const router = Router();

// GET /api/settings/smtp — get SMTP settings (password masked)
router.get('/smtp', authenticate, requirePermission('settings.smtp'), (_req, res) => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'smtp'").get();
  if (!row) return res.json({});

  const settings = JSON.parse(row.value);
  // Mask password
  if (settings.pass) {
    settings.pass = '••••••••';
  }
  res.json(settings);
});

// PUT /api/settings/smtp — save SMTP settings
router.put('/smtp', authenticate, requirePermission('settings.smtp'), (req, res) => {
  const { host, port, secure, user, pass, from, notifyEmail } = req.body;

  // If password is masked, keep the old one
  let finalPass = pass;
  if (pass === '••••••••') {
    const existing = db.prepare("SELECT value FROM app_settings WHERE key = 'smtp'").get();
    if (existing) {
      const old = JSON.parse(existing.value);
      finalPass = old.pass || '';
    }
  }

  const settings = { host, port: parseInt(port) || 587, secure: !!secure, user, pass: finalPass, from, notifyEmail };

  const existing = db.prepare("SELECT key FROM app_settings WHERE key = 'smtp'").get();
  if (existing) {
    db.prepare("UPDATE app_settings SET value = ? WHERE key = 'smtp'").run(JSON.stringify(settings));
  } else {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('smtp', ?)").run(JSON.stringify(settings));
  }

  refreshTransporter();
  res.json({ success: true });
});

// POST /api/settings/smtp/test — test SMTP connection
router.post('/smtp/test', authenticate, requirePermission('settings.smtp'), async (req, res) => {
  const { host, port, secure, user, pass } = req.body;

  // If password is masked, use the stored one
  let finalPass = pass;
  if (pass === '••••••••') {
    const existing = db.prepare("SELECT value FROM app_settings WHERE key = 'smtp'").get();
    if (existing) {
      const old = JSON.parse(existing.value);
      finalPass = old.pass || '';
    }
  }

  const result = await testConnection({ host, port: parseInt(port) || 587, secure: !!secure, user, pass: finalPass });
  if (result.success) {
    res.json({ success: true, message: 'SMTP connection successful!' });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// POST /api/settings/smtp/test-email — send a test email
router.post('/smtp/test-email', authenticate, requirePermission('settings.smtp'), async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email is required' });

  refreshTransporter();
  const result = await sendMail({
    to,
    subject: '3DTech - Test Email',
    html: '<div style="font-family:sans-serif"><h2>Test Email</h2><p>Your SMTP configuration is working correctly!</p><p style="color:#999;font-size:12px">Sent from 3DTech Admin</p></div>',
    text: 'Test Email\nYour SMTP configuration is working correctly!',
  });

  if (result.success) {
    res.json({ success: true, message: `Test email sent to ${to}` });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

export default router;
