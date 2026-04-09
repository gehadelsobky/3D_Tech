import { Router } from 'express';
import db from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    images: JSON.parse(row.images),
    description: row.description,
    features: JSON.parse(row.features),
    brandingOptions: JSON.parse(row.branding_options),
    moq: row.moq,
    leadTime: row.lead_time,
    priceRange: row.price_range,
    priceMin: row.price_min,
    priceMax: row.price_max,
    leadDays: row.lead_days,
    tags: JSON.parse(row.tags),
    notes: row.notes,
  };
}

// GET /api/products
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id').all();
  res.json(rows.map(rowToProduct));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(rowToProduct(row));
});

// POST /api/products (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const data = req.body;
  const result = db.prepare(`
    INSERT INTO products (name, category, images, description, features, branding_options, moq, lead_time, price_range, price_min, price_max, lead_days, tags, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name || '',
    data.category || '',
    JSON.stringify(data.images || []),
    data.description || '',
    JSON.stringify(data.features || []),
    JSON.stringify(data.brandingOptions || []),
    data.moq || 50,
    data.leadTime || '',
    data.priceRange || '',
    data.priceMin ?? null,
    data.priceMax ?? null,
    data.leadDays ?? null,
    JSON.stringify(data.tags || []),
    data.notes || ''
  );

  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(rowToProduct(created));
});

// PUT /api/products/:id (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const data = req.body;
  db.prepare(`
    UPDATE products SET
      name = ?, category = ?, images = ?, description = ?, features = ?,
      branding_options = ?, moq = ?, lead_time = ?, price_range = ?,
      price_min = ?, price_max = ?, lead_days = ?, tags = ?, notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.category ?? existing.category,
    JSON.stringify(data.images ?? JSON.parse(existing.images)),
    data.description ?? existing.description,
    JSON.stringify(data.features ?? JSON.parse(existing.features)),
    JSON.stringify(data.brandingOptions ?? JSON.parse(existing.branding_options)),
    data.moq ?? existing.moq,
    data.leadTime ?? existing.lead_time,
    data.priceRange ?? existing.price_range,
    data.priceMin ?? existing.price_min,
    data.priceMax ?? existing.price_max,
    data.leadDays ?? existing.lead_days,
    JSON.stringify(data.tags ?? JSON.parse(existing.tags)),
    data.notes ?? existing.notes,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json(rowToProduct(updated));
});

// DELETE /api/products/:id (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
