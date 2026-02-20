/**
 * Quick Scan Integration Example
 * Shows how to use OptimizedQuickScan in analysis routes
 */

import { OptimizedQuickScan } from '../services/OptimizedQuickScan.js';
import { SmartContractFetcher } from '../services/SmartContractFetcher.js';

/**
 * Example: Run optimized quick scan for a contract
 */
export async function runOptimizedQuickScan(contractAddress, chain) {
  console.log(`\n🚀 Starting Optimized Quick Scan`);
  console.log(`📍 Contract: ${contractAddress}`);
  console.log(`🔗 Chain: ${chain}\n`);

  try {
    // Initialize fetcher
    const fetcher = new SmartContractFetcher({
      maxRequestsPerSecond: 10,
      failoverTimeout: 60000
    });

    // Initialize quick scan service
    const quickScan = new OptimizedQuickScan(fetcher, {
      weekInBlocks: 50400,    // ~7 days
      maxScanBlocks: 100000,  // Max 100k blocks
      minScanBlocks: 50000,   // Min 50k blocks
      batchSize: 10           // Batch size for tx fetching
    });

    // Run quick scan
    const results = await quickScan.quickScan(contractAddress, chain);

    // Get statistics
    const stats = quickScan.getStats(results);

    // Return formatted results
    return {
      success: true,
      scanType: 'optimized_quick_scan',
      contract: {
        address: contractAddress,
        chain: chain,
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
        duration: `${results.metrics.scanDuration.toFixed(2)}s`,
        transactionsFound: results.metrics.totalTransactions,
        eventsFound: results.metrics.totalEvents,
        accountsFound: results.metrics.uniqueAccounts,
        blocksScanned: results.metrics.uniqueBlocks,
        deploymentFound: results.deploymentInfo?.found || false,
        deploymentDate: results.deploymentInfo?.date || 'Not found',
        dataQuality: results.metrics.dataQuality
      }
    };

  } catch (error) {
    console.error(`❌ Quick scan failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      scanType: 'optimized_quick_scan'
    };
  }
}

/**
 * Example: Integration with analysis route
 */
export async function integrateQuickScanIntoAnalysis(config, userId) {
  const { targetContract, analysisParams } = config;

  // Check if quick scan is requested
  if (analysisParams.searchStrategy === 'quick') {
    console.log(`⚡ Using Optimized Quick Scan strategy`);

    // Run quick scan
    const quickScanResults = await runOptimizedQuickScan(
      targetContract.address,
      targetContract.chain
    );

    if (quickScanResults.success) {
      return {
        analysisType: 'quick_scan',
        results: quickScanResults,
        metadata: {
          strategy: 'optimized_quick_scan',
          scanDuration: quickScanResults.summary.duration,
          dataQuality: quickScanResults.summary.dataQuality,
          deploymentDetected: quickScanResults.summary.deploymentFound
        }
      };
    } else {
      throw new Error(`Quick scan failed: ${quickScanResults.error}`);
    }
  }

  // Fall back to standard analysis
  return null;
}

/**
 * Example usage in API route:
 * 
 * router.post('/analysis/quick-scan', async (req, res) => {
 *   const { contractAddress, chain } = req.body;
 *   
 *   const results = await runOptimizedQuickScan(contractAddress, chain);
 *   
 *   res.json(results);
 * });
 */

export default {
  runOptimizedQuickScan,
  integrateQuickScanIntoAnalysis
};
