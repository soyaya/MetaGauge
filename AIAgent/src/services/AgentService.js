/**
 * AgentService
 * Gemini agentic loop for the AI Agent.
 * Receives user context fetched from the main app and answers questions / generates reports.
 */

import { GoogleGenAI } from '@google/genai';
import config from '../config/env.js';

const MAX_ITERATIONS = 5;

function getClient() {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

const SYSTEM_PROMPT = `You are MetaGauge AI Agent — a blockchain intelligence analyst.
You have access to real on-chain analytics data for the user's smart contract.
Always base your answers on the provided data. Be concise, specific, and business-focused.

Respond ONLY with valid JSON:
{
  "content": "Your main answer here",
  "components": [
    { "type": "metric_card", "data": { "title": "...", "value": "...", "trend": "up|down|neutral", "description": "..." } },
    { "type": "recommendation", "data": { "title": "...", "description": "...", "priority": "high|medium|low" } },
    { "type": "risk_signal", "data": { "signal": "...", "severity": "low|medium|high|critical" } }
  ]
}`;

export class AgentService {
  static async chat(message, context = {}) {
    if (!config.geminiApiKey) {
      return { content: 'Gemini API key not configured.', components: [] };
    }

    const client = getClient();

    // Build context string from main app data
    const contextStr = buildContextString(context);

    const contents = [
      ...(context.history || []).slice(-6),
      { role: 'user', parts: [{ text: `${contextStr}\n\nUser question: ${message}` }] },
    ];

    let finalContent = '';
    let finalComponents = [];
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const response = await client.models.generateContent({
        model: config.geminiModel,
        config: { systemInstruction: SYSTEM_PROMPT, generationConfig: { temperature: 0.3 } },
        contents,
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = tryParseJSON(text);
      finalContent = parsed?.content || text;
      finalComponents = parsed?.components || [];
      break;
    }

    return { content: finalContent, components: finalComponents };
  }

  /**
   * Autonomous research — runs full analysis and generates a report.
   */
  static async research(context = {}) {
    const { scores, riskSignals, traction, contract, github } = context;

    const githubSection = github && !github.error
      ? `\nGitHub (${github.owner}/${github.repo}):
- Dev Health Score: ${github.devHealthScore}/100
- Commits (30d): ${github.commits30d} | (90d): ${github.commits90d}
- Contributors: ${github.contributorCount}
- Last commit: ${github.lastCommitDaysAgo} days ago
- Abandoned: ${github.isAbandoned}
- Avg issue close time: ${github.avgDaysToClose ?? 'N/A'} days
- Stars: ${github.stars} | Forks: ${github.forks}`
      : '\nGitHub: not provided';

    const prompt = `Analyze this blockchain contract and generate a comprehensive intelligence report.

Contract: ${contract?.name || contract?.address} on ${contract?.chain}
Traction Score: ${scores?.tractionScore}/100
Risk Score: ${scores?.riskScore}/100
Sustainability Score: ${scores?.sustainabilityScore}/100
Community Health: ${scores?.communityHealthScore}/100
Growth Probability: ${scores?.growthProbability}/100
Risk Level: ${scores?.riskLevel}
Risk Signals: ${riskSignals?.length ? riskSignals.join('; ') : 'None detected'}

Key Metrics:
${buildMetricsSummary(traction)}
${githubSection}

Generate:
1. Executive summary (2-3 sentences)
2. Top 3 strengths
3. Top 3 risks with explanations
4. 3 actionable recommendations
5. Overall verdict`;

    return this.chat(prompt, { ...context, history: [] });
  }
}

function buildContextString(context) {
  if (!context.traction && !context.scores) return '';
  const lines = ['=== CONTRACT INTELLIGENCE DATA ==='];

  if (context.contract) {
    lines.push(`Contract: ${context.contract.name || context.contract.address} (${context.contract.chain})`);
  }
  if (context.scores) {
    lines.push(`Scores — Traction: ${context.scores.tractionScore}, Risk: ${context.scores.riskScore}, Sustainability: ${context.scores.sustainabilityScore}, Community: ${context.scores.communityHealthScore}`);
    lines.push(`Risk Level: ${context.scores.riskLevel} | Growth Probability: ${context.scores.growthProbability}%`);
  }
  if (context.riskSignals?.length) {
    lines.push(`Risk Signals: ${context.riskSignals.join('; ')}`);
  }
  if (context.traction?.metrics) {
    lines.push(buildMetricsSummary(context.traction));
  }
  if (context.github && !context.github.error) {
    const g = context.github;
    lines.push(`GitHub — ${g.owner}/${g.repo} | Dev Health: ${g.devHealthScore}/100 | Commits(30d): ${g.commits30d} | Contributors: ${g.contributorCount} | Last commit: ${g.lastCommitDaysAgo}d ago | Abandoned: ${g.isAbandoned}`);
  }
  return lines.join('\n');
}

function buildMetricsSummary(traction) {
  if (!traction) return '';
  const m = traction.metrics || {};
  const fr = traction.retentionMetrics || {};
  return [
    `Transactions: ${m.transactions || 0}`,
    `Unique Users: ${m.uniqueUsers || 0}`,
    `Retention Rate: ${fr.retentionRate || 0}%`,
    `D7 Retention: ${fr.d7Retention || 0}%`,
    `Churn Rate: ${fr.churnRate || 0}%`,
  ].join(' | ');
}

function tryParseJSON(str) {
  try {
    const match = str.match(/```json\s*([\s\S]*?)```/) || str.match(/(\{[\s\S]*\})/);
    return JSON.parse(match ? match[1] : str);
  } catch {
    return null;
  }
}
