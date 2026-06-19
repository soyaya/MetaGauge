/**
 * Smart RPC Manager - Only initializes RPCs for the target chain
 */

export class SmartRpcManager {
  constructor(targetChain) {
    this.targetChain = targetChain.toLowerCase();
    this.providers = {};
    
    console.log(`🎯 Smart RPC Manager: Initializing only ${this.targetChain} providers`);
  }

  /**
   * Get RPC URLs for the target chain only
   */
  getRpcUrls() {
    const rpcConfig = {
      ethereum: [
        { name: 'publicnode', url: process.env.ETHEREUM_RPC_URL1 || 'https://ethereum-rpc.publicnode.com' },
        { name: 'llamarpc', url: process.env.ETHEREUM_RPC_URL2 || 'https://eth.llamarpc.com' },
        ...(process.env.ETHEREUM_RPC_URL4 ? [{ name: 'alchemy', url: process.env.ETHEREUM_RPC_URL4 }] : []),
      ],
      starknet: [
        { name: 'publicnode', url: process.env.STARKNET_RPC_URL1 || 'https://starknet-rpc.publicnode.com' },
        { name: 'lava', url: process.env.STARKNET_RPC_URL2 || 'https://rpc.starknet.lava.build' }
      ]
    };

    return rpcConfig[this.targetChain] || [];
  }

  /**
   * Initialize only the target chain providers
   */
  async initialize() {
    const urls = this.getRpcUrls();
    
    if (urls.length === 0) {
      throw new Error(`No RPC URLs configured for chain: ${this.targetChain}`);
    }

    console.log(`✅ Initialized ${urls.length} RPC providers for ${this.targetChain}`);
    urls.forEach(rpc => console.log(`   - ${rpc.name}: ${rpc.url}`));
    
    this.providers = urls;
    return this.providers;
  }

  /**
   * Get a working RPC URL
   */
  async getWorkingRpc() {
    for (const provider of this.providers) {
      try {
        // Quick test
        const response = await fetch(provider.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          }),
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          console.log(`✅ Using ${provider.name} for ${this.targetChain}`);
          return provider.url;
        }
      } catch (error) {
        console.log(`⚠️  ${provider.name} failed, trying next...`);
      }
    }
    
    throw new Error(`All RPC providers failed for ${this.targetChain}`);
  }
}
