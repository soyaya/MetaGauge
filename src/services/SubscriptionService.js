/**
 * SubscriptionService — Pay-as-you-go metering
 * All rates read from .env. No flat monthly fee.
 * Users are charged per analysis, AI query, and contract monitored.
 */

import { UserStorage } from '../api/database/index.js';

// Read pricing from env with defaults
export const PRICING = {
  perAnalysis:       parseFloat(process.env.PRICE_PER_ANALYSIS       || '0.10'),
  perAiQuery:        parseFloat(process.env.PRICE_PER_AI_QUERY        || '0.05'),
  perContractMonth:  parseFloat(process.env.PRICE_PER_CONTRACT_MONTH  || '5.00'),
  perAlertEmail:     parseFloat(process.env.PRICE_PER_ALERT_EMAIL     || '0.01'),
  freeAnalyses:      parseInt(process.env.FREE_ANALYSES_PER_MONTH     || '10'),
  freeAiQueries:     parseInt(process.env.FREE_AI_QUERIES_PER_MONTH   || '3'),
  freeContracts:     parseInt(process.env.FREE_CONTRACTS               || '1'),
};

// Returns the current month key as "YYYY-MM"
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

class SubscriptionService {
  /**
   * Reset monthly counters if we're in a new month.
   * Mutates usage object in-place and persists if changed.
   */
  async _maybeResetMonthly(userId, usage) {
    const month = currentMonthKey();
    if (usage.currentMonth === month) return usage;

    // New month — reset monthly counters
    const reset = {
      ...usage,
      currentMonth:         month,
      monthlyAnalysisCount: 0,
      monthlyAiQueryCount:  0,
    };
    await UserStorage.update(userId, { usage: reset });
    return reset;
  }

  /**
   * Get current usage and balance for a user.
   */
  async getUsage(userId) {
    const user = await UserStorage.findById(userId);
    if (!user) return null;

    let usage = user.usage || {};
    const billing = user.billing || { balance: 0, totalSpent: 0, transactions: [] };

    // Reset monthly counters if needed
    usage = await this._maybeResetMonthly(userId, usage);

    // Always sync from real analysis records to fix counter drift
    // Exclude onboarding auto-indexing (quick-index) — only count user-initiated analyses
    const { AnalysisStorage } = await import('../api/database/index.js');
    const analyses = await AnalysisStorage.findByUserId(userId);
    const now = new Date();
    const realMonthly = analyses.filter(a => {
      const d = new Date(a.createdAt);
      return d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear() &&
             a.analysisType !== 'quick-index'; // exclude auto-onboarding indexing
    }).length;

    const monthlyAnalyses  = Math.max(usage.monthlyAnalysisCount || 0, realMonthly);
    const monthlyAiQueries = usage.monthlyAiQueryCount || 0;

    // Billable = anything beyond the monthly free quota
    const billableAnalyses  = Math.max(0, monthlyAnalyses  - PRICING.freeAnalyses);
    const billableAiQueries = Math.max(0, monthlyAiQueries - PRICING.freeAiQueries);
    const estimatedBill = Number(
      (billableAnalyses * PRICING.perAnalysis + billableAiQueries * PRICING.perAiQuery).toFixed(2)
    );

    return {
      balance:            billing.balance || 0,
      totalSpent:         billing.totalSpent || 0,
      analysesThisMonth:  monthlyAnalyses,
      aiQueriesThisMonth: monthlyAiQueries,
      totalAnalyses:      usage.analysisCount || 0,
      totalAiQueries:     usage.aiQueryCount  || 0,
      billableAnalyses,
      billableAiQueries,
      estimatedBill,
      pricing: PRICING,
      freeRemaining: {
        analyses:  Math.max(0, PRICING.freeAnalyses  - monthlyAnalyses),
        aiQueries: Math.max(0, PRICING.freeAiQueries - monthlyAiQueries),
      },
    };
  }

  /**
   * Charge a user for a metered action.
   * Returns { allowed, charged, balance }
   *
   * Rules:
   *  - Within free quota → always allowed, cost = 0
   *  - Beyond free quota → deduct from balance; if balance insufficient → blocked
   *  - Errors → blocked (fail closed, never silently allow)
   */
  async charge(userId, action, quantity = 1) {
    const user = await UserStorage.findById(userId);
    if (!user) return { allowed: false, charged: 0, balance: 0, reason: 'user_not_found' };

    let usage   = user.usage   || {};
    const billing = user.billing || { balance: 0, totalSpent: 0, transactions: [] };

    // Reset monthly counters if needed
    usage = await this._maybeResetMonthly(userId, usage);

    let monthlyAnalyses  = usage.monthlyAnalysisCount || 0;
    const monthlyAiQueries = usage.monthlyAiQueryCount  || 0;

    // Sync from real records to fix counter drift (dot-notation bug in old code)
    if (action === 'analysis') {
      try {
        const { AnalysisStorage } = await import('../api/database/index.js');
        const analyses = await AnalysisStorage.findByUserId(userId);
        const now = new Date();
        const real = analyses.filter(a => {
          const d = new Date(a.createdAt);
          return d.getMonth() === now.getMonth() &&
                 d.getFullYear() === now.getFullYear() &&
                 a.analysisType !== 'quick-index'; // exclude auto-onboarding indexing
        }).length;
        monthlyAnalyses = Math.max(monthlyAnalyses, real);
      } catch {}
    }

    let cost = 0;
    if (action === 'analysis') {
      const billable = Math.max(0, (monthlyAnalyses + quantity) - PRICING.freeAnalyses) -
                       Math.max(0, monthlyAnalyses - PRICING.freeAnalyses);
      cost = Number((billable * PRICING.perAnalysis).toFixed(4));

      // Hard block: free quota exhausted AND no balance
      if (monthlyAnalyses >= PRICING.freeAnalyses && billing.balance < PRICING.perAnalysis) {
        return { allowed: false, charged: 0, balance: billing.balance, required: PRICING.perAnalysis, reason: 'quota_exceeded' };
      }
    } else if (action === 'ai_query') {
      const billable = Math.max(0, (monthlyAiQueries + quantity) - PRICING.freeAiQueries) -
                       Math.max(0, monthlyAiQueries - PRICING.freeAiQueries);
      cost = Number((billable * PRICING.perAiQuery).toFixed(4));

      // Hard block: free quota exhausted AND no balance
      if (monthlyAiQueries >= PRICING.freeAiQueries && billing.balance < PRICING.perAiQuery) {
        return { allowed: false, charged: 0, balance: billing.balance, required: PRICING.perAiQuery, reason: 'quota_exceeded' };
      }
    } else if (action === 'alert_email') {
      cost = Number((quantity * PRICING.perAlertEmail).toFixed(4));
    }

    // If cost > 0, check balance
    if (cost > 0 && billing.balance < cost) {
      return { allowed: false, charged: 0, balance: billing.balance, required: cost, reason: 'insufficient_balance' };
    }

    // Deduct balance and increment usage counter
    const newBalance = Number((billing.balance - cost).toFixed(4));
    const tx = { action, quantity, cost, balance: newBalance, at: new Date().toISOString() };

    const updatedUsage = {
      ...usage,
      analysisCount:        (usage.analysisCount  || 0) + (action === 'analysis' ? quantity : 0),
      aiQueryCount:         (usage.aiQueryCount   || 0) + (action === 'ai_query' ? quantity : 0),
      monthlyAnalysisCount: (usage.monthlyAnalysisCount || 0) + (action === 'analysis' ? quantity : 0),
      monthlyAiQueryCount:  (usage.monthlyAiQueryCount  || 0) + (action === 'ai_query' ? quantity : 0),
      lastAnalysis: action === 'analysis' ? new Date().toISOString() : usage.lastAnalysis,
    };

    await UserStorage.update(userId, {
      usage: updatedUsage,
      billing: {
        ...billing,
        balance:      newBalance,
        totalSpent:   Number(((billing.totalSpent || 0) + cost).toFixed(4)),
        transactions: [...(billing.transactions || []).slice(-99), tx],
      },
    });

    return { allowed: true, charged: cost, balance: newBalance };
  }

  /**
   * Top up a user's balance (called after Stripe payment confirmed).
   */
  async topUp(userId, amountUSD) {
    const user = await UserStorage.findById(userId);
    if (!user) throw new Error('User not found');

    const billing = user.billing || { balance: 0, totalSpent: 0, transactions: [] };
    const newBalance = Number((billing.balance + amountUSD).toFixed(2));

    await UserStorage.update(userId, {
      billing: {
        ...billing,
        balance: newBalance,
        transactions: [...(billing.transactions || []).slice(-99), {
          action: 'topup', cost: -amountUSD, balance: newBalance, at: new Date().toISOString()
        }],
      },
    });

    return { balance: newBalance };
  }

  /**
   * Express middleware — checks if user can afford an action.
   * Attaches charge result to req.charge.
   */
  chargeMiddleware(action) {
    return async (req, res, next) => {
      if (!req.user?.id) return next();
      let result;
      try {
        result = await this.charge(req.user.id, action);
      } catch (err) {
        console.error('[Subscription] charge error:', err.message);
        return res.status(500).json({ error: 'Subscription check failed' });
      }
      if (!result.allowed) {
        const isQuota = result.reason === 'quota_exceeded';
        return res.status(402).json({
          error: isQuota ? 'Free quota exhausted' : 'Insufficient balance',
          message: isQuota
            ? `You've used your free ${action === 'analysis' ? 'analyses' : 'AI queries'} for this month. Top up to continue.`
            : `This action costs $${result.required}. Your balance is $${result.balance}. Please top up.`,
          balance: result.balance,
          required: result.required,
          reason: result.reason,
        });
      }
      req.charge = result;
      next();
    };
  }

  // Legacy compat
  getTierName() { return 'pay-as-you-go'; }
  createSubscriptionMiddleware() { return (req, res, next) => next(); }
}

const subscriptionService = new SubscriptionService();
export default subscriptionService;
export { subscriptionService };
