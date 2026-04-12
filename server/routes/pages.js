import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticate, requirePermission, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// Core page slugs that cannot be deleted
const CORE_PAGES = ['global', 'home', 'about', 'contact', 'products'];

// GET /api/pages — list all pages with metadata
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT slug, title, hidden, is_custom, updated_at FROM page_content ORDER BY is_custom ASC, slug ASC').all();
  res.json(rows);
});

// GET /api/pages/:slug — get page content (hidden pages only visible to authenticated users)
router.get('/:slug', (req, res) => {
  const row = db.prepare('SELECT content, content_ar, hidden FROM page_content WHERE slug = ?').get(req.params.slug);
  if (!row) {
    return res.status(404).json({ error: 'Page not found' });
  }
  if (row.hidden) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(404).json({ error: 'Page not found' });
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(404).json({ error: 'Page not found' });
    }
  }
  const content = JSON.parse(row.content);
  const contentAr = JSON.parse(row.content_ar || '{}');
  res.json({ ...content, _ar: contentAr });
});

// POST /api/pages — create a new custom page
router.post('/', authenticate, requirePermission('pages.edit'), (req, res) => {
  const { title, slug: rawSlug } = req.body;

  if (!title || !rawSlug) {
    return res.status(400).json({ error: 'Title and slug are required' });
  }

  // Sanitize slug: lowercase, alphanumeric + hyphens only
  const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  const existing = db.prepare('SELECT slug FROM page_content WHERE slug = ?').get(slug);
  if (existing) {
    return res.status(409).json({ error: 'A page with this slug already exists' });
  }

  const defaultContent = {
    heroTitle: title,
    heroDescription: '',
    sections: [],
  };

  db.prepare("INSERT INTO page_content (slug, title, content, is_custom, hidden) VALUES (?, ?, ?, 1, 0)").run(slug, title, JSON.stringify(defaultContent));

  res.status(201).json({ slug, title, content: defaultContent, hidden: 0, is_custom: 1 });
});

// PATCH /api/pages/:slug/visibility — toggle hidden status
router.patch('/:slug/visibility', authenticate, requirePermission('pages.edit'), (req, res) => {
  const { slug } = req.params;
  const { hidden } = req.body;

  if (slug === 'global') {
    return res.status(400).json({ error: 'Cannot hide global settings' });
  }

  const existing = db.prepare('SELECT slug FROM page_content WHERE slug = ?').get(slug);
  if (!existing) {
    return res.status(404).json({ error: 'Page not found' });
  }

  db.prepare("UPDATE page_content SET hidden = ?, updated_at = datetime('now') WHERE slug = ?").run(hidden ? 1 : 0, slug);
  res.json({ slug, hidden: !!hidden });
});

// DELETE /api/pages/:slug — delete a custom page (core pages protected)
router.delete('/:slug', authenticate, requirePermission('pages.edit'), (req, res) => {
  const { slug } = req.params;

  if (CORE_PAGES.includes(slug)) {
    return res.status(400).json({ error: 'Cannot delete core pages. Use hide instead.' });
  }

  const existing = db.prepare('SELECT slug FROM page_content WHERE slug = ?').get(slug);
  if (!existing) {
    return res.status(404).json({ error: 'Page not found' });
  }

  db.prepare('DELETE FROM page_content WHERE slug = ?').run(slug);
  res.json({ success: true });
});

// PUT /api/pages/:slug — update page content (requires pages.edit)
router.put('/:slug', authenticate, requirePermission('pages.edit'), (req, res) => {
  const { slug } = req.params;
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid content data' });
  }

  const existing = db.prepare('SELECT slug FROM page_content WHERE slug = ?').get(slug);
  if (!existing) {
    return res.status(404).json({ error: 'Page not found' });
  }

  // Separate Arabic content from English content
  const { _ar, ...content } = body;

  if (_ar && typeof _ar === 'object') {
    db.prepare("UPDATE page_content SET content = ?, content_ar = ?, updated_at = datetime('now') WHERE slug = ?")
      .run(JSON.stringify(content), JSON.stringify(_ar), slug);
  } else {
    db.prepare("UPDATE page_content SET content = ?, updated_at = datetime('now') WHERE slug = ?")
      .run(JSON.stringify(content), slug);
  }

  res.json({ ...content, _ar: _ar || {} });
});

export default router;
