import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

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
router.put('/', authenticate, requirePermission('gift_settings.edit'), (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings data' });
  }

  // resultsCount drives how many products the public Gift Finder renders —
  // clamp it so a bad value cannot blank the results or dump the whole catalogue.
  if (settings.resultsCount !== undefined) {
    const count = Number(settings.resultsCount);
    if (!Number.isFinite(count)) {
      return res.status(400).json({ error: 'resultsCount must be a number' });
    }
    settings.resultsCount = Math.min(24, Math.max(1, Math.floor(count)));
  }

  db.prepare('UPDATE gift_settings SET settings = ? WHERE id = 1').run(JSON.stringify(settings));
  res.json(settings);
});

export default router;
