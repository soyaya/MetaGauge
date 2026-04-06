/**
 * MetaGauge JavaScript SDK
 */
import fetch from 'node-fetch';

class MetaGaugeError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'MetaGaugeError';
    this.code = code;
  }
}

export class MetaGaugeSDK {
  constructor(apiKey, baseUrl = 'https://api.metagauge.io') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new MetaGaugeError(`API request failed: ${response.statusText}`, response.status);
    }

    return response.json();
  }

  validateContractAddress(address, chain) {
    if (!address || typeof address !== 'string') {
      throw new MetaGaugeError('Invalid contract address: must be a non-empty string', 400);
    }
    
    const patterns = {
      ethereum: /^0x[a-fA-F0-9]{40}$/,
      lisk: /^0x[a-fA-F0-9]{40}$/,
      starknet: /^0x[a-fA-F0-9]{63,64}$/
    };

    if (!patterns[chain]?.test(address)) {
      throw new MetaGaugeError(`Invalid contract address format for ${chain}`, 400);
    }
  }

  async getMetrics(contractAddress, chain) {
    this.validateContractAddress(contractAddress, chain);
    
    try {
      return await this.request(`/analysis/${contractAddress}/metrics?chain=${chain}`);
    } catch (error) {
      if (error.code === 404) {
        throw new MetaGaugeError('Contract not found or not analyzed yet', 404);
      }
      throw error;
    }
  }

  async getWalletSegments(contractAddress, chain) {
    this.validateContractAddress(contractAddress, chain);
    
    try {
      return await this.request(`/analysis/${contractAddress}/wallet-segments?chain=${chain}`);
    } catch (error) {
      if (error.code === 404) {
        throw new MetaGaugeError('Wallet segments not available for this contract', 404);
      }
      throw error;
    }
  }

  async getCohortRetention(contractAddress, chain) {
    this.validateContractAddress(contractAddress, chain);
    
    try {
      return await this.request(`/analysis/${contractAddress}/cohort-retention?chain=${chain}`);
    } catch (error) {
      if (error.code === 404) {
        throw new MetaGaugeError('Cohort retention data not available for this contract', 404);
      }
      throw error;
    }
  }

  async getAlerts() {
    try {
      return await this.request('/alerts');
    } catch (error) {
      if (error.code === 403) {
        throw new MetaGaugeError('Insufficient permissions to access alerts', 403);
      }
      throw error;
    }
  }
}

export default MetaGaugeSDK;
