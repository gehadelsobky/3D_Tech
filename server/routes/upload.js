import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticate, requirePermission } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();

// POST /api/upload — upload a single image
router.post('/', authenticate, requirePermission('files.upload'), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const url = `/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename, size: req.file.size });
  });
});

// POST /api/upload/multiple — upload multiple images
router.post('/multiple', authenticate, requirePermission('files.upload'), (req, res) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        if (err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Too many files. Maximum is 10.' });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

    const files = req.files.map(f => ({ url: `/uploads/${f.filename}`, filename: f.filename, size: f.size }));
    res.json({ files });
  });
});

// DELETE /api/upload/:filename — delete an uploaded file
router.delete('/:filename', authenticate, requirePermission('files.delete'), (req, res) => {
  const { filename } = req.params;
  // Sanitize filename to prevent directory traversal
  const safe = path.basename(filename);
  const filePath = path.join(uploadsDir, safe);

  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

export default router;
