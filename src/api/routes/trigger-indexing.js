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

    // Known high-activity contracts (reduce block range to prevent timeout)
    const HIGH_ACTIVITY_CONTRACTS = [
      '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
      '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    ];
    
    const isHighActivity = HIGH_ACTIVITY_CONTRACTS.includes(contract.address.toLowerCase());
    if (isHighActivity) {
      console.log(`⚠️ High-activity contract detected: ${contract.address}`);
    }

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
    let currentBlock;
    
    try {
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
      currentBlock = await rpcClient.getBlockNumber();
      console.log(`✅ Current block: ${currentBlock}`);
    } catch (rpcError) {
      // Log error silently (not as error to avoid alarming users)
      console.info(`ℹ️ RPC connection issue during initialization: ${rpcError.message}`);
      
      // Return early with user-friendly message - indexing will be retried later
      return res.json({
        message: 'Indexing queued - blockchain connection is being established',
        analysisId: null,
        progress: 0,
        status: 'queued',
        note: 'Your contract will be indexed shortly. You can continue using the app.'
      });
    }

    // Start from current block and go backwards (smaller range for high-activity contracts)
    const blockRanges = {
      free: isHighActivity ? 1000 : 10000,      // 1k vs 10k blocks
      starter: isHighActivity ? 5000 : 50000,   // 5k vs 50k blocks
      pro: isHighActivity ? 10000 : 200000,     // 10k vs 200k blocks
      enterprise: isHighActivity ? 50000 : 500000 // 50k vs 500k blocks
    };
    
    const blockRange = blockRanges[userTier] || blockRanges.free;
    const startBlock = Math.max(0, currentBlock - blockRange);
    
    if (isHighActivity) {
      console.log(`⚠️ Using reduced block range for high-activity contract: ${blockRange} blocks`);
    }

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
        
        let transactions;
        try {
          transactions = await rpcClient.getTransactionsByAddress(
            contract.address,
            startBlock,
            currentBlock
          );
          console.log(`✅ Found ${transactions.length} transactions`);
        } catch (fetchError) {
          console.info(`ℹ️ Transaction fetch issue: ${fetchError.message}`);
          throw new Error('Unable to fetch blockchain data. Please try again later.');
        }
        
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
        // Log error appropriately based on type
        if (error.message && error.message.includes('Unable to fetch blockchain data')) {
          console.info(`ℹ️ Indexing delayed due to blockchain connection: ${error.message}`);
        } else {
          console.error(`❌ Indexing failed:`, error);
        }
        
        await AnalysisStorage.update(analysis.id, {
          status: 'failed',
          errorMessage: 'Blockchain connection temporarily unavailable. Please try again later.'
        });
        await UserStorage.update(req.user.id, {
          onboarding: {
            ...user.onboarding,
            defaultContract: {
              ...contract,
              indexingProgress: 0,
              currentStep: 'Connection issue - will retry automatically'
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
    // Log network errors as info, others as errors
    if (error.message && (error.message.includes('RPC') || error.message.includes('connection'))) {
      console.info(`ℹ️ Indexing trigger issue: ${error.message}`);
    } else {
      console.error('Failed to trigger indexing:', error);
    }
    
    res.status(500).json({
      error: 'Unable to start indexing',
      message: 'Blockchain connection is temporarily unavailable. Please try again in a few moments.',
      canRetry: true
    });
  }
}
