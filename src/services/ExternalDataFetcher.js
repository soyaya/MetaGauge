/**
 * ExternalDataFetcher
 * Fetches external market/chain data to enrich AI context.
 * Results cached in data/ai-knowledge/market-context.json (6h TTL).
 */

import fs from 'fs/promises';
import path from 'path';

const CACHE_FILE = path.resolve('./data/ai-knowledge/market-context.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function readCache() {
  try { return JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')); } catch { return {}; }
}
async function writeCache(data) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
}

export class ExternalDataFetcher {
  /**
   * Refresh market context if stale, return current cache.
   */
  static async getMarketContext(chain = 'ethereum', contractAddress = null) {
    const cache = await readCache();
    const stale = !cache.lastUpdated || Date.now() - new Date(cache.lastUpdated).getTime() > CACHE_TTL_MS;

    if (stale) {
      await ExternalDataFetcher.refresh(cache, chain);
    }

    return await readCache();
  }

  static async refresh(existing = {}, chain = 'ethereum') {
    const updated = { ...existing, lastUpdated: new Date().toISOString() };

    // DeFiLlama — chain TVL stats
    try {
      const res = await fetch('https://api.llama.fi/v2/chains', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const chains = await res.json();
        updated.chainStats = updated.chainStats || {};
        for (const c of chains) {
          const key = c.name?.toLowerCase();
          if (key) updated.chainStats[key] = { tvl: c.tvl, name: c.name };
        }
      }
    } catch (e) {
      console.warn('[ExternalDataFetcher] DeFiLlama chains failed:', e.message);
    }

    // DeFiLlama — all protocols, grouped by category
    try {
      const res = await fetch('https://api.llama.fi/protocols', { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const protocols = await res.json();
        updated.protocols = {};
        updated.categoryTVL = {};

        // Store top 50 by TVL with growth data
        protocols.slice(0, 50).forEach(p => {
          updated.protocols[p.slug] = {
            name: p.name,
            tvl: p.tvl,
            tvl1dChange: p.change_1d,
            tvl7dChange: p.change_7d,
            tvl1mChange: p.change_1m,
            chain: p.chain,
            category: p.category,
            address: p.address,
          };
          // Aggregate TVL per category
          if (p.category) {
            updated.categoryTVL[p.category] = (updated.categoryTVL[p.category] || 0) + (p.tvl || 0);
          }
        });
      }
    } catch (e) {
      console.warn('[ExternalDataFetcher] DeFiLlama protocols failed:', e.message);
    }

    // CoinGecko — ETH + LSK prices
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,lisk&vs_currencies=usd&include_24hr_change=true&include_market_cap=true',
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const prices = await res.json();
        updated.tokens = updated.tokens || {};
        if (prices.ethereum) {
          updated.tokens['eth'] = {
            price: prices.ethereum.usd,
            change24h: prices.ethereum.usd_24h_change?.toFixed(2),
            marketCap: prices.ethereum.usd_market_cap,
          };
        }
        if (prices.lisk) {
          updated.tokens['lsk'] = {
            price: prices.lisk.usd,
            change24h: prices.lisk.usd_24h_change?.toFixed(2),
            marketCap: prices.lisk.usd_market_cap,
          };
        }
      }
    } catch (e) {
      console.warn('[ExternalDataFetcher] CoinGecko failed:', e.message);
    }

    await writeCache(updated);
    console.log('[ExternalDataFetcher] Market context refreshed');
    return updated;
  }

  /**
   * Get market context relevant to a specific contract's category.
   * Returns: category TVL (TAM proxy), top competitors in same category, chain stats.
   */
  static async getProtocolContext(contractAddress, chain, category) {
    const ctx = await ExternalDataFetcher.getMarketContext(chain, contractAddress);

    const result = {
      chainTVL: ctx.chainStats?.[chain.toLowerCase()]?.tvl || null,
      categoryTVL: category ? ctx.categoryTVL?.[category] || null : null,
      topProtocolsInCategory: [],
      ethPrice: ctx.tokens?.eth || null,
    };

    // Top 5 protocols in the same category — these are the TAM/SAM reference points
    if (category && ctx.protocols) {
      result.topProtocolsInCategory = Object.values(ctx.protocols)
        .filter(p => p.category === category)
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, 5)
        .map(p => ({
          name: p.name,
          tvl: p.tvl,
          tvl7dChange: p.tvl7dChange,
          tvl1mChange: p.tvl1mChange,
          chain: p.chain,
        }));
    }

    return result;
  }

  /**
   * Fetch contract info from a block explorer based on chain.
   * Ethereum → Etherscan, Starknet → Starkscan public API.
   */
  static async getContractInfo(address, chain = 'ethereum') {
    if (chain === 'ethereum') {
      const apiKey = process.env.ETHERSCAN_API_KEY;
      if (!apiKey) return null;
      try {
        const url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        const result = data.result?.[0];
        if (!result) return null;
        return {
          contractName: result.ContractName,
          compilerVersion: result.CompilerVersion,
          isVerified: result.ABI !== 'Contract source code not verified',
          abi: result.ABI !== 'Contract source code not verified' ? result.ABI : null,
        };
      } catch (e) {
        console.warn('[ExternalDataFetcher] Etherscan failed:', e.message);
        return null;
      }
    }

    if (chain === 'starknet') {
      try {
        // Starkscan public REST API — no key required
        const url = `https://api.starkscan.co/api/v0/contract/${address}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        return {
          contractName: data.contract_name || data.name || null,
          isVerified: !!data.is_verified,
          classHash: data.class_hash || null,
          deployedAt: data.deployed_at_timestamp || null,
        };
      } catch (e) {
        console.warn('[ExternalDataFetcher] Starkscan failed:', e.message);
        return null;
      }
    }

    return null;
  }

  /**
   * Free multi-source lookup — replaces paid web search.
   * Routes query to the most relevant free API based on keywords.
   * Returns array of { source, title, snippet } or null.
   */
  static async webSearch(query, { category, chain, contractAddress } = {}) {
    const q = query.toLowerCase();
    const results = [];

    // DeFiLlama: protocol search
    if (/tvl|protocol|defi|yield|apy|apr|liquidity|lending|dex|staking|growth|competitor|landscape|benchmark/.test(q)) {
      try {
        const res = await fetch('https://api.llama.fi/protocols', { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const protocols = await res.json();
          const matches = protocols
            .filter(p =>
              (category && p.category?.toLowerCase() === category.toLowerCase()) ||
              p.name?.toLowerCase().includes(q.split(' ')[0]) ||
              p.category?.toLowerCase().includes(q.split(' ')[0])
            )
            .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
            .slice(0, 6);
          matches.forEach(p => results.push({
            source: 'DeFiLlama',
            title: `${p.name} (${p.category})`,
            snippet: `TVL: $${p.tvl?.toLocaleString()} | 7d: ${p.change_7d?.toFixed(1)}% | 1m: ${p.change_1m?.toFixed(1)}% | Chain: ${p.chain}`,
          }));
        }
      } catch (e) { console.warn('[ExternalDataFetcher] DeFiLlama protocol search failed:', e.message); }
    }

    // DeFiLlama: chain TVL history
    if (/growth|trend|forecast|adoption|chain|ecosystem|layer|l2|rollup/.test(q) && chain) {
      try {
        const chainSlug = chain === 'ethereum' ? 'Ethereum' : chain.charAt(0).toUpperCase() + chain.slice(1);
        const res = await fetch(`https://api.llama.fi/v2/historicalChainTvl/${chainSlug}`, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const history = await res.json();
          const recent = history.slice(-30);
          const oldest = recent[0]?.tvl || 1;
          const newest = recent[recent.length - 1]?.tvl || 0;
          const growth30d = (((newest - oldest) / oldest) * 100).toFixed(1);
          results.push({
            source: 'DeFiLlama',
            title: `${chainSlug} chain TVL trend (30d)`,
            snippet: `Current TVL: $${newest?.toLocaleString()} | 30d change: ${growth30d}% | Peak: $${Math.max(...recent.map(r => r.tvl)).toLocaleString()}`,
          });
        }
      } catch (e) { console.warn('[ExternalDataFetcher] DeFiLlama chain history failed:', e.message); }
    }

    // DeFiLlama: category TVL breakdown (TAM/SAM/SOM)
    if (/tam|sam|som|market size|total addressable|serviceable|sector|industry|category/.test(q)) {
      try {
        const res = await fetch('https://api.llama.fi/protocols', { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const protocols = await res.json();
          const byCategory = {};
          protocols.forEach(p => {
            if (p.category && p.tvl) byCategory[p.category] = (byCategory[p.category] || 0) + p.tvl;
          });
          const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10);
          results.push({
            source: 'DeFiLlama',
            title: 'DeFi sector TVL breakdown (TAM reference)',
            snippet: sorted.map(([cat, tvl]) => `${cat}: $${Number(tvl).toLocaleString()}`).join(' | '),
          });
        }
      } catch (e) { console.warn('[ExternalDataFetcher] DeFiLlama category TVL failed:', e.message); }
    }

    // CoinGecko: token price + market cap
    if (/price|market cap|token|coin|volume|supply|inflation|valuation|funding/.test(q)) {
      try {
        const searchTerm = q.replace(/price|market cap|token|coin|volume/g, '').trim().split(' ')[0] || 'ethereum';
        const res = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchTerm)}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const data = await res.json();
          const coins = (data.coins || []).slice(0, 3);
          if (coins.length > 0) {
            const ids = coins.map(c => c.id).join(',');
            const priceRes = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
              { signal: AbortSignal.timeout(8000) }
            );
            if (priceRes.ok) {
              const prices = await priceRes.json();
              coins.forEach(c => {
                const p = prices[c.id];
                if (p) results.push({
                  source: 'CoinGecko',
                  title: `${c.name} (${c.symbol?.toUpperCase()}) market data`,
                  snippet: `Price: $${p.usd} | 24h: ${p.usd_24h_change?.toFixed(2)}% | Market cap: $${p.usd_market_cap?.toLocaleString()} | 24h vol: $${p.usd_24h_vol?.toLocaleString()}`,
                });
              });
            }
          }
        }
      } catch (e) { console.warn('[ExternalDataFetcher] CoinGecko search failed:', e.message); }
    }

    // CoinGecko: trending
    if (/news|latest|recent|trending|hot|popular/.test(q)) {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/search/trending', { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = await res.json();
          const trending = (data.coins || []).slice(0, 5).map(c => c.item.name).join(', ');
          results.push({
            source: 'CoinGecko',
            title: 'Trending tokens right now',
            snippet: `Currently trending: ${trending}`,
          });
        }
      } catch (e) { console.warn('[ExternalDataFetcher] CoinGecko trending failed:', e.message); }
    }

    // DeFiLlama: yields/APY
    if (/yield|apy|apr|staking|farm|earn|interest/.test(q)) {
      try {
        const res = await fetch('https://yields.llama.fi/pools', { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = await res.json();
          const pools = (data.data || [])
            .filter(p => !chain || p.chain?.toLowerCase() === chain.toLowerCase())
            .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
            .slice(0, 5);
          pools.forEach(p => results.push({
            source: 'DeFiLlama Yields',
            title: `${p.project} — ${p.symbol} pool`,
            snippet: `APY: ${p.apy?.toFixed(2)}% | TVL: $${p.tvlUsd?.toLocaleString()} | Chain: ${p.chain}`,
          }));
        }
      } catch (e) { console.warn('[ExternalDataFetcher] DeFiLlama yields failed:', e.message); }
    }

    return results.length > 0 ? results : null;
  }
}
