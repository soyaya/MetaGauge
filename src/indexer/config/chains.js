/**
 * Chain configuration for multi-chain support
 */

export const CHAIN_CONFIGS = {
  lisk: {
    chainId: 'lisk',
    name: 'Lisk',
    rpcEndpoints: [
      process.env.LISK_RPC_URL1 || 'https://lisk.drpc.org',
      process.env.LISK_RPC_URL2 || 'https://lisk.gateway.tenderly.co'
    ],
    blockTime: 12, // seconds
    explorerApi: 'https://blockscout.lisk.com/api',
    startBlock: 0
  },
  ethereum: {
    chainId: 'ethereum',
    name: 'Ethereum',
    rpcEndpoints: [
      process.env.ETHEREUM_RPC_URL1 || 'https://eth.public-rpc.com',
      process.env.ETHEREUM_RPC_URL2 || 'https://ethereum.publicnode.com'
    ],
    blockTime: 12,
    explorerApi: 'https://api.etherscan.io/api',
    startBlock: 0
  },
  starknet: {
    chainId: 'starknet',
    name: 'Starknet',
    rpcEndpoints: [
      process.env.STARKNET_RPC_URL1 || 'https://starknet-mainnet.public.blastapi.io',
      process.env.STARKNET_RPC_URL2 || 'https://starknet.publicnode.com'
    ],
    blockTime: 30,
    explorerApi: 'https://api.starkscan.co',
    startBlock: 0
  }
};

/**
 * Get chain configuration
 * @param {string} chainId 
 * @returns {Object}
 */
export function getChainConfig(chainId) {
  const config = CHAIN_CONFIGS[chainId.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return config;
}

/**
 * Calculate blocks for time period
 * @param {string} chainId 
 * @param {number} days 
 * @returns {number}
 */
export function calculateBlocksForDays(chainId, days) {
  const config = getChainConfig(chainId);
  const secondsPerDay = 86400;
  return Math.floor((days * secondsPerDay) / config.blockTime);
}
