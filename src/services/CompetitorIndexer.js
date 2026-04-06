/**
 * CompetitorIndexer
 * Schedules background indexing for competitor contracts.
 * Stores results in data/competitor_analyses.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { findAll } from '../api/database/CompetitorStorage.js';

const RESULTS_FILE = './data/competitor_analyses.json';

function readResults() {
  if (!existsSync(RESULTS_FILE)) return {};
  try { return JSON.parse(readFileSync(RESULTS_FILE, 'utf8')); } catch { return {}; }
}
function writeResults(data) { writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2), 'utf8'); }

let _wsManager = null;
let _reindexInterval = null;

/**
 * Index a single competitor — fetches basic on-chain stats via existing RPC clients.
 */
export async function indexCompetitor(competitor) {
  try {
    const results = readResults();
    results[competitor.id] = {
      competitorId: competitor.id,
      address: competitor.address,
      chain: competitor.chain,
      status: 'indexing',
      indexedAt: new Date().toISOString()
    };
    writeResults(results);

    // Dynamically import the right RPC client — Ethereum or Starknet only
    let client;
    if (competitor.chain === 'starknet') {
      const { default: StarknetRpcClient } = await import('./StarknetRpcClient.js');
      client = new StarknetRpcClient();
    } else {
      // Default to Ethereum for ethereum and any unknown chain
      const { default: EthereumRpcClient } = await import('./EthereumRpcClient.js');
      client = new EthereumRpcClient();
    }

    const txData = await client.getTransactionsByAddress(competitor.address, null, null);
    const txs = Array.isArray(txData) ? txData : (txData?.transactions || []);

    // Basic metrics from tx data
    const uniqueWallets = new Set(txs.map(tx => tx.from).filter(Boolean));
    const totalVolume = txs.reduce((s, tx) => s + parseFloat(tx.valueEth || tx.value || 0), 0);

    results[competitor.id] = {
      ...results[competitor.id],
      status: 'completed',
      metrics: {
        totalTransactions: txs.length,
        uniqueWallets: uniqueWallets.size,
        totalVolume,
        indexedAt: new Date().toISOString()
      }
    };
    writeResults(results);
    return results[competitor.id];
  } catch (err) {
    const results = readResults();
    if (results[competitor.id]) {
      results[competitor.id].status = 'failed';
      results[competitor.id].error = err.message;
      writeResults(results);
    }
    // Isolated failure — does not block other competitors
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
