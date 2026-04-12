import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticate, requirePermission } from '../middleware/auth.js';

// Magic bytes for allowed image types
const MAGIC_BYTES = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'image/webp': [Buffer.from('RIFF')], // RIFF....WEBP
};

function validateMagicBytes(filePath, mimetype) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return false;

  return signatures.some(sig => {
    for (let i = 0; i < sig.length; i++) {
      if (buf[i] !== sig[i]) return false;
    }
    // Extra check for WebP: bytes 8-11 must be 'WEBP'
    if (mimetype === 'image/webp') {
      return buf.toString('ascii', 8, 12) === 'WEBP';
    }
    return true;
  });
}

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
  // SVG excluded — can contain embedded JavaScript (XSS vector)
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
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

    // Validate actual file content matches claimed MIME type
    if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File content does not match its type. Upload rejected.' });
    }

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

    // Validate magic bytes for all uploaded files
    for (const file of req.files) {
      if (!validateMagicBytes(file.path, file.mimetype)) {
        // Clean up all uploaded files
        req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
        return res.status(400).json({ error: 'One or more files have invalid content. Upload rejected.' });
      }
    }

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
