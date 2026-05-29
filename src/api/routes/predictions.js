import express from 'express';
import { PredictionEngine } from '../../services/PredictionEngine.js';
import { PatternProfileService } from '../../services/PatternProfileService.js';

const router = express.Router();

// GET /api/predictions — return latest predictions for the authenticated user
router.get('/', async (req, res) => {
  try {
    const predictions = await PredictionEngine.get(req.user.id);
    const profile     = await PatternProfileService.get(req.user.id);
    res.json({ predictions, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/predictions/refresh — recompute predictions now
router.post('/refresh', async (req, res) => {
  try {
    const predictions = await PredictionEngine.predict(req.user.id);
    res.json({ predictions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
