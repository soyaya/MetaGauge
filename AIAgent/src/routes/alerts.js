import { Router } from 'express';
import Alert from '../models/Alert.js';
const router = Router();

// GET /api/alerts — user's alerts
router.get('/', async (req, res) => {
  const alerts = await Alert.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(50);
  res.json({ alerts });
});

// PUT /api/alerts/:id/read — mark as read
router.put('/:id/read', async (req, res) => {
  await Alert.findOneAndUpdate({ _id: req.params.id, userId: req.user.userId }, { read: true });
  res.json({ ok: true });
});

export default router;
