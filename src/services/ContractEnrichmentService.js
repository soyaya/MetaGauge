/**
 * ContractEnrichmentService
 * Fetches on-chain state via eth_call for metrics that can't be derived from tx history alone.
 * Uses the gateway RPC — sequential calls (no batch support).
 */

// Common function selectors
const SEL = {
  totalSupply:      '0x18160ddd',
  decimals:         '0x313ce567',
  balanceOf:        '0x70a08231', // + padded address
  basisPointsRate:  '0xdd644f72', // USDT fee rate
  getReserves:      '0x0902f1ac', // Uniswap V2 pair
  token0:           '0x0dfe1681',
  token1:           '0xd21220a7',
};

function pad32(hex) {
  return hex.replace('0x', '').padStart(64, '0');
}

function decodeUint(hex) {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

export class ContractEnrichmentService {
  constructor(rpcClient) {
    this.rpc = rpcClient;
  }

  async call(to, data) {
    try {
      const result = await this.rpc._makeRpcCall('eth_call', [{ to, data }, 'latest']);
      return result || '0x';
    } catch {
      return '0x';
    }
  }

  async getDecimals(address) {
    const r = await this.call(address, SEL.decimals);
    return r === '0x' ? 18 : Number(decodeUint(r));
  }

  async getTotalSupply(address, decimals) {
    const r = await this.call(address, SEL.totalSupply);
    if (r === '0x') return null;
    const raw = decodeUint(r);
    return Number(raw) / Math.pow(10, decimals);
  }

  async getBalanceOf(tokenAddress, holderAddress, decimals) {
    const data = SEL.balanceOf + pad32(holderAddress);
    const r = await this.call(tokenAddress, data);
    if (r === '0x') return null;
    return Number(decodeUint(r)) / Math.pow(10, decimals);
  }

  async getBasisPointsRate(address) {
    const r = await this.call(address, SEL.basisPointsRate);
    return r === '0x' ? null : Number(decodeUint(r));
  }

  /**
   * Fetch recent Transfer events and compute protocol revenue from fee rate.
   * Also extracts blockTimestamps for retention metrics.
   */
  async getRecentTransferVolume(contractAddress, decimals, feeRateBps = 0, blockRange = 500) {
    try {
      const latestHex = await this.rpc._makeRpcCall('eth_blockNumber', []);
      const latest = parseInt(latestHex, 16);
      const from = latest - blockRange;

      // Transfer(address,address,uint256) topic
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const logs = await this.rpc._makeRpcCall('eth_getLogs', [{
        fromBlock: '0x' + from.toString(16),
        toBlock:   '0x' + latest.toString(16),
        address:   contractAddress,
        topics:    [TRANSFER_TOPIC],
      }]);

      if (!Array.isArray(logs) || logs.length === 0) return {};

      const divisor = Math.pow(10, decimals);
      let totalVolume = 0;
      const timestamps = [];

      for (const log of logs) {
        if (log.data && log.data !== '0x') {
          totalVolume += Number(BigInt(log.data)) / divisor;
        }
        if (log.blockTimestamp) {
          timestamps.push(parseInt(log.blockTimestamp, 16));
        }
      }

      const protocolRevenue = feeRateBps > 0
        ? Number((totalVolume * feeRateBps / 10000).toFixed(2))
        : null;

      return {
        recentTransferVolume: Number(totalVolume.toFixed(2)),
        recentTransferCount:  logs.length,
        protocolRevenue,
        recentBlockRange:     blockRange,
        // Pass timestamps back for retention enrichment
        _transferTimestamps:  timestamps,
      };
    } catch (e) {
      console.warn('[ContractEnrichment] transfer volume failed:', e.message);
      return {};
    }
  }

  /**
   * Enrich a contract with all available on-chain state.
   */
  async enrich(contractAddress, ethPriceUSD = 2500) {
    const result = {};
    try {
      const decimals = await this.getDecimals(contractAddress);
      result.decimals = decimals;

      const totalSupply = await this.getTotalSupply(contractAddress, decimals);
      if (totalSupply !== null) {
        result.totalSupply = Number(totalSupply.toFixed(2));
        result.tvl = decimals <= 6
          ? Number(totalSupply.toFixed(2))
          : Number((totalSupply * ethPriceUSD).toFixed(2));
        result.tvlLabel = decimals <= 6 ? 'USD' : 'ETH';
      }

      const bps = await this.getBasisPointsRate(contractAddress);
      if (bps !== null) result.feeRateBps = bps;

      // Fetch recent transfer volume + protocol revenue
      const volumeData = await this.getRecentTransferVolume(contractAddress, decimals, bps || 0);
      Object.assign(result, volumeData);

    } catch (e) {
      console.warn('[ContractEnrichment] error:', e.message);
    }
    return result;
  }
}
