/**
 * Traction & Insights API
 * Powers the /analyzer page — investor-ready traction data
 */
import express from 'express';
import { AnalysisStorage, UserStorage, MetricsHistoryStorage } from '../database/index.js';
import { buildFullReportFromAnalysis } from './onboarding.js';
import { priceService } from '../../services/PriceService.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// ── Helper: load competitor data ─────────────────────────────────────────────
async function loadCompetitors(userId) {
  const dir = path.join('./data', 'users', userId, 'competitors');
  const files = await fs.readdir(dir).catch(() => []);
  const competitors = [];
  for (const file of files.filter(f => f.endsWith('.json') && !f.endsWith('.backup'))) {
    try {
      const c = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
      competitors.push(c);
    } catch { /* skip */ }
  }
  return competitors;
}

// ── OPS Score calculator ──────────────────────────────────────────────────────
function calculateOPS(fr, alerts = []) {
  const successRate   = Number(fr.summary?.successRate || 0);
  const retentionRate = fr.retentionMetrics?.retentionRate || 0;
  const activationRate= fr.activationMetrics?.activationRate || 0;
  const bounceRate    = fr.defiMetrics?.bounceRate || 0;
  const botPct        = fr.userQualityMetrics?.botPct || 0;
  const churnRate     = fr.retentionMetrics?.churnRate || 0;

  // Pillar 1 — Feature Stability (25%): success rate + low failure
  const featureStability = Math.min(100, successRate * 0.7 + (100 - botPct) * 0.3);

  // Pillar 2 — Response to Alerts (25%): based on unresolved alerts
  const unresolved = alerts.filter(a => !a.is_read).length;
  const responseScore = Math.max(0, 100 - unresolved * 15);

  // Pillar 3 — Resolution Efficiency (20%): low churn + low bounce
  const resolutionScore = Math.max(0, 100 - churnRate * 0.5 - bounceRate * 0.3);

  // Pillar 4 — Task Completion (15%): activation rate proxy
  const taskScore = activationRate;

  // Pillar 5 — Operational Hygiene (15%): retention + wallet quality
  const walletQuality = fr.userQualityMetrics?.avgWalletQuality || 0;
  const hygieneScore = Math.min(100, retentionRate * 0.5 + walletQuality * 0.5);

  const ops = Math.round(
    featureStability * 0.25 +
    responseScore    * 0.25 +
    resolutionScore  * 0.20 +
    taskScore        * 0.15 +
    hygieneScore     * 0.15
  );

  return {
    total: ops,
    pillars: {
      featureStability:   Math.round(featureStability),
      responseToAlerts:   Math.round(responseScore),
      resolutionEfficiency: Math.round(resolutionScore),
      taskCompletion:     Math.round(taskScore),
      hygiene:            Math.round(hygieneScore),
    },
    grade: ops >= 75 ? 'green' : ops >= 50 ? 'yellow' : 'red',
    label: ops >= 75 ? 'Healthy' : ops >= 50 ? 'Moderate' : 'Needs Attention',
  };
}

// ── Comprehensive task generator — every metric that can go red ──────────────
function generateTasks(fr, ops) {
  const ret  = fr.retentionMetrics   || {};
  const act  = fr.activationMetrics  || {};
  const gas  = fr.gasAnalysis        || {};
  const qual = fr.userQualityMetrics || {};
  const dm   = fr.defiMetrics        || {};
  const sum  = fr.summary            || {};
  const lc   = fr.userLifecycle?.summary || {};

  const rules = [
    // ── Churn ──────────────────────────────────────────────────────────────
    { id:'churn', metric:'churnRate', current:ret.churnRate||0, target:25, lowerBetter:true, pillar:'Churn',
      title:'Reduce churn rate',
      description:`${ret.churnRate||0}% of users have gone inactive in the last 30 days.`,
      action:'Run a re-engagement campaign. Offer incentives for returning wallets. Investigate the last action before churn.' },

    // ── Retention ──────────────────────────────────────────────────────────
    { id:'overall_ret', metric:'retentionRate', current:ret.retentionRate||0, target:40, pillar:'Retention',
      title:'Grow overall retention',
      description:`Only ${ret.retentionRate||0}% of wallets made more than one transaction.`,
      action:'Focus on the value delivered after the first interaction — make the second tx easier and more rewarding.' },
    { id:'d1_ret', metric:'d1Retention', current:ret.d1Retention||0, target:20, pillar:'Retention',
      title:'Improve Day-1 retention',
      description:`Only ${ret.d1Retention||0}% of users return within 24h of first interaction.`,
      action:'Send a follow-up notification or in-app prompt within 12h of first use. Highlight the next logical action.' },
    { id:'d7_ret', metric:'d7Retention', current:ret.d7Retention||0, target:15, pillar:'Retention',
      title:'Improve Day-7 retention',
      description:`D7 retention is ${ret.d7Retention||0}% — users aren't forming a weekly habit.`,
      action:'Introduce a weekly reward, streak mechanic, or digest email showing their activity.' },
    { id:'d30_ret', metric:'d30Retention', current:ret.d30Retention||0, target:10, pillar:'Retention',
      title:'Improve Day-30 retention',
      description:`Only ${ret.d30Retention||0}% of users are still active after 30 days.`,
      action:'Identify your power users and replicate their onboarding path for new users.' },
    { id:'resurrection', metric:'resurrectionRate', current:ret.resurrectionRate||0, target:10, pillar:'Retention',
      title:'Improve resurrection rate',
      description:`Only ${ret.resurrectionRate||0}% of churned users have come back.`,
      action:'Target churned wallets with a win-back campaign. Highlight new features or improvements since they left.' },

    // ── Activation & Adoption ──────────────────────────────────────────────
    { id:'activation', metric:'activationRate', current:act.activationRate||0, target:50, pillar:'Activation',
      title:'Increase activation rate',
      description:`Only ${act.activationRate||0}% of users return for a 2nd transaction.`,
      action:'Simplify the first-use experience. Add a guided onboarding flow or tutorial.' },
    { id:'bounce', metric:'bounceRate', current:dm.bounceRate||0, target:30, lowerBetter:true, pillar:'Activation',
      title:'Reduce bounce rate',
      description:`${dm.bounceRate||0}% of users interact only once and never return.`,
      action:'Identify the most common first interaction and improve its value delivery immediately after.' },
    { id:'adoption_funnel', metric:'step3Pct',
      current: fr.activationMetrics?.activationFunnel?.[2]?.pct || 0,
      target:30, pillar:'Adoption',
      title:'Improve feature adoption depth',
      description:`Only ${fr.activationMetrics?.activationFunnel?.[2]?.pct||0}% of users reach a 3rd transaction.`,
      action:'Add progressive disclosure — reveal more features after each successful interaction to drive deeper adoption.' },

    // ── Transaction Volume & Count ─────────────────────────────────────────
    { id:'tx_count', metric:'totalTransactions', current:sum.totalTransactions||0, target:100, pillar:'Volume',
      title:'Grow transaction count',
      description:`Only ${sum.totalTransactions||0} transactions indexed — target 100+ for meaningful analytics.`,
      action:'Drive more on-chain activity through campaigns, incentives, or new use cases that require transactions.' },
    { id:'dau', metric:'dau', current:dm.dau||0, target:Math.max(10, Math.round((dm.mau||1)*0.15)), pillar:'Volume',
      title:'Grow daily active users (DAU)',
      description:`DAU is ${dm.dau||0} — target is 15% of MAU (${Math.round((dm.mau||1)*0.15)}).`,
      action:'Run daily engagement campaigns. Add daily-use features like portfolio tracking or alerts.' },
    { id:'wau', metric:'wau', current:dm.wau||0, target:Math.max(5, Math.round((dm.mau||1)*0.5)), pillar:'Volume',
      title:'Grow weekly active users (WAU)',
      description:`WAU is ${dm.wau||0} — target is 50% of MAU.`,
      action:'Introduce weekly incentives or recurring use cases that bring users back every week.' },
    { id:'unique_users', metric:'uniqueUsers', current:sum.uniqueUsers||0, target:25, pillar:'Volume',
      title:'Grow unique user base',
      description:`Only ${sum.uniqueUsers||0} unique wallets have interacted with your contract.`,
      action:'Launch a referral programme. Partner with other protocols for cross-promotion.' },

    // ── Gas Cost ───────────────────────────────────────────────────────────
    { id:'gas_cost', metric:'avgGasCostUSD', current:gas.averageGasCostUSD||0, target:0.5, lowerBetter:true, pillar:'Gas',
      title:'Reduce average gas cost',
      description:`Average gas cost is $${gas.averageGasCostUSD||0} per transaction — high cost deters users.`,
      action:'Batch transactions where possible. Optimize contract calls to reduce gas usage. Consider L2 deployment.' },
    { id:'total_gas', metric:'totalGasCostUSD', current:gas.totalGasCostUSD||0, target:50, lowerBetter:true, pillar:'Gas',
      title:'Reduce total gas burden on users',
      description:`Users have spent $${gas.totalGasCostUSD||0} total on gas — high cumulative cost reduces LTV.`,
      action:'Implement gas sponsorship (ERC-4337 paymasters) for key user actions to reduce friction.' },
    { id:'failed_txs', metric:'failedTransactions', current:gas.failedTransactions||0, target:0, lowerBetter:true, pillar:'Gas',
      title:'Eliminate failed transactions',
      description:`${gas.failedTransactions||0} transactions failed — each failure costs users gas with no value.`,
      action:'Audit the most common failure reasons. Add pre-flight validation in your frontend before submitting txs.' },

    // ── User Quality ───────────────────────────────────────────────────────
    { id:'bot_pct', metric:'botPct', current:qual.botPct||0, target:5, lowerBetter:true, pillar:'Quality',
      title:'Reduce bot activity',
      description:`${qual.botPct||0}% of wallets show bot-like behaviour — inflating your metrics.`,
      action:'Implement rate limiting per wallet. Add proof-of-humanity checks for high-frequency wallets.' },
    { id:'wallet_quality', metric:'avgWalletQuality', current:qual.avgWalletQuality||0, target:65, pillar:'Quality',
      title:'Improve wallet quality score',
      description:`Average wallet quality is ${qual.avgWalletQuality||0}/100 — indicates low-value user base.`,
      action:'Target acquisition campaigns at high-value wallet segments. Reward multi-tx users with better rates.' },
    { id:'power_users', metric:'powerUserRate', current:qual.powerUserRate||0, target:15, pillar:'Quality',
      title:'Grow power user base',
      description:`Only ${qual.powerUserRate||0}% of wallets have 10+ transactions.`,
      action:'Create a loyalty programme or tiered rewards for high-frequency users.' },

    // ── OPS ────────────────────────────────────────────────────────────────
    { id:'ops_alerts', metric:'responseToAlerts', current:ops.pillars.responseToAlerts, target:75, pillar:'Operations',
      title:'Respond to outstanding alerts',
      description:`Alert response score is ${ops.pillars.responseToAlerts}/100 — unresolved alerts are stacking.`,
      action:'Go to the Alerts tab and acknowledge or resolve all open alerts within 24h.' },
    { id:'ops_stability', metric:'featureStability', current:ops.pillars.featureStability, target:80, pillar:'Operations',
      title:'Improve feature stability',
      description:`Feature stability score is ${ops.pillars.featureStability}/100.`,
      action:'Review failed transactions and error patterns. Fix the top 3 failure causes this week.' },
  ];

  return rules
    .filter(r => r.lowerBetter ? r.current > r.target : r.current < r.target)
    .map(r => ({
      ...r,
      priority: (r.lowerBetter ? r.current > r.target * 2 : r.current < r.target * 0.5) ? 'high' : 'medium',
      status: 'open',
      isResolved: r.lowerBetter ? r.current <= r.target : r.current >= r.target,
    }))
    .sort((a, b) => (a.priority === 'high' ? -1 : 1));
}
// ── Traction summary ──────────────────────────────────────────────────────────
function buildTractionSummary(fr, competitors, ethPriceUSD) {
  const me = {
    totalTxs:       fr.summary?.totalTransactions || 0,
    uniqueUsers:    fr.summary?.uniqueUsers || 0,
    successRate:    Number(fr.summary?.successRate || 0),
    failedTxs:      fr.gasAnalysis?.failedTransactions || 0,
    avgGasCostUSD:  fr.gasAnalysis?.averageGasCostUSD || 0,
    totalGasCostUSD:fr.gasAnalysis?.totalGasCostUSD || 0,
    retentionRate:  fr.retentionMetrics?.retentionRate || 0,
    activationRate: fr.activationMetrics?.activationRate || 0,
    dau:            fr.defiMetrics?.dau || 0,
    wau:            fr.defiMetrics?.wau || 0,
    mau:            fr.defiMetrics?.mau || 0,
    bounceRate:     fr.defiMetrics?.bounceRate || 0,
    walletQuality:  fr.userQualityMetrics?.avgWalletQuality || 0,
  };

  // Aggregate competitor averages
  const compAvg = (key) => {
    if (!competitors.length) return null;
    const vals = competitors.map(c => {
      const cf = buildFullReportFromAnalysis(c.transactions||[], c.metrics||{}, c);
      return cf.summary?.[key] ?? cf.gasAnalysis?.[key] ?? cf.retentionMetrics?.[key] ?? cf.defiMetrics?.[key] ?? 0;
    });
    return vals.reduce((a,b)=>a+b,0)/vals.length;
  };

  const compMetrics = competitors.map(c => {
    const cf = buildFullReportFromAnalysis(c.transactions||[], c.metrics||{}, c);
    return {
      name: c.name,
      totalTxs: cf.summary?.totalTransactions || 0,
      uniqueUsers: cf.summary?.uniqueUsers || 0,
      successRate: Number(cf.summary?.successRate || 0),
      failedTxs: cf.gasAnalysis?.failedTransactions || 0,
      avgGasCostUSD: cf.gasAnalysis?.averageGasCostUSD || 0,
      totalGasCostUSD: cf.gasAnalysis?.totalGasCostUSD || 0,
      retentionRate: cf.retentionMetrics?.retentionRate || 0,
      activationRate: cf.activationMetrics?.activationRate || 0,
      dau: cf.defiMetrics?.dau || 0,
    };
  });

  // Build comparison rows
  const rows = [
    { label:'Active Users (DAU)',    mine:me.dau,            comps:compMetrics.map(c=>c.dau),            higherBetter:true,  unit:'' },
    { label:'Total Transactions',    mine:me.totalTxs,       comps:compMetrics.map(c=>c.totalTxs),       higherBetter:true,  unit:'' },
    { label:'Avg Gas Cost',          mine:me.avgGasCostUSD,  comps:compMetrics.map(c=>c.avgGasCostUSD),  higherBetter:false, unit:'$' },
    { label:'Total Gas Spent',       mine:me.totalGasCostUSD,comps:compMetrics.map(c=>c.totalGasCostUSD),higherBetter:false, unit:'$' },
    { label:'Failed Transactions',   mine:me.failedTxs,      comps:compMetrics.map(c=>c.failedTxs),      higherBetter:false, unit:'' },
    { label:'Successful Txs',        mine:me.totalTxs-me.failedTxs, comps:compMetrics.map(c=>c.totalTxs-c.failedTxs), higherBetter:true, unit:'' },
    { label:'Retention Rate',        mine:me.retentionRate,  comps:compMetrics.map(c=>c.retentionRate),  higherBetter:true,  unit:'%' },
    { label:'Activation Rate',       mine:me.activationRate, comps:compMetrics.map(c=>c.activationRate), higherBetter:true,  unit:'%' },
    { label:'Unique Users',          mine:me.uniqueUsers,    comps:compMetrics.map(c=>c.uniqueUsers),    higherBetter:true,  unit:'' },
  ];

  // Productivity score: % of rows where you win
  const wins = rows.filter(r => {
    if (!r.comps.length) return true;
    const avgComp = r.comps.reduce((a,b)=>a+b,0)/r.comps.length;
    return r.higherBetter ? r.mine >= avgComp : r.mine <= avgComp;
  }).length;
  const productivityScore = Math.round((wins / rows.length) * 100);

  return { me, compMetrics, rows, productivityScore, competitorNames: competitors.map(c=>c.name) };
}

// ── Helper: build fr from latest analysis ─────────────────────────────────────
async function buildFR(userId) {
  const user = await UserStorage.findById(userId);
  if (!user?.onboarding?.defaultContract?.address) return null;
  const allAnalyses = await AnalysisStorage.findByUserId(userId);
  const latest = allAnalyses
    .filter(a => a.status === 'completed' && a.metadata?.isDefaultContract)
    .sort((a,b) => new Date(b.completedAt||b.createdAt) - new Date(a.completedAt||a.createdAt))[0];
  if (!latest) return null;
  const txs     = latest.results?.target?.transactions || [];
  const metrics = latest.results?.target?.metrics || {};
  const contract= latest.results?.target?.contract || user.onboarding.defaultContract;
  const ethPrice= await priceService.getPrice('eth').catch(() => 2500);
  return { fr: buildFullReportFromAnalysis(txs, metrics, { ...contract, _ethPriceUSD: ethPrice }), contract, user };
}

// ── GET /api/traction/tasks — all tasks with current status ──────────────────
router.get('/tasks', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });
    const { fr } = built;
    let alerts = [];
    try {
      const { readFileSync, existsSync } = await import('fs');
      if (existsSync('./data/alerts.json'))
        alerts = JSON.parse(readFileSync('./data/alerts.json','utf8')).filter(a => a.userId === req.user.id);
    } catch {}
    const ops   = calculateOPS(fr, alerts);
    const tasks = generateTasks(fr, ops);
    res.json({ tasks, total: tasks.length, high: tasks.filter(t=>t.priority==='high').length, medium: tasks.filter(t=>t.priority==='medium').length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/traction/metrics — all tracked metrics with status ───────────────
router.get('/metrics', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });
    const { fr } = built;
    const ret = fr.retentionMetrics || {};
    const act = fr.activationMetrics || {};
    const gas = fr.gasAnalysis || {};
    const qual= fr.userQualityMetrics || {};
    const dm  = fr.defiMetrics || {};
    const sum = fr.summary || {};

    const metrics = [
      // Churn
      { id:'churnRate',        label:'Churn Rate',          value:ret.churnRate||0,          unit:'%',  target:25,  lowerBetter:true,  pillar:'Churn' },
      // Retention
      { id:'retentionRate',    label:'Retention Rate',      value:ret.retentionRate||0,      unit:'%',  target:40,  pillar:'Retention' },
      { id:'d1Retention',      label:'D1 Retention',        value:ret.d1Retention||0,        unit:'%',  target:20,  pillar:'Retention' },
      { id:'d7Retention',      label:'D7 Retention',        value:ret.d7Retention||0,        unit:'%',  target:15,  pillar:'Retention' },
      { id:'d30Retention',     label:'D30 Retention',       value:ret.d30Retention||0,       unit:'%',  target:10,  pillar:'Retention' },
      { id:'resurrectionRate', label:'Resurrection Rate',   value:ret.resurrectionRate||0,   unit:'%',  target:10,  pillar:'Retention' },
      // Activation
      { id:'activationRate',   label:'Activation Rate',     value:act.activationRate||0,     unit:'%',  target:50,  pillar:'Activation' },
      { id:'bounceRate',       label:'Bounce Rate',         value:dm.bounceRate||0,          unit:'%',  target:30,  lowerBetter:true,  pillar:'Activation' },
      // Adoption
      { id:'step3Pct',         label:'3rd Tx Adoption',     value:fr.activationMetrics?.activationFunnel?.[2]?.pct||0, unit:'%', target:30, pillar:'Adoption' },
      // Volume
      { id:'totalTransactions',label:'Total Transactions',  value:sum.totalTransactions||0,  unit:'',   target:100, pillar:'Volume' },
      { id:'uniqueUsers',      label:'Unique Users',        value:sum.uniqueUsers||0,        unit:'',   target:25,  pillar:'Volume' },
      { id:'dau',              label:'DAU',                 value:dm.dau||0,                 unit:'',   target:Math.max(10,Math.round((dm.mau||1)*0.15)), pillar:'Volume' },
      { id:'wau',              label:'WAU',                 value:dm.wau||0,                 unit:'',   target:Math.max(5,Math.round((dm.mau||1)*0.5)),   pillar:'Volume' },
      { id:'mau',              label:'MAU',                 value:dm.mau||0,                 unit:'',   target:20,  pillar:'Volume' },
      // Gas
      { id:'avgGasCostUSD',    label:'Avg Gas Cost',        value:gas.averageGasCostUSD||0,  unit:'$',  target:0.5, lowerBetter:true,  pillar:'Gas' },
      { id:'totalGasCostUSD',  label:'Total Gas Cost',      value:gas.totalGasCostUSD||0,    unit:'$',  target:50,  lowerBetter:true,  pillar:'Gas' },
      { id:'failedTransactions',label:'Failed Txs',         value:gas.failedTransactions||0, unit:'',   target:0,   lowerBetter:true,  pillar:'Gas' },
      { id:'gasEfficiencyScore',label:'Gas Efficiency',     value:gas.gasEfficiencyScore||0, unit:'%',  target:90,  pillar:'Gas' },
      // Quality
      { id:'botPct',           label:'Bot %',               value:qual.botPct||0,            unit:'%',  target:5,   lowerBetter:true,  pillar:'Quality' },
      { id:'avgWalletQuality', label:'Wallet Quality',      value:qual.avgWalletQuality||0,  unit:'/100',target:65, pillar:'Quality' },
      { id:'powerUserRate',    label:'Power User Rate',     value:qual.powerUserRate||0,     unit:'%',  target:15,  pillar:'Quality' },
    ].map(m => ({
      ...m,
      status: m.lowerBetter ? (m.value <= m.target ? 'green' : m.value > m.target*1.5 ? 'red' : 'yellow')
                             : (m.value >= m.target ? 'green' : m.value < m.target*0.5 ? 'red' : 'yellow'),
    }));

    const red    = metrics.filter(m=>m.status==='red').length;
    const yellow = metrics.filter(m=>m.status==='yellow').length;
    const green  = metrics.filter(m=>m.status==='green').length;
    res.json({ metrics, summary: { red, yellow, green, total: metrics.length } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/traction/tasks/:taskId/recommendation — AI recommendation ────────
router.get('/tasks/:taskId/recommendation', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });
    const { fr } = built;
    let alerts = [];
    try {
      const { readFileSync, existsSync } = await import('fs');
      if (existsSync('./data/alerts.json'))
        alerts = JSON.parse(readFileSync('./data/alerts.json','utf8')).filter(a => a.userId === req.user.id);
    } catch {}
    const ops   = calculateOPS(fr, alerts);
    const tasks = generateTasks(fr, ops);
    const task  = tasks.find(t => t.id === req.params.taskId);
    if (!task) return res.json({ resolved: true, recommendation: 'This metric is on track — no action needed.' });

    let recommendation = task.action; // default rule-based
    try {
      const GeminiAIService = (await import('../../services/GeminiAIService.js')).default;
      const gemini = new GeminiAIService();
      const prompt = `A blockchain project has this problem: "${task.description}"
Current value: ${task.current}${task.unit||''}. Target: ${task.target}${task.unit||''}.
Give 3 specific, actionable steps the project owner can take to fix this. Be concise and practical. Format as numbered list.`;
      recommendation = await gemini.generateContent(prompt);
    } catch { /* use default */ }

    res.json({ taskId: task.id, title: task.title, resolved: false, recommendation, current: task.current, target: task.target });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/traction/ops — OPS score only ────────────────────────────────────
router.get('/ops', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });
    let alerts = [];
    try {
      const { readFileSync, existsSync } = await import('fs');
      if (existsSync('./data/alerts.json'))
        alerts = JSON.parse(readFileSync('./data/alerts.json','utf8')).filter(a => a.userId === req.user.id);
    } catch {}
    const ops = calculateOPS(built.fr, alerts);
    res.json(ops);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/traction/growth — growth snapshot ────────────────────────────────
router.get('/growth', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });
    const { fr } = built;
    res.json({
      newUsers:       fr.userLifecycle?.summary?.newUsers || 0,
      returningUsers: fr.userLifecycle?.summary?.returningUsers || 0,
      totalUsers:     fr.summary?.uniqueUsers || 0,
      totalTxs:       fr.summary?.totalTransactions || 0,
      dau:            fr.defiMetrics?.dau || 0,
      wau:            fr.defiMetrics?.wau || 0,
      mau:            fr.defiMetrics?.mau || 0,
      activationFunnel: fr.activationMetrics?.activationFunnel || [],
      avgTimeToActivation: fr.activationMetrics?.avgTimeToActivation,
      avgSessionDuration:  fr.defiMetrics?.avgSessionDuration,
      retentionMetrics: fr.retentionMetrics,
      gasAnalysis:      fr.gasAnalysis,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Main dashboard endpoint ───────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(404).json({ error: 'No contract onboarded' });
    }

    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest = allAnalyses
      .filter(a => a.status === 'completed' && a.metadata?.isDefaultContract)
      .sort((a,b) => new Date(b.completedAt||b.createdAt) - new Date(a.completedAt||a.createdAt))[0];

    if (!latest) return res.status(404).json({ error: 'No completed analysis found' });

    const txs     = latest.results?.target?.transactions || [];
    const metrics = latest.results?.target?.metrics || {};
    const contract= latest.results?.target?.contract || user.onboarding.defaultContract;
    const ethPrice= await priceService.getPrice('eth').catch(() => 2500);

    const fr = buildFullReportFromAnalysis(txs, metrics, { ...contract, _ethPriceUSD: ethPrice });
    const competitors = await loadCompetitors(req.user.id);

    // Load alerts for OPS
    let alerts = [];
    try {
      const { readFileSync, existsSync } = await import('fs');
      if (existsSync('./data/alerts.json')) {
        alerts = JSON.parse(readFileSync('./data/alerts.json','utf8'))
          .filter(a => a.userId === req.user.id);
      }
    } catch {}

    const ops      = calculateOPS(fr, alerts);
    const tasks    = generateTasks(fr, ops);
    const traction = buildTractionSummary(fr, competitors, ethPrice);

    // Feature insights
    const featureInsights = (fr.activationMetrics?.featureFirstUse || []).slice(0,8).map(f => ({
      feature: f.feature,
      adoption: f.pct,
      count: f.count,
    }));

    // Growth metrics
    const growth = {
      newUsers:       fr.userLifecycle?.summary?.newUsers || 0,
      returningUsers: fr.userLifecycle?.summary?.returningUsers || 0,
      totalUsers:     fr.summary?.uniqueUsers || 0,
      txGrowth:       fr.summary?.totalTransactions || 0,
      activationFunnel: fr.activationMetrics?.activationFunnel || [],
      avgTimeToActivation: fr.activationMetrics?.avgTimeToActivation,
      avgSessionDuration:  fr.defiMetrics?.avgSessionDuration,
    };

    // Investor labels
    const labels = [];
    if (traction.me.retentionRate >= 50) labels.push({ label:'Growth-Ready', color:'green' });
    if (traction.me.activationRate >= 60) labels.push({ label:'Strong Activation', color:'blue' });
    if (traction.me.successRate >= 99) labels.push({ label:'Reliable Protocol', color:'purple' });
    if (traction.productivityScore >= 70) labels.push({ label:'Revenue Positive', color:'yellow' });

    res.json({
      contract: { name: contract.name, address: contract.address, chain: contract.chain },
      ops,
      tasks,
      traction,
      featureInsights,
      growth,
      labels,
      recommendations: fr.recommendations || [],
      gasAnalysis: fr.gasAnalysis,
      retentionMetrics: fr.retentionMetrics,
      activationMetrics: fr.activationMetrics,
      userQuality: fr.userQualityMetrics,
      users: fr.users?.slice(0,10) || [],
      generatedAt: new Date().toISOString(),
    });

    // Snapshot today's metrics for historical tracking (fire-and-forget)
    MetricsHistoryStorage.append(req.user.id, {
      ops: ops.total,
      dau: fr.defiMetrics?.dau || 0,
      wau: fr.defiMetrics?.wau || 0,
      mau: fr.defiMetrics?.mau || 0,
      totalTxs: fr.summary?.totalTransactions || 0,
      uniqueUsers: fr.summary?.uniqueUsers || 0,
      retentionRate: fr.retentionMetrics?.retentionRate || 0,
      d7Retention: fr.retentionMetrics?.d7Retention || 0,
      churnRate: fr.retentionMetrics?.churnRate || 0,
      activationRate: fr.activationMetrics?.activationRate || 0,
      bounceRate: fr.defiMetrics?.bounceRate || 0,
      avgGasCostUSD: fr.gasAnalysis?.averageGasCostUSD || 0,
      walletQuality: fr.userQualityMetrics?.avgWalletQuality || 0,
      openTasks: tasks.length,
    }).catch(() => {});
  } catch (err) {
    console.error('traction error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Task check endpoint — re-evaluate a task against live data ────────────────
router.post('/tasks/:taskId/check', async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user?.onboarding?.defaultContract?.address) return res.status(404).json({ error: 'No contract' });

    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest = allAnalyses
      .filter(a => a.status === 'completed' && a.metadata?.isDefaultContract)
      .sort((a,b) => new Date(b.completedAt||b.createdAt) - new Date(a.completedAt||a.createdAt))[0];
    if (!latest) return res.status(404).json({ error: 'No analysis' });

    const txs     = latest.results?.target?.transactions || [];
    const metrics = latest.results?.target?.metrics || {};
    const contract= latest.results?.target?.contract || user.onboarding.defaultContract;
    const ethPrice= await priceService.getPrice('eth').catch(() => 2500);
    const fr = buildFullReportFromAnalysis(txs, metrics, { ...contract, _ethPriceUSD: ethPrice });

    let alerts = [];
    try {
      const { readFileSync, existsSync } = await import('fs');
      if (existsSync('./data/alerts.json'))
        alerts = JSON.parse(readFileSync('./data/alerts.json','utf8')).filter(a => a.userId === req.user.id);
    } catch {}

    const ops   = calculateOPS(fr, alerts);
    const tasks = generateTasks(fr, ops);
    const task  = tasks.find(t => t.id === req.params.taskId);

    if (!task) {
      // Task not found in failing list = it's resolved!
      return res.json({
        resolved: true,
        message: '✅ This metric is now on track. Task resolved.',
        aiGuidance: 'Great work! Keep monitoring to ensure it stays healthy.',
      });
    }

    // Task still failing — generate AI guidance
    let aiGuidance = task.action;
    try {
      const GeminiAIService = (await import('../../services/GeminiAIService.js')).default;
      const gemini = new GeminiAIService();
      const prompt = `A blockchain project has this problem: "${task.description}"
Current value: ${task.current}. Target: ${task.target}.
Give 2-3 specific, actionable steps the project owner can take on-chain or in their product to fix this. Be concise and practical.`;
      aiGuidance = await gemini.generateContent(prompt);
    } catch { /* use default action */ }

    res.json({
      resolved: false,
      task,
      aiGuidance,
      message: `Still failing — ${task.description}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/traction/send-report — email selected sections as PDF ───────────
router.post('/send-report', async (req, res) => {
  try {
    const { email, sections = [] } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!sections.length) return res.status(400).json({ error: 'Select at least one section' });

    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });
    const { fr, contract, user } = built;

    let alerts = [];
    try {
      const { readFileSync, existsSync } = await import('fs');
      if (existsSync('./data/alerts.json'))
        alerts = JSON.parse(readFileSync('./data/alerts.json','utf8')).filter(a => a.userId === req.user.id);
    } catch {}

    const ops   = calculateOPS(fr, alerts);
    const tasks = generateTasks(fr, ops);
    const traction = buildTractionSummary(fr, await loadCompetitors(req.user.id), 2500);

    // Generate PDF
    const { generateTractionPDF } = await import('../../services/TractionPDFGenerator.js');
    const pdfBuffer = await generateTractionPDF({
      user,
      contract,
      ops,
      tasks,
      growth: {
        newUsers:       fr.userLifecycle?.summary?.newUsers || 0,
        returningUsers: fr.userLifecycle?.summary?.returningUsers || 0,
        totalUsers:     fr.summary?.uniqueUsers || 0,
        txGrowth:       fr.summary?.totalTransactions || 0,
        activationFunnel: fr.activationMetrics?.activationFunnel || [],
        avgTimeToActivation: fr.activationMetrics?.avgTimeToActivation,
        avgSessionDuration:  fr.defiMetrics?.avgSessionDuration,
      },
      retentionMetrics:  fr.retentionMetrics,
      activationMetrics: fr.activationMetrics,
      gasAnalysis:       fr.gasAnalysis,
      userQuality:       fr.userQualityMetrics,
      defiMetrics:       fr.defiMetrics,
      summary:           fr.summary,
      featureInsights:   (fr.activationMetrics?.featureFirstUse || []).slice(0, 8),
      labels:            traction.productivityScore >= 70 ? [{ label:'Revenue Positive' }] : [],
      users:             fr.users?.slice(0, 10) || [],
      sections,
    });

    const date = new Date().toISOString().slice(0, 10);
    const filename = `traction-${contract.name}-${date}.pdf`;

    // Send email with PDF attachment
    const { EmailService } = await import('../../services/EmailService.js');
    const emailSvc = new EmailService();
    await emailSvc.sendBriefing(email, {
      type: 'traction',
      title: `Traction Report — ${contract.name}`,
      content: `Hi ${user.name},\n\nPlease find your MetaGauge traction report attached.\n\nSections: ${sections.join(', ')}\nContract: ${contract.name} on ${contract.chain}\nOPS Score: ${ops.total}/100 (${ops.label})\nDate: ${date}\n\nMetaGauge`,
      createdAt: new Date().toISOString(),
      attachment: { filename, content: pdfBuffer, encoding: 'base64' },
    });

    res.json({ message: `Report sent to ${email}`, sections, filename });
  } catch (err) {
    console.error('send-report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/traction/history — time-series snapshots ────────────────────────
router.get('/history', async (req, res) => {
  try {
    const history = await MetricsHistoryStorage.get(req.user.id);
    res.json({ history, days: history.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/traction/activity — unified activity feed ────────────────────────
router.get('/activity', async (req, res) => {
  try {
    const events = [];

    // 1. Analyses
    const analyses = await AnalysisStorage.findByUserId(req.user.id);
    for (const a of analyses) {
      events.push({
        id: `analysis-${a.id}`,
        type: 'analysis',
        title: a.analysisType === 'quick-index' ? 'Contract indexed' : 'Analysis completed',
        detail: `${a.results?.target?.contract?.name || a.contractAddress || 'Contract'} on ${a.results?.target?.contract?.chain || a.chain || 'ethereum'}`,
        status: a.status,
        ts: a.completedAt || a.createdAt,
        meta: { txs: a.results?.target?.metrics?.transactions, users: a.results?.target?.metrics?.uniqueUsers },
      });
    }

    // 2. Alerts
    try {
      const { readFileSync, existsSync } = await import('fs');
      if (existsSync('./data/alerts.json')) {
        const alerts = JSON.parse(readFileSync('./data/alerts.json', 'utf8'))
          .filter(a => a.userId === req.user.id);
        for (const a of alerts) {
          events.push({
            id: `alert-${a.id}`,
            type: 'alert',
            title: a.title,
            detail: a.message,
            status: a.is_read ? 'read' : 'unread',
            severity: a.severity,
            ts: a.createdAt,
          });
        }
      }
    } catch {}

    // 3. Metrics snapshots (daily)
    const history = await MetricsHistoryStorage.get(req.user.id);
    for (const h of history) {
      events.push({
        id: `snapshot-${h.date}`,
        type: 'snapshot',
        title: 'Daily metrics snapshot',
        detail: `OPS ${h.ops}/100 · DAU ${h.dau} · Retention ${h.retentionRate}% · ${h.openTasks} open tasks`,
        status: h.ops >= 75 ? 'good' : h.ops >= 50 ? 'moderate' : 'needs-work',
        ts: `${h.date}T00:00:00.000Z`,
        meta: h,
      });
    }

    // 4. Competitor indexing events
    try {
      const { readdir, readFile } = await import('fs/promises');
      const { join } = await import('path');
      const compDir = join('./data', 'users', req.user.id, 'competitors');
      const files = await readdir(compDir).catch(() => []);
      for (const f of files.filter(f => f.endsWith('.json') && !f.endsWith('.backup'))) {
        const c = JSON.parse(await readFile(join(compDir, f), 'utf8'));
        events.push({
          id: `competitor-${c.id}`,
          type: 'competitor',
          title: 'Competitor indexed',
          detail: `${c.name} on ${c.chain} — ${c.metrics?.transactions || 0} txs, ${c.metrics?.uniqueUsers || 0} users`,
          status: 'completed',
          ts: c.lastUpdated || c.createdAt,
        });
      }
    } catch {}

    // Sort newest first
    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    res.json({ events, total: events.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
