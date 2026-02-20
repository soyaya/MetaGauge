/**
 * Quick Scan Route with Real-time Progress
 * Provides progress updates for frontend UI
 */

import express from 'express';
import { SmartContractFetcher } from '../../services/SmartContractFetcher.js';
import { OptimizedQuickScan } from '../../services/OptimizedQuickScan.js';
import { AnalysisStorage } from '../database/index.js';

const router = express.Router();

/**
 * @swagger
 * /api/analysis/quick-scan:
 *   post:
 *     summary: Start optimized quick scan with progress updates
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractAddress
 *               - chain
 *             properties:
 *               contractAddress:
 *                 type: string
 *               chain:
 *                 type: string
 *               contractName:
 *                 type: string
 *     responses:
 *       202:
 *         description: Quick scan started
 *       400:
 *         description: Invalid request
 */
router.post('/quick-scan', async (req, res) => {
  try {
    const { contractAddress, chain, contractName = 'Contract' } = req.body;
    const userId = req.user.id;

    if (!contractAddress || !chain) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'contractAddress and chain are required'
      });
    }

    // Create analysis record
    const analysisData = {
      userId,
      configId: null,
      analysisType: 'quick_scan',
      status: 'pending',
      progress: 0,
      results: null,
      metadata: {
        contractAddress,
        chain,
        contractName,
        scanType: 'optimized_quick_scan',
        startedAt: new Date().toISOString()
      },
      errorMessage: null,
      logs: [],
      completedAt: null
    };

    const analysis = await AnalysisStorage.create(analysisData);

    // Start quick scan asynchronously
    performQuickScan(analysis.id, contractAddress, chain, contractName)
      .catch(error => {
        console.error('Quick scan error:', error);
        AnalysisStorage.update(analysis.id, {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date().toISOString()
        });
      });

    res.status(202).json({
      message: 'Quick scan started',
      analysisId: analysis.id,
      status: 'pending',
      estimatedTime: '60-90 seconds'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to start quick scan',
      message: error.message
    });
  }
});

/**
 * Perform quick scan with progress updates
 */
async function performQuickScan(analysisId, contractAddress, chain, contractName) {
  const startTime = Date.now();

  try {
    // Update status to running
    await AnalysisStorage.update(analysisId, {
      status: 'running',
      progress: 0,
      logs: ['Quick scan started']
    });

    // Initialize fetcher
    const fetcher = new SmartContractFetcher({
      maxRequestsPerSecond: 10,
      failoverTimeout: 60000
    });

    // Initialize quick scan with progress callback
    const quickScan = new OptimizedQuickScan(fetcher, {
      weekInBlocks: 50400,
      maxScanBlocks: 100000,
      minScanBlocks: 50000,
      batchSize: 10,
      onProgress: async (progressData) => {
        // Update analysis with progress
        const currentAnalysis = await AnalysisStorage.findById(analysisId);
        await AnalysisStorage.update(analysisId, {
          progress: progressData.progress,
          logs: [
            ...(currentAnalysis.logs || []),
            `[${progressData.step}] ${progressData.message}`
          ],
          metadata: {
            ...currentAnalysis.metadata,
            lastUpdate: progressData.timestamp,
            currentStep: progressData.step,
            ...progressData
          }
        });
      }
    });

    // Run quick scan
    const results = await quickScan.quickScan(contractAddress, chain);

    // Get statistics
    const stats = quickScan.getStats(results);

    // Calculate duration
    const duration = (Date.now() - startTime) / 1000;

    // Update with final results
    await AnalysisStorage.update(analysisId, {
      status: 'completed',
      progress: 100,
      results: {
        scanType: 'optimized_quick_scan',
        contract: {
          address: contractAddress,
          chain: chain,
          name: contractName,
          deployment: results.deploymentInfo
        },
        data: {
          transactions: results.transactions,
          events: results.events,
          accounts: Array.from(results.accounts),
          blocks: Array.from(results.blocks)
        },
        metrics: results.metrics,
        statistics: stats,
        summary: {
          duration: `${duration.toFixed(2)}s`,
          transactionsFound: results.metrics.totalTransactions,
          eventsFound: results.metrics.totalEvents,
          accountsFound: results.metrics.uniqueAccounts,
          blocksScanned: results.metrics.uniqueBlocks,
          deploymentFound: results.deploymentInfo?.found || false,
          deploymentDate: results.deploymentInfo?.date || 'Not found',
          dataQuality: results.metrics.dataQuality
        }
      },
      completedAt: new Date().toISOString(),
      logs: [
        `Quick scan completed in ${duration.toFixed(2)}s`,
        `Found ${results.metrics.totalTransactions} transactions`,
        `Found ${results.metrics.totalEvents} events`,
        `Found ${results.metrics.uniqueAccounts} unique accounts`
      ]
    });

    // Close fetcher
    await fetcher.close();

  } catch (error) {
    console.error('Quick scan failed:', error);
    await AnalysisStorage.update(analysisId, {
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date().toISOString(),
      logs: [`Error: ${error.message}`]
    });
    throw error;
  }
}

export default router;
