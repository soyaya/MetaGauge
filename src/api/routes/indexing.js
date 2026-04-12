/**
 * Quick Indexing Status and Trigger
 * Simple endpoint to check and start indexing
 */

import express from 'express';
import { UserStorage, AnalysisStorage } from '../database/index.js';

const router = express.Router();

/**
 * GET /api/indexing/status
 * Check if user has any analysis running or completed
 */
router.get('/status', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) {
      return res.json({ 
        hasContract: false, 
        message: 'No contract configured' 
      });
    }

    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const defaultContractAnalyses = analyses.filter(a => 
      a.metadata?.isDefaultContract === true
    );

    const running = defaultContractAnalyses.find(a => 
      a.status === 'running' || a.status === 'pending'
    );
    
    const completed = defaultContractAnalyses.filter(a => 
      a.status === 'completed'
    ).sort((a, b) => 
      new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)
    )[0];

    res.json({
      hasContract: true,
      contractAddress: user.onboarding.defaultContract.address,
      chain: user.onboarding.defaultContract.chain,
      totalAnalyses: defaultContractAnalyses.length,
      running: running ? {
        id: running.id,
        status: running.status,
        progress: running.progress || 0,
        createdAt: running.createdAt
      } : null,
      completed: completed ? {
        id: completed.id,
        status: completed.status,
        completedAt: completed.completedAt,
        transactionCount: completed.results?.target?.transactions?.length || 0
      } : null,
      needsIndexing: !running && !completed
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/indexing/trigger
 * Manually trigger indexing for user's default contract
 */
router.post('/trigger', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(400).json({ 
        error: 'No contract configured',
        message: 'Complete onboarding first'
      });
    }

    // Import and call the trigger function
    const { triggerDefaultContractIndexing } = await import('./trigger-indexing.js');
    
    // Create a mock response to capture the result
    let result = null;
    let statusCode = 200;
    
    const mockRes = {
      json: (data) => { result = data; return mockRes; },
      status: (code) => { statusCode = code; return mockRes; },
      end: () => mockRes
    };

    await triggerDefaultContractIndexing(req, mockRes);

    if (statusCode >= 400) {
      return res.status(statusCode).json(result || { error: 'Indexing failed' });
    }

    res.json({
      success: true,
      message: 'Indexing triggered successfully',
      analysisId: result?.analysisId || null,
      ...result
    });

  } catch (error) {
    console.error('Manual indexing trigger failed:', error);
    res.status(500).json({ 
      error: 'Failed to trigger indexing',
      message: error.message 
    });
  }
});

export default router;
