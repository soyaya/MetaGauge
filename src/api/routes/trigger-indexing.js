/**
 * Manual trigger to start indexing for default contract
 * Use this if automatic indexing didn't start after onboarding
 */

import { UserStorage, AnalysisStorage } from '../database/index.js';
import { ethers } from 'ethers';
import ContinuousMonitoringService from '../../services/ContinuousMonitoringService.js';
import SubscriptionService from '../../services/SubscriptionService.js';

export async function triggerDefaultContractIndexing(req, res) {
  try {
    const user = await UserStorage.findById(req.user.id);
    
    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(400).json({
        error: 'No default contract configured',
        message: 'Please complete onboarding first'
      });
    }

    const contract = user.onboarding.defaultContract;
    
    // Check if already indexing
    if (contract.isIndexed) {
      return res.json({
        message: 'Contract already indexed',
        progress: 100
      });
    }

    console.log(`🚀 Manual indexing trigger for ${contract.address}`);

    // Get RPC URLs (returns array for enhanced failover)
    const getRpcUrls = (chain) => {
      const urlArrays = {
        ethereum: [
          process.env.ETHEREUM_RPC_URL1,
          process.env.ETHEREUM_RPC_URL2,
          process.env.ETHEREUM_RPC_URL3
        ].filter(Boolean),
        lisk: [
          process.env.LISK_RPC_URL1,
          process.env.LISK_RPC_URL2,
          process.env.LISK_RPC_URL3
        ].filter(Boolean),
        starknet: [
          process.env.STARKNET_RPC_URL1,
          process.env.STARKNET_RPC_URL2,
          process.env.STARKNET_RPC_URL3
        ].filter(Boolean)
      };
      
      const urls = urlArrays[chain.toLowerCase()] || urlArrays.lisk;
      
      // Fallback to default if no URLs configured
      if (urls.length === 0) {
        const defaults = {
          ethereum: ['https://ethereum-rpc.publicnode.com'],
          lisk: ['https://lisk.drpc.org'],
          starknet: ['https://rpc.starknet.lava.build']
        };
        return defaults[chain.toLowerCase()] || defaults.lisk;
      }
      
      return urls;
    };

    // Determine transaction limit based on tier
    const tierLimits = {
      free: 100,        // Last 100 transactions
      starter: 500,     // Last 500 transactions
      pro: 2000,        // Last 2000 transactions
      enterprise: 10000 // Last 10000 transactions
    };
    
    const userTier = user.tier || 'free';
    const transactionLimit = tierLimits[userTier] || 100;
    
    console.log(`📊 Fetching last ${transactionLimit} transactions for ${userTier} tier`);

    // Get RPC URLs for enhanced client
    const rpcUrls = getRpcUrls(contract.chain);
    
    // Initialize enhanced RPC client early to get current block with failover
    let rpcClient;
    if (contract.chain.toLowerCase() === 'ethereum') {
      const { EthereumRpcClient } = await import('../../services/EthereumRpcClient.js');
      rpcClient = new EthereumRpcClient(rpcUrls, { tier: userTier });
    } else if (contract.chain.toLowerCase() === 'starknet') {
      const { StarknetRpcClient } = await import('../../services/StarknetRpcClient.js');
      rpcClient = new StarknetRpcClient(rpcUrls, { tier: userTier });
    } else {
      const { LiskRpcClient } = await import('../../services/LiskRpcClient.js');
      rpcClient = new LiskRpcClient(rpcUrls, { tier: userTier });
    }
    
    // Get current block using enhanced client with failover
    console.log(`🔍 Getting current block number...`);
    const currentBlock = await rpcClient.getBlockNumber();
    console.log(`✅ Current block: ${currentBlock}`);

    // Start from current block and go backwards (smaller range for free tier)
    const blockRanges = {
      free: 10000,      // Last 10k blocks (~2 days for Ethereum)
      starter: 50000,   // Last 50k blocks (~1 week)
      pro: 200000,      // Last 200k blocks (~1 month)
      enterprise: 500000 // Last 500k blocks (~3 months)
    };
    
    const blockRange = blockRanges[userTier] || 10000;
    const startBlock = Math.max(0, currentBlock - blockRange);

    // Create analysis record
    const analysis = await AnalysisStorage.create({
      userId: req.user.id,
      contractAddress: contract.address,
      chain: contract.chain,
      analysisType: 'quick-index',
      status: 'running',
      progress: 0,
      metadata: {
        isDefaultContract: true,
        startedAt: new Date().toISOString()
      }
    });

    // Start async indexing with progressive updates
    setImmediate(async () => {
      try {
        // Update: Starting
        await updateProgress(10, 'Initializing blockchain connection...');
        
        console.log(`📊 Fetching data from block ${startBlock} to ${currentBlock}`);
        
        // Update: Fetching transactions
        await updateProgress(20, 'Fetching contract transactions...');
        
        const transactions = await rpcClient.getTransactionsByAddress(
          contract.address,
          startBlock,
          currentBlock
        );
        
        console.log(`✅ Found ${transactions.length} transactions`);
        
        // Update: Processing data
        await updateProgress(50, 'Processing transaction data...');
        
        // Calculate metrics progressively
        const metrics = calculateMetrics(transactions);
        
        // Update: Calculating metrics
        await updateProgress(80, 'Calculating analytics metrics...');
        
        // Prepare final results
        const results = {
          contract: {
            address: contract.address,
            chain: contract.chain,
            name: contract.name
          },
          metrics: metrics,
          transactions: transactions.slice(0, 100), // Store first 100
          summary: {
            totalTransactions: transactions.length,
            uniqueUsers: metrics.uniqueUsers,
            blockRange: {
              start: startBlock,
              end: currentBlock,
              total: currentBlock - startBlock
            }
          },
          tier: userTier,
          completedAt: new Date().toISOString()
        };
        
        // Update: Finalizing
        await updateProgress(95, 'Finalizing analysis...');
        
        // Update analysis with complete results
        await AnalysisStorage.update(analysis.id, {
          status: 'completed',
          progress: 100,
          results: { target: results },
          completedAt: new Date().toISOString()
        });
        
        // Update user contract status
        await UserStorage.update(req.user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              isIndexed: true,
              indexingProgress: 100,
              lastAnalysisId: analysis.id
            }
          }
        });
        
        await updateProgress(100, 'Analysis complete!');
        console.log(`✅ Indexing complete: ${transactions.length} transactions analyzed`);
        
        // ✅ AUTO-START CONTINUOUS MONITORING for paid tiers
        try {
          let subscriptionInfo = null;
          if (user.walletAddress) {
            subscriptionInfo = await SubscriptionService.getSubscriptionInfo(user.walletAddress);
          }
          
          if (subscriptionInfo && subscriptionInfo.tier > 0 && subscriptionInfo.isActive) {
            console.log(`🚀 Auto-starting continuous monitoring for ${subscriptionInfo.tierName} tier`);
            
            const monitoringResult = await ContinuousMonitoringService.startMonitoring(
              req.user.id,
              contract,
              {
                tierName: subscriptionInfo.tierName,
                tierNumber: subscriptionInfo.tier,
                continuousSync: true,
                apiCallsPerMonth: ContinuousMonitoringService.getApiLimitForTier(subscriptionInfo.tier)
              },
              analysis.id
            );
            
            if (monitoringResult.success) {
              console.log(`✅ Continuous monitoring started successfully`);
            }
          }
        } catch (monitoringError) {
          console.error(`⚠️ Failed to start continuous monitoring:`, monitoringError);
        }
      } catch (error) {
        console.error(`❌ Indexing failed:`, error);
        await AnalysisStorage.update(analysis.id, {
          status: 'failed',
          errorMessage: error.message
        });
        await UserStorage.update(req.user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              indexingProgress: 0,
              currentStep: `Error: ${error.message}`
            }
          }
        });
      }
    });
    
    // Helper function to update progress
    async function updateProgress(progress, step) {
      try {
        await UserStorage.update(req.user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              indexingProgress: progress,
              currentStep: step
            }
          }
        });
        
        await AnalysisStorage.update(analysis.id, {
          progress: progress,
          currentStep: step
        });
      } catch (err) {
        console.error('Failed to update progress:', err);
      }
    }
    
    // Helper function to calculate metrics
    function calculateMetrics(transactions) {
      const uniqueUsers = new Set(transactions.map(tx => tx.from)).size;
      const totalValue = transactions.reduce((sum, tx) => {
        const value = BigInt(tx.value || '0');
        return sum + value;
      }, BigInt(0));
      
      const totalGasUsed = transactions.reduce((sum, tx) => {
        const gas = BigInt(tx.gasUsed || '0');
        return sum + gas;
      }, BigInt(0));
      
      const successfulTxs = transactions.filter(tx => tx.status).length;
      const failedTxs = transactions.length - successfulTxs;
      
      return {
        transactions: transactions.length,
        uniqueUsers: uniqueUsers,
        totalValue: totalValue.toString(),
        avgGasUsed: transactions.length > 0 ? Number(totalGasUsed / BigInt(transactions.length)) : 0,
        successRate: transactions.length > 0 ? (successfulTxs / transactions.length * 100).toFixed(2) : 0,
        failureRate: transactions.length > 0 ? (failedTxs / transactions.length * 100).toFixed(2) : 0,
        volume: totalValue.toString()
      };
    }

    res.json({
      message: 'Indexing started',
      analysisId: analysis.id,
      progress: 0
    });

  } catch (error) {
    console.error('Failed to trigger indexing:', error);
    res.status(500).json({
      error: 'Failed to start indexing',
      message: error.message
    });
  }
}
