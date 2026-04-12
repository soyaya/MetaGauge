/**
 * Dashboard Data Routes
 * Provides specific endpoints for dashboard metrics
 */

import express from 'express';
import { UserStorage, AnalysisStorage } from '../database/index.js';
import { EthereumRpcClient } from '../../services/EthereumRpcClient.js';
import { StarknetRpcClient } from '../../services/StarknetRpcClient.js';

const router = express.Router();

/**
 * GET /api/dashboard/contract-info
 * Returns contract deployment and indexing information
 */
router.get('/contract-info', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(404).json({
        error: 'No default contract found'
      });
    }

    const contract = user.onboarding.defaultContract;
    
    // Get latest analysis for block range data
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const latestAnalysis = analyses
      .filter(a => a.metadata?.isDefaultContract && a.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];

    // Get deployment block if not stored
    let deploymentBlock = contract.deploymentBlock;
    if (!deploymentBlock && contract.address && contract.chain) {
      try {
        const rpcUrls = getRpcUrls(contract.chain);
        const rpcClient = contract.chain.toLowerCase() === 'starknet' 
          ? new StarknetRpcClient(rpcUrls)
          : new EthereumRpcClient(rpcUrls);
        
        deploymentBlock = await findDeploymentBlock(rpcClient, contract.address);
        
        // Update user data with deployment block
        await UserStorage.update(req.user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              deploymentBlock
            }
          }
        });
      } catch (error) {
        console.warn('Failed to find deployment block:', error.message);
      }
    }

    // Extract block range from analysis
    const blockRange = latestAnalysis?.metadata?.blockRange || 
                      latestAnalysis?.results?.target?.summary?.blockRange || 
                      null;

    const blocksIndexed = blockRange ? (blockRange.end - blockRange.start + 1) : 0;

    res.json({
      onboardedDate: contract.startDate,
      deploymentBlock: deploymentBlock || null,
      blocksIndexed,
      blockRange: blockRange ? {
        start: blockRange.start,
        end: blockRange.end,
        deployment: deploymentBlock,
        total: blocksIndexed
      } : null,
      isIndexed: contract.isIndexed,
      indexingProgress: contract.indexingProgress || 0
    });

  } catch (error) {
    console.error('Contract info error:', error);
    res.status(500).json({
      error: 'Failed to get contract information',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/indexing-status
 * Returns current indexing status and progress
 */
router.get('/indexing-status', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(404).json({
        error: 'No default contract found'
      });
    }

    const contract = user.onboarding.defaultContract;
    
    // Get running analysis if any
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const runningAnalysis = analyses.find(a => 
      a.metadata?.isDefaultContract && 
      (a.status === 'running' || a.status === 'pending')
    );

    res.json({
      isIndexed: contract.isIndexed,
      progress: contract.indexingProgress || 0,
      status: runningAnalysis?.status || (contract.isIndexed ? 'completed' : 'not_started'),
      currentStep: runningAnalysis?.currentStep || null,
      analysisId: runningAnalysis?.id || null,
      estimatedCompletion: runningAnalysis ? estimateCompletion(runningAnalysis) : null
    });

  } catch (error) {
    console.error('Indexing status error:', error);
    res.status(500).json({
      error: 'Failed to get indexing status',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/block-metrics
 * Returns detailed block and transaction metrics
 */
router.get('/block-metrics', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(404).json({
        error: 'No default contract found'
      });
    }

    // Get latest completed analysis
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    const latestAnalysis = analyses
      .filter(a => a.metadata?.isDefaultContract && a.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];

    if (!latestAnalysis) {
      return res.json({
        totalTransactions: 0,
        blocksProcessed: 0,
        blockRange: null,
        transactionDensity: 0,
        avgTransactionsPerBlock: 0
      });
    }

    const transactions = latestAnalysis.results?.target?.transactions || [];
    const blockRange = latestAnalysis.metadata?.blockRange || 
                      latestAnalysis.results?.target?.summary?.blockRange;

    const blocksProcessed = blockRange ? (blockRange.end - blockRange.start + 1) : 0;
    const transactionDensity = blocksProcessed > 0 ? transactions.length / blocksProcessed : 0;

    // Calculate blocks with transactions
    const blocksWithTxs = new Set(transactions.map(tx => tx.blockNumber)).size;

    res.json({
      totalTransactions: transactions.length,
      blocksProcessed,
      blocksWithTransactions: blocksWithTxs,
      blockRange,
      transactionDensity: Number(transactionDensity.toFixed(4)),
      avgTransactionsPerBlock: Number((transactions.length / Math.max(blocksWithTxs, 1)).toFixed(2)),
      lastUpdated: latestAnalysis.metadata?.lastLiveUpdate || latestAnalysis.completedAt
    });

  } catch (error) {
    console.error('Block metrics error:', error);
    res.status(500).json({
      error: 'Failed to get block metrics',
      message: error.message
    });
  }
});

// Helper functions
function getRpcUrls(chain) {
  const map = {
    ethereum: [
      process.env.ETHEREUM_RPC_URL1,
      process.env.ETHEREUM_RPC_URL2,
      process.env.ETHEREUM_RPC_URL3,
    ].filter(Boolean),
    starknet: [
      process.env.STARKNET_RPC_URL1,
      process.env.STARKNET_RPC_URL2,
      process.env.STARKNET_RPC_URL3,
    ].filter(Boolean),
  };
  return map[chain.toLowerCase()] || map.ethereum;
}

async function findDeploymentBlock(rpcClient, contractAddress) {
  try {
    const currentBlock = await rpcClient.getBlockNumber();
    
    // Binary search for deployment block
    let left = 0;
    let right = currentBlock;
    let deploymentBlock = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      try {
        const code = await rpcClient._makeRpcCall('eth_getCode', [contractAddress, '0x' + mid.toString(16)]);
        
        if (code === '0x') {
          // Contract doesn't exist at mid, search right
          left = mid + 1;
        } else {
          // Contract exists at mid, search left for earlier deployment
          deploymentBlock = mid;
          right = mid - 1;
        }
      } catch (error) {
        // On error, try moving right
        left = mid + 1;
      }
    }

    return deploymentBlock;
  } catch (error) {
    console.warn('Deployment block search failed:', error.message);
    return null;
  }
}

function estimateCompletion(analysis) {
  if (!analysis.createdAt || !analysis.progress) return null;
  
  const startTime = new Date(analysis.createdAt).getTime();
  const now = Date.now();
  const elapsed = now - startTime;
  
  if (analysis.progress <= 0) return null;
  
  const totalEstimated = (elapsed / analysis.progress) * 100;
  const remaining = totalEstimated - elapsed;
  
  return new Date(now + remaining).toISOString();
}

export default router;
