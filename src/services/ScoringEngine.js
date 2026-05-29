/**
 * ScoringEngine
 * Computes traction, risk, sustainability, and community health scores (0–100)
 * purely from data already in the main app — no external APIs needed.
 */

export class ScoringEngine {
  /**
   * @param {object} traction  — from MainAppClient.getTraction()
   * @param {object} analysis  — from MainAppClient.getAnalysis()
   * @param {object} github    — from GitHubAnalyzer.analyze() (optional)
   */
  static compute(traction, analysis, github = null) {
    const fr = analysis?.results?.target?.fullReport || {};
    const metrics = traction?.metrics || analysis?.results?.target?.metrics || {};
    const ops = traction?.ops || {};

    const tractionScore      = this._traction(fr, metrics, ops);
    const riskScore          = this._risk(fr, metrics, github);
    const sustainabilityScore = this._sustainability(fr, metrics, github);
    const communityHealthScore = this._communityHealth(fr, metrics);
    const growthProbability  = this._growthProbability(tractionScore, riskScore, sustainabilityScore);
    const riskLevel          = this._riskLevel(riskScore);

    return {
      tractionScore,
      riskScore,
      sustainabilityScore,
      communityHealthScore,
      growthProbability,
      confidenceInterval: this._confidence(fr, metrics),
      riskLevel,
    };
  }

  static _traction(fr, metrics, ops) {
    const txVolume      = clamp(normalize(metrics.transactions || 0, 0, 10000), 0, 100);
    const uniqueUsers   = clamp(normalize(metrics.uniqueUsers || 0, 0, 5000), 0, 100);
    const retentionRate = fr.retentionMetrics?.retentionRate || 0;
    const d7            = fr.retentionMetrics?.d7Retention || 0;
    const opsTotal      = ops.total || 0;

    return Math.round(
      txVolume      * 0.20 +
      uniqueUsers   * 0.20 +
      retentionRate * 0.25 +
      d7            * 0.20 +
      opsTotal      * 0.15
    );
  }

  static _risk(fr, metrics, github = null) {
    const failureRate = fr.summary?.failureRate || metrics.failureRate || 0;
    const churnRate   = fr.retentionMetrics?.churnRate || 0;
    const botPct      = fr.userQualityMetrics?.botPct || 0;
    const bounceRate  = fr.defiMetrics?.bounceRate || 0;

    let score = Math.round(
      clamp(failureRate, 0, 100) * 0.25 +
      clamp(churnRate,   0, 100) * 0.25 +
      clamp(botPct,      0, 100) * 0.25 +
      clamp(bounceRate,  0, 100) * 0.15
    );

    // Abandoned repo adds 10 risk points
    if (github?.isAbandoned) score = Math.min(100, score + 10);

    return score;
  }

  static _sustainability(fr, metrics, github = null) {
    const successRate    = fr.summary?.successRate || 0;
    const retentionRate  = fr.retentionMetrics?.retentionRate || 0;
    const walletQuality  = fr.userQualityMetrics?.avgWalletQuality || 0;
    const activationRate = fr.activationMetrics?.activationRate || 0;

    let score = Math.round(
      successRate    * 0.25 +
      retentionRate  * 0.25 +
      walletQuality  * 0.20 +
      activationRate * 0.15
    );

    // GitHub dev health contributes 15% to sustainability
    if (github?.devHealthScore != null) {
      score = Math.round(score * 0.85 + github.devHealthScore * 0.15);
    }

    return Math.min(100, score);
  }

  static _communityHealth(fr, metrics) {
    const botPct        = fr.userQualityMetrics?.botPct || 0;
    const uniqueUsers   = clamp(normalize(metrics.uniqueUsers || 0, 0, 5000), 0, 100);
    const retentionRate = fr.retentionMetrics?.retentionRate || 0;

    // Low bots + high users + good retention = healthy community
    return Math.round(
      (100 - botPct) * 0.40 +
      uniqueUsers    * 0.30 +
      retentionRate  * 0.30
    );
  }

  static _growthProbability(traction, risk, sustainability) {
    // Weighted blend — high traction + low risk + sustainable = high growth probability
    return Math.round(traction * 0.45 + (100 - risk) * 0.30 + sustainability * 0.25);
  }

  static _confidence(fr, metrics) {
    // Confidence is higher when we have more data points
    const txCount = metrics.transactions || 0;
    const userCount = metrics.uniqueUsers || 0;
    if (txCount > 1000 && userCount > 100) return 85;
    if (txCount > 100)  return 65;
    if (txCount > 10)   return 45;
    return 25;
  }

  static _riskLevel(riskScore) {
    if (riskScore >= 75) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function normalize(val, min, max) {
  if (max === min) return 0;
  return ((val - min) / (max - min)) * 100;
}
