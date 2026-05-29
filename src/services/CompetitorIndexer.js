/**
 * CompetitorIndexer
 * Schedules background indexing for competitor contracts.
 */

import { findAll } from '../api/database/CompetitorStorage.js';
import { CompetitorAnalysesStorage } from '../api/database/index.js';
import { getRpcUrls } from '../config/env.js';

let _wsManager = null;
let _reindexInterval = null;

/**
 * Index a single competitor — fetches basic on-chain stats via existing RPC clients.
 */
export async function indexCompetitor(competitor) {
  try {
    await CompetitorAnalysesStorage.save(competitor.id, {
      competitorId: competitor.id,
      address: competitor.address,
      chain: competitor.chain,
      status: 'indexing',
      indexedAt: new Date().toISOString()
    });

    // Dynamically import the right RPC client — Ethereum or Starknet only
    let client;
    if (competitor.chain === 'starknet') {
      const { default: StarknetRpcClient } = await import('./StarknetRpcClient.js');
      client = new StarknetRpcClient(getRpcUrls('starknet'));
    } else {
      const { default: EthereumRpcClient } = await import('./EthereumRpcClient.js');
      client = new EthereumRpcClient(getRpcUrls('ethereum'));
    }

    const txData = await client.getTransactionsByAddress(competitor.address, null, null);
    const txs = Array.isArray(txData) ? txData : (txData?.transactions || []);

    const uniqueWallets = new Set(txs.map(tx => tx.from).filter(Boolean));
    const totalVolume = txs.reduce((s, tx) => s + parseFloat(tx.valueEth || tx.value || 0), 0);

    const result = {
      competitorId: competitor.id,
      address: competitor.address,
      chain: competitor.chain,
      status: 'completed',
      metrics: {
        totalTransactions: txs.length,
        uniqueWallets: uniqueWallets.size,
        totalVolume,
        indexedAt: new Date().toISOString()
      }
    };
    await CompetitorAnalysesStorage.save(competitor.id, result);
    return result;
  } catch (err) {
    const existing = await CompetitorAnalysesStorage.get(competitor.id) || {};
    await CompetitorAnalysesStorage.save(competitor.id, { ...existing, status: 'failed', error: err.message });
    console.error(`[CompetitorIndexer] Failed to index ${competitor.address}:`, err.message);
    return null;
  }
}

/**
 * Schedule indexing for a newly added competitor (within 60s).
 */
export function scheduleIndexing(competitor) {
  setTimeout(() => indexCompetitor(competitor), 5000);
}

/**
 * Re-index all competitors (called every 24h).
 */
export async function reindexAll() {
  const competitors = findAll();
  for (const competitor of competitors) {
    await indexCompetitor(competitor); // sequential to avoid RPC overload
  }
}

/**
 * Initialize 24h re-index cron.
 */
export function initialize(wsManager = null) {
  _wsManager = wsManager;
  if (_reindexInterval) clearInterval(_reindexInterval);
  _reindexInterval = setInterval(reindexAll, 24 * 3600 * 1000);
}

export function getResults(competitorId) {
  return readResults()[competitorId] || null;
}

export function getAllResults() { return readResults(); }
