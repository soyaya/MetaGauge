/**
 * Chat AI Service for Contract Analysis Conversations
 * Extends GeminiAI service with chat-specific functionality and component generation
 */

import { GoogleGenAI } from '@google/genai';
import { ComponentTypes, ChartTypes } from '../api/models/ChatSession.js';
import { AnalysisStorage } from '../api/database/fileStorage.js';

// Rate limiting store (in production, use Redis or similar)
const chatRateLimitStore = new Map();

class ChatAIService {
  constructor() {
    this.genAI = null;
    this.enabled = null;
    this.initialized = false;
  }

  /**
   * Initialize the service lazily
   */
  initialize() {
    if (this.initialized) return;

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured - Chat AI features will be disabled');
      this.enabled = false;
      this.initialized = true;
      return;
    }

    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.enabled = true;
    this.initialized = true;
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
      
      const response = await this.genAI.models.generateContent({
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
        
        return contractAddr?.toLowerCase() === contractAddress.toLowerCase() &&
               contractChainName === contractChain;
      });

      // If no analyses found for this user, try to find any analysis for this contract
      if (contractAnalyses.length === 0) {
        console.log(`No analyses found for user ${userId}, searching all analyses for contract ${contractAddress}`);
        const allAnalyses = await AnalysisStorage.findAll();
        contractAnalyses = allAnalyses.filter(analysis => {
          if (analysis.status !== 'completed') return false;
          
          const targetContract = analysis.results?.target?.contract;
          if (!targetContract) return false;
          
          const contractAddr = typeof targetContract === 'string' 
            ? targetContract 
            : targetContract.address;
          const contractChainName = analysis.results?.target?.chain || targetContract.chain;
          
          return contractAddr?.toLowerCase() === contractAddress.toLowerCase() &&
                 contractChainName === contractChain;
        });
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
    
    // Business metrics focused questions
    const businessMetricQuestions = [
      "What's the total value locked (TVL) in this contract?",
      "Show me the revenue and fee generation trends",
      "What's the daily active user (DAU) count and growth rate?",
      "How much transaction volume does this contract process monthly?",
      "What's the average transaction size and frequency?",
      "Show me the user acquisition and retention metrics",
      "What's the contract's market share compared to competitors?",
      "How efficient is the gas usage and what are the cost implications?",
      "What's the user lifetime value (LTV) and engagement patterns?",
      "Show me the seasonal trends and usage patterns"
    ];

    const performanceQuestions = [
      "What's the overall performance of this contract?",
      "Show me the transaction volume trends with charts",
      "How does this contract compare to competitors?",
      "What are the key performance indicators (KPIs)?",
      "Show me the growth metrics and projections"
    ];

    const analyticsQuestions = [
      "Who are the top users and whale addresses?",
      "What's the user distribution and segmentation?",
      "Show me transaction patterns and behavior analysis",
      "What are the peak usage times and patterns?",
      "Analyze the contract's network effects"
    ];

    const securityQuestions = [
      "Are there any security concerns I should know about?",
      "What's the risk assessment for this contract?",
      "Show me unusual transaction patterns or anomalies"
    ];

    if (!analysisData) {
      return [
        "Can you analyze this contract for me?",
        "What business metrics are available for this contract?",
        "Show me the key performance indicators with charts",
        ...businessMetricQuestions.slice(0, 4),
        ...performanceQuestions.slice(0, 3)
      ];
    }

    // Generate context-specific questions based on available data
    const contextQuestions = [];
    
    if (analysisData.results?.target?.transactions > 0) {
      contextQuestions.push(...businessMetricQuestions.slice(0, 3));
      contextQuestions.push("Show me transaction patterns and volume trends");
      contextQuestions.push("What's the transaction success rate and efficiency?");
    }

    if (analysisData.results?.target?.behavior?.userCount > 0) {
      contextQuestions.push("Analyze user acquisition and retention rates");
      contextQuestions.push("What's the user engagement and activity metrics?");
      contextQuestions.push("Show me user segmentation and behavior patterns");
    }

    if (analysisData.results?.competitors?.length > 0) {
      contextQuestions.push("Compare business metrics with competitors");
      contextQuestions.push("What's our competitive advantage and market position?");
      contextQuestions.push("Show me market share and growth comparison");
    }

    // Combine all questions and return up to 10
    const allQuestions = [
      ...contextQuestions,
      ...businessMetricQuestions,
      ...performanceQuestions,
      ...analyticsQuestions,
      ...securityQuestions
    ];

    // Remove duplicates and return up to 10 questions
    const uniqueQuestions = [...new Set(allQuestions)];
    return uniqueQuestions.slice(0, 10);
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