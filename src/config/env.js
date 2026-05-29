/**
 * Centralized environment configuration
 * Load dotenv once at application entry point
 */
import dotenv from 'dotenv';

// Load environment variables once
dotenv.config();

// ── Public fallback RPC endpoints (no key required) ───────────────────────
const ETH_PUBLIC_FALLBACKS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://eth.llamarpc.com',
];

const STARKNET_PUBLIC_FALLBACKS = [
  'https://starknet-rpc.publicnode.com',
  'https://rpc.starknet.lava.build',
  'https://free-rpc.nethermind.io/mainnet-juno',
];

/**
 * Returns a deduplicated list of Ethereum RPC URLs.
 * Env-configured URLs come first; public fallbacks fill the rest.
 */
export function getEthereumRpcUrls() {
  const configured = [
    process.env.ETHEREUM_RPC_URL1,
    process.env.ETHEREUM_RPC_URL2,
    process.env.ETHEREUM_RPC_URL3,
    process.env.ETHEREUM_RPC_URL,
    process.env.ETHEREUM_RPC_URL_FALLBACK,
  ].filter(Boolean);

  const all = [...configured, ...ETH_PUBLIC_FALLBACKS];
  return [...new Map(all.map(u => [u, u])).values()];
}

/**
 * Returns a deduplicated list of Starknet RPC URLs.
 */
export function getStarknetRpcUrls() {
  const configured = [
    process.env.STARKNET_RPC_URL1,
    process.env.STARKNET_RPC_URL2,
    process.env.STARKNET_RPC_URL3,
  ].filter(Boolean);

  const all = [...configured, ...STARKNET_PUBLIC_FALLBACKS];
  return [...new Map(all.map(u => [u, u])).values()];
}

/**
 * Returns RPC URLs for a given chain name.
 */
export function getRpcUrls(chain = 'ethereum') {
  return chain.toLowerCase() === 'starknet'
    ? getStarknetRpcUrls()
    : getEthereumRpcUrls();
}

export const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Contract
  contractAddress: process.env.CONTRACT_ADDRESS,
  contractChain:   process.env.CONTRACT_CHAIN || 'ethereum',
  contractName:    process.env.CONTRACT_NAME,

  // RPC (use getEthereumRpcUrls() / getRpcUrls() for full fallback list)
  ethereumRpcUrl:    process.env.ETHEREUM_RPC_URL || ETH_PUBLIC_FALLBACKS[0],
  ethereumRpcApiKey: process.env.ETHEREUM_RPC_API_KEY || null,
  starknetRpcUrl1:   process.env.STARKNET_RPC_URL1 || STARKNET_PUBLIC_FALLBACKS[0],

  // AI
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel:  process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',

  // Database
  databaseType: process.env.DATABASE_TYPE || 'file',

  // Analysis
  analyzeChainOnly:   process.env.ANALYZE_CHAIN_ONLY === 'true',
  analysisBlockRange: parseInt(process.env.ANALYSIS_BLOCK_RANGE || '1000'),

  // Rate Limiting
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
  rateLimitAnalyses: parseInt(process.env.RATE_LIMIT_ANALYSES || '10'),
};

export default config;
