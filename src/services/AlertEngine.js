import { join } from 'path';

const HOUR_MS = 3600 * 1000;

const DEFAULTS = {
  retentionDrop: 15,
  whaleInactiveDays: 7,
  revenueChangePct: 30,
  botSurgePct: 20,
  churnSpikePct: 20,
};

async function getAlertsStorage() {
  const { AlertsStorage } = await import('../api/database/index.js');
  return AlertsStorage;
}

async function readAlerts() {
  const s = await getAlertsStorage();
  return s.readAll_array();
}

async function isDuplicate(type, contractId) {
  const alerts = await readAlerts();
  const cutoff = Date.now() - HOUR_MS;
  return alerts.some(a => a.type === type && a.contractId === contractId && new Date(a.createdAt||a.created_at).getTime() > cutoff);
}

export async function saveAlert(alert) {
  const s = await getAlertsStorage();
  await s.create(alert);
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

export async function checkRetentionDrop(metrics, contractId, userId, thresholds = {}) {
  const threshold = thresholds.retentionDrop ?? DEFAULTS.retentionDrop;
  const d7 = metrics?.behavior?.retentionRate7d ?? metrics?.retentionRate7d ?? metrics?.d7_rate;
  if (d7 == null || d7 >= threshold) return null;
  if (await isDuplicate('retention_drop', contractId)) return null;
  return saveAlert(makeAlert('retention_drop', 'high', contractId, userId, 'Retention Drop Detected', `D7 retention dropped to ${d7.toFixed(1)}% (threshold: ${threshold}%)`));
}

export async function checkWhaleExit(users = [], contractId, userId, thresholds = {}) {
  const inactiveDays = thresholds.whaleInactiveDays ?? DEFAULTS.whaleInactiveDays;
  const cutoff = Date.now() - inactiveDays * 86400 * 1000;
  const exitedWhales = [...users].sort((a,b)=>(b.totalValue||0)-(a.totalValue||0)).slice(0,10).filter(w => w.lastSeen && new Date(w.lastSeen).getTime() < cutoff);
  if (!exitedWhales.length) return null;
  if (await isDuplicate('whale_exit', contractId)) return null;
  return saveAlert(makeAlert('whale_exit', 'high', contractId, userId, 'Whale Exit Detected', `${exitedWhales.length} top wallet(s) inactive for ${inactiveDays}+ days`));
}

export async function checkRevenueChange(currentRevenue, previousRevenue, contractId, userId, thresholds = {}) {
  if (!previousRevenue) return null;
  const changePct = Math.abs((currentRevenue - previousRevenue) / previousRevenue * 100);
  const threshold = thresholds.revenueChangePct ?? DEFAULTS.revenueChangePct;
  if (changePct < threshold) return null;
  if (await isDuplicate('revenue_change', contractId)) return null;
  const direction = currentRevenue > previousRevenue ? 'spike' : 'dip';
  return saveAlert(makeAlert('revenue_change', direction === 'dip' ? 'high' : 'medium', contractId, userId, `Revenue ${direction.charAt(0).toUpperCase()+direction.slice(1)} Detected`, `Revenue changed by ${changePct.toFixed(1)}%`));
}

export async function checkBotSurge(bots = [], totalWallets, contractId, userId, thresholds = {}) {
  if (!totalWallets) return null;
  const botPct = (bots.length / totalWallets) * 100;
  const threshold = thresholds.botSurgePct ?? DEFAULTS.botSurgePct;
  if (botPct < threshold) return null;
  if (await isDuplicate('bot_surge', contractId)) return null;
  return saveAlert(makeAlert('bot_surge', 'critical', contractId, userId, 'Bot Surge Detected', `${botPct.toFixed(1)}% of activity is from flagged bots`));
}

export async function checkChurnSpike(currentChurn, previousChurn, contractId, userId, thresholds = {}) {
  if (!previousChurn || isNaN(currentChurn) || isNaN(previousChurn)) return null;
  const increase = currentChurn - previousChurn;
  const threshold = thresholds.churnSpikePct ?? DEFAULTS.churnSpikePct;
  if (increase < threshold) return null;
  if (await isDuplicate('churn_spike', contractId)) return null;
  return saveAlert(makeAlert('churn_spike', 'high', contractId, userId, 'Churn Spike Detected', `Churn rate increased by ${increase.toFixed(1)}pp`));
}

export async function checkCompetitorRetentionSurge(competitorId, currentD7, previousD7, contractId, userId) {
  if (currentD7 == null || previousD7 == null || currentD7 - previousD7 < 15) return null;
  if (await isDuplicate('competitor_retention_surge', contractId)) return null;
  return saveAlert(makeAlert('competitor_retention_surge', 'medium', contractId, userId, 'Competitor Retention Surge', `Competitor ${competitorId} D7 retention jumped ${(currentD7-previousD7).toFixed(1)}pp`));
}

export async function checkCompetitorAcquisitionSpike(competitorId, currentWallets, previousWallets, contractId, userId) {
  if (!previousWallets) return null;
  const changePct = (currentWallets - previousWallets) / previousWallets * 100;
  if (changePct < 50) return null;
  if (await isDuplicate('competitor_acquisition_spike', contractId)) return null;
  return saveAlert(makeAlert('competitor_acquisition_spike', 'medium', contractId, userId, 'Competitor Acquisition Spike', `Competitor ${competitorId} new wallets up ${changePct.toFixed(1)}%`));
}

export async function checkWhaleMigration(whaleAddress, competitorId, contractId, userId) {
  if (await isDuplicate('whale_migration', contractId)) return null;
  return saveAlert(makeAlert('whale_migration', 'high', contractId, userId, 'Whale Migration Detected', `Top wallet ${whaleAddress} is now active on competitor ${competitorId}`));
}

export async function checkTVLOvertake(competitorId, competitorVolume, userVolume, contractId, userId) {
  if (competitorVolume <= userVolume) return null;
  if (await isDuplicate('tvl_overtake', contractId)) return null;
  return saveAlert(makeAlert('tvl_overtake', 'high', contractId, userId, 'TVL Overtake', `Competitor ${competitorId} volume surpassed yours`));
}

export async function checkMomentumShift(competitorId, competitorGrowth, userGrowth, contractId, userId) {
  if (competitorGrowth < userGrowth * 2) return null;
  if (await isDuplicate('momentum_shift', contractId)) return null;
  return saveAlert(makeAlert('momentum_shift', 'medium', contractId, userId, 'Momentum Shift', `Competitor ${competitorId} 7d growth rate is 2x yours`));
}

export async function checkAllAlerts(analysis, userId, wsManager = null, thresholds = {}) {
  const contractId = analysis.contractId || analysis.id;
  const metrics = analysis.results?.target?.behavior || {};
  const users = analysis.results?.target?.fullReport?.users || [];
  const transactions = analysis.results?.target?.fullReport?.transactions || [];

  try {
    const { AlertConfigStorage } = await import('../api/database/index.js');
    const configs = await AlertConfigStorage.findByUserId(userId);
    const cfg = configs[0];
    if (cfg?.thresholds) {
      if (cfg.thresholds.failureRate?.enabled)  thresholds.retentionDrop    = cfg.thresholds.failureRate.value;
      if (cfg.thresholds.userDropoff?.enabled)  thresholds.churnSpikePct    = cfg.thresholds.userDropoff.value;
      if (cfg.thresholds.volumeChange?.enabled) thresholds.revenueChangePct = cfg.thresholds.volumeChange.value;
    }
    if (cfg?.categories?.performance === false) thresholds._skipRetention = true;
    if (cfg?.categories?.anomaly === false)     thresholds._skipBots = true;
    if (cfg?.categories?.growth === false)      thresholds._skipWhale = true;
  } catch {}

  const { evaluateContract } = await import('./BotDetectionService.js');
  const { bots } = evaluateContract(users, transactions);

  const fired = (await Promise.all([
    !thresholds._skipRetention && checkRetentionDrop(metrics, contractId, userId, thresholds),
    !thresholds._skipWhale     && checkWhaleExit(users, contractId, userId, thresholds),
    !thresholds._skipBots      && checkBotSurge(bots, users.length, contractId, userId, thresholds),
  ])).filter(Boolean);

  if (wsManager && fired.length) {
    for (const alert of fired) wsManager.emitProgress(userId, { type: 'alert', alert });
  }
  return fired;
}
