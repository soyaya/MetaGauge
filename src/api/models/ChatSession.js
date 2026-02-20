/**
 * Chat Session model for contract-specific AI conversations
 * File-based storage for chat sessions and messages
 */

import crypto from 'crypto';

export class ChatSession {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    this.contractAddress = data.contractAddress;
    this.contractChain = data.contractChain;
    this.contractName = data.contractName || 'Unknown Contract';
    this.title = data.title || `Chat: ${this.contractName}`;
    this.isActive = data.isActive !== false;
    this.lastMessageAt = data.lastMessageAt || null;
    this.messageCount = data.messageCount || 0;
    this.metadata = data.metadata || {
      analysisIds: [], // Associated analysis results
      lastAnalysisId: null,
      contextData: null // Cached contract data for faster responses
    };
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      contractAddress: this.contractAddress,
      contractChain: this.contractChain,
      contractName: this.contractName,
      title: this.title,
      isActive: this.isActive,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export class ChatMessage {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.sessionId = data.sessionId;
    this.role = data.role; // 'user' | 'assistant' | 'system'
    this.content = data.content; // Text content
    this.components = data.components || []; // Structured components for rendering
    this.metadata = data.metadata || {
      analysisId: null,
      processingTime: null,
      model: null,
      tokens: null
    };
    this.isStreaming = data.isStreaming || false;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      role: this.role,
      content: this.content,
      components: this.components,
      metadata: this.metadata,
      isStreaming: this.isStreaming,
      createdAt: this.createdAt
    };
  }
}

// Component types for structured responses
export const ComponentTypes = {
  TEXT: 'text',
  CHART: 'chart',
  METRIC_CARD: 'metric_card',
  TABLE: 'table',
  ALERT: 'alert',
  INSIGHT_CARD: 'insight_card',
  RECOMMENDATION: 'recommendation',
  TRANSACTION_LIST: 'transaction_list',
  USER_ANALYSIS: 'user_analysis',
  COMPETITIVE_COMPARISON: 'competitive_comparison'
};

// Chart types
export const ChartTypes = {
  LINE: 'line',
  BAR: 'bar',
  PIE: 'pie',
  AREA: 'area',
  SCATTER: 'scatter',
  DONUT: 'donut'
};