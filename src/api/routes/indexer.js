/**
 * Streaming Indexer API Routes
 */

import express from 'express';

const router = express.Router();

let indexerManager = null;

/**
 * Initialize routes with indexer manager
 */
export function initializeIndexerRoutes(manager) {
  indexerManager = manager;
  return router;
}

/**
 * Start indexing
 */
router.post('/start', async (req, res) => {
  try {
    const { contractAddress, chainId } = req.body;
    const userId = req.user.id;
    
    if (!contractAddress || !chainId) {
      return res.status(400).json({ error: 'Missing contractAddress or chainId' });
    }

    // Get user subscription tier (default to free)
    const subscriptionTier = req.user.subscriptionTier || 'free';

    const indexer = await indexerManager.startIndexing(
      userId,
      contractAddress,
      chainId,
      subscriptionTier
    );

    res.json({
      success: true,
      sessionId: userId,
      status: indexer.status,
      startBlock: indexer.startBlock,
      currentBlock: indexer.currentBlock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stop indexing
 */
router.post('/stop', async (req, res) => {
  try {
    const userId = req.user.id;
    const stopped = indexerManager.stopIndexing(userId);

    res.json({ success: stopped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Pause indexing
 */
router.post('/pause', async (req, res) => {
  try {
    const userId = req.user.id;
    const paused = indexerManager.pauseIndexing(userId);

    res.json({ success: paused });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resume indexing
 */
router.post('/resume', async (req, res) => {
  try {
    const userId = req.user.id;
    const resumed = indexerManager.resumeIndexing(userId);

    res.json({ success: resumed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get indexing status
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const status = indexerManager.getIndexingStatus(userId);

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all active indexers (admin)
 */
router.get('/active', async (req, res) => {
  try {
    const active = indexerManager.getActiveIndexers();
    res.json({ count: active.length, indexers: active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = await indexerManager.components.healthMonitor?.getCurrentHealth();
    res.json(health || { status: 'unknown' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get detailed health report
 */
router.get('/health/detailed', async (req, res) => {
  try {
    const health = await indexerManager.components.healthMonitor?.getDetailedHealth();
    res.json(health || { status: 'unknown' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = indexerManager.components.metricsCollector?.getMetrics();
    res.json(metrics || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
