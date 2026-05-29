/**
 * RAGContextBuilder
 * Assembles the full knowledge context injected into every AI prompt.
 * This is the core of the RAG system — AI never acts without this context.
 */

import fs from 'fs/promises';
import path from 'path';

const KB_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/ai-knowledge');

async function readJson(file, fallback) {
  try {
    const data = await fs.readFile(path.join(KB_DIR, file), 'utf8');
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

export class RAGContextBuilder {
  /**
   * Build the full RAG context string for a given analysis call.
   * @param {object} opts
   * @param {string} opts.chain - e.g. 'ethereum'
   * @param {string} opts.userId
   * @param {string} opts.contractAddress
   * @param {object} opts.metrics - current metrics object
   * @param {object[]} opts.recentTasks - recent tasks for this user/contract
   */
  static async build({ chain, userId, contractAddress, metrics = {}, recentTasks = [] }) {
    const [metricDefs, chainLearnings, userLearnings, marketCtx] = await Promise.all([
      readJson('metrics-definitions.json', {}),
      readJson('chain-learnings.json', {}),
      readJson('user-learnings.json', {}),
      readJson('market-context.json', {}),
    ]);

    const sections = [];

    // 1. Metric definitions — only include metrics present in current data
    const relevantMetrics = Object.keys(metrics).filter(k => metricDefs[k]);
    if (relevantMetrics.length > 0) {
      sections.push('=== METRIC BOUNDARIES ===');
      for (const key of relevantMetrics) {
        const def = metricDefs[key];
        const val = metrics[key];
        const status = RAGContextBuilder._classify(val, def);
        sections.push(
          `${key}: current=${val} | good=${def.goodRange} | warn=${def.warnRange} | bad=${def.badRange} | status=${status}\n  → ${def.interpretation}`
        );
      }
    }

    // 2. Chain learnings
    const cl = chainLearnings[chain];
    if (cl && cl.findings?.length > 0) {
      sections.push(`\n=== CHAIN LEARNINGS (${chain}) ===`);
      cl.findings.slice(-5).forEach(f => sections.push(`- [${f.date}] ${f.finding}`));
    }

    // 3. User learnings
    const ul = userLearnings[userId];
    if (ul && ul.patterns?.length > 0) {
      sections.push('\n=== USER PATTERNS ===');
      ul.patterns.slice(-3).forEach(p => sections.push(`- ${p}`));
    }

    // 4. Market context — chain TVL, category TVL (TAM proxy), top protocols in category
    if (marketCtx.chainStats?.[chain]) {
      const cs = marketCtx.chainStats[chain];
      sections.push(`\n=== MARKET CONTEXT ===`);
      sections.push(`${chain} chain total TVL: $${cs.tvl?.toLocaleString() || 'unknown'}`);
    }
    if (marketCtx.tokens?.eth) {
      sections.push(`ETH price: $${marketCtx.tokens.eth.price} | 24h: ${marketCtx.tokens.eth.change24h}% | market cap: $${marketCtx.tokens.eth.marketCap?.toLocaleString()}`);
    }
    // Category-level data — TAM/SAM reference
    if (marketCtx.categoryTVL) {
      const categories = Object.entries(marketCtx.categoryTVL)
        .sort(([,a],[,b]) => b - a)
        .slice(0, 10)
        .map(([cat, tvl]) => `${cat}: $${tvl?.toLocaleString()}`)
        .join(' | ');
      sections.push(`Category TVL breakdown (TAM reference): ${categories}`);
    }
    // Top protocols — competitive landscape
    if (marketCtx.protocols) {
      const top = Object.values(marketCtx.protocols)
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, 10);
      if (top.length > 0) {
        sections.push(`Top protocols by TVL: ${top.map(p => `${p.name}(${p.category},$${p.tvl?.toLocaleString()},7d:${p.tvl7dChange?.toFixed(1)}%)`).join(' | ')}`);
      }
    }

    // 5. Recent tasks
    if (recentTasks.length > 0) {
      sections.push('\n=== ACTIVE TASKS ===');
      recentTasks.slice(0, 5).forEach(t => {
        sections.push(`- [${t.status}] ${t.goal} | target: ${t.targetMetric} ${t.targetValue} | deadline: ${t.deadline}`);
      });
    }

    // 6. Feedback patterns
    try {
      const { FeedbackProcessor } = await import('./FeedbackProcessor.js');
      const patterns = await FeedbackProcessor.getPatterns(userId);
      if (patterns.disliked.length > 0) {
        sections.push(`\n=== USER PREFERENCES ===`);
        sections.push(`Avoid these response types (user rated poorly): ${patterns.disliked.join(', ')}`);
        if (patterns.liked.length > 0) sections.push(`Prefer these response types: ${patterns.liked.join(', ')}`);
      }
    } catch {}

    // 6b. Pattern profile — accumulated trends
    try {
      const { PatternProfileService } = await import('./PatternProfileService.js');
      const profile = await PatternProfileService.get(userId);
      if (profile) {
        sections.push(`\n=== HISTORICAL PATTERN PROFILE ===`);
        sections.push(`Summary: ${profile.summary}`);
        sections.push(`Growth: ${profile.growth?.direction} (${profile.growth?.rate > 0 ? '+' : ''}${profile.growth?.rate}% overall, current ${profile.growth?.current} users)`);
        sections.push(`Retention trend: ${profile.retention?.direction} (avg ${profile.retention?.avg}%)`);
        sections.push(`Churn trend: ${profile.churn?.direction} (current ${profile.churn?.current}%)`);
        sections.push(`User quality: ${profile.userQuality?.quality} (whale ${profile.userQuality?.avgWhaleRatio}%, bot ${profile.userQuality?.avgBotRatio}%)`);
        if (profile.milestones?.length) sections.push(`Milestones reached: ${profile.milestones.join(', ')}`);
        sections.push(`Data points: ${profile.dataPoints} analyses`);

        // Predictions
        const p = profile.predictions;
        if (p) {
          sections.push(`\n=== PREDICTIONS (next 30 days) ===`);
          sections.push(`Users: ${p.next30Days.users.current} → ${p.next30Days.users.value} (${p.next30Days.users.changePct > 0 ? '+' : ''}${p.next30Days.users.changePct}%)`);
          sections.push(`Retention: ${p.next30Days.retentionRate.current}% → ${p.next30Days.retentionRate.value}%`);
          sections.push(`Churn risk: ${p.churnRisk.level} (score ${p.churnRisk.score}/100)`);
          sections.push(`Growth score: ${p.growthScore.score}/100 (${p.growthScore.label})`);
          if (Object.keys(p.timeToMilestone || {}).length) {
            const [key, val] = Object.entries(p.timeToMilestone)[0];
            sections.push(`Next milestone: ${key.replace('_', ' ')} in ~${val.days} days (${val.date})`);
          }
          sections.push(`Prediction confidence: ${p.confidence}`);
        }
      }
    } catch {}

    // 7. Role instruction
    sections.push(`
    // 7. Role instruction
You are a business intelligence AI for blockchain protocols. You MUST:
- Only draw conclusions supported by the data and boundaries above
- Reference specific metric values and their status (good/warn/bad)
- Assign actionable tasks with measurable on-chain targets
- Be concise, specific, and business-focused
- Never speculate beyond what the data shows`);

    return sections.join('\n');
  }

  /**
   * Classify a metric value against its definition boundaries.
   */
  static _classify(value, def) {
    if (value == null || !def.alertThreshold) return 'unknown';
    const num = parseFloat(value);
    if (isNaN(num)) return 'unknown';

    // Parse good/bad ranges from strings like ">40", "<20", "20-40"
    const bad = def.badRange;
    if (bad.startsWith('<') && num < parseFloat(bad.slice(1))) return 'BAD';
    if (bad.startsWith('>') && num > parseFloat(bad.slice(1))) return 'BAD';

    const good = def.goodRange;
    if (good.startsWith('>') && num > parseFloat(good.slice(1))) return 'GOOD';
    if (good.startsWith('<') && num < parseFloat(good.slice(1))) return 'GOOD';

    return 'WARN';
  }

  /**
   * Write a new learning to the knowledge base.
   */
  static async learn({ type, key, finding, outcome }) {
    if (type === 'chain') {
      const data = await readJson('chain-learnings.json', {});
      if (!data[key]) data[key] = { findings: [] };
      data[key].findings.push({ date: new Date().toISOString().slice(0, 10), finding, outcome });
      // Keep last 50 findings per chain
      data[key].findings = data[key].findings.slice(-50);
      await fs.writeFile(path.join(KB_DIR, 'chain-learnings.json'), JSON.stringify(data, null, 2));
    } else if (type === 'user') {
      const data = await readJson('user-learnings.json', {});
      if (!data[key]) data[key] = { patterns: [] };
      data[key].patterns.push(finding);
      data[key].patterns = data[key].patterns.slice(-20);
      await fs.writeFile(path.join(KB_DIR, 'user-learnings.json'), JSON.stringify(data, null, 2));
    }
  }
}
