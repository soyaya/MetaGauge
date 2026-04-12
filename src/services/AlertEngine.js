/**
 * AlertEngine
 * Checks metric thresholds and fires alerts via WebSocket + storage.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ALERTS_FILE = './data/alerts.json';
const HOUR_MS = 3600 * 1000;

// Default thresholds
const DEFAULTS = {
  retentionDrop: 15,      // D7 retention % below this triggers alert
  whaleInactiveDays: 7,   // whale inactive for N days
  revenueChangePct: 30,   // revenue change % above this triggers alert
  botSurgePct: 20,        // bot activity % above this triggers alert
  churnSpikePct: 20,      // churn rate increase % above this triggers alert
};

function readAlerts() {
  if (!existsSync(ALERTS_FILE)) return [];
  try { return JSON.parse(readFileSync(ALERTS_FILE, 'utf8')); } catch { return []; }
}

function writeAlerts(alerts) {
  writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
}

function isDuplicate(type, contractId) {
  const alerts = readAlerts();
  const cutoff = Date.now() - HOUR_MS;
  return alerts.some(a =>
    a.type === type &&
    a.contractId === contractId &&
    new Date(a.createdAt).getTime() > cutoff
  );
}

export function saveAlert(alert) {
  const alerts = readAlerts();
  alerts.unshift(alert);
  writeAlerts(alerts);
  return alert;
}

export function makeAlert(type, severity, contractId, userId, title, message) {
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type, severity, contractId, userId, title, message,
    is_read: false, acknowledged_at: null,
    createdAt: new Date().toISOString()
  };
}

// --- Individual checks ---

export function checkRetentionDrop(metrics, contractId, userId, thresholds = {}) {
  const threshold = thresholds.retentionDrop ?? DEFAULTS.retentionDrop;
  const d7 = metrics?.behavior?.retentionRate7d ?? metrics?.retentionRate7d ?? metrics?.d7_rate;
  if (d7 == null || d7 >= threshold) return null;
  if (isDuplicate('retention_drop', contractId)) return null;
  return saveAlert(makeAlert('retention_drop', 'high', contractId, userId,
    'Retention Drop Detected',
    `D7 retention dropped to ${d7.toFixed(1)}% (threshold: ${threshold}%)`
  ));
}

export function checkWhaleExit(users = [], contractId, userId, thresholds = {}) {
  const inactiveDays = thresholds.whaleInactiveDays ?? DEFAULTS.whaleInactiveDays;
  const cutoff = Date.now() - inactiveDays * 86400 * 1000;
  const sorted = [...users].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
  const top10 = sorted.slice(0, 10);
  const exitedWhales = top10.filter(w => w.lastSeen && new Date(w.lastSeen).getTime() < cutoff);
  if (!exitedWhales.length) return null;
  if (isDuplicate('whale_exit', contractId)) return null;
  return saveAlert(makeAlert('whale_exit', 'high', contractId, userId,
    'Whale Exit Detected',
    `${exitedWhales.length} top wallet(s) inactive for ${inactiveDays}+ days`
  ));
}

export function checkRevenueChange(currentRevenue, previousRevenue, contractId, userId, thresholds = {}) {
  if (!previousRevenue) return null;
  const changePct = Math.abs((currentRevenue - previousRevenue) / previousRevenue * 100);
  const threshold = thresholds.revenueChangePct ?? DEFAULTS.revenueChangePct;
  if (changePct < threshold) return null;
  if (isDuplicate('revenue_change', contractId)) return null;
  const direction = currentRevenue > previousRevenue ? 'spike' : 'dip';
  return saveAlert(makeAlert('revenue_change', direction === 'dip' ? 'high' : 'medium', contractId, userId,
    `Revenue ${direction.charAt(0).toUpperCase() + direction.slice(1)} Detected`,
    `Revenue changed by ${changePct.toFixed(1)}% (threshold: ${threshold}%)`
  ));
}

export function checkBotSurge(bots = [], totalWallets, contractId, userId, thresholds = {}) {
  if (!totalWallets) return null;
  const botPct = (bots.length / totalWallets) * 100;
  const threshold = thresholds.botSurgePct ?? DEFAULTS.botSurgePct;
  if (botPct < threshold) return null;
  if (isDuplicate('bot_surge', contractId)) return null;
  return saveAlert(makeAlert('bot_surge', 'critical', contractId, userId,
    'Bot Surge Detected',
    `${botPct.toFixed(1)}% of activity is from flagged bots (threshold: ${threshold}%)`
  ));
}

export function checkChurnSpike(currentChurn, previousChurn, contractId, userId, thresholds = {}) {
  if (!previousChurn || isNaN(currentChurn) || isNaN(previousChurn)) return null;
  const increase = currentChurn - previousChurn;
  const threshold = thresholds.churnSpikePct ?? DEFAULTS.churnSpikePct;
  if (increase < threshold) return null;
  if (isDuplicate('churn_spike', contractId)) return null;
  return saveAlert(makeAlert('churn_spike', 'high', contractId, userId,
    'Churn Spike Detected',
    `Churn rate increased by ${increase.toFixed(1)}pp (threshold: ${threshold}pp)`
  ));
}

/**
 * Competitive alert checks - Task 7.4
 */

export function checkCompetitorRetentionSurge(competitorId, currentD7, previousD7, contractId, userId) {
  if (currentD7 == null || previousD7 == null) return null;
  if (currentD7 - previousD7 < 15) return null;
  if (isDuplicate('competitor_retention_surge', contractId)) return null;
  return saveAlert(makeAlert('competitor_retention_surge', 'medium', contractId, userId,
    'Competitor Retention Surge',
    `Competitor ${competitorId} D7 retention jumped ${(currentD7 - previousD7).toFixed(1)}pp`
  ));
}

export function checkCompetitorAcquisitionSpike(competitorId, currentWallets, previousWallets, contractId, userId) {
  if (!previousWallets) return null;
  const changePct = (currentWallets - previousWallets) / previousWallets * 100;
  if (changePct < 50) return null;
  if (isDuplicate('competitor_acquisition_spike', contractId)) return null;
  return saveAlert(makeAlert('competitor_acquisition_spike', 'medium', contractId, userId,
    'Competitor Acquisition Spike',
    `Competitor ${competitorId} new wallets up ${changePct.toFixed(1)}% in 24h`
  ));
}

export function checkWhaleMigration(whaleAddress, competitorId, contractId, userId) {
  if (isDuplicate('whale_migration', contractId)) return null;
  return saveAlert(makeAlert('whale_migration', 'high', contractId, userId,
    'Whale Migration Detected',
    `Top wallet ${whaleAddress} is now active on competitor ${competitorId}`
  ));
}

export function checkTVLOvertake(competitorId, competitorVolume, userVolume, contractId, userId) {
  if (competitorVolume <= userVolume) return null;
  if (isDuplicate('tvl_overtake', contractId)) return null;
  return saveAlert(makeAlert('tvl_overtake', 'high', contractId, userId,
    'TVL Overtake',
    `Competitor ${competitorId} volume surpassed yours for the first time`
  ));
}

export function checkMomentumShift(competitorId, competitorGrowth, userGrowth, contractId, userId) {
  if (competitorGrowth < userGrowth * 2) return null;
  if (isDuplicate('momentum_shift', contractId)) return null;
  return saveAlert(makeAlert('momentum_shift', 'medium', contractId, userId,
    'Momentum Shift',
    `Competitor ${competitorId} 7d growth rate is 2x yours`
  ));
}

/**
 * @param {Object} analysis - completed analysis record
 * @param {string} userId
 * @param {Object} wsManager - WebSocketManager instance (optional)
 * @param {Object} thresholds - custom thresholds
 */
export async function checkAllAlerts(analysis, userId, wsManager = null, thresholds = {}) {
  const contractId = analysis.contractId || analysis.id;
  const metrics = analysis.results?.target?.behavior || {};
  const users = analysis.results?.target?.fullReport?.users || [];
  const transactions = analysis.results?.target?.fullReport?.transactions || [];

  // Bot detection for surge check
  const { evaluateContract } = await import('./BotDetectionService.js');
  const { bots } = evaluateContract(users, transactions);

  const fired = [
    checkRetentionDrop(metrics, contractId, userId, thresholds),
    checkWhaleExit(users, contractId, userId, thresholds),
    checkBotSurge(bots, users.length, contractId, userId, thresholds),
  ].filter(Boolean);

  // Deliver via WebSocket within 10s
  if (wsManager && fired.length) {
    for (const alert of fired) {
      wsManager.emitProgress(userId, { type: 'alert', alert });
    }
  }

  return fired;
}
