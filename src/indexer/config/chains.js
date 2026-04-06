/**
 * Chain configuration — Ethereum and Starknet only
 */

export const CHAIN_CONFIGS = {
  ethereum: {
    chainId: 'ethereum',
    name: 'Ethereum',
    rpcEndpoints: [
      process.env.ETHEREUM_RPC_URL1 || 'https://ethereum-rpc.publicnode.com',
      process.env.ETHEREUM_RPC_URL2 || 'https://eth.llamarpc.com',
      process.env.ETHEREUM_RPC_URL3 || 'https://rpc.ankr.com/eth'
    ],
    blockTime: 12,
    explorerApi: 'https://api.etherscan.io/api',
    startBlock: 0
  },
  starknet: {
    chainId: 'starknet',
    name: 'Starknet',
    rpcEndpoints: [
      process.env.STARKNET_RPC_URL1 || 'https://starknet-rpc.publicnode.com',
      process.env.STARKNET_RPC_URL2 || 'https://rpc.starknet.lava.build',
      process.env.STARKNET_RPC_URL3 || 'https://free-rpc.nethermind.io/mainnet-juno'
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
