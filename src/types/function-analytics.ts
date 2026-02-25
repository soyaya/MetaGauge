/**
 * Core data models for Function Signature Analytics
 * Requirements: 2.1, 3.1, 4.1, 5.1
 */

export interface FunctionSignature {
  signature: string;
  name?: string;
  walletCount: number;
  transactionCount: number;
  avgTransactionsPerWallet: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface WalletInteraction {
  walletAddress: string;
  signature: string;
  timestamp: Date;
  transactionHash: string;
  blockNumber: number;
  gasUsed?: number;
  value?: string;
}

export interface UserJourney {
  walletAddress: string;
  interactions: WalletInteraction[];
  entryPoint: string;
  lastInteraction: Date;
  totalInteractions: number;
  uniqueSignatures: number;
  hasGaps: boolean;
}

export interface CohortMetrics {
  cohortId: string;
  cohortDate: Date;
  cohortPeriod: 'daily' | 'weekly' | 'monthly';
  walletCount: number;
  signature?: string;
  activationRate?: number;
  churnRate?: number;
  retentionRates?: {
    day1?: number;
    day7?: number;
    day30?: number;
    day90?: number;
  };
  metrics?: {
    [period: string]: number;
  };
}

export interface AnalyticsCache {
  key: string;
  data: any;
  timestamp: Date;
  ttl: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FlowNode {
  id: string;
  signature: string;
  name?: string;
  walletCount: number;
  isEntryPoint: boolean;
  isDropOff: boolean;
}

export interface FlowEdge {
  source: string;
  target: string;
  walletCount: number;
  transitionRate: number;
}

export interface FlowVisualization {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ActivationConfig {
  interactions: number;
  days: number;
}

export interface ChurnConfig {
  inactiveDays: number;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
