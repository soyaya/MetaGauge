/**
 * Single source of truth for all pricing, limits, and feature access.
 * Every route, service, and frontend reads from here (via /api/billing/pricing).
 */

export const FREE_QUOTA = {
  analyses:             3,    // free analyses per month
  aiQueries:            3,    // free AI queries (chat + insights) per month
  contracts:            1,    // free contracts
  alerts:               3,    // free alert configs
  historicalTxs:        50,   // free transactions of historical data
  continuousMonitoring: false, // continuous sync requires balance
};

export const PRICING = {
  perAnalysis:          0.10,  // $ per analysis after free quota
  perAiQuery:           0.05,  // $ per AI query after free quota
  perContractDayActive: 0.10,  // $ per contract per day of continuous monitoring (~$3/mo)
  perAlertEmail:        0.01,  // $ per alert email delivered
};

export const FEATURES = {
  basicAnalytics:      true,
  aiInsights:          true,   // gated by aiQueries quota/balance
  competitiveAnalysis: true,   // gated by aiQueries quota/balance
  export:              true,
  // Requires balance > 0
  continuousSync:      'balance',  // charged at PRICING.perContractMonth
  apiAccess:           'balance',
  extendedHistory:     'balance',  // beyond FREE_QUOTA.historicalTxs
};

export const LIMITS = {
  maxContractsFree:    FREE_QUOTA.contracts,
  maxAlertsFree:       FREE_QUOTA.alerts,
  maxMessageLength:    4000,   // chars per chat message
  maxAnalysisPerDay:   20,     // hard cap regardless of balance
};
