/**
 * ProactiveAgent
 * Always-on monitoring: metric regressions, inactive users, competitor spikes, daily digests.
 * Initialized once in server.js after server starts.
 */

import { UserStorage, AnalysisStorage, MetricsHistoryStorage } from '../api/database/index.js';
import { EmailAutomation } from './EmailAutomation.js';
import { getTraction } from '../api/database/TractionStorage.js';
import { AITaskManager } from './AITaskManager.js';
import { isAgentPermitted } from './AgentService.js';
import { PatternProfileService } from './PatternProfileService.js';

let wsManager = null;

export class ProactiveAgent {
  static init(ws) {
    wsManager = ws;
    console.log('🤖 ProactiveAgent started');

    // Every hour — regression check
    setInterval(() => ProactiveAgent.checkMetricRegressions().catch(console.warn), 60 * 60 * 1000);

    // Every day at 8am UTC
    setInterval(async () => {
      const now = new Date();
      if (now.getUTCHours() === 8 && now.getUTCMinutes() < 5) {
        await ProactiveAgent.checkInactiveUsers().catch(console.warn);
        await ProactiveAgent.checkCompetitorSpikes().catch(console.warn);
        await ProactiveAgent.generateDailyDigest().catch(console.warn);
      }
    }, 5 * 60 * 1000); // check every 5 min

    // Every Monday
    setInterval(async () => {
      const now = new Date();
      if (now.getUTCDay() === 1 && now.getUTCHours() === 8 && now.getUTCMinutes() < 5) {
        await ProactiveAgent.generateWeeklyReport().catch(console.warn);
      }
    }, 5 * 60 * 1000);

    // Every Monday at 9am UTC — auto-generate tasks for all users
    setInterval(async () => {
      const now = new Date();
      if (now.getUTCDay() === 1 && now.getUTCHours() === 9 && now.getUTCMinutes() < 5) {
        await ProactiveAgent.generateTasksForAllUsers().catch(console.warn);
      }
    }, 5 * 60 * 1000);
  }

  static async checkMetricRegressions() {
    const users = await UserStorage.findAll().catch(() => []);
    for (const user of users) {
      try {
        if (!await isAgentPermitted(user.id, 'regressionAlerts')) continue;

        const analyses = await AnalysisStorage.findByUserId(user.id);
        // Scope to the user's default contract — comparing analyses from two
        // different contracts would produce a meaningless "drop".
        const completed = analyses.filter(a => a.metadata?.isDefaultContract && a.status === 'completed');
        if (completed.length < 2) continue;

        const latest = completed[0];
        const previous = completed[1];

        const latestRate = latest.results?.target?.fullReport?.retentionMetrics?.d7 ?? latest.results?.target?.metrics?.d7Retention;
        const prevRate = previous.results?.target?.fullReport?.retentionMetrics?.d7 ?? previous.results?.target?.metrics?.d7Retention;

        if (latestRate != null && prevRate != null && prevRate > 0) {
          const drop = ((prevRate - latestRate) / prevRate) * 100;
          if (drop > 20) {
            await EmailAutomation.sendRegressionAlert(user.id, 'D7 Retention', prevRate, latestRate);
            if (wsManager) {
              wsManager.emitProgress(user.id, {
                type: 'alert',
                alert: { severity: 'high', title: `D7 Retention dropped ${Math.round(drop)}%`, message: `${prevRate}% → ${latestRate}%` },
              });
            }
          }
        }

        // Observe AI tasks — auto-complete or mark overdue
        const currentMetrics = latest.results?.target?.metrics || {};
        await AITaskManager.observeAllTasks(user.id, currentMetrics, wsManager).catch(() => {});

        // ── On-chain risk check ───────────────────────────────────────────────
        const contract = user.onboarding?.defaultContract;
        if (contract?.address && contract?.chain === 'ethereum') {
          try {
            const { OnChainRiskAnalyzer } = await import('./OnChainRiskAnalyzer.js');
            const { saveAlert, makeAlert } = await import('./AlertEngine.js');
            const { AlertsStorage } = await import('../api/database/index.js');
            const risk = await OnChainRiskAnalyzer.analyze(contract.address, contract.chain);
            if (risk.signals?.length > 0) {
              const existing = await AlertsStorage.findByUserId(user.id).catch(() => []);
              const recentTypes = new Set(existing.filter(a => Date.now() - new Date(a.createdAt||a.created_at).getTime() < 3600000).map(a => a.type));
              if (!recentTypes.has('onchain_risk')) {
                const alert = makeAlert('onchain_risk', 'high', contract.address, user.id, 'On-Chain Risk Detected', risk.signals[0]);
                await saveAlert(alert);
                if (wsManager) wsManager.emitProgress(user.id, { type: 'alert', alert });
              }
            }
          } catch {}
        }

        // ── Predictive alerts ─────────────────────────────────────────────────
        try {
          const { PredictionEngine } = await import('./PredictionEngine.js');
          const { saveAlert, makeAlert } = await import('./AlertEngine.js');
          const { AlertsStorage } = await import('../api/database/index.js');
          const predictions = await PredictionEngine.predict(user.id);

          if (predictions) {
            const existing = await AlertsStorage.findByUserId(user.id).catch(() => []);
            const recentTypes = new Set(existing
              .filter(a => Date.now() - new Date(a.createdAt||a.created_at).getTime() < 86400000)
              .map(a => a.type));

            // Predict: D30 retention will drop below 20%
            const retForecast = predictions.next30Days?.retentionRate;
            if (retForecast?.value < 20 && retForecast?.trend === 'down' && !recentTypes.has('predict_retention_drop')) {
              const contractAddress = user.onboarding?.defaultContract?.address || '';
              const alert = makeAlert('predict_retention_drop', 'high', contractAddress, user.id,
                'Retention Forecast: At Risk',
                `Retention rate is trending down and projected to reach ${retForecast.value}% in 30 days. Act now to prevent drop below 20%.`);
              await saveAlert(alert);
              if (wsManager) wsManager.emitProgress(user.id, { type: 'alert', alert });
            }

            // Predict: churn risk is high
            if (predictions.churnRisk?.level === 'high' && !recentTypes.has('predict_churn_high')) {
              const contractAddress = user.onboarding?.defaultContract?.address || '';
              const alert = makeAlert('predict_churn_high', 'high', contractAddress, user.id,
                'High Churn Risk Predicted',
                `Churn risk score is ${predictions.churnRisk.score}/100. Avg churn rate ${predictions.churnRisk.avgChurn}% and rising.`);
              await saveAlert(alert);
              if (wsManager) wsManager.emitProgress(user.id, { type: 'alert', alert });
            }

            // Predict: user growth declining
            const userForecast = predictions.next30Days?.users;
            if (userForecast?.trend === 'down' && userForecast?.changePct < -15 && !recentTypes.has('predict_user_decline')) {
              const contractAddress = user.onboarding?.defaultContract?.address || '';
              const alert = makeAlert('predict_user_decline', 'medium', contractAddress, user.id,
                'User Growth Declining',
                `User count projected to drop ${Math.abs(userForecast.changePct)}% in 30 days (${userForecast.current} → ${userForecast.value}).`);
              await saveAlert(alert);
              if (wsManager) wsManager.emitProgress(user.id, { type: 'alert', alert });
            }
          }
        } catch {}
        if (contract?.address) {
          try {
            const { SentimentAnalyzer } = await import('./SentimentAnalyzer.js');
            const { saveAlert, makeAlert } = await import('./AlertEngine.js');
            const { AlertsStorage } = await import('../api/database/index.js');
            const sentiment = await SentimentAnalyzer.analyze(contract.address, contract.chain || 'ethereum');
            if (sentiment.sentimentScore != null && sentiment.sentimentScore < 35) {
              const existing = await AlertsStorage.findByUserId(user.id).catch(() => []);
              const recentTypes = new Set(existing.filter(a => Date.now() - new Date(a.createdAt||a.created_at).getTime() < 3600000).map(a => a.type));
              if (!recentTypes.has('sentiment_negative')) {
                const alert = makeAlert('sentiment_negative', 'medium', contract.address, user.id,
                  'Negative Sentiment Detected',
                  `Community sentiment dropped to ${sentiment.sentimentScore}/100 (${sentiment.direction})`);
                await saveAlert(alert);
                if (wsManager) wsManager.emitProgress(user.id, { type: 'alert', alert });
              }
            }
          } catch {}
        }

        // BI pattern alerts
        const txs = latest.results?.target?.transactions || [];
        if (txs.length > 10) {
          const { BusinessIntelligenceEngine: BI } = await import('./BusinessIntelligenceEngine.js');
          const patterns = BI.recognizePatterns(txs);
          for (const p of patterns.filter(p => p.severity === 'high')) {
            await EmailAutomation.sendRegressionAlert(user.id, p.type.replace(/_/g, ' '), 0, p.count || 1);
          }
          // Whale going silent alert
          const churn = BI.computeChurnRisk(txs);
          const silentWhales = churn.highRisk.filter(w => w.txCount >= 10 && w.daysSinceLast > 14);
          if (silentWhales.length > 0) {
            await EmailAutomation.sendRegressionAlert(user.id, `${silentWhales.length} whale wallet(s) silent`, silentWhales[0].daysSinceLast, 0);
          }
        }
      } catch {}
    }
  }

  static async checkInactiveUsers() {
    const users = await UserStorage.findAll().catch(() => []);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const user of users) {
      try {
        if (user.lastLogin && new Date(user.lastLogin).getTime() > sevenDaysAgo) continue;
        const traction = await getTraction(user.id);
        const openCount = (traction.tasks || []).filter(t => t.status !== 'resolved').length;
        const aiOpen = (await AITaskManager.getActiveTasks(user.id)).length;
        const total = openCount + aiOpen;
        if (total > 0) await EmailAutomation.sendInactiveNudge(user.id, total);
      } catch {}
    }
  }

  static async checkCompetitorSpikes() {
    const users = await UserStorage.findAll().catch(() => []);
    for (const user of users) {
      try {
        if (!await isAgentPermitted(user.id, 'checkCompetitors')) continue;
        const { CompetitorDataStorage } = await import('../api/database/index.js');
        const competitors = await CompetitorDataStorage.findByUserId(user.id);
        for (const comp of competitors) {
          const spike = comp.metrics?.volumeChange7d || comp.metrics?.tvlChange7d;
          if (spike && spike > 30) {
            await EmailAutomation.sendRegressionAlert(user.id, `${comp.name || 'Competitor'} volume`, 0, spike);
          }
        }
      } catch {}
    }
  }

  static async generateDailyDigest() {
    const users = await UserStorage.findAll().catch(() => []);
    for (const user of users) {
      try {
        if (!user.preferences?.notifications?.email) continue;
        if (!await isAgentPermitted(user.id, 'sendDigests')) continue;
        const { BriefingScheduler } = await import('./BriefingScheduler.js');
        const scheduler = new BriefingScheduler();
        const briefing = await scheduler.generateDailyBrief(user.id);
        if (briefing) await EmailAutomation.sendDigest(user.id, briefing);
      } catch {}
    }

    // Daily social media posts
    for (const user of users) {
      try {
        if (!await isAgentPermitted(user.id, 'postSocial')) continue;
        const { runDailySocialPost } = await import('./SocialMediaAgent.js');
        await runDailySocialPost(user.id);
      } catch {}
    }
  }

  static async generateTasksForAllUsers() {
    const users = await UserStorage.findAll().catch(() => []);
    for (const user of users) {
      try {
        if (!await isAgentPermitted(user.id, 'autoAnalyze')) continue;
        const contract = user.onboarding?.defaultContract;
        if (!contract?.address) continue;
        const profile = await PatternProfileService.get(user.id);
        const profileContext = profile
          ? `\n\nUser pattern profile:\n- ${profile.summary}\n- Growth: ${profile.growth?.direction} (${profile.growth?.rate}%)\n- Retention trend: ${profile.retention?.direction} (avg ${profile.retention?.avg}%)\n- Churn trend: ${profile.churn?.direction}\n- User quality: ${profile.userQuality?.quality}\n- Milestones reached: ${(profile.milestones || []).join(', ') || 'none'}`
          : '';
        const { default: AgentService } = await import('./AgentService.js');
        await AgentService.run(
          user.id,
          `Analyze this contract. Identify all failing or underperforming metrics. For each one, call create_task with a specific target value and 14-day deadline.${profileContext}`,
          { contractAddress: contract.address, chain: contract.chain || 'ethereum', source: 'proactive' }
        );
        console.log(`🤖 Auto-tasks generated for user ${user.id}`);
      } catch (err) {
        console.warn(`[ProactiveAgent] generateTasks failed for ${user.id}:`, err.message);
      }
    }
  }

  static async generateWeeklyReport() {    const users = await UserStorage.findAll().catch(() => []);
    for (const user of users) {
      try {
        if (!user.preferences?.notifications?.email) continue;
        if (!await isAgentPermitted(user.id, 'sendDigests')) continue;
        const { BriefingScheduler } = await import('./BriefingScheduler.js');
        const scheduler = new BriefingScheduler();
        const briefing = await scheduler.generateWeeklyStrategy(user.id);
        if (briefing) await EmailAutomation.sendDigest(user.id, briefing);
      } catch {}
    }
  }
}
