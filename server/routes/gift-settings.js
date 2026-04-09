import { Router } from 'express';
import db from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/gift-settings — public (needed by GiftFinder page)
router.get('/', (_req, res) => {
  const row = db.prepare('SELECT settings FROM gift_settings WHERE id = 1').get();
  if (!row) {
    return res.json({});
  }
  res.json(JSON.parse(row.settings));
});

// PUT /api/gift-settings — admin only
router.put('/', authenticate, requireAdmin, (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings data' });
  }
  db.prepare('UPDATE gift_settings SET settings = ? WHERE id = 1').run(JSON.stringify(settings));
  res.json(settings);
});

export default router;
