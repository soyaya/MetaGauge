/**
 * LifecycleCampaignService
 * Generates targeted on-chain campaign suggestions based on user lifecycle stages.
 * Uses real wallet data from the latest analysis.
 */

const CAMPAIGN_TEMPLATES = {
  new_users: {
    stage: 'New Users (< 7 days)',
    trigger: 'wallets with only 1-2 transactions in the last 7 days',
    campaigns: [
      {
        name: 'Welcome Incentive',
        mechanic: 'Offer a gas rebate or fee discount on the second transaction — reduce the friction to return.',
        onChainAction: 'Deploy a merkle-drop contract with eligible addresses. Users claim by transacting again.',
        estimatedImpact: 'Can lift D7 retention by 8-15%',
        effort: 'medium',
      },
      {
        name: 'Guided First Action',
        mechanic: 'Identify which function new users call first. If it has a high failure rate, simplify or guide them to an easier entry point.',
        onChainAction: 'Add a simplified wrapper function with better error handling and gas estimates.',
        estimatedImpact: 'Reduces early churn by fixing the drop-off point',
        effort: 'high',
      },
    ],
  },
  at_risk: {
    stage: 'At-Risk Users (14-30 days inactive)',
    trigger: 'wallets with transactions 14-30 days ago, none since',
    campaigns: [
      {
        name: 'Re-engagement Window',
        mechanic: 'Create a time-sensitive on-chain event — a yield boost, governance vote, or limited airdrop — that expires in 7 days.',
        onChainAction: 'Snapshot inactive wallets. Deploy time-locked incentive contract claimable only within the window.',
        estimatedImpact: 'Recovers 10-20% of at-risk wallets',
        effort: 'medium',
      },
      {
        name: 'Loyalty Recognition',
        mechanic: 'Acknowledge their past activity with a soulbound token or on-chain badge. Recognition triggers reciprocity.',
        onChainAction: 'Batch mint ERC-1155 loyalty badges to at-risk high-LTV wallets.',
        estimatedImpact: 'Low cost, high signal — shows you value them',
        effort: 'low',
      },
    ],
  },
  churned: {
    stage: 'Churned Users (30+ days inactive)',
    trigger: 'wallets with no transactions in 30+ days',
    campaigns: [
      {
        name: 'Win-Back Airdrop',
        mechanic: 'Airdrop tokens or NFTs to historically active wallets. Make the claim require one transaction to reactivate them.',
        onChainAction: 'Merkle airdrop to churned wallets sorted by historical LTV. Claim requires contract interaction.',
        estimatedImpact: 'Reactivates 5-10% of churned high-value wallets',
        effort: 'medium',
      },
    ],
  },
  power_users: {
    stage: 'Power Users (top 10% by activity)',
    trigger: 'wallets in the top decile of transaction count and LTV',
    campaigns: [
      {
        name: 'Referral Programme',
        mechanic: 'Power users are your best acquisition channel. Give them an on-chain referral code that tracks new user introductions.',
        onChainAction: 'Deploy referral registry contract. Power users mint referral NFTs; new users who transact via referral trigger rewards.',
        estimatedImpact: '1 power user can bring 3-5 new users on average',
        effort: 'high',
      },
      {
        name: 'Governance Access',
        mechanic: 'Give power users a governance role — voting rights, parameter proposals. Creates deeper protocol ownership.',
        onChainAction: 'Issue governance tokens proportional to cumulative LTV. Gate proposals behind minimum token threshold.',
        estimatedImpact: 'Increases power user retention by 20-30%',
        effort: 'high',
      },
    ],
  },
};

export class LifecycleCampaignService {
  /**
   * Generate campaign suggestions based on wallet lifecycle distribution.
   * @param {object} fullReport — from latest analysis
   * @param {object} biData     — from BusinessIntelligenceEngine (LTV + churn)
   */
  static generate(fullReport = {}, biData = {}) {
    const suggestions = [];

    const userLifecycle = fullReport.userLifecycle || fullReport.userBehavior || {};
    const churnRisk     = biData.highRisk || [];
    const ltvSegments   = biData.segments || {};

    // New users — check activation rate
    const activationRate = fullReport.activationMetrics?.activationRate || 0;
    if (activationRate < 50) {
      suggestions.push({
        ...CAMPAIGN_TEMPLATES.new_users,
        urgency: activationRate < 30 ? 'high' : 'medium',
        dataSignal: `Activation rate: ${activationRate.toFixed(1)}% — most new users never return`,
      });
    }

    // At-risk users
    const atRiskCount = churnRisk.filter(w => w.daysSinceLast >= 14 && w.daysSinceLast < 30).length;
    if (atRiskCount > 0) {
      suggestions.push({
        ...CAMPAIGN_TEMPLATES.at_risk,
        urgency: atRiskCount > 10 ? 'high' : 'medium',
        dataSignal: `${atRiskCount} wallet${atRiskCount !== 1 ? 's' : ''} at risk (14-30 days inactive)`,
      });
    }

    // Churned users
    const churnedCount = churnRisk.filter(w => w.daysSinceLast >= 30).length;
    if (churnedCount > 5) {
      suggestions.push({
        ...CAMPAIGN_TEMPLATES.churned,
        urgency: 'low',
        dataSignal: `${churnedCount} wallets churned (30+ days inactive)`,
      });
    }

    // Power users — always suggest if we have high-LTV segment
    const powerUserCount = (ltvSegments.high || []).length;
    if (powerUserCount > 0) {
      suggestions.push({
        ...CAMPAIGN_TEMPLATES.power_users,
        urgency: 'medium',
        dataSignal: `${powerUserCount} high-LTV wallet${powerUserCount !== 1 ? 's' : ''} identified`,
      });
    }

    return suggestions.sort((a, b) =>
      (a.urgency === 'high' ? 0 : a.urgency === 'medium' ? 1 : 2) -
      (b.urgency === 'high' ? 0 : b.urgency === 'medium' ? 1 : 2)
    );
  }
}
