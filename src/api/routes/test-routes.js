import express from 'express';

const router = express.Router();

router.post('/test-endpoint', async (req, res) => {
  res.json({ 
    message: 'Test endpoint works', 
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'no-user'
  });
});

export default router;