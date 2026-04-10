import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// GET /api/categories — list all categories (public: active only, admin: all)
router.get('/', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  let rows;
  if (token) {
    rows = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
  } else {
    rows = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC').all();
  }
  res.json(rows);
});

// POST /api/categories — create a new category
router.post('/', authenticate, requirePermission('products.create'), (req, res) => {
  const { id: rawId, name, icon, description } = req.body;
  if (!rawId || !name) return res.status(400).json({ error: 'ID and name are required' });

  const id = rawId.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!id) return res.status(400).json({ error: 'Invalid ID' });

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (existing) return res.status(409).json({ error: 'A category with this ID already exists' });

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM categories').get();
  const sortOrder = (maxOrder.max ?? -1) + 1;

  db.prepare('INSERT INTO categories (id, name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)').run(id, name, icon || '', description || '', sortOrder);

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json(created);
});

// PUT /api/categories/:id — update a category
router.put('/:id', authenticate, requirePermission('products.edit'), (req, res) => {
  const { id } = req.params;
  const { name, icon, description, is_active } = req.body;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  db.prepare('UPDATE categories SET name = ?, icon = ?, description = ?, is_active = ? WHERE id = ?').run(
    name, icon || '', description || '', is_active ?? 1, id
  );

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json(updated);
});

// PUT /api/categories/reorder — update sort order for all categories
router.put('/reorder/batch', authenticate, requirePermission('products.edit'), (req, res) => {
  const { order } = req.body; // [{id, sort_order}]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order data' });

  const update = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    for (const item of order) {
      update.run(item.sort_order, item.id);
    }
  });
  reorder();

  const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
  res.json(rows);
});

// DELETE /api/categories/:id — delete a category (only if no products use it)
router.delete('/:id', authenticate, requirePermission('products.delete'), (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category = ?').get(id);
  if (productCount.count > 0) {
    return res.status(400).json({ error: `Cannot delete: ${productCount.count} product(s) use this category. Reassign them first or deactivate instead.` });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
