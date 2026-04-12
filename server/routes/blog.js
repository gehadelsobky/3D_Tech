import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticate, requirePermission, JWT_SECRET } from '../middleware/auth.js';
import { emitEvent } from '../webhookEmitter.js';

const router = Router();

// Helper: verify JWT token for mixed public/admin routes
function isAuthenticated(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;
  try { jwt.verify(token, JWT_SECRET); return true; } catch { return false; }
}

// GET /api/blog — public: published only, admin: all
router.get('/', (req, res) => {
  let rows;
  if (isAuthenticated(req)) {
    rows = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all();
  } else {
    rows = db.prepare("SELECT * FROM blog_posts WHERE status = 'published' ORDER BY created_at DESC").all();
  }
  res.json(rows.map(r => ({ ...r, tags: JSON.parse(r.tags) })));
});

// GET /api/blog/:slug — get single post by slug (public: published only)
router.get('/:slug', (req, res) => {
  let row;
  if (isAuthenticated(req)) {
    row = db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(req.params.slug);
  } else {
    row = db.prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'").get(req.params.slug);
  }
  if (!row) return res.status(404).json({ error: 'Post not found' });
  res.json({ ...row, tags: JSON.parse(row.tags) });
});

// POST /api/blog — create a new post
router.post('/', authenticate, requirePermission('pages.edit'), (req, res) => {
  const { title, title_ar, slug: rawSlug, excerpt, excerpt_ar, content, content_ar, cover_image, author, status, tags } = req.body;
  if (!title || !rawSlug) return res.status(400).json({ error: 'Title and slug are required' });

  const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return res.status(400).json({ error: 'Invalid slug' });

  const existing = db.prepare('SELECT id FROM blog_posts WHERE slug = ?').get(slug);
  if (existing) return res.status(409).json({ error: 'A post with this slug already exists' });

  const result = db.prepare(
    "INSERT INTO blog_posts (title, title_ar, slug, excerpt, excerpt_ar, content, content_ar, cover_image, author, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(title, title_ar || '', slug, excerpt || '', excerpt_ar || '', content || '', content_ar || '', cover_image || '', author || 'Admin', status || 'draft', JSON.stringify(tags || []));

  const created = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(result.lastInsertRowid);
  const post = { ...created, tags: JSON.parse(created.tags) };
  if (post.status === 'published') emitEvent('blog.published', post);
  res.status(201).json(post);
});

// PUT /api/blog/:id — update a post
router.put('/:id', authenticate, requirePermission('pages.edit'), (req, res) => {
  const { id } = req.params;
  const { title, title_ar, excerpt, excerpt_ar, content, content_ar, cover_image, author, status, tags } = req.body;

  const existing = db.prepare('SELECT id FROM blog_posts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  db.prepare(`
    UPDATE blog_posts SET title = ?, title_ar = ?, excerpt = ?, excerpt_ar = ?, content = ?, content_ar = ?, cover_image = ?, author = ?, status = ?, tags = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, title_ar || '', excerpt || '', excerpt_ar || '', content || '', content_ar || '', cover_image || '', author || 'Admin', status || 'draft', JSON.stringify(tags || []), id);

  const updated = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id);
  const post = { ...updated, tags: JSON.parse(updated.tags) };
  if (post.status === 'published') emitEvent('blog.published', post);
  res.json(post);
});

// DELETE /api/blog/:id — delete a post
router.delete('/:id', authenticate, requirePermission('pages.edit'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM blog_posts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
