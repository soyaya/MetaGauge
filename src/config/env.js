/**
 * Centralized environment configuration
 * Load dotenv once at application entry point
 */
import dotenv from 'dotenv';

// Load environment variables once
dotenv.config();

export const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Contract
  contractAddress: process.env.CONTRACT_ADDRESS,
  contractChain: process.env.CONTRACT_CHAIN || 'lisk',
  contractName: process.env.CONTRACT_NAME,
  
  // RPC URLs
  liskRpcUrl1: process.env.LISK_RPC_URL1 || 'https://rpc.api.lisk.com',
  liskRpcUrl2: process.env.LISK_RPC_URL2 || 'https://lisk.drpc.org',
  liskRpcUrl3: process.env.LISK_RPC_URL3,
  liskRpcUrl4: process.env.LISK_RPC_URL4,
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  starknetRpcUrl1: process.env.STARKNET_RPC_URL1 || 'https://rpc.starknet.lava.build',
  starknetRpcUrl2: process.env.STARKNET_RPC_URL2,
  starknetRpcUrl3: process.env.STARKNET_RPC_URL3,
  
  // AI
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
  
  // Database
  databaseType: process.env.DATABASE_TYPE || 'file',
  
  // Analysis
  analyzeChainOnly: process.env.ANALYZE_CHAIN_ONLY === 'true',
  analysisBlockRange: parseInt(process.env.ANALYSIS_BLOCK_RANGE || '1000'),
  
  // Rate Limiting
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
  rateLimitAnalyses: parseInt(process.env.RATE_LIMIT_ANALYSES || '10'),
};

export default config;
