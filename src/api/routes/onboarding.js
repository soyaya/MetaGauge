/**
 * Onboarding routes
 * Handles user onboarding process with default contract setup
 */

import express from 'express';
import { UserStorage, ContractStorage, AnalysisStorage } from '../database/index.js';
import { SmartContractFetcher } from '../../services/SmartContractFetcher.js';
import { OptimizedQuickScan } from '../../services/OptimizedQuickScan.js';
import { ProgressiveDataFetcher } from '../../services/ProgressiveDataFetcher.js';
import { performContinuousContractSync } from './continuous-sync-improved.js';
import { initializeStreamingIndexer } from '../../indexer/index.js';
import SubscriptionService from '../../services/SubscriptionService.js';
import { triggerDefaultContractIndexing } from './trigger-indexing.js';
import { MetricsNormalizer } from '../../services/MetricsNormalizer.js';

// Get streaming indexer from server
let streamingIndexer = null;
export function setStreamingIndexer(indexer) {
  streamingIndexer = indexer;
}

const router = express.Router();

/**
 * @swagger
 * /api/onboarding/status:
 *   get:
 *     summary: Get user onboarding status
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 */
router.get('/status', async (req, res) => {
  // Set headers immediately to prevent any middleware from adding content
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Check for running continuous sync
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const runningContinuousSync = allAnalyses.find(analysis => 
      (analysis.status === 'running' || analysis.status === 'pending') &&
      analysis.metadata?.isDefaultContract === true &&
      analysis.metadata?.continuous === true
    );
    
    // Get current analysis for progress details (but don't include full analysis object)
    const currentAnalysis = allAnalyses.find(analysis =>
      (analysis.status === 'running' || analysis.status === 'pending') &&
      analysis.metadata?.isDefaultContract === true
    );

    // Safely extract currentStep (ensure it's a string)
    let currentStep = '';
    try {
      currentStep = user.onboarding?.defaultContract?.currentStep || 
                    (currentAnalysis ? String(currentAnalysis.currentStep || currentAnalysis.metadata?.currentStep || '') : '') ||
                    '';
      // Ensure it's a string and not an object
      if (typeof currentStep !== 'string') {
        currentStep = '';
      }
      // Limit length to prevent huge strings
      if (currentStep.length > 200) {
        currentStep = currentStep.substring(0, 200);
      }
    } catch (e) {
      currentStep = '';
    }

    // Create clean response object with no circular references
    const response = {
      completed: Boolean(user.onboarding?.completed),
      hasDefaultContract: Boolean(user.onboarding?.defaultContract?.address),
      isIndexed: Boolean(user.onboarding?.defaultContract?.isIndexed),
      indexingProgress: Number(user.onboarding?.defaultContract?.indexingProgress || 0),
      currentStep: String(currentStep),
      continuousSync: Boolean(runningContinuousSync || user.onboarding?.defaultContract?.continuousSync),
      continuousSyncActive: Boolean(runningContinuousSync)
    };

    // End response immediately
    res.status(200);
    return res.end(JSON.stringify(response));
  } catch (error) {
    console.error('Onboarding status error:', error);
    res.status(500);
    return res.end(JSON.stringify({
      error: 'Failed to get onboarding status',
      message: String(error.message || 'Unknown error')
    }));
  }
});

/**
 * @swagger
 * /api/onboarding/complete:
 *   post:
 *     summary: Complete user onboarding with default contract
 *     tags: [Onboarding]
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
 *               - contractName
 *               - purpose
 *               - category
 *               - startDate
 *             properties:
 *               socialLinks:
 *                 type: object
 *                 properties:
 *                   website:
 *                     type: string
 *                   twitter:
 *                     type: string
 *                   discord:
 *                     type: string
 *                   telegram:
 *                     type: string
 *               logo:
 *                 type: string
 *               contractAddress:
 *                 type: string
 *               chain:
 *                 type: string
 *               contractName:
 *                 type: string
 *               abi:
 *                 type: string
 *               purpose:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [defi, nft, gaming, dao, infrastructure, other]
 *               startDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/complete', async (req, res) => {
  console.log('🎯 Onboarding complete endpoint called');
  try {
    const {
      socialLinks = {},
      logo,
      contractAddress,
      chain,
      contractName,
      abi,
      purpose,
      category,
      startDate
    } = req.body;

    // Validation
    if (!contractAddress || !chain || !contractName || !purpose || !category || !startDate) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Contract address, chain, name, purpose, category, and start date are required'
      });
    }

    const validCategories = ['defi', 'nft', 'gaming', 'dao', 'infrastructure', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        message: `Category must be one of: ${validCategories.join(', ')}`
      });
    }

    // Update user with onboarding data
    const onboardingData = {
      completed: true,
      socialLinks: {
        website: socialLinks.website || null,
        twitter: socialLinks.twitter || null,
        discord: socialLinks.discord || null,
        telegram: socialLinks.telegram || null
      },
      logo: logo || null,
      defaultContract: {
        address: contractAddress,
        chain,
        abi: abi || null,
        name: contractName,
        purpose,
        category,
        startDate: startDate || new Date().toISOString(),
        isIndexed: false,
        indexingProgress: 0,
        lastAnalysisId: null
      }
    };

    const updatedUser = await UserStorage.update(req.user.id, {
      onboarding: onboardingData
    });

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Mark all old contract configs as NOT default
    const allContracts = await ContractStorage.findByUserId(req.user.id);
    for (const contract of allContracts) {
      if (contract.isDefault) {
        await ContractStorage.update(contract.id, { isDefault: false, isActive: false });
        console.log(`📋 Marked old contract ${contract.id} as not default`);
      }
    }

    // Mark all old analyses as NOT default contract
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    for (const analysis of allAnalyses) {
      if (analysis.metadata?.isDefaultContract) {
        await AnalysisStorage.update(analysis.id, {
          metadata: {
            ...analysis.metadata,
            isDefaultContract: false,
            replacedByNewDefault: true,
            replacedAt: new Date().toISOString()
          }
        });
        console.log(`📋 Marked old analysis ${analysis.id} as not default`);
      }
    }

    // Create default contract configuration
    const contractConfig = {
      userId: req.user.id,
      name: contractName,
      description: `Default contract for ${contractName} - ${purpose}`,
      targetContract: {
        address: contractAddress,
        chain,
        name: contractName,
        abi: abi || null
      },
      competitors: [],
      rpcConfig: getDefaultRpcConfig(),
      analysisParams: getDefaultAnalysisParams(),
      tags: ['default', category],
      isActive: true,
      isDefault: true
    };

    const savedConfig = await ContractStorage.create(contractConfig);
    console.log(`📋 Created contract config: ${savedConfig.id}`);

    // Respond immediately to user
    res.json({
      message: 'Onboarding completed successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        onboarding: updatedUser.onboarding
      },
      defaultContractId: savedConfig.id,
      indexingStarted: true
    });

    // Do heavy work in background (subscription fetch + indexing)
    setImmediate(async () => {
      try {
        console.log('🚀 [ONBOARDING] Starting background indexing...');
        
        // Get user's subscription tier
        let userTier = 'free';
        try {
          if (req.user.walletAddress) {
            const subscriptionInfo = await SubscriptionService.getSubscriptionInfo(req.user.walletAddress);
            userTier = subscriptionInfo.tierName.toLowerCase();
            await UserStorage.update(req.user.id, { tier: userTier });
            console.log(`✅ [ONBOARDING] User subscription tier: ${userTier}`);
          }
        } catch (error) {
          console.warn('[ONBOARDING] Could not fetch subscription from contract, using free tier:', error.message);
        }

        // Trigger indexing with proper error handling
        console.log(`🚀 [ONBOARDING] Starting indexing for user ${req.user.id} (tier: ${userTier})`);
        
        const { triggerDefaultContractIndexing } = await import('./trigger-indexing.js');
        
        // Create mock response that logs everything
        let indexingSuccess = false;
        let indexingError = null;
        
        const mockRes = {
          json: (data) => {
            console.log('✅ [ONBOARDING] Indexing response:', JSON.stringify(data, null, 2));
            indexingSuccess = true;
            return mockRes;
          },
          status: (code) => {
            console.log(`📊 [ONBOARDING] Indexing status code: ${code}`);
            if (code >= 400) {
              console.error(`❌ [ONBOARDING] Indexing failed with status ${code}`);
              indexingSuccess = false;
            }
            return mockRes;
          },
          send: (data) => {
            console.log('📤 [ONBOARDING] Indexing send:', data);
            return mockRes;
          }
        };
        
        await triggerDefaultContractIndexing(req, mockRes);
        
        if (indexingSuccess) {
          console.log('✅ [ONBOARDING] Background indexing completed successfully');
        } else {
          console.error('❌ [ONBOARDING] Background indexing may have failed - check logs above');
        }
        
      } catch (error) {
        console.error('❌ [ONBOARDING] Background indexing failed:', error);
        console.error('[ONBOARDING] Error message:', error.message);
        console.error('[ONBOARDING] Error stack:', error.stack);
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to complete onboarding',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/onboarding/default-contract:
 *   get:
 *     summary: Get default contract information and metrics
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default contract data retrieved successfully
 */
router.get('/default-contract', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user || !user.onboarding?.defaultContract?.address) {
      return res.status(404).json({
        error: 'No default contract found',
        message: 'User has not completed onboarding or has no default contract'
      });
    }

    const defaultContract = user.onboarding.defaultContract;
    
    // Get all analyses for this default contract
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const defaultContractAnalyses = allAnalyses.filter(analysis => 
      analysis.results?.target?.contract?.address?.toLowerCase() === defaultContract.address.toLowerCase() ||
      analysis.metadata?.isDefaultContract === true
    );

    // Get the most recent completed analysis (prioritize lastAnalysisId if available)
    let latestAnalysis = null;
    if (defaultContract.lastAnalysisId) {
      latestAnalysis = await AnalysisStorage.findById(defaultContract.lastAnalysisId);
    }
    
    // If no lastAnalysisId or analysis not found, get the most recent completed analysis
    if (!latestAnalysis) {
      const completedAnalyses = defaultContractAnalyses
        .filter(a => a.status === 'completed')
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));
      
      if (completedAnalyses.length > 0) {
        latestAnalysis = completedAnalyses[0];
        // Update the lastAnalysisId to the most recent completed analysis
        const userToUpdate = await UserStorage.findById(req.user.id);
        const updatedOnboardingData = {
          ...userToUpdate.onboarding,
          defaultContract: {
            ...userToUpdate.onboarding.defaultContract,
            lastAnalysisId: latestAnalysis.id
          }
        };
        await UserStorage.update(req.user.id, { onboarding: updatedOnboardingData });
      }
    }

    // Normalize metrics to ensure valid values
    const normalizedMetrics = latestAnalysis?.results?.target?.metrics && !latestAnalysis.results.target.metrics.error
      ? MetricsNormalizer.normalizeDeFiMetrics(latestAnalysis.results.target.metrics)
      : MetricsNormalizer.getDefaultDeFiMetrics();

    // Normalize behavior data
    const normalizedBehavior = latestAnalysis?.results?.target?.behavior
      ? MetricsNormalizer.normalizeUserBehavior(latestAnalysis.results.target.behavior)
      : MetricsNormalizer.getDefaultUserBehavior();

    res.json({
      contract: defaultContract,
      metrics: normalizedMetrics,
      // Include full analysis results for detailed metrics display
      fullResults: latestAnalysis?.results?.target ? {
        ...latestAnalysis.results.target,
        defiMetrics: normalizedMetrics,
        userBehavior: normalizedBehavior
      } : null,
      indexingStatus: {
        isIndexed: defaultContract.isIndexed,
        progress: defaultContract.indexingProgress
      },
      // Include subscription information
      subscription: latestAnalysis?.metadata?.subscription || {
        tier: defaultContract.subscriptionTier || 'Free',
        tierNumber: 0,
        historicalDays: 7,
        continuousSync: false
      },
      blockRange: latestAnalysis?.metadata?.blockRange || null,
      analysisHistory: {
        total: defaultContractAnalyses.length,
        completed: defaultContractAnalyses.filter(a => a.status === 'completed').length,
        latest: latestAnalysis ? {
          id: latestAnalysis.id,
          status: latestAnalysis.status,
          createdAt: latestAnalysis.createdAt,
          completedAt: latestAnalysis.completedAt,
          hasError: !!(latestAnalysis.results?.target?.metrics?.error)
        } : null
      },
      // Include error information if analysis failed
      analysisError: latestAnalysis?.results?.target?.metrics?.error || null
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get default contract data',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/onboarding/user-metrics:
 *   get:
 *     summary: Get overall user analysis metrics
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User metrics retrieved successfully
 */
router.get('/user-metrics', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Get all user's analyses
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const completedAnalyses = allAnalyses.filter(a => a.status === 'completed');

    // Get all user's contracts
    const allContracts = await ContractStorage.findByUserId(req.user.id);

    // Calculate metrics
    const totalContracts = allContracts.length;
    const totalAnalyses = allAnalyses.length;
    const completedAnalysesCount = completedAnalyses.length;
    const failedAnalyses = allAnalyses.filter(a => a.status === 'failed').length;
    const runningAnalyses = allAnalyses.filter(a => a.status === 'running' || a.status === 'pending').length;

    // Calculate average execution time
    const completedWithTime = completedAnalyses.filter(a => a.metadata?.executionTimeMs);
    const avgExecutionTime = completedWithTime.length > 0 
      ? completedWithTime.reduce((sum, a) => sum + a.metadata.executionTimeMs, 0) / completedWithTime.length
      : 0;

    // Get unique chains analyzed
    const chainsAnalyzed = new Set();
    completedAnalyses.forEach(analysis => {
      if (analysis.results?.target?.contract?.chain) {
        chainsAnalyzed.add(analysis.results.target.contract.chain);
      }
    });

    // Monthly analysis count
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyAnalyses = allAnalyses.filter(analysis => {
      const analysisDate = new Date(analysis.createdAt);
      return analysisDate.getMonth() === currentMonth && analysisDate.getFullYear() === currentYear;
    }).length;

    res.json({
      overview: {
        totalContracts,
        totalAnalyses,
        completedAnalyses: completedAnalysesCount,
        failedAnalyses,
        runningAnalyses,
        monthlyAnalyses,
        chainsAnalyzed: Array.from(chainsAnalyzed),
        avgExecutionTimeMs: Math.round(avgExecutionTime)
      },
      subscription: user.subscription || {
        tier: 0,
        tierName: 'Free',
        isActive: false,
        features: {},
        limits: {}
      },
      usage: user.usage,
      limits: {
        monthly: user.subscription?.isActive && user.subscription?.features?.apiCallsPerMonth 
          ? user.subscription.features.apiCallsPerMonth 
          : (user.tier === 'free' ? 10 : user.tier === 'pro' ? 100 : user.tier === 'starter' ? 1000 : -1),
        remaining: user.subscription?.isActive && user.subscription?.features?.apiCallsPerMonth
          ? Math.max(0, user.subscription.features.apiCallsPerMonth - (user.usage?.monthlyAnalysisCount || 0))
          : (user.tier === 'free' ? Math.max(0, 10 - (user.usage?.monthlyAnalysisCount || 0)) :
             user.tier === 'pro' ? Math.max(0, 100 - (user.usage?.monthlyAnalysisCount || 0)) : 
             user.tier === 'starter' ? Math.max(0, 1000 - (user.usage?.monthlyAnalysisCount || 0)) : -1)
      },
      recentAnalyses: allAnalyses
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(analysis => ({
          id: analysis.id,
          status: analysis.status,
          analysisType: analysis.analysisType,
          contractAddress: analysis.results?.target?.contract?.address,
          contractName: analysis.results?.target?.contract?.name,
          chain: analysis.results?.target?.contract?.chain,
          createdAt: analysis.createdAt,
          completedAt: analysis.completedAt
        }))
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user metrics',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/onboarding/test-refresh:
 *   post:
 *     summary: Test refresh endpoint
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test successful
 */
router.post('/test-refresh', async (req, res) => {
  res.json({ message: 'Test refresh endpoint works', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /api/onboarding/trigger-indexing:
 *   post:
 *     summary: Manually trigger indexing for default contract
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Indexing started
 */
router.post('/trigger-indexing', triggerDefaultContractIndexing);

/**
 * @swagger
 * /api/onboarding/refresh-default-contract:
 *   post:
 *     summary: Refresh default contract data by running a new analysis
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               continuous:
 *                 type: boolean
 *                 description: Enable continuous syncing mode
 *     responses:
 *       200:
 *         description: Default contract refresh started successfully
 *       404:
 *         description: No default contract found
 */
router.post('/refresh-default-contract', async (req, res) => {
  try {
    const { continuous = false } = req.body;
    console.log(`🔍 DEBUG: Received continuous parameter: ${continuous}, type: ${typeof continuous}`);
    
    const user = await UserStorage.findById(req.user.id);
    if (!user || !user.onboarding?.defaultContract?.address) {
      return res.status(404).json({
        error: 'No default contract found',
        message: 'User has not completed onboarding or has no default contract'
      });
    }

    const defaultContract = user.onboarding.defaultContract;
    
    // Check if there's already a running analysis for this user
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const runningAnalysis = allAnalyses.find(analysis => 
      (analysis.status === 'running' || analysis.status === 'pending') &&
      analysis.metadata?.isDefaultContract === true
    );

    if (runningAnalysis) {
      // If requesting continuous sync but current is not continuous, stop current and start new
      if (continuous && !runningAnalysis.metadata?.continuous) {
        console.log(`🔄 Stopping non-continuous analysis to start continuous sync`);
        await AnalysisStorage.update(runningAnalysis.id, {
          status: 'completed',
          progress: 100,
          metadata: {
            ...runningAnalysis.metadata,
            stoppedForContinuous: true,
            stoppedAt: new Date().toISOString()
          },
          completedAt: new Date().toISOString()
        });
        // Continue to start new continuous sync
      } 
      // If requesting non-continuous but current is continuous, stop continuous and start new
      else if (!continuous && runningAnalysis.metadata?.continuous) {
        console.log(`🛑 Stopping continuous sync to start regular refresh`);
        await AnalysisStorage.update(runningAnalysis.id, {
          status: 'completed',
          progress: 100,
          metadata: {
            ...runningAnalysis.metadata,
            continuous: false,
            stoppedForRegular: true,
            stoppedAt: new Date().toISOString()
          },
          completedAt: new Date().toISOString()
        });
        // Continue to start new regular sync
      }
      // If same type is already running, return existing
      else {
        return res.json({
          message: continuous ? 'Continuous sync already in progress' : 'Default contract refresh already in progress',
          analysisId: runningAnalysis.id,
          status: runningAnalysis.status,
          progress: runningAnalysis.progress || 10,
          continuous: runningAnalysis.metadata?.continuous || false
        });
      }
    }
    
    // Find the default contract configuration
    const allContracts = await ContractStorage.findByUserId(req.user.id);
    const defaultConfig = allContracts.find(c => c.isDefault && c.isActive);
    
    if (!defaultConfig) {
      return res.status(404).json({
        error: 'Default contract configuration not found',
        message: 'Default contract configuration is missing or inactive'
      });
    }

    // Find existing analysis to update instead of creating new one
    let existingAnalysis = null;
    if (defaultContract.lastAnalysisId) {
      existingAnalysis = await AnalysisStorage.findById(defaultContract.lastAnalysisId);
    }
    
    // If no existing analysis found, find the most recent completed one for this default contract
    if (!existingAnalysis) {
      const defaultContractAnalyses = allAnalyses.filter(analysis => 
        analysis.metadata?.isDefaultContract === true
      );
      const completedAnalyses = defaultContractAnalyses
        .filter(a => a.status === 'completed')
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));
      
      if (completedAnalyses.length > 0) {
        existingAnalysis = completedAnalyses[0];
      }
    }

    let analysisId;
    
    if (existingAnalysis) {
      // Update existing analysis instead of creating new one
      console.log(`🔄 Updating existing analysis ${existingAnalysis.id} for refresh (continuous: ${continuous})`);
      
      await AnalysisStorage.update(existingAnalysis.id, {
        status: 'running',
        progress: 10,
        results: continuous ? existingAnalysis.results : null, // Keep existing results in continuous mode
        metadata: {
          ...existingAnalysis.metadata,
          isDefaultContract: true,
          isRefresh: true,
          continuous: continuous,
          continuousStarted: continuous ? new Date().toISOString() : undefined,
          refreshStarted: new Date().toISOString(),
          originalCreatedAt: existingAnalysis.createdAt, // Preserve original creation time
          syncCycle: continuous ? (existingAnalysis.metadata?.syncCycle || 0) + 1 : 1
        },
        errorMessage: null,
        logs: continuous ? 
          [...(existingAnalysis.logs || []), `Starting continuous sync cycle ${(existingAnalysis.metadata?.syncCycle || 0) + 1}...`] :
          ['Starting default contract data refresh...'],
        completedAt: null
      });
      
      analysisId = existingAnalysis.id;
    } else {
      // Create new analysis only if no existing one found
      console.log(`📝 Creating new analysis for default contract refresh (continuous: ${continuous})`);
      
      const analysisData = {
        userId: req.user.id,
        configId: defaultConfig.id,
        analysisType: 'single',
        status: 'running',
        progress: 10,
        results: null,
        metadata: {
          isDefaultContract: true,
          isRefresh: true,
          continuous: continuous,
          searchStrategy: continuous ? 'comprehensive' : 'standard', // Smart search strategy
          smartSearch: true,
          continuousStarted: continuous ? new Date().toISOString() : undefined,
          refreshStarted: new Date().toISOString(),
          syncCycle: 1
        },
        errorMessage: null,
        logs: continuous ? 
          ['Starting continuous sync mode...'] :
          ['Starting default contract data refresh...'],
        completedAt: null
      };

      const analysisResult = await AnalysisStorage.create(analysisData);
      analysisId = analysisResult.id;
    }

    // Update user's default contract with analysis ID and reset indexing status
    const refreshUser = await UserStorage.findById(req.user.id);
    const refreshOnboarding = {
      ...refreshUser.onboarding,
      defaultContract: {
        ...refreshUser.onboarding.defaultContract,
        lastAnalysisId: analysisId,
        isIndexed: false,
        indexingProgress: 10,
        continuousSync: continuous,
        continuousSyncStarted: continuous ? new Date().toISOString() : undefined
      }
    };
    await UserStorage.update(req.user.id, { onboarding: refreshOnboarding });

    // Start analysis asynchronously
    if (continuous) {
      console.log(`🚀 Starting continuous sync for analysis ${analysisId}`);
      // Use the improved continuous sync function directly
      performContinuousContractSync(analysisId, defaultConfig, req.user.id)
        .then(() => {
          console.log(`✅ Continuous sync completed for analysis ${analysisId}`);
        })
        .catch(error => {
          console.error('Continuous contract sync error:', error);
          console.error('Error stack:', error.stack);
          AnalysisStorage.update(analysisId, {
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date().toISOString(),
            metadata: { ...existingAnalysis?.metadata, continuous: false }
          });
          
          // Update user status on error (async)
          (async () => {
            try {
              const errorUser = await UserStorage.findById(req.user.id);
              const errorOnboarding = {
                ...errorUser.onboarding,
                defaultContract: {
                  ...errorUser.onboarding.defaultContract,
                  indexingProgress: 0,
                  isIndexed: false,
                  continuousSync: false
                }
              };
              await UserStorage.update(req.user.id, { onboarding: errorOnboarding });
            } catch (updateError) {
              console.error('Failed to update user on error:', updateError);
            }
          })();
        });
    } else {
      console.log(`🚀 Starting regular refresh for analysis ${analysisId}`);
      
      // Add timeout protection
      const ANALYSIS_TIMEOUT = 3 * 60 * 1000; // 3 minutes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Analysis execution timeout - no response after 3 minutes'));
        }, ANALYSIS_TIMEOUT);
      });
      
      Promise.race([
        performDefaultContractRefresh(analysisId, defaultConfig, req.user.id),
        timeoutPromise
      ])
        .then(() => {
          console.log(`✅ Regular refresh completed for analysis ${analysisId}`);
        })
        .catch(error => {
          console.error('❌ Default contract refresh error:', error);
          console.error('Error stack:', error.stack);
          console.error('Analysis ID:', analysisId);
          console.error('Config:', JSON.stringify(defaultConfig, null, 2));
          
          AnalysisStorage.update(analysisId, {
            status: 'failed',
            errorMessage: error.message || 'Unknown error occurred',
            completedAt: new Date().toISOString(),
            logs: [
              'Analysis failed',
              `Error: ${error.message}`,
              `Stack: ${error.stack?.substring(0, 500)}`
            ]
          }).catch(updateError => {
            console.error('Failed to update analysis on error:', updateError);
          });
          
          // Update user status on error (async)
          (async () => {
            try {
              const errorUser = await UserStorage.findById(req.user.id);
              const errorOnboarding = {
                ...errorUser.onboarding,
                defaultContract: {
                  ...errorUser.onboarding.defaultContract,
                  indexingProgress: 0,
                  isIndexed: false
                }
              };
              await UserStorage.update(req.user.id, { onboarding: errorOnboarding });
            } catch (updateError) {
              console.error('Failed to update user on error:', updateError);
            }
          })();
        });
    }

    console.log(`🔍 DEBUG: About to send response with continuous: ${continuous}`);
    res.json({
      message: continuous ? 'Continuous contract sync started successfully' : 'Default contract refresh started successfully',
      analysisId: analysisId,
      status: 'running',
      progress: 10,
      continuous: continuous,
      isUpdate: !!existingAnalysis
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to refresh default contract',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/onboarding/debug-analysis:
 *   get:
 *     summary: Debug analysis status (development only)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analysis debug information
 */
router.get('/debug-analysis', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all analyses for this user
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    
    // Find running analyses
    const runningAnalyses = allAnalyses.filter(analysis => 
      analysis.status === 'running' || analysis.status === 'pending'
    );
    
    // Find continuous sync analyses
    const continuousAnalyses = allAnalyses.filter(analysis => 
      analysis.metadata?.continuous === true
    );
    
    // Find default contract analyses
    const defaultContractAnalyses = allAnalyses.filter(analysis => 
      analysis.metadata?.isDefaultContract === true
    );

    res.json({
      user: {
        id: user.id,
        onboarding: user.onboarding
      },
      analyses: {
        total: allAnalyses.length,
        running: runningAnalyses.length,
        continuous: continuousAnalyses.length,
        defaultContract: defaultContractAnalyses.length
      },
      runningAnalyses: runningAnalyses.map(a => ({
        id: a.id,
        status: a.status,
        progress: a.progress,
        continuous: a.metadata?.continuous,
        isDefaultContract: a.metadata?.isDefaultContract,
        syncCycle: a.metadata?.syncCycle,
        createdAt: a.createdAt,
        logs: a.logs?.slice(-3) // Last 3 log entries
      })),
      continuousAnalyses: continuousAnalyses.map(a => ({
        id: a.id,
        status: a.status,
        progress: a.progress,
        syncCycle: a.metadata?.syncCycle,
        continuousStarted: a.metadata?.continuousStarted,
        lastCycleStarted: a.metadata?.lastCycleStarted
      }))
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get debug information',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/onboarding/stop-continuous-sync:
 *   post:
 *     summary: Stop continuous syncing for default contract
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Continuous sync stopped successfully
 *       404:
 *         description: No continuous sync in progress
 */
router.post('/stop-continuous-sync', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user || !user.onboarding?.defaultContract?.address) {
      return res.status(404).json({
        error: 'No default contract found',
        message: 'User has not completed onboarding or has no default contract'
      });
    }

    // Find running continuous sync analysis
    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const continuousAnalysis = allAnalyses.find(analysis => 
      (analysis.status === 'running' || analysis.status === 'pending') &&
      analysis.metadata?.isDefaultContract === true &&
      analysis.metadata?.continuous === true
    );

    if (!continuousAnalysis) {
      return res.status(404).json({
        error: 'No continuous sync in progress',
        message: 'No continuous sync is currently running for the default contract'
      });
    }

    // Mark analysis as stopped but completed
    await AnalysisStorage.update(continuousAnalysis.id, {
      status: 'completed',
      progress: 100,
      metadata: {
        ...continuousAnalysis.metadata,
        continuous: false,
        continuousStopped: new Date().toISOString(),
        stoppedByCycle: continuousAnalysis.metadata?.syncCycle || 1
      },
      logs: [
        ...(continuousAnalysis.logs || []),
        `Continuous sync stopped by user after ${continuousAnalysis.metadata?.syncCycle || 1} cycles`
      ],
      completedAt: new Date().toISOString()
    });

    // Update user's continuous sync status
    const stopUser = await UserStorage.findById(req.user.id);
    const stopOnboarding = {
      ...stopUser.onboarding,
      defaultContract: {
        ...stopUser.onboarding.defaultContract,
        continuousSync: false,
        continuousSyncStopped: new Date().toISOString(),
        isIndexed: true,
        indexingProgress: 100
      }
    };
    await UserStorage.update(req.user.id, { onboarding: stopOnboarding });

    res.json({
      message: 'Continuous sync stopped successfully',
      analysisId: continuousAnalysis.id,
      cyclesCompleted: continuousAnalysis.metadata?.syncCycle || 1,
      totalDuration: new Date().getTime() - new Date(continuousAnalysis.metadata?.continuousStarted || continuousAnalysis.createdAt).getTime()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to stop continuous sync',
      message: error.message
    });
  }
});

// Helper functions
function getDefaultRpcConfig() {
  return {
    ethereum: [
      process.env.ETHEREUM_RPC_URL,
      process.env.ETHEREUM_RPC_URL_FALLBACK
    ].filter(Boolean),
    lisk: [
      process.env.LISK_RPC_URL1,
      process.env.LISK_RPC_URL2,
      process.env.LISK_RPC_URL3,
      process.env.LISK_RPC_URL4
    ].filter(Boolean),
    starknet: [
      process.env.STARKNET_RPC_URL1,
      process.env.STARKNET_RPC_URL2,
      process.env.STARKNET_RPC_URL3
    ].filter(Boolean)
  };
}

function getDefaultAnalysisParams() {
  return {
    // Use smart search instead of fixed blockRange
    searchStrategy: 'quick', // Smart quick scan for onboarding
    smartSearch: true,
    whaleThreshold: parseFloat(process.env.WHALE_THRESHOLD_ETH) || 10,
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 5,
    failoverTimeout: parseInt(process.env.FAILOVER_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 2,
    outputFormats: (process.env.OUTPUT_FORMATS || 'json,csv,markdown').split(',')
  };
}

export default router;
