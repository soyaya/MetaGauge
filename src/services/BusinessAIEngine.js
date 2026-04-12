/**
 * BusinessAIEngine
 * Unified RAG-powered AI engine. Single entry point for all AI operations.
 * Every call is grounded in the knowledge base — AI never acts without context.
 */

import { GoogleGenAI } from '@google/genai';
import { RAGContextBuilder } from './RAGContextBuilder.js';
import { ExternalDataFetcher } from './ExternalDataFetcher.js';
import { AITaskManager } from './AITaskManager.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

class BusinessAIEngine {
  constructor() {
    // Skip initialization if AI is disabled
    if (process.env.AI_DISABLED === 'true') {
      console.log('🚫 BusinessAIEngine disabled via AI_DISABLED flag');
      this.disabled = true;
      return;
    }
    this.genAI = null;
    this.enabled = false;
  }

  _init() {
    if (this.genAI) return;
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[BusinessAI] GEMINI_API_KEY not set — AI disabled');
      return;
    }
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.enabled = true;
  }

  async _call(systemContext, userPrompt) {
    this._init();
    if (!this.enabled) return null;
    try {
      const response = await this.genAI.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: `${systemContext}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      console.error('[BusinessAI] Gemini call failed:', e.message);
      return null;
    }
  }

  /**
   * Full contract analysis with RAG context.
   * Returns structured insights + generated tasks.
   */
  async analyze({ userId, contractId, contractAddress, chain, metrics, competitorData = null }) {
    if (this.disabled) {
      return { message: "AI analysis temporarily disabled", disabled: true };
    }
    // Refresh external data in background
    ExternalDataFetcher.getMarketContext(chain, contractAddress).catch(() => {});

    const activeTasks = await AITaskManager.getActiveTasks(userId, contractId);
    const ragContext = await RAGContextBuilder.build({ chain, userId, contractAddress, metrics, recentTasks: activeTasks });

    const prompt = `
Analyze this smart contract's performance and provide business intelligence.

Contract: ${contractAddress} on ${chain}
Current Metrics:
${JSON.stringify(metrics, null, 2)}

${competitorData ? `Competitor Data:\n${JSON.stringify(competitorData, null, 2)}` : ''}

Respond in this exact JSON format:
{
  "summary": "2-3 sentence executive summary",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "opportunities": ["opportunity 1"],
  "risks": ["risk 1"],
  "insights": [
    { "metric": "metricName", "status": "GOOD|WARN|BAD", "finding": "what this means", "action": "what to do" }
  ],
  "tasks": [
    { "goal": "specific actionable goal", "targetMetric": "metricName", "targetValue": 40, "deadlineDays": 14, "rationale": "why this matters" }
  ],
  "learnings": [
    { "type": "chain|user", "finding": "what was learned" }
  ]
}`;

    const raw = await this._call(ragContext, prompt);
    if (!raw) return this._fallbackAnalysis(metrics);

    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || raw);
    } catch {
      return this._fallbackAnalysis(metrics);
    }

    // Create tasks from AI response
    const createdTasks = [];
    for (const t of (parsed.tasks || [])) {
      if (t.targetMetric && t.targetValue != null) {
        const task = await AITaskManager.createTask({
          userId, contractId, contractAddress, chain,
          goal: t.goal,
          targetMetric: t.targetMetric,
          targetValue: t.targetValue,
          deadlineDays: t.deadlineDays || 14,
          rationale: t.rationale,
        });
        createdTasks.push(task);
      }
    }

    // Persist learnings
    for (const l of (parsed.learnings || [])) {
      if (l.type && l.finding) {
        await RAGContextBuilder.learn({
          type: l.type,
          key: l.type === 'chain' ? chain : userId,
          finding: l.finding,
          outcome: null,
        });
      }
    }

    return { ...parsed, createdTasks };
  }

  /**
   * Chat with contract context — RAG-grounded conversational AI.
   * Returns { content: string, components: array }
   */
  async chat({ userId, message, contractAddress, chain, metrics, analysisData = null, sessionHistory = [] }) {
    // Refresh external market data (6h cache)
    ExternalDataFetcher.getMarketContext(chain, contractAddress).catch(() => {});

    // Get category from contract data for TAM/SAM/SOM context
    const category = analysisData?.results?.target?.contract?.category
      || analysisData?.results?.target?.fullReport?.metadata?.category
      || null;

    // Fetch protocol/market context relevant to this contract's category
    const protocolCtx = await ExternalDataFetcher.getProtocolContext(contractAddress, chain, category).catch(() => ({}));

    // Web search for questions that need external lookup
    const needsWebSearch = /\b(tam|sam|som|market size|total addressable|serviceable|obtainable|growth rate|cagr|market share|market cap|industry size|sector size|news|latest|recent|trend|forecast|projection|outlook|competitor|landscape|benchmark|valuation|funding|raise|investment|adoption|tvl|volume|liquidity|yield|apy|apr|protocol health|ecosystem|on.?chain|defi|nft|dao|layer.?2|l2|rollup|scaling|regulation|compliance|hack|exploit|audit|security|price|token|inflation|supply|demand|user growth|dau|mau|retention|churn|engagement|revenue|fee|profit|burn rate|runway|traction|pmf|product.market fit)\b/i.test(message);
    let webResults = null;
    if (needsWebSearch) {
      const query = `${category || 'DeFi'} ${chain} ${message.slice(0, 120)}`;
      webResults = await ExternalDataFetcher.webSearch(query, { category, chain, contractAddress }).catch(() => null);
    }

    const activeTasks = await AITaskManager.getActiveTasks(userId);
    const ragContext = await RAGContextBuilder.build({ chain, userId, contractAddress, metrics, recentTasks: activeTasks });

    const history = sessionHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

    // Build full analysis data summary
    let dataSummary = '';
    if (analysisData?.results?.target) {
      const t = analysisData.results.target;
      const fr = t.fullReport || {};
      const txCount = typeof t.transactions === 'number' ? t.transactions : (Array.isArray(t.transactions) ? t.transactions.length : 0);
      dataSummary = `
=== CONTRACT ANALYSIS DATA ===
Transactions: ${txCount}
Metrics: ${JSON.stringify(t.metrics || {})}
Summary: ${JSON.stringify(fr.summary || {})}
User behavior: ${JSON.stringify(fr.userBehavior || {})}
DeFi metrics: ${JSON.stringify(fr.defiMetrics || {})}
Retention: ${JSON.stringify(fr.retentionMetrics || {})}
Activation: ${JSON.stringify(fr.activationMetrics || {})}
Gas analysis: ${JSON.stringify(fr.gasAnalysis || {})}
UX analysis: ${JSON.stringify(fr.uxAnalysis || {})}
User lifecycle: ${JSON.stringify(fr.userLifecycle || {})}
User quality: ${JSON.stringify(fr.userQualityMetrics || {})}
Recommendations: ${JSON.stringify(fr.recommendations || [])}
Alerts: ${JSON.stringify(fr.alerts || [])}`;
    }

    // Protocol/market context for TAM/SAM/SOM and competitive positioning
    const marketSummary = `
=== MARKET & PROTOCOL CONTEXT ===
Contract category: ${category || 'unknown'}
Chain TVL: $${protocolCtx.chainTVL?.toLocaleString() || 'unknown'}
Category TVL (TAM proxy): $${protocolCtx.categoryTVL?.toLocaleString() || 'unknown'}
ETH price: $${protocolCtx.ethPrice?.price || 'unknown'} (24h: ${protocolCtx.ethPrice?.change24h || '?'}%)
Top protocols in category: ${JSON.stringify(protocolCtx.topProtocolsInCategory || [])}
${webResults ? `\nWeb search results for context:\n${webResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}` : ''}`;

    const prompt = `${history ? `Conversation so far:\n${history}\n` : ''}
User: ${message}

Contract: ${contractAddress} on ${chain}
${dataSummary}
${marketSummary}

Instructions:
- Answer using the contract data and market context above
- For TAM/SAM/SOM: TAM = total category TVL on chain, SAM = realistic addressable share based on contract's user count vs category, SOM = contract's current TVL/volume vs category
- Cite specific numbers from the data
- When the answer involves data that can be visualised, include chart or table components

Return ONLY valid JSON:
{
  "content": "your conversational answer here",
  "components": [
    { "type": "chart|metric_card|table|alert|insight_card|recommendation", "data": {} }
  ]
}

Component schemas:
- chart: { title, type (line|bar|area|pie|donut|radar), data: [{label, value}], description }
- metric_card: { title, value, unit, change, trend (up|down|neutral), description }
- table: { title, headers: [], rows: [[]] }
- alert: { severity (info|warning|error|success), title, message }
- insight_card: { title, insight, confidence (0-100), category }
- recommendation: { title, description, priority (high|medium|low), impact, effort (low|medium|high) }

If no visual components are needed, return "components": [].`;

    const raw = await this._call(ragContext, prompt);
    if (!raw) {
      return { content: "I don't have enough data to answer that right now. Please run an analysis first.", components: [] };
    }

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || raw);
      return {
        content: parsed.content || parsed.text || raw,
        components: Array.isArray(parsed.components) ? parsed.components : [],
      };
    } catch {
      return { content: raw, components: [] };
    }
  }

  /**
   * Generate a briefing (daily/weekly/monthly).
   */
  async brief({ userId, type, contracts }) {
    const ragContext = await RAGContextBuilder.build({ chain: 'ethereum', userId, contractAddress: null, metrics: {} });
    const activeTasks = await AITaskManager.getActiveTasks(userId);

    const prompt = `
Generate a ${type} business briefing for this user's blockchain portfolio.

Contracts monitored: ${JSON.stringify(contracts?.map(c => ({ name: c.name, chain: c.chain, address: c.address })))}
Active tasks: ${activeTasks.length} tasks in progress

Provide:
1. Key wins this ${type === 'daily' ? 'day' : type === 'weekly' ? 'week' : 'month'}
2. Metrics that need attention
3. Top 3 priorities for the next period
4. One strategic recommendation

Keep it concise and actionable. Format as plain text, not JSON.`;

    return await this._call(ragContext, prompt);
  }

  /**
   * Observe task progress after an analysis run.
   */
  async observeTasks(userId, metrics, wsManager = null) {
    return AITaskManager.observeAllTasks(userId, metrics, wsManager);
  }

  _fallbackAnalysis(metrics) {
    return {
      summary: 'Analysis complete. AI interpretation unavailable — check GEMINI_API_KEY.',
      strengths: [],
      weaknesses: [],
      opportunities: [],
      risks: [],
      insights: [],
      tasks: [],
      learnings: [],
      createdTasks: [],
    };
  }
}

export const businessAI = new BusinessAIEngine();
export default businessAI;
