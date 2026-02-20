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
      lisk: [
        { name: 'drpc', url: process.env.LISK_RPC_URL1 || 'https://lisk.drpc.org' },
        { name: 'tenderly', url: process.env.LISK_RPC_URL2 || 'https://lisk.gateway.tenderly.co/2o3VKjmisQNOJIPlLrt6Ye' }
      ],
      ethereum: [
        { name: 'publicnode', url: 'https://ethereum-rpc.publicnode.com' }
      ],
      starknet: [
        { name: 'lava', url: 'https://rpc.starknet.lava.build' }
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
