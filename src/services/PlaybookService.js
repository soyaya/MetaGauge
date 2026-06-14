/**
 * PlaybookService
 * Returns a step-by-step growth playbook for a failing metric.
 * Triggered automatically when a task is created for a bad metric.
 */

const PLAYBOOKS = {
  retentionRate7d: {
    title: 'D7 Retention Recovery Playbook',
    problem: 'Users are not returning within 7 days — they are not finding enough value to come back.',
    steps: [
      { step: 1, action: 'Identify drop-off point', detail: 'Check your UX tab — find the transaction type with the highest failure or abandonment rate. That is where users are giving up.' },
      { step: 2, action: 'Segment churned wallets by LTV', detail: 'Export your at-risk wallet list. Focus re-engagement on high-LTV wallets first — they have already proven willingness to transact.' },
      { step: 3, action: 'Reduce friction at drop-off', detail: 'If users are failing on a specific function call, lower gas requirements, improve error messaging, or add a simpler entry point.' },
      { step: 4, action: 'Design a return incentive', detail: 'Create a reason to come back within 7 days — a yield bonus, governance vote, airdrop eligibility window, or streak reward.' },
      { step: 5, action: 'Measure', detail: 'Run a new analysis in 7 days. Target: D7 retention above 25% within 30 days.' },
    ],
    target: 'D7 Retention > 25%',
    timeframe: '30 days',
  },

  churnRate: {
    title: 'Churn Reduction Playbook',
    problem: 'Too many users are leaving and not coming back.',
    steps: [
      { step: 1, action: 'Identify when users churn', detail: 'Check the Users tab cohort table — which cohort (week/month) has the worst drop-off? That tells you if it is an onboarding problem or a retention problem.' },
      { step: 2, action: 'Analyse the last action before churn', detail: 'Look at transactions from churned wallets — what was the last thing they did? A failed tx, a withdrawal, or just inactivity?' },
      { step: 3, action: 'Create a re-engagement window', detail: 'Target wallets inactive for 14-30 days with a time-sensitive incentive. On-chain proof of re-engagement is more credible than email.' },
      { step: 4, action: 'Fix the exit trigger', detail: 'If churn follows failed transactions, fix the contract UX. If it follows withdrawals, improve yield or lock incentives.' },
      { step: 5, action: 'Measure', detail: 'Target: churn rate below 30% within 60 days.' },
    ],
    target: 'Churn Rate < 30%',
    timeframe: '60 days',
  },

  successRate: {
    title: 'Transaction Success Rate Playbook',
    problem: 'Too many transactions are failing — users are wasting gas and losing trust.',
    steps: [
      { step: 1, action: 'Identify which functions are failing', detail: 'Check the Functions tab — sort by failure rate. The top offenders are your priority.' },
      { step: 2, action: 'Check gas estimation', detail: 'Most failures are from underestimated gas limits. Review your contract\'s gas consumption patterns, especially after state changes.' },
      { step: 3, action: 'Add pre-condition checks', detail: 'Add revert messages that tell users exactly why a transaction will fail before they submit it. Reduces wasted gas and frustration.' },
      { step: 4, action: 'Test edge cases', detail: 'Replay the failing transactions in a fork. Identify boundary conditions — slippage, deadline, allowance issues.' },
      { step: 5, action: 'Measure', detail: 'Target: success rate above 95% within 14 days of fixes deployed.' },
    ],
    target: 'Success Rate > 95%',
    timeframe: '14 days',
  },

  botRatio: {
    title: 'Bot Activity Reduction Playbook',
    problem: 'High bot activity is inflating your metrics and potentially extracting value from real users.',
    steps: [
      { step: 1, action: 'Identify bot wallet patterns', detail: 'Check the Wallet Analytics tab — bots typically show very high transaction frequency, identical gas prices, and zero time between transactions.' },
      { step: 2, action: 'Assess the impact', detail: 'Are bots front-running real users? Inflating TVL? Or just passive arbitrage? Each requires a different response.' },
      { step: 3, action: 'Add MEV protection', detail: 'If bots are front-running, consider commit-reveal schemes, private mempools (Flashbots Protect), or time-weighted pricing.' },
      { step: 4, action: 'Add rate limiting', detail: 'For non-MEV bots, add per-wallet transaction rate limits or CAPTCHA-equivalent mechanisms for high-frequency callers.' },
      { step: 5, action: 'Measure', detail: 'Target: bot ratio below 10% within 30 days.' },
    ],
    target: 'Bot Ratio < 10%',
    timeframe: '30 days',
  },

  uniqueUsers: {
    title: 'User Acquisition Playbook',
    problem: 'Not enough unique users are interacting with your contract.',
    steps: [
      { step: 1, action: 'Identify your current acquisition channel', detail: 'Where are existing users coming from? Check referral patterns in transaction data — are they coming in clusters (community-driven) or steadily (organic/SEO)?' },
      { step: 2, action: 'Reduce first-interaction friction', detail: 'What does a new user need to do to interact with your contract for the first time? Every step you remove doubles conversion.' },
      { step: 3, action: 'Leverage your existing community', detail: 'Your current high-LTV wallets are your best acquisition channel. Design a referral mechanism with on-chain proof — verifiable and credible.' },
      { step: 4, action: 'Publish your MetaGauge score', detail: 'Share your public intelligence report link. Verified on-chain metrics build trust with new users faster than marketing copy.' },
      { step: 5, action: 'Measure', detail: 'Track new unique wallets per week. Target: 20% week-over-week growth for 4 consecutive weeks.' },
    ],
    target: '20% weekly user growth',
    timeframe: '30 days',
  },
};

const METRIC_ALIASES = {
  d7Retention: 'retentionRate7d',
  d7_retention: 'retentionRate7d',
  retentionRate: 'retentionRate7d',
  churn: 'churnRate',
  churn_rate: 'churnRate',
  success_rate: 'successRate',
  failureRate: 'successRate',
  botPct: 'botRatio',
  bot_pct: 'botRatio',
  users: 'uniqueUsers',
  unique_users: 'uniqueUsers',
};

export class PlaybookService {
  /**
   * Get playbook for a metric key.
   * @param {string} metric — metric key from task or benchmark
   * @returns {object|null}
   */
  static get(metric) {
    const key = METRIC_ALIASES[metric] || metric;
    return PLAYBOOKS[key] || null;
  }

  /**
   * Get all playbooks for metrics that are in 'bad' or 'warn' status.
   * @param {object} benchmarkResult — from BenchmarkService.benchmark()
   * @returns {Array}
   */
  static getForBenchmarks(benchmarkResult) {
    const playbooks = [];
    for (const [metric, data] of Object.entries(benchmarkResult?.benchmarks || {})) {
      if (data.status === 'bad' || data.status === 'warn') {
        const playbook = PlaybookService.get(metric);
        if (playbook) playbooks.push({ metric, currentValue: data.value, status: data.status, ...playbook });
      }
    }
    // Sort: bad first, then warn
    return playbooks.sort((a, b) => (a.status === 'bad' ? -1 : 1));
  }
}
