/**
 * Automated backup script — run via cron or PM2.
 *
 * Usage:
 *   node server/backup-cron.js
 *
 * Cron example (daily at 2 AM):
 *   0 2 * * * cd /var/www/3dtech && node server/backup-cron.js
 *
 * PM2 cron example in ecosystem.config.cjs:
 *   { name: '3dtech-backup', script: 'server/backup-cron.js', cron_restart: '0 2 * * *', autorestart: false }
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'data.db');
const BACKUP_DIR = join(__dirname, 'backups');
const MAX_BACKUPS = 30; // Keep last 30 backups

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

try {
  const db = new Database(DB_PATH, { readonly: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `backup_${timestamp}.db`;
  const backupPath = join(BACKUP_DIR, backupName);

  db.backup(backupPath);
  db.close();

  console.log(`[${new Date().toISOString()}] Backup created: ${backupName}`);

  // Clean old backups
  const backups = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
    .map(f => ({ name: f, time: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  const removed = backups.slice(MAX_BACKUPS);
  removed.forEach(f => {
    try {
      unlinkSync(join(BACKUP_DIR, f.name));
      console.log(`  Removed old backup: ${f.name}`);
    } catch { /* ignore */ }
  });
} catch (err) {
  console.error(`[${new Date().toISOString()}] Backup FAILED:`, err.message);
  process.exit(1);
}
