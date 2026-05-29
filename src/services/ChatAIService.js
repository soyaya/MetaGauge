/**
 * Chat AI Service for Contract Analysis Conversations
 * Extends GeminiAI service with chat-specific functionality and component generation
 */

import { GoogleGenAI } from '@google/genai';
import { ComponentTypes, ChartTypes } from '../api/models/ChatSession.js';
import { AnalysisStorage } from '../api/database/fileStorage.js';
import MetricsContextService from './MetricsContextService.js';

function getApiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

// Rate limiting store (in production, use Redis or similar)
const chatRateLimitStore = new Map();

class ChatAIService {
  constructor() {
    this.keys = [];
    this.currentKeyIndex = 0;
    this.clients = {};
    this.enabled = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    this.keys = getApiKeys();
    if (this.keys.length === 0) {
      console.warn('No GEMINI_API_KEY configured - Chat AI features will be disabled');
      this.enabled = false;
      this.initialized = true;
      return;
    }
    this.enabled = true;
    this.initialized = true;
  }

  _getClient(idx) {
    const key = this.keys[idx % this.keys.length];
    if (!this.clients[key]) this.clients[key] = new GoogleGenAI({ apiKey: key });
    return this.clients[key];
  }

  async _generateWithFallback(params) {
    this.initialize();
    let lastErr;
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const idx = (this.currentKeyIndex + attempt) % this.keys.length;
      try {
        const result = await this._getClient(idx).models.generateContent(params);
        this.currentKeyIndex = idx;
        return result;
      } catch (err) {
        lastErr = err;
        const msg = err?.message || '';
        if (msg.includes('403') || msg.includes('429') || msg.includes('PERMISSION_DENIED') ||
            msg.includes('API_KEY') || msg.includes('blocked') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('SERVICE_DISABLED') || msg.includes('has not been used') || msg.includes('is disabled')) {
          console.warn(`[ChatAIService] Key ${idx + 1}/${this.keys.length} failed, trying next...`);
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  /**
   * Check rate limit for chat requests
   */
  checkChatRateLimit(userId = 'anonymous') {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100; // 100 chat messages per 15 minutes per user

    const record = chatRateLimitStore.get(userId);
    
    if (!record || now > record.resetTime) {
      chatRateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
      // Evict expired entries
      for (const [k, v] of chatRateLimitStore) {
        if (now > v.resetTime) chatRateLimitStore.delete(k);
      }
      return true;
    }
    
    if (record.count >= maxRequests) {
      return false;
    }
    
    record.count++;
    return true;
  }

  /**
   * Generate AI chat response with components
   */
  async generateChatResponse(userMessage, sessionContext, userId = 'anonymous') {
    this.initialize();
    
    if (!this.enabled) {
      return this.getFallbackChatResponse(userMessage);
    }

    if (!this.checkChatRateLimit(userId)) {
      throw new Error('Chat rate limit exceeded. Please try again later.');
    }

    try {
      const prompt = this.buildChatPrompt(userMessage, sessionContext);
      
      const response = await this._generateWithFallback({
        model: 'gemini-2.5-flash-lite',
        contents: [{ text: prompt }],
        generationConfig: {
          temperature: 0.4, // Slightly higher for more conversational responses
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      });
      
      let jsonResponse = response.text || '';
      
      // Clean up response - remove markdown formatting if present
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to parse the JSON
      let chatResponse;
      try {
        chatResponse = JSON.parse(jsonResponse);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          chatResponse = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback to text response
          return {
            content: jsonResponse,
            components: [{
              type: ComponentTypes.TEXT,
              data: { text: jsonResponse }
            }],
            metadata: {
              model: 'gemini-2.5-flash-lite',
              processingTime: Date.now(),
              fallback: true
            }
          };
        }
      }
      
      return {
        content: chatResponse.content || chatResponse.text || '',
        components: chatResponse.components || [],
        metadata: {
          model: 'gemini-2.5-flash-lite',
          processingTime: Date.now(),
          tokens: response.usage?.totalTokens || null
        }
      };

    } catch (error) {
      console.error('Chat AI response error:', error);
      return this.getFallbackChatResponse(userMessage, error.message);
    }
  }

  /**
   * Build comprehensive prompt for chat conversation
   */
  buildChatPrompt(userMessage, sessionContext) {
    const { contractData, analysisData, chatHistory, contractAddress, contractChain } = sessionContext;

    // Get metrics context for AI
    const metrics = analysisData?.results?.target?.metrics || {};
    const metricsContext = MetricsContextService.getContextForAI(metrics);

    return `
You are an expert blockchain analyst AI assistant specializing in smart contract analysis and onchain data interpretation. You're having a conversation about the contract ${contractAddress} on ${contractChain}.

CONTEXT:
Contract Address: ${contractAddress}
Chain: ${contractChain}
Contract Name: ${contractData?.name || 'Unknown'}

AVAILABLE DATA:
${JSON.stringify({
  contractData: contractData || {},
  latestAnalysis: analysisData?.results?.target?.fullReport || {},
  metrics: analysisData?.results?.target?.metrics || {},
  transactions: analysisData?.results?.target?.transactions || 0,
  competitors: analysisData?.results?.competitors?.length || 0
}, null, 2)}
${metricsContext}

IMPORTANT INSTRUCTIONS FOR METRICS:
- When discussing any metric, ALWAYS explain what it means using the definitions provided above
- Reference the "Good" and "Bad" ranges to provide context
- Relate the metric values to the user's specific data
- Provide actionable insights based on the interpretation guidelines
- If a metric is not in the glossary, explain it in simple terms

RECENT CONVERSATION:
${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

USER MESSAGE: "${userMessage}"

Respond as a knowledgeable blockchain analyst. When users ask for charts, graphs, or visual data, ALWAYS provide appropriate chart components with real or realistic sample data. Focus on creating interactive visualizations that help users understand contract performance.

IMPORTANT: Return your response in the following JSON format (return ONLY valid JSON):

{
  "content": "Your conversational response text here",
  "components": [
    {
      "type": "text|chart|metric_card|table|alert|insight_card|recommendation|transaction_list|user_analysis|competitive_comparison",
      "data": {
        // Component-specific data structure
      }
    }
  ]
}

COMPONENT TYPES AND DATA STRUCTURES:

1. TEXT: { "text": "Your text content" }

2. METRIC_CARD: {
  "title": "Metric Name",
  "value": "123.45",
  "unit": "ETH|USD|%|count",
  "change": "+5.2%",
  "trend": "up|down|neutral",
  "description": "Brief explanation"
}

3. CHART: {
  "title": "Chart Title",
  "type": "line|bar|pie|area|donut",
  "data": [
    { "label": "Jan", "value": 100 },
    { "label": "Feb", "value": 150 }
  ],
  "xAxis": "Time",
  "yAxis": "Value",
  "description": "Chart description"
}

4. TABLE: {
  "title": "Table Title",
  "headers": ["Column 1", "Column 2", "Column 3"],
  "rows": [
    ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
    ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
  ]
}

5. ALERT: {
  "severity": "info|warning|error|success",
  "title": "Alert Title",
  "message": "Alert message",
  "actionable": true|false
}

6. INSIGHT_CARD: {
  "title": "Insight Title",
  "insight": "Key insight text",
  "confidence": 85,
  "category": "performance|security|growth|risk"
}

7. RECOMMENDATION: {
  "title": "Recommendation Title",
  "description": "Detailed recommendation",
  "priority": "high|medium|low",
  "impact": "Expected impact",
  "effort": "low|medium|high"
}

CHART GENERATION GUIDELINES:
- When users ask for "charts", "graphs", or "visual data", ALWAYS include chart components
- Use realistic sample data if actual data is not available
- For transaction volume: use line or area charts with time series data
- For user analysis: use bar charts or pie charts showing user segments
- For performance metrics: use multiple metric cards with trend indicators
- For competitive analysis: use bar charts comparing metrics
- For security analysis: use alert components and metric cards
- Always include descriptive titles and explanations for charts

SAMPLE CHART DATA PATTERNS:
- Transaction Volume: [{"label": "Week 1", "value": 1250}, {"label": "Week 2", "value": 1890}, ...]
- User Growth: [{"label": "New Users", "value": 45}, {"label": "Returning", "value": 78}, ...]
- Performance Metrics: Multiple metric_card components with different KPIs
- Gas Usage: Line chart showing gas consumption over time
- Token Distribution: Pie chart showing holder distribution

GUIDELINES:
- Be conversational and helpful
- ALWAYS provide visual components when users ask for charts or data visualization
- Use actual data from the contract analysis when available
- If data is limited, create realistic sample data that demonstrates the concept
- Provide actionable insights and recommendations
- Use appropriate components to visualize data
- Keep responses focused and relevant to the user's question
- If asked about specific metrics, create metric cards or charts
- For transaction analysis, use tables or charts
- For alerts or warnings, use alert components
- Always include at least one component in your response
- When users ask for "charts" or "graphs", prioritize chart components over text
`;
  }

  /**
   * Get contract context data for chat
   */
  async getContractContext(userId, contractAddress, contractChain) {
    try {
      // Get the most recent analysis for this contract
      const analyses = await AnalysisStorage.findByUserId(userId);
      let contractAnalyses = analyses.filter(analysis => {
        if (analysis.status !== 'completed') return false;
        
        // Handle both data structures: string contract address or object with address
        const targetContract = analysis.results?.target?.contract;
        if (!targetContract) return false;
        
        const contractAddr = typeof targetContract === 'string' 
          ? targetContract 
          : targetContract.address;
        const contractChainName = analysis.results?.target?.chain || targetContract.chain;
        
        return contractAddr?.toLowerCase() === contractAddress?.toLowerCase() &&
               (!contractChainName || !contractChain || contractChainName === contractChain);
      });

      // If no analyses found for this user, return empty context — don't search other users
      if (contractAnalyses.length === 0) {
        return {
          contractData: { address: contractAddress, chain: contractChain, name: 'Unknown Contract' },
          analysisData: null,
          hasRecentAnalysis: false,
          lastAnalyzed: null
        };
      }

      const latestAnalysis = contractAnalyses.sort((a, b) => 
        new Date(b.completedAt) - new Date(a.completedAt)
      )[0];

      if (latestAnalysis) {
        // Extract contract data from the analysis
        const targetContract = latestAnalysis.results.target.contract;
        const contractData = typeof targetContract === 'string' 
          ? {
              address: targetContract,
              chain: latestAnalysis.results.target.chain,
              name: latestAnalysis.results.target.fullReport?.metadata?.contractName || 'Unknown Contract'
            }
          : targetContract;

        return {
          contractData,
          analysisData: latestAnalysis,
          hasRecentAnalysis: true,
          lastAnalyzed: latestAnalysis.completedAt
        };
      }

      return {
        contractData: {
          address: contractAddress,
          chain: contractChain,
          name: 'Unknown Contract'
        },
        analysisData: null,
        hasRecentAnalysis: false,
        lastAnalyzed: null
      };
    } catch (error) {
      console.error('Error getting contract context:', error);
      return {
        contractData: {
          address: contractAddress,
          chain: contractChain,
          name: 'Unknown Contract'
        },
        analysisData: null,
        hasRecentAnalysis: false,
        lastAnalyzed: null
      };
    }
  }

  /**
   * Generate suggested questions based on contract data
   */
  async generateSuggestedQuestions(contractContext) {
    const { contractData, analysisData } = contractContext;
    const txs = analysisData?.results?.target?.transactions || [];
    const hasData = txs.length > 0;

    // Base questions always available
    const base = [
      "Who are my highest value customers by LTV?",
      "Which wallets are at risk of churning?",
      "What patterns do you see in my user behavior?",
      "Give me a growth strategy based on my data",
      "What is my revenue forecast for the next 30 days?",
      "Show me my feature adoption funnel",
      "When are my peak usage hours?",
      "Who are my smart money wallets?",
      "What viral patterns do you see?",
      "How do I compare to my competitors?",
    ];

    if (!hasData) {
      return [
        "Analyze this contract for me",
        "What data do you have on this contract?",
        "How do I get more users?",
        ...base.slice(0, 5),
      ];
    }

    // Data-driven questions based on what's actually in the analysis
    const dynamic = [];
    const uniqueUsers = new Set(txs.map(t => t.from)).size;
    const failedTxs = txs.filter(t => !t.status).length;
    const failRate = txs.length ? Math.round(failedTxs / txs.length * 100) : 0;

    if (uniqueUsers > 0)  dynamic.push(`I have ${uniqueUsers} wallets — who are the top 10% by value?`);
    if (failRate > 5)     dynamic.push(`My failure rate is ${failRate}% — what's causing it?`);
    if (uniqueUsers > 10) dynamic.push("Which of my users are about to churn?");
    if (txs.length > 50)  dynamic.push("Show me a chart of my transaction volume over time");
    if (uniqueUsers > 20) dynamic.push("What does my user retention cohort look like?");

    return [...dynamic, ...base].slice(0, 10);
  }

  /**
   * Fallback response when AI is disabled or rate limited
   */
  getFallbackChatResponse(userMessage, error = null) {
    // Check if it's a quota/rate limit error
    const isQuotaError = error && (
      error.includes('quota') || 
      error.includes('rate limit') || 
      error.includes('RESOURCE_EXHAUSTED') ||
      error.includes('429')
    );

    if (isQuotaError) {
      return {
        content: "I've temporarily reached my AI processing limits. Here's what I can tell you about smart contract analysis while we wait for the limits to reset:",
        components: [
          {
            type: ComponentTypes.ALERT,
            data: {
              severity: 'info',
              title: 'AI Temporarily Unavailable',
              message: 'The AI service has reached its quota limits. Please try again in a few minutes.',
              actionable: false
            }
          },
          {
            type: ComponentTypes.INSIGHT_CARD,
            data: {
              title: 'Contract Analysis Basics',
              insight: 'Smart contract analysis typically covers transaction volume, user behavior, security patterns, and competitive positioning. You can explore these areas through the main analyzer tool.',
              confidence: 100,
              category: 'performance'
            }
          },
          {
            type: ComponentTypes.RECOMMENDATION,
            data: {
              title: 'Alternative Analysis Options',
              description: 'While waiting for AI chat to be available, you can run a full contract analysis from the Analyzer page to get detailed metrics, charts, and insights.',
              priority: 'medium',
              impact: 'Get comprehensive contract insights',
              effort: 'low'
            }
          }
        ],
        metadata: {
          fallback: true,
          reason: 'quota_exceeded',
          processingTime: Date.now()
        }
      };
    }

    // General fallback for other errors or disabled AI
    return {
      content: error 
        ? `I encountered an error processing your message: ${error}. Please try again or rephrase your question.`
        : "I'm currently unable to provide AI-powered responses. Please configure the GEMINI_API_KEY to enable intelligent chat features.",
      components: [{
        type: ComponentTypes.ALERT,
        data: {
          severity: error ? 'error' : 'warning',
          title: error ? 'Processing Error' : 'AI Chat Disabled',
          message: error 
            ? 'There was an issue processing your request. Please try again.'
            : 'Configure GEMINI_API_KEY environment variable to enable intelligent responses',
          actionable: true
        }
      }],
      metadata: {
        fallback: true,
        reason: error ? 'processing_error' : 'disabled',
        processingTime: Date.now()
      }
    };
  }

  /**
   * Check if AI service is enabled
   */
  isEnabled() {
    this.initialize();
    return this.enabled;
  }
}

export default new ChatAIService();