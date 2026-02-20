/**
 * Price Service for converting crypto amounts to USD
 */

import fetch from 'node-fetch';

export class PriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get current price for a cryptocurrency in USD
   * @param {string} symbol - Crypto symbol (eth, lsk, etc.)
   * @returns {Promise<number>} Price in USD
   */
  async getPrice(symbol) {
    const cacheKey = symbol.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.price;
    }

    try {
      // Use CoinGecko API (free tier)
      const coinIds = {
        'eth': 'ethereum',
        'ethereum': 'ethereum',
        'lsk': 'lisk',
        'lisk': 'lisk',
        'strk': 'starknet',
        'starknet': 'starknet'
      };

      const coinId = coinIds[symbol.toLowerCase()] || 'ethereum';
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        {
          headers: {
            'Accept': 'application/json',
          },
          timeout: 5000
        }
      );

      if (!response.ok) {
        throw new Error(`Price API error: ${response.status}`);
      }

      const data = await response.json();
      const price = data[coinId]?.usd || 0;

      // Cache the result
      this.cache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      console.warn(`Failed to fetch price for ${symbol}:`, error.message);
      
      // Return fallback prices if API fails
      const fallbackPrices = {
        'eth': 2500,
        'ethereum': 2500,
        'lsk': 1.2,
        'lisk': 1.2,
        'strk': 0.5,
        'starknet': 0.5
      };
      
      return fallbackPrices[symbol.toLowerCase()] || 0;
    }
  }

  /**
   * Convert wei to USD
   * @param {string|number} weiAmount - Amount in wei
   * @param {string} chain - Blockchain (ethereum, lisk, starknet)
   * @returns {Promise<number>} Amount in USD
   */
  async weiToUSD(weiAmount, chain = 'ethereum') {
    if (!weiAmount || weiAmount === '0') return 0;

    try {
      const wei = typeof weiAmount === 'string' ? BigInt(weiAmount) : BigInt(weiAmount.toString());
      
      // Convert wei to native token amount
      const decimals = this.getDecimals(chain);
      const tokenAmount = Number(wei) / Math.pow(10, decimals);
      
      // Get current price
      const priceUSD = await this.getPrice(chain);
      
      return tokenAmount * priceUSD;
    } catch (error) {
      console.warn(`Failed to convert wei to USD:`, error.message);
      return 0;
    }
  }

  /**
   * Convert ETH amount to USD
   * @param {string|number} ethAmount - Amount in ETH
   * @param {string} chain - Blockchain
   * @returns {Promise<number>} Amount in USD
   */
  async ethToUSD(ethAmount, chain = 'ethereum') {
    if (!ethAmount || ethAmount === 0) return 0;

    try {
      const amount = typeof ethAmount === 'string' ? parseFloat(ethAmount) : ethAmount;
      const priceUSD = await this.getPrice(chain);
      
      return amount * priceUSD;
    } catch (error) {
      console.warn(`Failed to convert ETH to USD:`, error.message);
      return 0;
    }
  }

  /**
   * Get decimals for a chain's native token
   * @param {string} chain 
   * @returns {number}
   */
  getDecimals(chain) {
    const decimals = {
      'ethereum': 18,
      'lisk': 18,
      'starknet': 18
    };
    
    return decimals[chain.toLowerCase()] || 18;
  }

  /**
   * Format USD amount for display
   * @param {number} usdAmount 
   * @returns {string}
   */
  formatUSD(usdAmount) {
    if (usdAmount === 0) return '$0.00';
    
    if (usdAmount < 0.01) {
      return `$${usdAmount.toFixed(6)}`;
    } else if (usdAmount < 1) {
      return `$${usdAmount.toFixed(4)}`;
    } else if (usdAmount < 1000) {
      return `$${usdAmount.toFixed(2)}`;
    } else if (usdAmount < 1000000) {
      return `$${(usdAmount / 1000).toFixed(1)}K`;
    } else {
      return `$${(usdAmount / 1000000).toFixed(1)}M`;
    }
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const priceService = new PriceService();
export default priceService;