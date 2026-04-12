import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { sendFormNotification, sendConfirmationEmail } from '../email.js';

const router = Router();

// ==================== FORM DEFINITIONS ====================

// GET /api/forms — list all forms (public: only active, admin: all)
router.get('/', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  let rows;
  if (token) {
    // Admin sees all forms
    rows = db.prepare(`
      SELECT f.*, (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.id) as submission_count
      FROM form_definitions f ORDER BY f.created_at DESC
    `).all();
  } else {
    // Public sees only active forms
    rows = db.prepare('SELECT id, name, slug, description, fields, settings FROM form_definitions WHERE is_active = 1 ORDER BY name').all();
  }
  res.json(rows.map(r => ({ ...r, fields: JSON.parse(r.fields), settings: JSON.parse(r.settings) })));
});

// GET /api/forms/:slug — get form by slug (public, only active)
router.get('/:slug', (req, res) => {
  const row = db.prepare('SELECT id, name, slug, description, fields, settings FROM form_definitions WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Form not found' });
  res.json({ ...row, fields: JSON.parse(row.fields), settings: JSON.parse(row.settings) });
});

// POST /api/forms — create a new form
router.post('/', authenticate, requirePermission('forms.create'), (req, res) => {
  const { name, slug: rawSlug, description, fields, settings } = req.body;
  if (!name || !rawSlug) return res.status(400).json({ error: 'Name and slug are required' });

  const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return res.status(400).json({ error: 'Invalid slug' });

  const existing = db.prepare('SELECT id FROM form_definitions WHERE slug = ?').get(slug);
  if (existing) return res.status(409).json({ error: 'A form with this slug already exists' });

  const result = db.prepare(
    "INSERT INTO form_definitions (name, slug, description, fields, settings) VALUES (?, ?, ?, ?, ?)"
  ).run(name, slug, description || '', JSON.stringify(fields || []), JSON.stringify(settings || {}));

  const created = db.prepare('SELECT * FROM form_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...created, fields: JSON.parse(created.fields), settings: JSON.parse(created.settings) });
});

// PUT /api/forms/:id — update a form
router.put('/:id', authenticate, requirePermission('forms.edit'), (req, res) => {
  const { id } = req.params;
  const { name, description, fields, settings, is_active } = req.body;

  const existing = db.prepare('SELECT id FROM form_definitions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Form not found' });

  db.prepare(`
    UPDATE form_definitions SET name = ?, description = ?, fields = ?, settings = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, description || '', JSON.stringify(fields || []), JSON.stringify(settings || {}), is_active ?? 1, id);

  const updated = db.prepare('SELECT * FROM form_definitions WHERE id = ?').get(id);
  res.json({ ...updated, fields: JSON.parse(updated.fields), settings: JSON.parse(updated.settings) });
});

// DELETE /api/forms/:id — delete a form and all its submissions
router.delete('/:id', authenticate, requirePermission('forms.delete'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM form_definitions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Form not found' });

  db.prepare('DELETE FROM form_definitions WHERE id = ?').run(id);
  res.json({ success: true });
});

// ==================== FORM SUBMISSIONS ====================

// POST /api/forms/:slug/submit — public submission
router.post('/:slug/submit', (req, res) => {
  const form = db.prepare('SELECT id, name, fields FROM form_definitions WHERE slug = ? AND is_active = 1').get(req.params.slug);
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const fields = JSON.parse(form.fields);
  const data = req.body;

  // Honeypot check
  if (data._hp) return res.json({ success: true }); // silently accept but don't store

  // Validate required fields
  for (const field of fields) {
    if (field.required && !data[field.name]?.toString().trim()) {
      return res.status(400).json({ error: `${field.label} is required` });
    }
  }

  db.prepare("INSERT INTO form_submissions (form_id, data) VALUES (?, ?)").run(form.id, JSON.stringify(data));

  // Send email notifications (fire and forget)
  sendFormNotification(form.name, data).catch(() => {});

  // Send confirmation email to user if email field exists
  const emailField = data.email || data.Email || data.e_mail;
  if (emailField) {
    const nameField = data.name || data.Name || data.full_name || '';
    sendConfirmationEmail(emailField, nameField, form.name).catch(() => {});
  }

  res.status(201).json({ success: true });
});

// GET /api/forms/:id/submissions — list submissions for a form (admin)
router.get('/:id/submissions', authenticate, requirePermission('forms.view'), (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status;

  let query = 'SELECT * FROM form_submissions WHERE form_id = ?';
  const params = [id];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count')).get(...params).count;
  const rows = db.prepare(query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limit, offset);

  res.json({
    submissions: rows.map(r => ({ ...r, data: JSON.parse(r.data) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// PATCH /api/forms/submissions/:id — update submission status/notes
router.patch('/submissions/:id', authenticate, requirePermission('forms.edit'), (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const existing = db.prepare('SELECT id FROM form_submissions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Submission not found' });

  if (status) db.prepare('UPDATE form_submissions SET status = ? WHERE id = ?').run(status, id);
  if (notes !== undefined) db.prepare('UPDATE form_submissions SET notes = ? WHERE id = ?').run(notes, id);

  const updated = db.prepare('SELECT * FROM form_submissions WHERE id = ?').get(id);
  res.json({ ...updated, data: JSON.parse(updated.data) });
});

// DELETE /api/forms/submissions/:id — delete a single submission
router.delete('/submissions/:id', authenticate, requirePermission('forms.delete'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM form_submissions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Submission not found' });

  db.prepare('DELETE FROM form_submissions WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
