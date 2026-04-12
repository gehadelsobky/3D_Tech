import { Router } from 'express';
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data.db');
const BACKUP_DIR = join(__dirname, '..', 'backups');

const router = Router();

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

// POST /api/backup — create a backup and download it
router.post('/', authenticate, requirePermission('settings.backup'), async (_req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `backup_${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, backupName);

    // Use SQLite's built-in backup (safe even while DB is in use) — returns a Promise
    await db.backup(backupPath);

    // Clean old backups — keep only the last 10
    const backups = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: statSync(join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    backups.slice(10).forEach(f => {
      try { unlinkSync(join(BACKUP_DIR, f.name)); } catch { /* ignore */ }
    });

    // Stream the backup file as download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${backupName}"`);
    createReadStream(backupPath).pipe(res);
  } catch (err) {
    console.error('Backup failed:', err.message);
    res.status(500).json({ error: 'Backup failed. Please try again or contact support.' });
  }
});

// GET /api/backup/list — list available backups
router.get('/list', authenticate, requirePermission('settings.backup'), (_req, res) => {
  try {
    const backups = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => {
        const stat = statSync(join(BACKUP_DIR, f));
        return { name: f, size: stat.size, created: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json(backups);
  } catch {
    res.json([]);
  }
});

// GET /api/backup/download/:name — download a specific backup
router.get('/download/:name', authenticate, requirePermission('settings.backup'), (req, res) => {
  const { name } = req.params;
  // Prevent directory traversal — only allow safe filenames
  const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!safeName || safeName !== name || !safeName.endsWith('.db')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = join(BACKUP_DIR, safeName);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  createReadStream(filePath).pipe(res);
});

export default router;
