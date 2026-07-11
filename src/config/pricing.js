/**
 * Single source of truth for all pricing, limits, and feature access.
 * Every route, service, and frontend reads from here (via /api/billing/pricing).
 */

export const FREE_QUOTA = {
  analyses:             3,     // free analyses per month
  aiQueries:            3,     // free AI queries (chat + insights) per month
  contracts:            1,     // free contracts
  alerts:               3,     // free alert configs
  historicalTxs:        50,    // free transactions of historical data
  continuousMonitoring: false, // continuous sync requires balance
};

export const PRICING = {
  // Per-use costs (after free quota)
  perAnalysis:          0.10,  // $ per analysis
  perAiQuery:           0.05,  // $ per AI query
  perContractDayActive: 0.10,  // $ per contract per day of continuous monitoring (~$3/mo)
  perContractMonth:     3.00,  // $ per contract per month (display only)
  perAlertEmail:        0.01,  // $ per alert email delivered

  // Free quota — duplicated here so frontend gets everything from one endpoint
  freeAnalyses:         FREE_QUOTA.analyses,
  freeAiQueries:        FREE_QUOTA.aiQueries,
  freeContracts:        FREE_QUOTA.contracts,
  freeAlerts:           FREE_QUOTA.alerts,
};

export const FEATURES = {
  basicAnalytics:      true,
  aiInsights:          true,   // gated by aiQueries quota/balance
  competitiveAnalysis: true,   // gated by aiQueries quota/balance
  export:              true,
  continuousSync:      'balance',
  apiAccess:           'balance',
  extendedHistory:     'balance',
};

export const FEATURED_PRICING = {
  monthly: 20,   // $20/month to feature a project in Discover
  yearly:  200,  // $200/year (~2 months free vs. 12 * $20 = $240)
};

export const LIMITS = {
  maxContractsFree:  FREE_QUOTA.contracts,
  maxAlertsFree:     FREE_QUOTA.alerts,
  maxMessageLength:  4000,
  maxAnalysisPerDay: 20,
};
