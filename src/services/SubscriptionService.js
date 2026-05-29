/**
 * SubscriptionService — Pay-as-you-go metering
 * Single source of truth: src/config/pricing.js
 */

import { UserStorage } from '../api/database/index.js';
import { FREE_QUOTA, PRICING, LIMITS } from '../config/pricing.js';

export { PRICING };

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

class SubscriptionService {
  async _maybeResetMonthly(userId, usage) {
    const month = currentMonthKey();
    if (usage.currentMonth === month) return usage;
    const reset = { ...usage, currentMonth: month, monthlyAnalysisCount: 0, monthlyAiQueryCount: 0, monthlyResetDate: new Date().toISOString() };
    await UserStorage.update(userId, { monthlyAnalysisCount: 0, monthlyResetDate: new Date().toISOString() });
    return reset;
  }

  async getSubscriptionStatus(userId) {
    const user = await UserStorage.findById(userId);
    if (!user) return { limits: { monthly: FREE_QUOTA.analyses, remaining: FREE_QUOTA.analyses, maxProjects: FREE_QUOTA.contracts, maxAlerts: FREE_QUOTA.alerts, historicalDays: FREE_QUOTA.historicalDays } };
    const used = user.usage?.monthlyAnalysisCount || 0;
    return {
      limits: {
        monthly:        FREE_QUOTA.analyses,
        remaining:      Math.max(0, FREE_QUOTA.analyses - used),
        maxProjects:    FREE_QUOTA.contracts,
        maxAlerts:      FREE_QUOTA.alerts,
        historicalDays: FREE_QUOTA.historicalDays,
      }
    };
  }

  async getUsage(userId) {
    const user = await UserStorage.findById(userId);
    if (!user) return null;

    let usage = user.usage || {};
    const billing = user.billing || { balance: 0, totalSpent: 0, transactions: [] };
    usage = await this._maybeResetMonthly(userId, usage);

    const { AnalysisStorage } = await import('../api/database/index.js');
    const analyses = await AnalysisStorage.findByUserId(userId);
    const now = new Date();
    const realMonthly = analyses.filter(a => {
      const d = new Date(a.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && a.analysisType !== 'quick-index';
    }).length;

    const monthlyAnalyses  = Math.max(usage.monthlyAnalysisCount || 0, realMonthly);
    const monthlyAiQueries = usage.monthlyAiQueryCount || 0;
    const billableAnalyses  = Math.max(0, monthlyAnalyses  - FREE_QUOTA.analyses);
    const billableAiQueries = Math.max(0, monthlyAiQueries - FREE_QUOTA.aiQueries);

    return {
      balance:            billing.balance || 0,
      totalSpent:         billing.totalSpent || 0,
      analysesThisMonth:  monthlyAnalyses,
      aiQueriesThisMonth: monthlyAiQueries,
      totalAnalyses:      usage.analysisCount || 0,
      totalAiQueries:     usage.aiQueryCount  || 0,
      billableAnalyses,
      billableAiQueries,
      estimatedBill:      Number((billableAnalyses * PRICING.perAnalysis + billableAiQueries * PRICING.perAiQuery).toFixed(2)),
      pricing:            PRICING,
      freeQuota:          FREE_QUOTA,
      freeRemaining: {
        analyses:  Math.max(0, FREE_QUOTA.analyses  - monthlyAnalyses),
        aiQueries: Math.max(0, FREE_QUOTA.aiQueries - monthlyAiQueries),
      },
    };
  }

  async charge(userId, action, quantity = 1) {
    const user = await UserStorage.findById(userId);
    if (!user) return { allowed: false, charged: 0, balance: 0, reason: 'user_not_found' };

    let usage   = user.usage   || {};
    const billing = user.billing || { balance: 0, totalSpent: 0, transactions: [] };
    usage = await this._maybeResetMonthly(userId, usage);

    let monthlyAnalyses  = usage.monthlyAnalysisCount || 0;
    let monthlyAiQueries = usage.monthlyAiQueryCount  || 0;

    // Sync analysis count from real records
    if (action === 'analysis') {
      try {
        const { AnalysisStorage } = await import('../api/database/index.js');
        const all = await AnalysisStorage.findByUserId(userId);
        const now = new Date();
        const real = all.filter(a => {
          const d = new Date(a.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && a.analysisType !== 'quick-index';
        }).length;
        monthlyAnalyses = Math.max(monthlyAnalyses, real);
      } catch {}
    }

    let cost = 0;
    if (action === 'analysis') {
      const billable = Math.max(0, (monthlyAnalyses + quantity) - FREE_QUOTA.analyses) - Math.max(0, monthlyAnalyses - FREE_QUOTA.analyses);
      cost = Number((billable * PRICING.perAnalysis).toFixed(4));
      if (monthlyAnalyses >= FREE_QUOTA.analyses && billing.balance < PRICING.perAnalysis)
        return { allowed: false, charged: 0, balance: billing.balance, required: PRICING.perAnalysis, reason: 'quota_exceeded' };
    } else if (action === 'ai_query') {
      const billable = Math.max(0, (monthlyAiQueries + quantity) - FREE_QUOTA.aiQueries) - Math.max(0, monthlyAiQueries - FREE_QUOTA.aiQueries);
      cost = Number((billable * PRICING.perAiQuery).toFixed(4));
      if (monthlyAiQueries >= FREE_QUOTA.aiQueries && billing.balance < PRICING.perAiQuery)
        return { allowed: false, charged: 0, balance: billing.balance, required: PRICING.perAiQuery, reason: 'quota_exceeded' };
    } else if (action === 'alert_email') {
      cost = Number((quantity * PRICING.perAlertEmail).toFixed(4));
    } else if (action === 'contract_monitoring') {
      // charged per contract per day active — $0.17/day (~$5/mo)
      cost = Number((quantity * PRICING.perContractDayActive).toFixed(4));
      if (billing.balance < cost)
        return { allowed: false, charged: 0, balance: billing.balance, required: cost, reason: 'insufficient_balance' };
    }

    if (cost > 0 && billing.balance < cost)
      return { allowed: false, charged: 0, balance: billing.balance, required: cost, reason: 'insufficient_balance' };

    const newBalance = Number((billing.balance - cost).toFixed(4));
    const tx = { action, quantity, cost, balance: newBalance, at: new Date().toISOString() };

    await UserStorage.update(userId, {
      usage: {
        ...usage,
        analysisCount:        (usage.analysisCount  || 0) + (action === 'analysis' ? quantity : 0),
        aiQueryCount:         (usage.aiQueryCount   || 0) + (action === 'ai_query' ? quantity : 0),
        monthlyAnalysisCount: (usage.monthlyAnalysisCount || 0) + (action === 'analysis' ? quantity : 0),
        monthlyAiQueryCount:  (usage.monthlyAiQueryCount  || 0) + (action === 'ai_query' ? quantity : 0),
        lastAnalysis: action === 'analysis' ? new Date().toISOString() : (usage.lastAnalysis || null),
        lastAiQuery:  action === 'ai_query' ? new Date().toISOString() : (usage.lastAiQuery  || null),
      },
      billing: {
        ...billing,
        balance:      newBalance,
        totalSpent:   Number(((billing.totalSpent || 0) + cost).toFixed(4)),
        transactions: [...(billing.transactions || []).slice(-99), tx],
      },
    });

    // Warn user when balance drops below $1
    if (cost > 0 && newBalance < 1 && newBalance >= 0) {
      import('./EmailAutomation.js').then(({ EmailAutomation }) =>
        EmailAutomation.sendRegressionAlert(userId, 'Account balance', billing.balance, newBalance)
      ).catch(() => {});
    }

    return { allowed: true, charged: cost, balance: newBalance };
  }

  async topUp(userId, amountUSD) {
    const user = await UserStorage.findById(userId);
    if (!user) throw new Error('User not found');
    const billing = user.billing || { balance: 0, totalSpent: 0, transactions: [] };
    const newBalance = Number((billing.balance + amountUSD).toFixed(2));
    await UserStorage.update(userId, {
      billing: {
        ...billing,
        balance: newBalance,
        transactions: [...(billing.transactions || []).slice(-99), { action: 'topup', cost: -amountUSD, balance: newBalance, at: new Date().toISOString() }],
      },
    });
    return { balance: newBalance };
  }

  chargeMiddleware(action) {
    return async (req, res, next) => {
      if (!req.user?.id) return next();
      let result;
      try { result = await this.charge(req.user.id, action); }
      catch (err) { return res.status(500).json({ error: 'Subscription check failed' }); }
      if (!result.allowed) {
        return res.status(402).json({
          error: result.reason === 'quota_exceeded' ? 'Free quota exhausted' : 'Insufficient balance',
          message: result.reason === 'quota_exceeded'
            ? `You've used your ${action === 'analysis' ? FREE_QUOTA.analyses + ' free analyses' : FREE_QUOTA.aiQueries + ' free AI queries'} for this month. Top up to continue.`
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
}

const subscriptionService = new SubscriptionService();
export default subscriptionService;
export { subscriptionService };
