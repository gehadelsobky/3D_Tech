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
    sortOrder: row.sort_order,
  };
}

// GET /api/products
router.get('/', (req, res) => {
  // Display order is admin-controlled; id is only the tiebreaker.
  const rows = db.prepare('SELECT * FROM products ORDER BY sort_order ASC, id ASC').all();
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
  // A new product lands at the end of the catalogue rather than jumping to the
  // front, so adding one never silently reshuffles what visitors already see.
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM products').get();
  const sortOrder = (maxOrder.max ?? -1) + 1;
  const result = db.prepare(`
    INSERT INTO products (name, name_ar, category, images, description, description_ar, features, features_ar, branding_options, branding_options_ar, moq, lead_time, lead_time_ar, price_range, price_range_ar, price_min, price_max, lead_days, tags, notes, notes_ar, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.notesAr || '',
    sortOrder
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

// PUT /api/products/reorder/batch — persist a new catalogue order
// Two path segments, so this never collides with PUT /:id above.
router.put('/reorder/batch', authenticate, requirePermission('products.edit'), (req, res) => {
  const { order } = req.body; // [{ id, sort_order }]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order data' });

  const invalid = order.some(
    (item) => !Number.isInteger(Number(item?.id)) || !Number.isInteger(Number(item?.sort_order))
  );
  if (invalid) return res.status(400).json({ error: 'Each entry needs a numeric id and sort_order' });

  const update = db.prepare('UPDATE products SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    for (const item of order) update.run(Number(item.sort_order), Number(item.id));
  })();

  const rows = db.prepare('SELECT * FROM products ORDER BY sort_order ASC, id ASC').all();
  res.json(rows.map(rowToProduct));
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
