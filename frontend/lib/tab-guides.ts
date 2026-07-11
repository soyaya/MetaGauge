/**
 * Single source of truth for "what does this tab do" copy.
 * Used by the per-tab guide popover, the global Help modal, and the
 * first-time dashboard tour — so the three stay in sync automatically.
 */

export interface TabGuideEntry {
  label: string
  description: string
}

export const TAB_ORDER: string[] = [
  'overview', 'metrics', 'users', 'transactions', 'wallets', 'functions',
  'ux', 'intelligence', 'playbooks', 'outreach', 'campaigns', 'financials',
  'discover', 'export', 'agent', 'competitive',
]

export const TAB_GUIDES: Record<string, TabGuideEntry> = {
  overview: {
    label: 'Overview',
    description: 'A snapshot of your contract\'s health at a glance — key growth metrics, recent activity, and indexing status, all in one place.',
  },
  metrics: {
    label: 'Metrics',
    description: 'Detailed on-chain metrics: transaction volume, fees, activity trends, and the raw numbers behind your growth.',
  },
  users: {
    label: 'Users',
    description: 'Who\'s using your contract — new vs. returning users, growth over time, and your top users by activity.',
  },
  transactions: {
    label: 'Txns',
    description: 'A breakdown of individual and aggregated on-chain transactions indexed for your contract.',
  },
  wallets: {
    label: 'Wallets',
    description: 'Wallet-level analytics — balances, behavior segments, and enrichment data for the addresses interacting with your contract.',
  },
  functions: {
    label: 'Functions',
    description: 'Which contract functions get called most, how users move through them (journeys), and cohort analysis by first-use function.',
  },
  ux: {
    label: 'UX',
    description: 'A UX grade for your contract based on transaction success rate, session completion, and failure/bottleneck patterns.',
  },
  intelligence: {
    label: 'Intelligence',
    description: 'Signals beyond the chain — GitHub development activity, community/social sentiment, and risk flags for your project.',
  },
  playbooks: {
    label: 'Playbooks',
    description: 'AI-generated growth playbooks: concrete, prioritized actions based on patterns MetaGauge found in your data.',
  },
  outreach: {
    label: 'Outreach',
    description: 'Targeted wallet segments (e.g. at-risk or high-value users) with AI-drafted outreach messages you can send or export.',
  },
  campaigns: {
    label: 'Campaigns',
    description: 'Lifecycle campaign suggestions — win-back, activation, and retention pushes for specific user segments, ranked by urgency.',
  },
  financials: {
    label: 'Financials',
    description: 'Investor-grade financial documents (income statement, cash flow, balance sheet, unit economics, KPIs) generated from on-chain data plus a few business inputs you provide by chatting with CFO, MetaGauge\'s financial AI.',
  },
  discover: {
    label: 'Discover',
    description: 'Browse other featured projects, or feature your own project here so investors can find it. Featuring is a paid upgrade ($20/mo or $200/yr).',
  },
  export: {
    label: 'Export',
    description: 'Turn your analysis into shareable, audience-aware content — investor slides, social posts, and reports you can copy or download.',
  },
  agent: {
    label: 'Agent',
    description: 'Your always-on AI agent: churn-risk and growth-score predictions, plus settings for automatic alerts and digest emails.',
  },
  competitive: {
    label: 'Competitive',
    description: 'How your contract stacks up against the competitors you\'ve added — side-by-side metrics and a performance radar chart.',
  },
}
