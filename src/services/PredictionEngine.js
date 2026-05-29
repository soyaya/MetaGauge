/**
 * PredictionEngine
 * Uses metrics_history snapshots to forecast business values.
 * All predictions use linear regression + trend adjustment.
 * Called after PatternProfileService.update() and surfaced in dashboard + agent context.
 */

import { MetricsHistoryStorage, PatternProfileStorage } from '../api/database/index.js';

export class PredictionEngine {

  /**
   * Generate full predictions for a user. Returns predictions object.
   * Saves into the pattern_profile so it's available everywhere.
   */
  static async predict(userId) {
    try {
      const history = await MetricsHistoryStorage.get(userId);
      if (history.length < 2) return null;

      const snapshots = history.map(h => h.snapshot || h).filter(s => s);

      const predictions = {
        generatedAt: new Date().toISOString(),
        dataPoints: snapshots.length,
        next30Days: {
          users:       this._forecast(snapshots, 'uniqueUsers', 30),
          transactions: this._forecast(snapshots, 'totalTxs', 30),
          retentionRate: this._forecastBounded(snapshots, 'retentionRate', 30, 0, 100),
          churnRate:    this._forecastBounded(snapshots, 'churnRate', 30, 0, 100),
        },
        timeToMilestone: this._milestones(snapshots),
        churnRisk:       this._churnRisk(snapshots),
        growthScore:     this._growthScore(snapshots),
        confidence:      this._confidence(snapshots),
        summary:         null,
      };

      predictions.summary = this._buildSummary(predictions);

      // Merge into existing pattern profile
      const existing = await PatternProfileStorage.get(userId) || {};
      await PatternProfileStorage.save(userId, { ...existing, predictions });

      return predictions;
    } catch (err) {
      console.warn('[PredictionEngine] predict failed:', err.message);
      return null;
    }
  }

  static async get(userId) {
    const profile = await PatternProfileStorage.get(userId);
    return profile?.predictions || null;
  }

  // ── Core forecasting ───────────────────────────────────────────────────────

  /**
   * Linear regression forecast N days ahead.
   * Returns { value, trend, low, high } (simple confidence interval).
   */
  static _forecast(snapshots, key, days) {
    const vals = snapshots.map((s, i) => ({ x: i, y: s[key] || 0 }));
    if (vals.length < 2) return { value: vals[0]?.y || 0, trend: 'unknown' };

    const { slope, intercept } = this._linReg(vals);
    const nextX = vals.length - 1 + (days / 7); // assume ~weekly snapshots
    const value = Math.max(0, Math.round(slope * nextX + intercept));
    const current = vals[vals.length - 1].y;
    const trend = slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'flat';

    // Simple ±15% confidence interval
    return {
      value,
      current,
      change: value - current,
      changePct: current > 0 ? Math.round(((value - current) / current) * 100) : 0,
      trend,
      low:  Math.max(0, Math.round(value * 0.85)),
      high: Math.round(value * 1.15),
    };
  }

  static _forecastBounded(snapshots, key, days, min, max) {
    const result = this._forecast(snapshots, key, days);
    result.value = Math.min(max, Math.max(min, result.value));
    result.low   = Math.min(max, Math.max(min, result.low));
    result.high  = Math.min(max, Math.max(min, result.high));
    return result;
  }

  /**
   * Estimate days until user count hits each milestone.
   */
  static _milestones(snapshots) {
    const vals = snapshots.map((s, i) => ({ x: i, y: s.uniqueUsers || 0 }));
    if (vals.length < 2) return {};
    const { slope } = this._linReg(vals);
    if (slope <= 0) return {};

    const current = vals[vals.length - 1].y;
    const daysPerSnapshot = 7; // approximate
    const result = {};

    for (const target of [100, 500, 1000, 5000, 10000]) {
      if (current >= target) continue;
      const snapshotsNeeded = (target - current) / slope;
      const days = Math.round(snapshotsNeeded * daysPerSnapshot);
      if (days > 0 && days < 3650) result[`${target}_users`] = { days, date: this._futureDate(days) };
    }
    return result;
  }

  /**
   * Churn risk score 0-100 based on churn trend + retention trend.
   */
  static _churnRisk(snapshots) {
    const churnVals = snapshots.map(s => s.churnRate || 0);
    const retVals   = snapshots.map(s => s.retentionRate || 0);
    const avgChurn  = churnVals.reduce((a, b) => a + b, 0) / churnVals.length;
    const avgRet    = retVals.reduce((a, b) => a + b, 0) / retVals.length;

    // Trend: is churn getting worse?
    const recentChurn = churnVals.slice(-3);
    const churnTrend  = recentChurn.length > 1
      ? recentChurn[recentChurn.length - 1] - recentChurn[0]
      : 0;

    const score = Math.min(100, Math.round(avgChurn * 0.6 + Math.max(0, churnTrend) * 2 + Math.max(0, 50 - avgRet) * 0.4));
    const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
    return { score, level, avgChurn: Math.round(avgChurn), churnTrend: Math.round(churnTrend) };
  }

  /**
   * Growth score 0-100.
   */
  static _growthScore(snapshots) {
    const vals = snapshots.map((s, i) => ({ x: i, y: s.uniqueUsers || 0 }));
    if (vals.length < 2) return { score: 0, label: 'insufficient data' };
    const { slope } = this._linReg(vals);
    const current = vals[vals.length - 1].y;
    const pctPerWeek = current > 0 ? (slope / current) * 100 : 0;
    const score = Math.min(100, Math.max(0, Math.round(50 + pctPerWeek * 5)));
    const label = score >= 75 ? 'strong' : score >= 50 ? 'moderate' : score >= 25 ? 'weak' : 'declining';
    return { score, label, weeklyGrowthPct: Math.round(pctPerWeek * 10) / 10 };
  }

  /**
   * Confidence in predictions based on data quantity and variance.
   */
  static _confidence(snapshots) {
    if (snapshots.length >= 14) return 'high';
    if (snapshots.length >= 7)  return 'medium';
    return 'low';
  }

  static _buildSummary(p) {
    const parts = [];
    const u = p.next30Days.users;
    if (u.trend !== 'unknown') {
      parts.push(`Users projected to ${u.trend === 'up' ? 'grow to' : u.trend === 'down' ? 'drop to' : 'stay around'} ${u.value} in 30 days (${u.changePct > 0 ? '+' : ''}${u.changePct}%)`);
    }
    if (p.churnRisk.level === 'high') parts.push(`High churn risk (score ${p.churnRisk.score}/100) — immediate retention action needed`);
    if (p.growthScore.label === 'strong') parts.push(`Strong growth momentum (+${p.growthScore.weeklyGrowthPct}%/week)`);
    const nextMilestone = Object.entries(p.timeToMilestone)[0];
    if (nextMilestone) parts.push(`Next milestone: ${nextMilestone[0].replace('_', ' ')} in ~${nextMilestone[1].days} days`);
    return parts.join('. ') || 'Insufficient history for predictions.';
  }

  // ── Math helpers ───────────────────────────────────────────────────────────

  static _linReg(points) {
    const n = points.length;
    const sumX  = points.reduce((a, p) => a + p.x, 0);
    const sumY  = points.reduce((a, p) => a + p.y, 0);
    const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
    const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
    const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  static _futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
