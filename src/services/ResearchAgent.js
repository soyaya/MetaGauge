/**
 * ResearchAgent
 * Fetches external data for a specific contract/project from:
 *   - DeFiLlama  (TVL, protocol fees, category benchmarks)
 *   - CoinGecko  (price, market cap, volume, sentiment)
 *   - CoinMarketCap (supplementary price/rank data)
 *   - GitHub     (dev activity — commits, contributors, stars)
 *
 * Results are saved per contract to the research_data PostgreSQL table.
 * TTL: 7 days. If data is fresh, no re-fetch.
 *
 * Usage:
 *   import ResearchAgent from './ResearchAgent.js';
 *   const data = await ResearchAgent.run({ contractAddress, chain, tokenSymbol, projectSlug, githubRepo });
 */

import { query } from '../api/database/postgres.js';

const DEFILLAMA_BASE  = process.env.DEFILLAMA_API_URL     || 'https://api.llama.fi';
const CG_BASE         = process.env.COINGECKO_API_URL      || 'https://api.coingecko.com/api/v3';
const CG_KEY          = process.env.COINGECKO_API_KEY      || '';
// Demo keys use x-cg-demo-api-key; Pro keys use x-cg-pro-api-key
const CG_KEY_HEADER   = CG_KEY.startsWith('CG-') ? 'x-cg-demo-api-key' : 'x-cg-pro-api-key';
const CMC_BASE        = process.env.COINMARKETCAP_API_URL  || 'https://pro-api.coinmarketcap.com/v1';
const CMC_KEY         = process.env.COINMARKETCAP_API_KEY  || '';
const TTL_DAYS        = parseInt(process.env.RESEARCH_TTL_DAYS || '7');

const timeout = (ms) => AbortSignal.timeout(ms);

// ── Fetch helpers ──────────────────────────────────────────────────────────

async function fetchJSON(url, headers = {}, ms = 10000) {
  const res = await fetch(url, { headers, signal: timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// ── DeFiLlama ─────────────────────────────────────────────────────────────

async function fetchDeFiLlama(projectSlug) {
  const result = { source: 'DeFiLlama', fetched: new Date().toISOString() };

  // First get category from /protocols list (it's not in the single protocol endpoint)
  try {
    const protocols = await fetchJSON(`${DEFILLAMA_BASE}/protocols`, {}, 12000);
    const match = protocols.find(p =>
      p.slug === projectSlug ||
      p.slug?.includes(projectSlug?.toLowerCase()) ||
      p.name?.toLowerCase() === projectSlug?.toLowerCase() ||
      p.name?.toLowerCase().includes(projectSlug?.toLowerCase()) ||
      p.symbol?.toLowerCase() === projectSlug?.toLowerCase()
    );
    if (match) {
      result.category = match.category;
      result.listedAt = match.listedAt;
    }
  } catch { /* non-fatal */ }

  // Protocol details
  try {
    const data = await fetchJSON(`${DEFILLAMA_BASE}/protocol/${projectSlug}`);
    result.tvl            = data.tvl;
    result.tvlUsd         = data.currentChainTvls ? Object.values(data.currentChainTvls).reduce((s, v) => s + (v || 0), 0) : null;
    result.description    = data.description;
    result.chains         = data.chains;
    result.twitter        = data.twitter;
    result.symbol         = data.symbol;
    // TVL history — last 30 days
    if (data.tvl && Array.isArray(data.tvl)) {
      const last30 = data.tvl.slice(-30);
      result.tvlHistory = last30.map(d => ({ date: d.date, tvl: d.totalLiquidityUSD }));
      const first = last30[0]?.totalLiquidityUSD || 0;
      const last  = last30[last30.length - 1]?.totalLiquidityUSD || 0;
      result.tvl30dChange = first > 0 ? Math.round(((last - first) / first) * 100) : null;
    }
  } catch (e) {
    result.error = e.message;
    result.notFound = true;
  }

  // Protocol fees/revenue from DeFiLlama fees API
  try {
    const feesData = await fetchJSON(`${DEFILLAMA_BASE}/summary/fees/${projectSlug}`);
    result.fees24h  = feesData.total24h;
    result.fees7d   = feesData.total7d;
    result.fees30d  = feesData.total30d;
    result.revenue24h = feesData.revenue24h;
  } catch { /* not all protocols have fee data */ }

  return result;
}

// ── Sector benchmarks from DeFiLlama ──────────────────────────────────────

async function fetchSectorBenchmarks(category) {
  const result = { source: 'DeFiLlama', category, fetched: new Date().toISOString() };
  try {
    const protocols = await fetchJSON(`${DEFILLAMA_BASE}/protocols`, {}, 12000);
    const sectorProtocols = protocols.filter(p =>
      p.category && category &&
      p.category.toLowerCase().replace(/s$/, '') === category.toLowerCase().replace(/s$/, '') &&
      p.tvl > 0
    ).sort((a, b) => b.tvl - a.tvl);

    if (sectorProtocols.length > 0) {
      const tvls = sectorProtocols.map(p => p.tvl).filter(Boolean).sort((a, b) => a - b);
      const mid  = Math.floor(tvls.length / 2);
      result.protocol_count    = sectorProtocols.length;
      result.median_tvl        = tvls[mid] || 0;
      result.top10_protocols   = sectorProtocols.slice(0, 10).map(p => ({
        name: p.name, tvl: p.tvl, chain: p.chains?.[0], symbol: p.symbol
      }));
      result.total_sector_tvl  = tvls.reduce((s, v) => s + v, 0);
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

// ── CoinGecko ─────────────────────────────────────────────────────────────

async function fetchCoinGecko(tokenSymbol) {
  const result = { source: 'CoinGecko', fetched: new Date().toISOString() };
  if (!tokenSymbol) return result;

  const headers = CG_KEY ? { [CG_KEY_HEADER]: CG_KEY } : {};

  // Search for coin ID by symbol
  try {
    const search = await fetchJSON(
      `${CG_BASE}/search?query=${encodeURIComponent(tokenSymbol)}`,
      headers
    );
    const coin = search.coins?.[0];
    if (!coin) { result.notFound = true; return result; }

    result.coinId  = coin.id;
    result.symbol  = coin.symbol;
    result.name    = coin.name;
    result.rank    = coin.market_cap_rank;

    // Full market data
    const market = await fetchJSON(
      `${CG_BASE}/coins/${coin.id}?localization=false&tickers=false&community_data=true&developer_data=false`,
      headers
    );

    result.priceUsd        = market.market_data?.current_price?.usd;
    result.marketCapUsd    = market.market_data?.market_cap?.usd;
    result.volume24hUsd    = market.market_data?.total_volume?.usd;
    result.priceChange24h  = market.market_data?.price_change_percentage_24h;
    result.priceChange7d   = market.market_data?.price_change_percentage_7d;
    result.priceChange30d  = market.market_data?.price_change_percentage_30d;
    result.ath             = market.market_data?.ath?.usd;
    result.atl             = market.market_data?.atl?.usd;
    result.athChangePercent = market.market_data?.ath_change_percentage?.usd;
    result.circulatingSupply = market.market_data?.circulating_supply;
    result.totalSupply     = market.market_data?.total_supply;
    result.fdv             = market.market_data?.fully_diluted_valuation?.usd;

    // Sentiment
    result.sentimentVotesUp   = market.sentiment_votes_up_percentage;
    result.sentimentVotesDown = market.sentiment_votes_down_percentage;
    result.communityScore     = market.community_score;
    result.developerScore     = market.developer_score;

    // 30-day OHLCV for price trajectory
    try {
      const ohlcv = await fetchJSON(
        `${CG_BASE}/coins/${coin.id}/ohlc?vs_currency=usd&days=30`,
        headers
      );
      if (Array.isArray(ohlcv) && ohlcv.length > 0) {
        result.price30dHigh  = Math.max(...ohlcv.map(c => c[2]));
        result.price30dLow   = Math.min(...ohlcv.map(c => c[3]));
        result.priceTrajectory = ohlcv.slice(-10).map(c => ({ ts: c[0], close: c[4] }));
      }
    } catch { /* optional */ }

  } catch (e) {
    result.error = e.message;
  }

  return result;
}

// ── CoinMarketCap ─────────────────────────────────────────────────────────

async function fetchCoinMarketCap(tokenSymbol) {
  const result = { source: 'CoinMarketCap', fetched: new Date().toISOString() };
  if (!tokenSymbol || !CMC_KEY) return result;

  try {
    const headers = { 'X-CMC_PRO_API_KEY': CMC_KEY, Accept: 'application/json' };
    const data = await fetchJSON(
      `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(tokenSymbol.toUpperCase())}&convert=USD`,
      headers
    );

    const tokenRaw = data.data?.[tokenSymbol.toUpperCase()];
    // CMC returns object (single) or array depending on plan
    const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
    if (!token) { result.notFound = true; return result; }

    result.cmcId         = token.id;
    result.name          = token.name;
    result.rank          = token.cmc_rank;
    result.priceUsd      = token.quote?.USD?.price;
    result.marketCapUsd  = token.quote?.USD?.market_cap;
    result.volume24h     = token.quote?.USD?.volume_24h;
    result.change1h      = token.quote?.USD?.percent_change_1h;
    result.change24h     = token.quote?.USD?.percent_change_24h;
    result.change7d      = token.quote?.USD?.percent_change_7d;
    result.change30d     = token.quote?.USD?.percent_change_30d;
    result.fdv           = token.quote?.USD?.fully_diluted_market_cap;
    result.circulatingSupply = token.circulating_supply;
    result.totalSupply   = token.total_supply;
    result.maxSupply     = token.max_supply;
  } catch (e) {
    result.error = e.message;
  }

  return result;
}

// ── GitHub ────────────────────────────────────────────────────────────────

async function fetchGitHub(repoUrl) {
  const result = { source: 'GitHub', fetched: new Date().toISOString() };
  if (!repoUrl) return result;

  // Extract owner/repo from URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) { result.error = 'Invalid GitHub URL'; return result; }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'MetaGauge-Research/1.0' };
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

  try {
    // Repo metadata
    const repoData = await fetchJSON(`https://api.github.com/repos/${owner}/${cleanRepo}`, headers);
    result.stars        = repoData.stargazers_count;
    result.forks        = repoData.forks_count;
    result.openIssues   = repoData.open_issues_count;
    result.watchers     = repoData.watchers_count;
    result.language     = repoData.language;
    result.lastPush     = repoData.pushed_at;
    result.description  = repoData.description;
    result.topics       = repoData.topics;
    result.license      = repoData.license?.spdx_id;

    // Contributors count
    try {
      const contribs = await fetchJSON(
        `https://api.github.com/repos/${owner}/${cleanRepo}/contributors?per_page=1&anon=false`,
        headers
      );
      // GitHub returns Link header for pagination — count from array length as proxy
      result.contributors = Array.isArray(contribs) ? contribs.length : 0;
    } catch { result.contributors = null; }

    // Commit activity — last 52 weeks
    try {
      const activity = await fetchJSON(
        `https://api.github.com/repos/${owner}/${cleanRepo}/stats/commit_activity`,
        headers
      );
      if (Array.isArray(activity)) {
        const last4Weeks  = activity.slice(-4).reduce((s, w) => s + w.total, 0);
        const last12Weeks = activity.slice(-12).reduce((s, w) => s + w.total, 0);
        const last52Weeks = activity.reduce((s, w) => s + w.total, 0);
        result.commits4w  = last4Weeks;
        result.commits12w = last12Weeks;
        result.commits52w = last52Weeks;
        result.weeklyActivity = activity.slice(-12).map(w => w.total);
      }
    } catch { /* may return 202 on first fetch — that's fine */ }

  } catch (e) {
    result.error = e.message;
  }

  return result;
}

// ── Summary builder ───────────────────────────────────────────────────────

function buildSummary({ defillama, coingecko, coinmarketcap, github, benchmarks }) {
  const price = coingecko?.priceUsd || coinmarketcap?.priceUsd;
  const mcap  = coingecko?.marketCapUsd || coinmarketcap?.marketCapUsd;

  return {
    has_token:          !!price,
    price_usd:          price || null,
    market_cap_usd:     mcap  || null,
    token_rank:         coingecko?.rank || coinmarketcap?.rank || null,
    price_change_7d:    coingecko?.priceChange7d || coinmarketcap?.change7d || null,
    price_change_30d:   coingecko?.priceChange30d || coinmarketcap?.change30d || null,
    tvl_usd:            defillama?.tvlUsd || null,
    tvl_30d_change_pct: defillama?.tvl30dChange || null,
    protocol_category:  defillama?.category || null,
    protocol_fees_24h:  defillama?.fees24h || null,
    sector_median_tvl:  benchmarks?.median_tvl || null,
    sector_protocol_count: benchmarks?.protocol_count || null,
    github_stars:       github?.stars || null,
    github_commits_4w:  github?.commits4w || null,
    github_contributors: github?.contributors || null,
    dev_active:         github?.commits4w > 0,
    sentiment_positive: coingecko?.sentimentVotesUp || null,
    rag_context: buildRAGContext({ defillama, coingecko, coinmarketcap, github, benchmarks }),
  };
}

// ── RAG context string ────────────────────────────────────────────────────

function buildRAGContext({ defillama, coingecko, coinmarketcap, github, benchmarks }) {
  const lines = [];

  if (defillama && !defillama.notFound) {
    lines.push(`Protocol category: ${defillama.category || 'unknown'}.`);
    if (defillama.tvlUsd)      lines.push(`Current TVL: $${Math.round(defillama.tvlUsd).toLocaleString()}.`);
    if (defillama.tvl30dChange != null) lines.push(`TVL 30-day change: ${defillama.tvl30dChange}%.`);
    if (defillama.fees24h)     lines.push(`Protocol fees (24h): $${Math.round(defillama.fees24h).toLocaleString()}.`);
    if (defillama.fees30d)     lines.push(`Protocol fees (30d): $${Math.round(defillama.fees30d).toLocaleString()}.`);
  }

  const cg = coingecko; const cmc = coinmarketcap;
  const price = cg?.priceUsd || cmc?.priceUsd;
  const mcap  = cg?.marketCapUsd || cmc?.marketCapUsd;
  if (price)                 lines.push(`Token price: $${price}.`);
  if (mcap)                  lines.push(`Market cap: $${Math.round(mcap).toLocaleString()}.`);
  if (cg?.priceChange7d != null) lines.push(`Price change 7d: ${cg.priceChange7d?.toFixed(1)}%.`);
  if (cg?.priceChange30d != null) lines.push(`Price change 30d: ${cg.priceChange30d?.toFixed(1)}%.`);
  if (cg?.sentimentVotesUp)  lines.push(`Community sentiment: ${cg.sentimentVotesUp?.toFixed(0)}% positive.`);

  if (benchmarks && !benchmarks.error) {
    lines.push(`Sector (${benchmarks.category}): ${benchmarks.protocol_count} protocols, median TVL $${Math.round(benchmarks.median_tvl || 0).toLocaleString()}.`);
    if (benchmarks.top10_protocols?.length > 0) {
      lines.push(`Top sector protocols: ${benchmarks.top10_protocols.slice(0, 5).map(p => p.name).join(', ')}.`);
    }
  }

  if (github && !github.error) {
    lines.push(`GitHub: ${github.stars || 0} stars, ${github.contributors || 0} contributors.`);
    if (github.commits4w != null) lines.push(`Commits (last 4 weeks): ${github.commits4w}.`);
  }

  return lines.join(' ');
}

// ── Main run function ─────────────────────────────────────────────────────

async function run({ contractAddress, chain, tokenSymbol, projectSlug, githubRepo, category, forceRefresh = false }) {
  // Check TTL in DB
  if (!forceRefresh) {
    const existing = await query(
      `SELECT *, expires_at > NOW() AS fresh FROM research_data WHERE contract_address=$1 AND chain=$2`,
      [contractAddress?.toLowerCase(), chain]
    );
    if (existing.rows[0]?.fresh) {
      console.log(`[ResearchAgent] Cache hit for ${contractAddress} (${chain})`);
      return existing.rows[0];
    }
  }

  console.log(`[ResearchAgent] Running research for ${contractAddress} (${chain})`);

  // Fire all fetches in parallel — error isolation per source
  const [defillama, coingecko, coinmarketcap, github, benchmarks] = await Promise.all([
    projectSlug ? fetchDeFiLlama(projectSlug).catch(e => ({ error: e.message })) : Promise.resolve({}),
    tokenSymbol ? fetchCoinGecko(tokenSymbol).catch(e => ({ error: e.message })) : Promise.resolve({}),
    tokenSymbol ? fetchCoinMarketCap(tokenSymbol).catch(e => ({ error: e.message })) : Promise.resolve({}),
    githubRepo  ? fetchGitHub(githubRepo).catch(e => ({ error: e.message })) : Promise.resolve({}),
    category    ? fetchSectorBenchmarks(category).catch(e => ({ error: e.message })) : Promise.resolve({}),
  ]);

  const summary = buildSummary({ defillama, coingecko, coinmarketcap, github, benchmarks });

  // Upsert into DB
  const ttlDays = TTL_DAYS;
  await query(
    `INSERT INTO research_data
       (contract_address, chain, defillama_data, coingecko_data, github_data, sector_benchmarks, summary, fetched_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() + INTERVAL '${ttlDays} days')
     ON CONFLICT (contract_address, chain) DO UPDATE SET
       defillama_data    = EXCLUDED.defillama_data,
       coingecko_data    = EXCLUDED.coingecko_data,
       github_data       = EXCLUDED.github_data,
       sector_benchmarks = EXCLUDED.sector_benchmarks,
       summary           = EXCLUDED.summary,
       fetched_at        = NOW(),
       expires_at        = NOW() + INTERVAL '${ttlDays} days'`,
    [
      contractAddress?.toLowerCase(), chain,
      JSON.stringify(defillama),
      JSON.stringify(coingecko),
      JSON.stringify(github),
      JSON.stringify(benchmarks),
      JSON.stringify(summary),
    ]
  );

  // Also save coinmarketcap into coingecko_data as supplementary (combined)
  const combined = { ...coingecko, coinmarketcap };
  await query(
    `UPDATE research_data SET coingecko_data=$1 WHERE contract_address=$2 AND chain=$3`,
    [JSON.stringify(combined), contractAddress?.toLowerCase(), chain]
  );

  const saved = await query(
    `SELECT * FROM research_data WHERE contract_address=$1 AND chain=$2`,
    [contractAddress?.toLowerCase(), chain]
  );

  console.log(`[ResearchAgent] Research saved for ${contractAddress}`);
  return saved.rows[0];
}

// ── Get saved research + build RAG string for Gemini injection ────────────

async function getRAGContext(contractAddress, chain) {
  const result = await query(
    `SELECT summary FROM research_data WHERE contract_address=$1 AND chain=$2`,
    [contractAddress?.toLowerCase(), chain]
  );
  return result.rows[0]?.summary?.rag_context || null;
}

export default { run, getRAGContext, fetchDeFiLlama, fetchCoinGecko, fetchCoinMarketCap, fetchGitHub, fetchSectorBenchmarks };
