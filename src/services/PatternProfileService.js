/**
 * PatternProfileService
 * Builds and persists a per-user pattern profile after every analysis.
 * Profile accumulates over time — each run adds a snapshot to history
 * and recomputes trends, so the agent always has rich context.
 */

import { PatternProfileStorage, MetricsHistoryStorage } from '../api/database/index.js';
import { PredictionEngine } from './PredictionEngine.js';
import { MilestoneTracker } from './MilestoneTracker.js';

export class PatternProfileService {

  /**
   * Run after every completed analysis.
   * Reads metrics history, computes patterns, saves profile.
   */
  static async update(userId, currentMetrics) {
    try {
      // 1. Persist today's snapshot to metrics_history
      await MetricsHistoryStorage.append(userId, {
        uniqueUsers:    currentMetrics.uniqueUsers    || 0,
        activeUsers:    currentMetrics.activeUsers    || 0,
        newUsers:       currentMetrics.newUsers       || 0,
        transactions:   currentMetrics.transactions   || 0,
        successRate:    currentMetrics.successRate    || 0,
        retentionRate:  currentMetrics.retentionRate  || 0,
        d7Retention:    currentMetrics.d7Retention    || 0,
        churnRate:      currentMetrics.churnRate      || 0,
        avgGasUSD:      currentMetrics.avgGasUSD      || 0,
        totalVolumeUSD: currentMetrics.totalVolumeUSD || 0,
        whaleRatio:     currentMetrics.whaleRatio     || 0,
        botRatio:       currentMetrics.botRatio       || 0,
      });

      // 2. Load history (last 90 days)
      const history = await MetricsHistoryStorage.findByUserId(userId);
      if (!history.length) return null;

      const snapshots = history.map(h => h.snapshot || h);

      // 3. Compute profile
      const profile = {
        updatedAt: new Date().toISOString(),
        dataPoints: snapshots.length,
        growth:     this._growthTrend(snapshots, 'uniqueUsers'),
        retention:  this._trend(snapshots, 'retentionRate'),
        churn:      this._trend(snapshots, 'churnRate'),
        activity:   this._trend(snapshots, 'transactions'),
        gasEfficiency: this._trend(snapshots, 'avgGasUSD'),
        userQuality: this._userQualityTrend(snapshots),
        peakActivity: this._peakActivity(snapshots),
        milestones:  this._checkMilestones(snapshots, currentMetrics),
        summary:     this._buildSummary(snapshots, currentMetrics),
      };

      await PatternProfileStorage.save(userId, profile);

      // Check for newly crossed milestones (non-blocking)
      MilestoneTracker.check(userId, profile.milestones).catch(() => {});

      // Run predictions on top of updated history (non-blocking)
      PredictionEngine.predict(userId).catch(() => {});

      return profile;
    } catch (err) {
      console.warn('[PatternProfileService] update failed:', err.message);
      return null;
    }
  }

  static async get(userId) {
    return PatternProfileStorage.get(userId);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  static _growthTrend(snapshots, key) {
    const vals = snapshots.map(s => s[key] || 0).filter(v => v > 0);
    if (vals.length < 2) return { direction: 'unknown', rate: 0, current: vals[0] || 0 };
    const first = vals[0], last = vals[vals.length - 1];
    const rate = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    const recent = vals.slice(-3);
    const recentDelta = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0;
    return {
      direction: recentDelta > 0 ? 'growing' : recentDelta < 0 ? 'declining' : 'stable',
      rate,
      current: last,
      recentDelta,
    };
  }

  static _trend(snapshots, key) {
    const vals = snapshots.map(s => s[key] || 0);
    if (vals.length < 2) return { avg: vals[0] || 0, direction: 'unknown' };
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
    const recent = vals.slice(-3);
    const delta = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0;
    return { avg, current: vals[vals.length - 1], direction: delta > 0.5 ? 'improving' : delta < -0.5 ? 'declining' : 'stable' };
  }

  static _userQualityTrend(snapshots) {
    const whaleVals = snapshots.map(s => s.whaleRatio || 0);
    const botVals   = snapshots.map(s => s.botRatio   || 0);
    const avgWhale  = whaleVals.reduce((a, b) => a + b, 0) / (whaleVals.length || 1);
    const avgBot    = botVals.reduce((a, b) => a + b, 0)   / (botVals.length   || 1);
    return {
      avgWhaleRatio: Math.round(avgWhale * 10) / 10,
      avgBotRatio:   Math.round(avgBot   * 10) / 10,
      quality: avgBot > 30 ? 'bot-heavy' : avgWhale > 20 ? 'whale-driven' : 'organic',
    };
  }

  static _peakActivity(snapshots) {
    if (!snapshots.length) return null;
    const maxTx = Math.max(...snapshots.map(s => s.transactions || 0));
    const peak  = snapshots.find(s => (s.transactions || 0) === maxTx);
    return { maxTransactions: maxTx, date: peak?.date || null };
  }

  static _checkMilestones(snapshots, current) {
    const milestones = [];
    const thresholds = [10, 50, 100, 500, 1000, 5000, 10000];
    const users = current.uniqueUsers || 0;
    for (const t of thresholds) {
      if (users >= t) milestones.push(`${t}_users`);
    }
    if ((current.retentionRate || 0) >= 40) milestones.push('retention_40pct');
    if ((current.retentionRate || 0) >= 60) milestones.push('retention_60pct');
    if ((current.totalVolumeUSD || 0) >= 1000) milestones.push('volume_1k_usd');
    if ((current.totalVolumeUSD || 0) >= 10000) milestones.push('volume_10k_usd');
    return milestones;
  }

  static _buildSummary(snapshots, current) {
    const growth = this._growthTrend(snapshots, 'uniqueUsers');
    const retention = this._trend(snapshots, 'retentionRate');
    const churn = this._trend(snapshots, 'churnRate');
    const parts = [];
    if (growth.direction !== 'unknown') parts.push(`User base is ${growth.direction} (${growth.rate > 0 ? '+' : ''}${growth.rate}% overall)`);
    if (retention.direction !== 'unknown') parts.push(`Retention is ${retention.direction} (avg ${retention.avg}%)`);
    if (churn.current > 20) parts.push(`High churn at ${churn.current}% — needs attention`);
    return parts.join('. ') || 'Insufficient data for pattern analysis.';
  }
}
