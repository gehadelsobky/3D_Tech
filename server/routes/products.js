import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { emitEvent } from '../webhookEmitter.js';

const router = Router();

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar || '',
    category: row.category,
    images: JSON.parse(row.images),
    description: row.description,
    descriptionAr: row.description_ar || '',
    features: JSON.parse(row.features),
    featuresAr: JSON.parse(row.features_ar || '[]'),
    brandingOptions: JSON.parse(row.branding_options),
    brandingOptionsAr: JSON.parse(row.branding_options_ar || '[]'),
    moq: row.moq,
    leadTime: row.lead_time,
    leadTimeAr: row.lead_time_ar || '',
    priceRange: row.price_range,
    priceRangeAr: row.price_range_ar || '',
    priceMin: row.price_min,
    priceMax: row.price_max,
    leadDays: row.lead_days,
    tags: JSON.parse(row.tags),
    notes: row.notes,
    notesAr: row.notes_ar || '',
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
router.post('/', authenticate, requirePermission('products.create'), (req, res) => {
  const data = req.body;
  const result = db.prepare(`
    INSERT INTO products (name, name_ar, category, images, description, description_ar, features, features_ar, branding_options, branding_options_ar, moq, lead_time, lead_time_ar, price_range, price_range_ar, price_min, price_max, lead_days, tags, notes, notes_ar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name || '',
    data.nameAr || '',
    data.category || '',
    JSON.stringify(data.images || []),
    data.description || '',
    data.descriptionAr || '',
    JSON.stringify(data.features || []),
    JSON.stringify(data.featuresAr || []),
    JSON.stringify(data.brandingOptions || []),
    JSON.stringify(data.brandingOptionsAr || []),
    data.moq || 50,
    data.leadTime || '',
    data.leadTimeAr || '',
    data.priceRange || '',
    data.priceRangeAr || '',
    data.priceMin ?? null,
    data.priceMax ?? null,
    data.leadDays ?? null,
    JSON.stringify(data.tags || []),
    data.notes || '',
    data.notesAr || ''
  );

  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  const product = rowToProduct(created);
  emitEvent('product.created', product);
  res.status(201).json(product);
});

// PUT /api/products/:id (admin only)
router.put('/:id', authenticate, requirePermission('products.edit'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const data = req.body;
  db.prepare(`
    UPDATE products SET
      name = ?, name_ar = ?, category = ?, images = ?, description = ?, description_ar = ?,
      features = ?, features_ar = ?, branding_options = ?, branding_options_ar = ?,
      moq = ?, lead_time = ?, lead_time_ar = ?, price_range = ?, price_range_ar = ?,
      price_min = ?, price_max = ?, lead_days = ?, tags = ?, notes = ?, notes_ar = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.nameAr ?? existing.name_ar ?? '',
    data.category ?? existing.category,
    JSON.stringify(data.images ?? JSON.parse(existing.images)),
    data.description ?? existing.description,
    data.descriptionAr ?? existing.description_ar ?? '',
    JSON.stringify(data.features ?? JSON.parse(existing.features)),
    JSON.stringify(data.featuresAr ?? JSON.parse(existing.features_ar || '[]')),
    JSON.stringify(data.brandingOptions ?? JSON.parse(existing.branding_options)),
    JSON.stringify(data.brandingOptionsAr ?? JSON.parse(existing.branding_options_ar || '[]')),
    data.moq ?? existing.moq,
    data.leadTime ?? existing.lead_time,
    data.leadTimeAr ?? existing.lead_time_ar ?? '',
    data.priceRange ?? existing.price_range,
    data.priceRangeAr ?? existing.price_range_ar ?? '',
    data.priceMin ?? existing.price_min,
    data.priceMax ?? existing.price_max,
    data.leadDays ?? existing.lead_days,
    JSON.stringify(data.tags ?? JSON.parse(existing.tags)),
    data.notes ?? existing.notes,
    data.notesAr ?? existing.notes_ar ?? '',
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  const product = rowToProduct(updated);
  emitEvent('product.updated', product);
  res.json(product);
});

// DELETE /api/products/:id (admin only)
router.delete('/:id', authenticate, requirePermission('products.delete'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  emitEvent('product.deleted', { id: Number(req.params.id) });
  res.json({ success: true });
});

export default router;
