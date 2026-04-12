import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { sendTestPing } from '../webhookEmitter.js';

const router = Router();

const VALID_EVENTS = ['form.submitted', 'product.created', 'product.updated', 'product.deleted', 'blog.published'];

// GET /api/webhooks — list all webhooks
router.get('/', authenticate, requirePermission('webhooks.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, events: JSON.parse(r.events) })));
});

// POST /api/webhooks — create a new webhook
router.post('/', authenticate, requirePermission('webhooks.manage'), (req, res) => {
  const { name, url, secret, events } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!url?.trim()) return res.status(400).json({ error: 'URL is required' });

  // Validate URL format
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'At least one event is required' });
  }
  const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
  if (invalidEvents.length) {
    return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
  }

  // Auto-generate secret if not provided
  const webhookSecret = secret?.trim() || crypto.randomBytes(32).toString('hex');

  const result = db.prepare(
    "INSERT INTO webhooks (name, url, secret, events) VALUES (?, ?, ?, ?)"
  ).run(name.trim(), url.trim(), webhookSecret, JSON.stringify(events));

  const created = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...created, events: JSON.parse(created.events) });
});

// PUT /api/webhooks/:id — update a webhook
router.put('/:id', authenticate, requirePermission('webhooks.manage'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Webhook not found' });

  const { name, url, secret, events, is_active } = req.body;

  if (url) {
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
  }
  if (events) {
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'At least one event is required' });
    }
    const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
    if (invalidEvents.length) {
      return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
    }
  }

  db.prepare(`
    UPDATE webhooks SET name = ?, url = ?, secret = ?, events = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name?.trim() || existing.name,
    url?.trim() || existing.url,
    secret?.trim() || existing.secret,
    JSON.stringify(events || JSON.parse(existing.events)),
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    id
  );

  const updated = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
  res.json({ ...updated, events: JSON.parse(updated.events) });
});

// DELETE /api/webhooks/:id — delete a webhook and its deliveries
router.delete('/:id', authenticate, requirePermission('webhooks.manage'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM webhooks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Webhook not found' });

  db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/webhooks/:id/test — send a test ping
router.post('/:id/test', authenticate, requirePermission('webhooks.manage'), async (req, res) => {
  try {
    const result = await sendTestPing(Number(req.params.id));
    if (result.success) {
      res.json({ success: true, message: `Test delivered successfully (HTTP ${result.status})` });
    } else {
      res.status(400).json({ success: false, error: `Delivery failed: ${result.body}` });
    }
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/webhooks/:id/deliveries — delivery log for a webhook
router.get('/:id/deliveries', authenticate, requirePermission('webhooks.view'), (req, res) => {
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as count FROM webhook_deliveries WHERE webhook_id = ?').get(id).count;
  const rows = db.prepare(
    'SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(id, limit, offset);

  res.json({
    deliveries: rows.map(r => ({ ...r, payload: JSON.parse(r.payload) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// GET /api/webhooks/events — list available events
router.get('/events/list', authenticate, requirePermission('webhooks.view'), (_req, res) => {
  res.json(VALID_EVENTS);
});

export default router;
