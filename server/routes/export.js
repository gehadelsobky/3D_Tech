import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Helper: convert array of objects to CSV string
function toCSV(rows, columns) {
  if (!rows.length) return columns.join(',') + '\n';
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      let val = row[col] ?? '';
      if (typeof val === 'object') val = JSON.stringify(val);
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  ).join('\n');
  return header + '\n' + body + '\n';
}

// GET /api/export/products
router.get('/products', authenticate, requirePermission('products.view'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id').all();
  const columns = ['id', 'name', 'category', 'description', 'moq', 'lead_time', 'price_range', 'price_min', 'price_max', 'tags', 'notes', 'created_at'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
  res.send('\uFEFF' + toCSV(rows, columns)); // BOM for Excel Arabic support
});

// GET /api/export/submissions?form_id=X
router.get('/submissions', authenticate, requirePermission('forms.view'), (req, res) => {
  const { form_id } = req.query;
  let rows;
  if (form_id) {
    rows = db.prepare('SELECT fs.*, fd.name as form_name FROM form_submissions fs JOIN form_definitions fd ON fs.form_id = fd.id WHERE fs.form_id = ? ORDER BY fs.created_at DESC').all(form_id);
  } else {
    rows = db.prepare('SELECT fs.*, fd.name as form_name FROM form_submissions fs JOIN form_definitions fd ON fs.form_id = fd.id ORDER BY fs.created_at DESC').all();
  }

  // Flatten submission data fields into columns
  const allKeys = new Set();
  const parsed = rows.map(r => {
    const data = JSON.parse(r.data);
    Object.keys(data).forEach(k => { if (k !== '_hp') allKeys.add(k); });
    return { ...r, ...data };
  });

  const baseColumns = ['id', 'form_name', 'status', 'created_at'];
  const dataColumns = [...allKeys];
  const columns = [...baseColumns, ...dataColumns, 'notes'];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="submissions.csv"');
  res.send('\uFEFF' + toCSV(parsed, columns));
});

// GET /api/export/users
router.get('/users', authenticate, requirePermission('users.view'), (_req, res) => {
  const rows = db.prepare('SELECT u.id, u.username, u.email, r.name as role_name, u.created_at FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.id').all();
  const columns = ['id', 'username', 'email', 'role_name', 'created_at'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.send('\uFEFF' + toCSV(rows, columns));
});

// GET /api/export/blog
router.get('/blog', authenticate, requirePermission('pages.edit'), (_req, res) => {
  const rows = db.prepare('SELECT id, title, slug, excerpt, author, status, tags, created_at, updated_at FROM blog_posts ORDER BY id').all();
  const columns = ['id', 'title', 'slug', 'excerpt', 'author', 'status', 'tags', 'created_at', 'updated_at'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="blog_posts.csv"');
  res.send('\uFEFF' + toCSV(rows, columns));
});

export default router;
