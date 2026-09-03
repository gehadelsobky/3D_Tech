import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { parseCsv, validateRows, buildTemplate, COLUMNS } from '../productImport.js';

const router = Router();

// A separate multer instance from the image uploader on purpose.
// memoryStorage means the file never touches disk: nothing to clean up, no
// path traversal, and nothing that could later be served back.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  // Extension only, deliberately: browsers report CSV as text/csv,
  // application/vnd.ms-excel, text/plain or application/octet-stream depending
  // on the OS, so a MIME allowlist rejects real files without adding safety.
  // The check that matters is that the bytes parse as CSV with the expected
  // headers, which happens next. Magic bytes do not apply to text.
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      return cb(new Error('Only .csv files are accepted.'));
    }
    cb(null, true);
  },
});

/** Wraps multer so its errors come back as JSON rather than a 500. */
function receiveCsv(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. The maximum is 5MB.'
        : err.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    next();
  });
}

const categoryIds = () => db.prepare('SELECT id FROM categories').all().map((c) => c.id);
const existingNames = () => db.prepare('SELECT name FROM products').all().map((p) => p.name);

/** Parse + validate a buffer. Shared so preview and commit cannot diverge. */
function inspect(buffer) {
  const parsed = parseCsv(buffer);
  if (parsed.error) return { fileError: parsed.error };
  const result = validateRows(parsed.rows, parsed.headers, categoryIds(), existingNames(), {
    lineNumbers: parsed.lineNumbers,
    rowErrors: parsed.rowErrors,
  });
  if (result.fileError) return { fileError: result.fileError };
  return { ...result, rowCount: parsed.rows.length };
}

const fingerprintOf = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// GET /api/import/products/template
router.get('/products/template', authenticate, requirePermission('products.create'), (_req, res) => {
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY sort_order').all();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.csv"');
  res.send(buildTemplate(categories));
});

// POST /api/import/products/preview — validate only, write nothing
router.post('/products/preview', authenticate, requirePermission('products.create'), receiveCsv, (req, res) => {
  const result = inspect(req.file.buffer);
  if (result.fileError) return res.status(400).json({ error: result.fileError });

  res.json({
    rowCount: result.rowCount,
    validCount: result.valid.length,
    errorRowCount: result.erroredRowCount,
    errors: result.errors,
    warnings: result.warnings,
    unknownColumns: result.unknownColumns,
    preview: result.valid.slice(0, 5).map((p) => ({ name: p.name, category: p.category, moq: p.moq })),
    fingerprint: fingerprintOf(req.file.buffer),
  });
});

// POST /api/import/products — insert the valid rows
router.post('/products', authenticate, requirePermission('products.create'), receiveCsv, (req, res) => {
  const { fingerprint } = req.body;
  if (!fingerprint || fingerprint !== fingerprintOf(req.file.buffer)) {
    return res.status(400).json({ error: 'This is not the file you previewed. Validate it again before importing.' });
  }

  // Re-validated from the bytes, never from anything the client sends back:
  // a tampered client must not be able to slip a row past validation.
  const result = inspect(req.file.buffer);
  if (result.fileError) return res.status(400).json({ error: result.fileError });
  if (!result.valid.length) return res.status(400).json({ error: 'Nothing to import — no row passed validation.' });

  const columns = COLUMNS.map((c) => c.name);
  const insert = db.prepare(`
    INSERT INTO products (${columns.join(', ')}, sort_order)
    VALUES (${columns.map(() => '?').join(', ')}, ?)
  `);

  const startOrder = (db.prepare('SELECT MAX(sort_order) as max FROM products').get().max ?? -1) + 1;

  // One transaction: a failure part-way leaves no products behind.
  const importAll = db.transaction((records) => {
    records.forEach((record, i) => {
      // No `?? ''` fallback here. validateRows sets every one of the 21 keys on
      // every row it returns, and `null ?? ''` would turn an absent price_min
      // into an empty string — which SQLite stores as TEXT in a REAL column and
      // which would pass the Gift Finder's `priceMin !== null` check.
      insert.run(...columns.map((c) => record[c]), startOrder + i);
    });
  });
  importAll(result.valid);

  console.log(`[import] ${req.user.username} imported ${result.valid.length} product(s)`);
  res.json({ imported: result.valid.length });
});

export default router;
