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
import { PRICING, FREE_QUOTA } from '../../config/pricing.js';
import { triggerDefaultContractIndexing } from './trigger-indexing.js';
import { UxBottleneckDetector } from '../../services/UxBottleneckDetector.js';
import { MetricsNormalizer } from '../../services/MetricsNormalizer.js';
import { isBot } from '../../services/BotDetectionService.js';
import { priceService } from '../../services/PriceService.js';

// Get streaming indexer from server
let streamingIndexer = null;
export function setStreamingIndexer(indexer) {
  streamingIndexer = indexer;
}

// Single source of truth for UX grade thresholds — same instance/defaults used
// by UxBottleneckDetector.gradeUxQuality(), so a contract can't grade differently
// depending on which code path built its report.
const uxGrader = new UxBottleneckDetector();

/**
 * Grade UX quality from completion rate, failure rate, and avg session time
 * (all on the same 0-100 / minutes scale used elsewhere in this file).
 * Requires ALL three thresholds to pass for a given grade — a high completion
 * rate alone no longer masks a high failure rate.
 */
function gradeUx(successRate, failureRate, avgSessionMinutes) {
  if (successRate == null) return 'F';
  const completionRate = successRate / 100;
  const failRate = (failureRate || 0) / 100;
  for (const [grade, t] of Object.entries(uxGrader.uxGradeThresholds)) {
    if (grade === 'F') continue;
    if (completionRate >= t.completionRate && failRate <= t.failureRate && avgSessionMinutes <= t.avgTimeMinutes) {
      return grade;
    }
  }
  return 'F';
}

/**
 * The continuous-sync flow (continuous-sync-improved.js) builds its own
 * fullReport with a completely different shape (snake_case tx fields, no
 * retentionMetrics/activationFunnel/userQualityMetrics/gasAnalysis/interactions).
 * This adapts it to the shape every dashboard tab is written against, so
 * contracts on continuous sync don't silently show blank/undefined data.
 * Fields the continuous-sync path never computes are left `null` (same
 * "not computed yet" convention already used throughout this file) rather
 * than guessed.
 */
function adaptContinuousSyncReport(fr) {
  const USER_TYPE_MAP = { whale: 'whale', power_user: 'power', active: 'regular', event_active: 'regular', casual: 'new' };

  const transactions = (fr.transactions || []).map(t => ({
    hash: t.hash,
    from: t.from_address,
    to: t.to_address,
    value: t.value_wei,
    gasUsed: t.gas_used,
    gasPrice: t.gas_price_wei,
    blockNumber: t.block_number,
    blockTimestamp: t.block_timestamp,
    status: t.status,
    input: t.input || '0x',
    chain: t.chain,
  }));

  const users = (fr.users || []).map(u => ({
    address: u.address,
    transactionCount: u.transactionCount,
    totalValue: u.totalValue,
    totalGasSpent: u.totalGasSpent,
    userType: USER_TYPE_MAP[u.userType] || 'regular',
  }));

  const successCount = transactions.filter(t => t.status === true).length;
  const successRate  = transactions.length ? Math.round((successCount / transactions.length) * 100) : null;
  const failedCount  = transactions.length - successCount;
  const failureRate  = transactions.length ? Math.round((failedCount / transactions.length) * 100) : 0;

  const uxGrade    = fr.uxAnalysis?.uxGrade || {};
  const lifecycle  = fr.userLifecycle || {};
  const journeys   = fr.userJourneys || {};

  return {
    summary: {
      totalTransactions: fr.summary?.totalTransactions ?? transactions.length,
      uniqueUsers:        fr.summary?.uniqueUsers ?? users.length,
      successRate,
      totalValueEth:      fr.defiMetrics?.totalValue ?? null,
    },
    transactions,
    gasAnalysis: {
      averageGasPrice: null, averageGasUsed: null,
      totalGasCostUSD: null, averageGasCostUSD: null,
      gasEfficiencyScore: successRate, failedTransactions: failedCount, failureRate,
      ethPriceUsed: null,
    },
    defiMetrics: {
      dau: null, wau: null, mau: null, bounceRate: null,
      activationRate:  lifecycle.activationMetrics?.activationRate ?? null,
      txSuccessRate:   successRate,
      avgSessionDuration: fr.uxAnalysis?.sessionDurations?.averageDuration ?? null,
      avgTimeToActivation: null, avgTimeToFirstInteraction: null,
      totalVolumeEth:  fr.defiMetrics?.totalValue ?? null,
      tvl: null, protocolRevenue: null, feeRateBps: null,
    },
    userBehavior: { loyaltyScore: null, whaleRatio: null, userClassifications: null },
    userLifecycle: { summary: lifecycle.summary || {} },
    retentionMetrics: {
      d1Retention: null, d7Retention: null, d30Retention: null,
      churnRate:      lifecycle.summary?.churnRate ?? null,
      retentionRate:  lifecycle.summary?.retentionRate ?? null,
      resurrectionRate: 0,
    },
    activationMetrics: {
      activationRate: lifecycle.activationMetrics?.activationRate ?? null,
      avgTimeToActivation: null, avgGasToActivateETH: null, avgGasToActivateUSD: null,
      activationFunnel: [], featureFirstUse: [],
    },
    uxAnalysis: {
      uxGrade: {
        grade: uxGrade.grade || 'F',
        score: Math.round((uxGrade.completionRate || 0) * 100),
        completionRate: uxGrade.completionRate ?? null,
        failureRate:    uxGrade.failureRate ?? null,
      },
      sessionDurations: fr.uxAnalysis?.sessionDurations || {},
      bounceRate: null,
    },
    userJourneys: { averageJourneyLength: journeys.averageJourneyLength ?? null },
    userQualityMetrics: { powerUserRate: null, botPct: null, avgSophistication: null, avgWalletQuality: null },
    interactions: { peakInteractionTimes: [] },
    users,
    recommendations: [],
    alerts: [],
  };
}

/**
 * Builds the fullReport shape expected by all dashboard tabs from raw analysis data.
 * Exported so other routes (competitive, metrics) can reuse the same shape.
 */
export function buildFullReportFromAnalysis(rawTxs = [], rawMetrics = {}, rawTarget = {}) {
  if (rawTarget?.fullReport) {
    if (rawTarget.fullReport.metadata?.continuousSync) {
      return adaptContinuousSyncReport(rawTarget.fullReport);
    }
    return rawTarget.fullReport;
  }

  const hexToNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.startsWith('0x')) return parseInt(v, 16);
    return Number(v) || 0;
  };
  const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
  const fmtDur = s => { if (!s) return null; if (s<60) return `${s}s`; if (s<3600) return `${Math.round(s/60)}m`; if (s<86400) return `${Math.round(s/3600)}h`; return `${Math.round(s/86400)}d`; };

  const txs = rawTxs || [];
  const now = Date.now() / 1000;
  const DAY = 86400;
  // Use live price passed in from caller, fall back to 2500
  const ETH_PRICE = rawTarget?._ethPriceUSD || 2500;

  // Per-wallet
  const wm = {};
  txs.forEach(tx => {
    const w = wm[tx.from] = wm[tx.from] || { txs:[], gas:0, value:0, firstTs:Infinity, lastTs:0 };
    w.txs.push(tx);
    w.gas   += hexToNum(tx.gasUsed) * hexToNum(tx.gasPrice);
    w.value += hexToNum(tx.value);
    const ts = tx.blockTimestamp || 0;
    if (ts < w.firstTs) w.firstTs = ts;
    if (ts > w.lastTs)  w.lastTs  = ts;
  });
  const wallets      = Object.entries(wm);
  const totalUsers   = wallets.length;
  const newUsers     = wallets.filter(([,w]) => w.txs.length === 1).length;
  const returning    = wallets.filter(([,w]) => w.txs.length > 1).length;
  const whales       = wallets.filter(([,w]) => w.txs.length >= 10).length;
  const power        = wallets.filter(([,w]) => w.txs.length > 10).length;
  const active24h    = wallets.filter(([,w]) => (now - w.lastTs) < DAY).length;
  const active7d     = wallets.filter(([,w]) => (now - w.lastTs) < 7*DAY).length;
  const active30d    = wallets.filter(([,w]) => (now - w.lastTs) < 30*DAY).length;

  // Success
  const successCount = txs.filter(t => t.status === true || t.status === 1).length;
  const failedCount  = txs.length - successCount;
  const successRate  = txs.length ? Math.round((successCount / txs.length) * 100) : null;
  const failureRate  = txs.length ? Math.round((failedCount  / txs.length) * 100) : 0;

  // Gas
  const gasVals  = txs.map(t => hexToNum(t.gasUsed)).filter(Boolean);
  const gasPriceVals = txs.map(t => hexToNum(t.gasPrice)).filter(Boolean);
  const totalGasWei  = txs.reduce((s,t) => s + hexToNum(t.gasUsed)*hexToNum(t.gasPrice), 0);
  const avgGas       = gasVals.length ? Math.round(gasVals.reduce((a,b)=>a+b,0)/gasVals.length) : 0;
  const avgGasPriceWei = gasPriceVals.length ? Math.round(gasPriceVals.reduce((a,b)=>a+b,0)/gasPriceVals.length) : 0;
  const totalGasUSD  = (totalGasWei/1e18)*ETH_PRICE;
  const avgGasCostUSD = txs.length ? Math.round((totalGasUSD/txs.length)*10000)/10000 : 0;

  // Volume
  const totalWei    = txs.reduce((s,t) => s + hexToNum(t.value), 0);
  const totalETH    = totalWei / 1e18;
  const avgTxSizeETH = txs.length ? (totalETH/txs.length).toFixed(6) : '0';

  // Retention — proper cohort: did the wallet make a tx AFTER the Nth day from their first tx?
  const retRate  = totalUsers ? Math.round((returning/totalUsers)*100) : 0;
  const churn    = 100 - retRate;
  const bounce   = totalUsers ? Math.round((newUsers/totalUsers)*100) : 0;
  const d1 = totalUsers ? Math.round((wallets.filter(([,w]) => {
    const sorted = [...w.txs].sort((a,b)=>(a.blockTimestamp||0)-(b.blockTimestamp||0));
    return sorted.some(t => (t.blockTimestamp||0) > (sorted[0].blockTimestamp||0) + DAY);
  }).length / totalUsers) * 100) : 0;
  const d7 = totalUsers ? Math.round((wallets.filter(([,w]) => {
    const sorted = [...w.txs].sort((a,b)=>(a.blockTimestamp||0)-(b.blockTimestamp||0));
    return sorted.some(t => (t.blockTimestamp||0) > (sorted[0].blockTimestamp||0) + 7*DAY);
  }).length / totalUsers) * 100) : 0;
  const d30 = totalUsers ? Math.round((wallets.filter(([,w]) => {
    const sorted = [...w.txs].sort((a,b)=>(a.blockTimestamp||0)-(b.blockTimestamp||0));
    return sorted.some(t => (t.blockTimestamp||0) > (sorted[0].blockTimestamp||0) + 30*DAY);
  }).length / totalUsers) * 100) : 0;

  // Session (median)
  const sessionArr = wallets.filter(([,w])=>w.txs.length>1).map(([,w])=>w.lastTs-w.firstTs);
  const medSession = median(sessionArr);

  // Time to activation (median)
  const actArr = wallets.filter(([,w])=>w.txs.length>=2).map(([,w])=>{
    const s=[...w.txs].sort((a,b)=>(a.blockTimestamp||0)-(b.blockTimestamp||0));
    return (s[1].blockTimestamp||0)-(s[0].blockTimestamp||0);
  }).filter(s=>s>0);
  const medAct = median(actArr);

  // First tx timestamp
  const timestamps = txs.map(t=>t.blockTimestamp).filter(Boolean).sort((a,b)=>a-b);
  const firstTxTs  = timestamps[0] || 0;

  // Methods
  const METHODS = {'0xa9059cbb':'Transfer','0x095ea7b3':'Approve','0x23b872dd':'TransferFrom','0x40c10f19':'Mint','0x42966c68':'Burn','0x2e1a7d4d':'Withdraw','0xd0e30db0':'Deposit','0x3593564c':'Execute'};
  const fc = {};
  txs.forEach(tx => { const sig=tx.input?.length>=10?tx.input.slice(0,10):'0x'; const l=METHODS[sig]||(sig==='0x'?'ETH Transfer':'Contract Call'); fc[l]=(fc[l]||0)+1; });

  // Peak hours
  const hc = {};
  txs.forEach(tx => { if(tx.blockTimestamp){const h=new Date(tx.blockTimestamp*1000).getUTCHours();hc[h]=(hc[h]||0)+1;} });
  const peakHours = Object.entries(hc).sort(([,a],[,b])=>b-a).slice(0,3).map(([h,c])=>({hour:`${h}:00 UTC`,count:c}));

  // Bot detection — use real heuristics
  const botAddresses = new Set(
    wallets
      .filter(([addr, w]) => isBot({ address: addr, transactions: w.txs }).isBot)
      .map(([addr]) => addr)
  );
  const botCount = botAddresses.size;
  const botPct   = totalUsers ? Math.round((botCount / totalUsers) * 100) : 0;

  // Quality — exclude bots from wallet quality calc
  const powerRate = totalUsers ? Math.round((power/totalUsers)*100) : 0;
  const avgSoph   = totalUsers ? Math.round(wallets.reduce((s,[,w])=>s+new Set(w.txs.map(t=>t.input?.slice(0,10)||'0x')).size,0)/totalUsers*10)/10 : 0;
  const walletQ   = Math.round(retRate*0.4 + powerRate*0.3 + Math.min(avgSoph*10,30));
  const avgJourney = totalUsers ? Math.round(txs.length/totalUsers*10)/10 : 0;

  // Funnel — tabs read: s.step, s.users, s.pct
  const funnel = [
    {step:'Wallets Seen',  users:totalUsers, pct:100},
    {step:'Transacted',    users:totalUsers, pct:100},
    {step:'Returned',      users:returning,  pct:Math.round(returning/Math.max(totalUsers,1)*100)},
    {step:'Active (24h)',  users:active24h,  pct:Math.round(active24h/Math.max(totalUsers,1)*100)},
  ];

  // featureFirstUse — metrics-tab reads f.feature, f.count; ux-tab reads f.feature, f.count
  const featureFirstUse = Object.entries(fc).sort(([,a],[,b])=>b-a)
    .map(([feature,count])=>({feature, name:feature, count, pct:Math.round(count/Math.max(txs.length,1)*100)}));

  // Users table — users-tab reads u.transactionCount, u.totalValue, u.totalGasSpent, u.userType
  const usersTable = wallets.sort(([,a],[,b])=>b.txs.length-a.txs.length).slice(0,20).map(([addr,w])=>({
    address:          addr,
    transactionCount: w.txs.length,
    txCount:          w.txs.length,
    totalValue:       w.value/1e18,
    valueETH:         (w.value/1e18).toFixed(6),
    totalGasSpent:    w.gas/1e18,
    gasSpentETH:      (w.gas/1e18).toFixed(6),
    firstSeen:        w.firstTs,
    lastSeen:         w.lastTs,
    isWhale:          w.txs.length >= 10,
    isNew:            w.txs.length === 1,
    userType:         w.txs.length>=10?'whale':w.txs.length>3?'power':w.txs.length>1?'regular':'new',
  }));

  return {
    summary: {
      totalTransactions: rawMetrics.transactions ?? txs.length,
      uniqueUsers:       rawMetrics.uniqueUsers  ?? totalUsers,
      totalVolume:       totalWei,
      totalValueEth:     totalETH.toFixed(6),
      successRate,
      failureRate,
      avgGasUsed:        avgGas,
    },
    transactions: txs,
    gasAnalysis: {
      avgGasUsed:         avgGas,
      averageGasUsed:     avgGas,
      averageGasPrice:    `${(avgGasPriceWei/1e9).toFixed(2)} gwei`,
      totalGasCostUSD:    Math.round(totalGasUSD*100)/100,
      averageGasCostUSD:  avgGasCostUSD,
      failedTransactions: failedCount,
      failureRate,
      gasEfficiencyScore: successRate,
      ethPriceUsed:       ETH_PRICE,
    },
    defiMetrics: {
      totalVolumeEth:            totalETH,
      totalVolumeUSD:            Math.round(totalETH*ETH_PRICE*100)/100,
      dau: active24h, wau: active7d, mau: active30d,
      bounceRate: bounce,
      activationRate: retRate,
      txSuccessRate: successRate,
      successRate,
      avgSessionDuration:        fmtDur(medSession),
      avgTimeToActivation:       fmtDur(medAct),
      avgTimeToFirstInteraction: firstTxTs ? fmtDur(Math.round(now-firstTxTs)) : null,
      averageTransactionSize:    avgTxSizeETH,
      interactionComplexity:     avgSoph>2?'High':avgSoph>1?'Medium':'Low',
      contractUtilization:       txs.length,
      functionSuccessRate:       successRate,
      protocolStickiness:        retRate,
      recentTransferVolume:      totalETH > 0 ? totalETH : null,
      recentTransferCount:       txs.filter(t=>t.input?.startsWith('0xa9059cbb')).length || null,
      tvl: null, protocolRevenue: null, feeRateBps: null,
    },
    userBehavior: {
      whaleRatio: totalUsers ? Math.round((whales/totalUsers)*100) : 0,
      loyaltyScore: retRate, retentionRate: retRate, churnRate: churn,
      engagementScore: retRate, botActivity: botPct,
      userClassifications: { new:newUsers, returning, whale:whales, active:active24h },
    },
    userLifecycle: {
      summary: { totalUsers, newUsers, returningUsers:returning, activeUsers:active24h, retentionRate:retRate },
    },
    retentionMetrics: {
      d1Retention:d1, d7Retention:d7, d30Retention:d30,
      churnRate:churn, retentionRate:retRate, resurrectionRate:0,
    },
    activationMetrics: {
      activationRate: retRate,
      avgTimeToActivation: fmtDur(medAct),
      avgGasToActivateETH: null,
      avgGasToActivateUSD: null,
      activationFunnel: funnel,
      featureFirstUse,
    },
    uxAnalysis: {
      uxGrade: {
        grade: gradeUx(successRate, failureRate, medSession / 60),
        score: successRate,
        completionRate: successRate!=null ? successRate/100 : null,
        failureRate:    failureRate/100,
      },
      sessionDurations: { averageDuration:fmtDur(medSession), averageDurationMinutes:Math.round(medSession/60) },
      bounceRate: bounce,
    },
    userJourneys: { averageJourneyLength: avgJourney },
    userQualityMetrics: { whaleCount:whales, botCount, botPct, powerUserRate:powerRate, avgWalletQuality:walletQ, avgSophistication:avgSoph },
    interactions: { featureCounts:fc, peakInteractionTimes:peakHours },
    users: usersTable,
    recommendations: rawTarget?.recommendations || [],
    alerts:          rawTarget?.alerts          || [],
  };
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
      startDate,
      defaultContract // Support nested format too
    } = req.body;

    // Support both flat and nested formats
    const address = contractAddress || defaultContract?.address;
    const contractChain = chain || defaultContract?.chain;
    const name = contractName || defaultContract?.name;
    const contractPurpose = purpose || defaultContract?.purpose || 'General';
    const contractCategory = category || defaultContract?.category || 'other';
    const contractStartDate = startDate || defaultContract?.startDate || new Date().toISOString();
    const contractAbi = abi || defaultContract?.abi;

    // Validation
    if (!address || !contractChain || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Contract address, chain, and name are required',
        requiredFields: ['contractAddress or defaultContract.address', 'chain or defaultContract.chain', 'contractName or defaultContract.name']
      });
    }

    const validCategories = ['defi', 'nft', 'gaming', 'dao', 'infrastructure', 'other'];
    if (!validCategories.includes(contractCategory)) {
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
        address,
        chain: contractChain,
        abi: contractAbi || null,
        name,
        purpose: contractPurpose,
        category: contractCategory,
        startDate: contractStartDate,
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

          // Auto-trigger Research Agent for newly indexed contract (Phase 2 §2.4)
          const newContractAddress = req.body?.contractAddress || req.body?.contract_address;
          const newChain           = req.body?.chain || 'ethereum';
          if (newContractAddress) {
            import('../../services/ResearchAgent.js').then(({ default: ResearchAgent }) => {
              ResearchAgent.run({ contractAddress: newContractAddress, chain: newChain })
                .then(() => console.log(`[ResearchAgent] Auto-triggered for newly indexed contract ${newContractAddress}`))
                .catch(e => console.warn(`[ResearchAgent] Auto-trigger failed for ${newContractAddress}: ${e.message}`));
            }).catch(() => {});
          }
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

    // Fetch deployment block if not yet stored (background, non-blocking)
    if (!defaultContract.deploymentBlock && defaultContract.address && defaultContract.chain) {
      setImmediate(async () => {
        try {
          // Use Etherscan API — much faster and accurate vs binary search
          const etherscanKey = process.env.ETHERSCAN_API_KEY;
          if (etherscanKey) {
            const url = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getcontractcreation&contractaddresses=${defaultContract.address}&apikey=${etherscanKey}`;
            const resp = await fetch(url);
            const json = await resp.json();
            const deployBlock = json?.result?.[0]?.blockNumber;
            if (deployBlock) {
              const freshUser = await UserStorage.findById(req.user.id);
              await UserStorage.update(req.user.id, {
                onboarding: {
                  ...freshUser.onboarding,
                  defaultContract: { ...freshUser.onboarding.defaultContract, deploymentBlock: parseInt(deployBlock) },
                },
              });
              console.log(`✅ Deployment block: ${deployBlock} for ${defaultContract.address}`);
            }
          }
        } catch (e) {
          console.warn('⚠️ Could not find deployment block:', e.message);
        }
      });
    }

    // Build fullReport shape that the dashboard tabs expect
    const rawTarget = latestAnalysis?.results?.target;
    const rawMetrics = rawTarget?.metrics || {};
    const rawTxs = rawTarget?.transactions || [];

    const _ethPriceUSD = await priceService.getPrice('eth').catch(() => 2500);
    const builtFullReport = buildFullReportFromAnalysis(rawTxs, rawMetrics, {
      ...rawTarget,
      _ethPriceUSD,
      defiMetrics:  normalizedMetrics,
      userBehavior: normalizedBehavior,
    });

    res.json({
      contract: defaultContract,
      metrics: normalizedMetrics,
      // Include full analysis results for detailed metrics display
      fullResults: rawTarget ? {
        ...rawTarget,
        fullReport: builtFullReport,
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
      blockRange: (() => {
        const br = latestAnalysis?.metadata?.blockRange || latestAnalysis?.results?.target?.summary?.blockRange || null;
        if (!br) return null;
        const start = br.start ?? br.fromBlock ?? null;
        const end   = br.end   ?? br.toBlock   ?? null;
        const deploymentBlock = defaultContract.deploymentBlock ?? null;
        const total = (start != null && end != null) ? end - start : null;
        return { start, end, deployment: deploymentBlock, total };
      })(),
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
        monthly:   FREE_QUOTA.analyses,
        remaining: Math.max(0, FREE_QUOTA.analyses - (user.usage?.monthlyAnalysisCount || 0)),
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

    // Continuous monitoring: check balance covers at least 1 day ($0.17), charge daily via scheduler
    if (continuous) {
      const billing = (await UserStorage.findById(req.user.id))?.billing || {};
      if ((billing.balance || 0) < PRICING.perContractDayActive) {
        return res.status(402).json({
          error: 'Insufficient balance',
          message: `Continuous monitoring costs $${PRICING.perContractDayActive}/day per contract. Your balance is $${billing.balance || 0}. Please top up.`,
          balance: billing.balance || 0,
          required: PRICING.perContractDayActive,
        });
      }
    }
    
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
      
      // performDefaultContractRefresh: re-trigger indexing via triggerDefaultContractIndexing logic
      async function performDefaultContractRefresh(analysisId, config, userId) {
        const { triggerDefaultContractIndexing } = await import('./trigger-indexing.js');
        const mockReq = { user: { id: userId }, body: config, params: {} };
        const mockRes = {
          json: () => {},
          status: () => mockRes,
        };
        return triggerDefaultContractIndexing(mockReq, mockRes);
      }

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

/**
 * POST /api/onboarding/backfill-timestamps
 * Stub — timestamps are stored at index time. Returns current state.
 */
router.post('/backfill-timestamps', async (req, res) => {
  res.json({ success: true, message: 'Timestamps are stored during indexing. No backfill needed.' });
});

export default router;
