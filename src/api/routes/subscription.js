import express from 'express';
import { UserStorage } from '../database/index.js';
import subscriptionService from '../../services/SubscriptionService.js';
import { FREE_QUOTA, PRICING, FEATURES, LIMITS } from '../../config/pricing.js';
import { EthereumRpcClient } from '../../services/EthereumRpcClient.js';

const router = express.Router();

// GET /api/subscription/status
router.get('/status', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const usage   = user.usage   || {};
    const billing = user.billing || { balance: 0 };
    const hasBalance = (billing.balance || 0) > 0;

    const monthlyAnalyses  = usage.monthlyAnalysisCount || 0;
    const monthlyAiQueries = usage.monthlyAiQueryCount  || 0;

    res.json({
      model: 'pay-as-you-go',
      balance: billing.balance || 0,
      freeQuota: FREE_QUOTA,
      freeRemaining: {
        analyses:  Math.max(0, FREE_QUOTA.analyses  - monthlyAnalyses),
        aiQueries: Math.max(0, FREE_QUOTA.aiQueries - monthlyAiQueries),
      },
      limits: {
        monthly:        FREE_QUOTA.analyses,
        remaining:      Math.max(0, FREE_QUOTA.analyses - monthlyAnalyses),
        maxProjects:    FREE_QUOTA.contracts,
        maxAlerts:      FREE_QUOTA.alerts,
        historicalTxs: FREE_QUOTA.historicalTxs,
        maxMessageLength: LIMITS.maxMessageLength,
        maxAnalysisPerDay: LIMITS.maxAnalysisPerDay,
      },
      features: {
        basicAnalytics:      true,
        aiInsights:          monthlyAiQueries < FREE_QUOTA.aiQueries || hasBalance,
        competitiveAnalysis: monthlyAiQueries < FREE_QUOTA.aiQueries || hasBalance,
        continuousSync:      hasBalance,
        apiAccess:           hasBalance,
        extendedHistory:     hasBalance,
        export:              true,
      },
      usage: {
        analysisCount:        usage.analysisCount        || 0,
        monthlyAnalysisCount: monthlyAnalyses,
        aiQueryCount:         usage.aiQueryCount         || 0,
        monthlyAiQueryCount:  monthlyAiQueries,
        lastAnalysis:         usage.lastAnalysis         || null,
        monthlyResetDate:     usage.monthlyResetDate     || null,
      },
      pricing: PRICING,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get subscription status', message: err.message });
  }
});

// GET /api/subscription/usage
router.get('/usage', async (req, res) => {
  try {
    const usage = await subscriptionService.getUsage(req.user.id);
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get usage', message: err.message });
  }
});

// POST /api/subscription/verify — verify on-chain payment and credit balance
router.post('/verify', async (req, res) => {
  try {
    const { transactionHash, chain = 'ethereum' } = req.body;
    if (!transactionHash) return res.status(400).json({ error: 'transactionHash required' });

    const rpcUrls = [process.env.ETHEREUM_RPC_URL, process.env.ETHEREUM_RPC_URL_FALLBACK].filter(Boolean);
    const rpc = new EthereumRpcClient(rpcUrls);
    const tx = await rpc.getTransaction(transactionHash);
    if (!tx) return res.status(400).json({ error: 'Transaction not found on chain' });

    const PAYMENT_ADDRESSES = {
      [process.env.PAYMENT_ADDRESS || '']: true,
    };
    const toAddr = (tx.to || '').toLowerCase();
    if (!PAYMENT_ADDRESSES[toAddr]) {
      return res.status(400).json({ error: 'Transaction recipient does not match payment address' });
    }

    // Convert wei value to ETH, then to USD using a rough rate
    const ethValue = Number(BigInt(tx.value || '0')) / 1e18;
    const ethPriceUSD = parseFloat(process.env.ETH_PRICE_USD || '2500');
    const amountUSD = Number((ethValue * ethPriceUSD).toFixed(2));

    if (amountUSD < 0.01) return res.status(400).json({ error: 'Payment amount too small' });

    const result = await subscriptionService.topUp(req.user.id, amountUSD);

    res.json({ success: true, credited: amountUSD, balance: result.balance });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed', message: err.message });
  }
});

export default router;
