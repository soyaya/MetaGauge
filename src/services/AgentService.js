/**
 * AgentService
 * Unified AI agent using Gemini function calling.
 * Rotates through multiple API keys on 403/429/blocked errors.
 */

import { GoogleGenAI } from '@google/genai';
import { RAGContextBuilder } from './RAGContextBuilder.js';
import { AgentMemory } from './AgentMemory.js';
import { TOOL_SCHEMAS, TOOL_EXECUTORS } from './agent/tools/index.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_ITERATIONS = 5;

async function getAgentConfig(userId) {
  try {
    const { AgentConfigStorage } = await import('../api/database/index.js');
    return await AgentConfigStorage.get(userId);
  } catch { return null; }
}

export async function isAgentPermitted(userId, permission) {
  const cfg = await getAgentConfig(userId);
  if (!cfg || !cfg.enabled) return false;
  return cfg.permissions?.[permission] === true;
}

// Collect all keys from env in order
function getApiKeys() {
  const keys = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

// Returns true if the error should trigger a key rotation
function isKeyError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('403') ||
    msg.includes('429') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY') ||
    msg.includes('blocked') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('SERVICE_DISABLED') ||
    msg.includes('has not been used') ||
    msg.includes('is disabled')
  );
}

class AgentService {
  constructor() {
    this.keys = [];
    this.currentKeyIndex = 0;
    this.clients = {}; // cache GoogleGenAI instances per key
  }

  _loadKeys() {
    if (this.keys.length === 0) {
      this.keys = getApiKeys();
    }
    return this.keys;
  }

  _getClient(keyIndex) {
    const keys = this._loadKeys();
    if (keys.length === 0) return null;
    const key = keys[keyIndex % keys.length];
    if (!this.clients[key]) {
      this.clients[key] = new GoogleGenAI({ apiKey: key });
    }
    return this.clients[key];
  }

  /**
   * Call Gemini with automatic key rotation on failure.
   */
  async _generateWithFallback(params) {
    const keys = this._loadKeys();
    if (keys.length === 0) throw new Error('No Gemini API keys configured');

    let lastErr;
    // Try from current key, rotate through all
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const idx = (this.currentKeyIndex + attempt) % keys.length;
      const client = this._getClient(idx);
      try {
        const result = await client.models.generateContent(params);
        // Success — lock onto this key index
        this.currentKeyIndex = idx;
        return result;
      } catch (err) {
        lastErr = err;
        if (isKeyError(err)) {
          console.warn(`[AgentService] Key ${idx + 1}/${keys.length} failed (${err.message?.slice(0, 60)}), trying next...`);
          continue;
        }
        // Non-key error — don't rotate, just throw
        throw err;
      }
    }
    throw lastErr;
  }

  /**
   * Run the agent loop.
   * @param {string} userId
   * @param {string} message
   * @param {object} context - { contractAddress, chain, sessionId, sessionHistory, source }
   */
  async run(userId, message, context = {}) {
    if (process.env.AI_DISABLED === 'true') {
      return { content: 'AI is currently disabled.', components: [], toolsUsed: [], iterations: 0 };
    }
    if (this._loadKeys().length === 0) {
      return { content: 'No Gemini API keys configured.', components: [], toolsUsed: [], iterations: 0 };
    }

    // Gate autonomous (non-chat) actions behind agent config
    const source = context.source || 'chat';
    if (source !== 'chat') {
      const permMap = { analyzer: 'autoAnalyze', proactive: 'autoAnalyze', briefing: 'sendDigests' };
      const perm = permMap[source] || 'autoAnalyze';
      if (!isAgentPermitted(userId, perm)) {
        return { content: `Agent action "${source}" is disabled. Enable it in Alerts → Agent Controls.`, components: [], toolsUsed: [], iterations: 0 };
      }
    }

    // Build RAG system prompt
    let ragContext = '';
    try {
      ragContext = await RAGContextBuilder.build({
        chain: context.chain || 'ethereum',
        userId,
        contractAddress: context.contractAddress || '',
        metrics: {},
        recentTasks: [],
      });
    } catch { /* ignore */ }

    const memoryContext = await AgentMemory.buildContext(userId).catch(() => '');
    const systemPrompt = `You are MetaGauge, a blockchain analytics AI and business growth expert. You have tools that fetch REAL data about the user's smart contract.

RULES:
- ALWAYS call get_metrics first when asked about metrics, retention, users, transactions, gas, or performance.
- ALWAYS call get_business_intelligence when asked about LTV, churn, patterns, growth forecast, sessions, funnel, or smart money.
- ALWAYS call get_tasks when asked about issues or what to fix.
- NEVER answer data questions from memory — use tools first.

RESPONSE FORMAT:
Always respond with a JSON object:
{
  "content": "Your main text answer here",
  "components": [
    {
      "type": "metric_card",
      "data": { "title": "...", "value": "...", "unit": "...", "change": "...", "trend": "up|down|neutral", "description": "..." }
    },
    {
      "type": "chart",
      "data": { "type": "bar|line|pie|area", "title": "...", "data": [{"label":"...", "value": 0}], "description": "..." }
    },
    {
      "type": "recommendation",
      "data": { "title": "...", "description": "...", "priority": "high|medium|low", "impact": "...", "effort": "low|medium|high" }
    },
    {
      "type": "insight_card",
      "data": { "title": "...", "insight": "...", "confidence": 85, "category": "growth|retention|revenue|risk" }
    }
  ]
}

Include charts whenever you have time-series, distribution, or comparison data. Include metric_cards for key numbers. Include recommendations when you identify issues.

IMPORTANT: Your ENTIRE response must be valid JSON matching the format above. Do NOT include any text outside the JSON object.

${ragContext}${memoryContext}`.trim();

    // Normalise session history — ensure every entry has the parts format
    const history = (context.sessionHistory || []).slice(-6).map(m => {
      if (m.parts) return m;
      return { role: m.role, parts: [{ text: String(m.content || '') }] };
    });

    const messages = [
      ...history,
      { role: 'user', parts: [{ text: message }] },
    ];

    const tools = [{ functionDeclarations: TOOL_SCHEMAS }];
    const toolsUsed = [];
    let iterations = 0;
    let finalContent = null;
    let finalComponents = [];

    // Agentic loop
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await this._generateWithFallback({
        model: MODEL,
        config: {
          systemInstruction: systemPrompt,
          tools,
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0.3 },
        },
        contents: messages,
      });

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const fnCalls = parts.filter(p => p.functionCall);

      if (fnCalls.length === 0) {
        const textPart = parts.find(p => p.text);
        const raw = textPart?.text || '';
        const parsed = tryParseJSON(raw);
        finalContent = parsed?.content || raw;
        finalComponents = sanitizeComponents(parsed?.components || []);
        break;
      }

      // Execute all tool calls
      const toolResults = [];
      for (const part of fnCalls) {
        const { name, args } = part.functionCall;
        toolsUsed.push(name);
        let result;
        try {
          const executor = TOOL_EXECUTORS[name];
          result = executor ? await executor(userId, args || {}, context) : { error: `Unknown tool: ${name}` };
        } catch (err) {
          result = { error: err.message };
        }
        toolResults.push({ name, result });
      }

      messages.push({ role: 'model', parts });
      messages.push({
        role: 'user',
        parts: toolResults.map(tr => ({
          functionResponse: { name: tr.name, response: tr.result },
        })),
      });
    }

    // Save key insight to memory
    if (finalContent && toolsUsed.length > 0) {
      const snippet = finalContent.slice(0, 120).replace(/\n/g, ' ');
      const lowerMsg = message.toLowerCase();
      const isPreference = /my (top |main |biggest |primary )?priority|i want to|i need to|focus on|most important/.test(lowerMsg);
      const isMetricsFetch = toolsUsed.includes('get_metrics');
      // Single atomic memory update to avoid race conditions
      AgentMemory.update(userId, {
        insight: snippet,
        preference: isPreference ? `User priority: ${message.slice(0, 100)}` : null,
        contractSummary: isMetricsFetch ? finalContent?.slice(0, 200).replace(/\n/g, ' ') : null,
      }).catch(() => {});
    }

    return {
      content: finalContent || 'I was unable to generate a response.',
      components: finalComponents,
      toolsUsed,
      iterations,
    };
  }
}

function tryParseJSON(str) {
  try {
    const match = str.match(/```json\s*([\s\S]*?)```/) || str.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function truncateLabel(label) {
  if (typeof label !== 'string') return label;
  // Truncate Ethereum addresses: 0x1234...abcd
  if (/^0x[0-9a-fA-F]{40,}$/.test(label)) return label.slice(0, 6) + '...' + label.slice(-4);
  // Truncate long strings
  if (label.length > 20) return label.slice(0, 18) + '…';
  return label;
}

function sanitizeComponents(components) {
  if (!Array.isArray(components)) return [];
  return components.map(c => {
    if (c?.type === 'chart' && Array.isArray(c?.data?.data)) {
      return { ...c, data: { ...c.data, data: c.data.data.map(d => ({ ...d, label: truncateLabel(d.label) })) } };
    }
    return c;
  });
}

export default new AgentService();
