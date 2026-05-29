/**
 * Competitor Indexing
 * Same pattern as trigger-indexing.js but for competitor contracts.
 * Each competitor's data is saved per-user:
 *   data/users/{userId}/competitors/{competitorId}.json  — raw txs + metrics
 *   data/users/{userId}/competitor_metrics.json          — side-by-side comparison
 */

import { UserStorage, AnalysisStorage, LivePollStorage, MetricsStorage, CompetitorDataStorage, CompetitorMetricsStorage } from '../database/index.js';
import { getRpcUrls } from '../../config/env.js';

const HISTORY_LIMIT = 50;
const CHUNK_SIZE    = 100;
const LIVE_POLL_MS  = 30_000;
const LOG_TIMEOUT   = 15000;

// getRpcUrls imported from ../../config/env.js above

function calculateMetrics(transactions) {
  const uniqueUsers  = new Set(transactions.map(tx => tx.from)).size;
  const totalValue   = transactions.reduce((s, tx) => s + BigInt(tx.value || '0'), BigInt(0));
  const totalGas     = transactions.reduce((s, tx) => s + BigInt(tx.gasUsed || '0'), BigInt(0));
  const successful   = transactions.filter(tx => tx.status).length;
  return {
    transactions:  transactions.length,
    uniqueUsers,
    totalValue:    totalValue.toString(),
    avgGasUsed:    transactions.length ? Number(totalGas / BigInt(transactions.length)) : 0,
    successRate:   transactions.length ? ((successful / transactions.length) * 100).toFixed(2) : 0,
    failureRate:   transactions.length ? (((transactions.length - successful) / transactions.length) * 100).toFixed(2) : 0,
    volume:        totalValue.toString(),
  };
}

async function getRpcClient(chain, rpcUrls) {
  if (chain?.toLowerCase() === 'starknet') {
    const { StarknetRpcClient } = await import('../../services/StarknetRpcClient.js');
    return new StarknetRpcClient(rpcUrls);
  }
  const { EthereumRpcClient } = await import('../../services/EthereumRpcClient.js');
  return new EthereumRpcClient(rpcUrls);
}

/**
 * Rebuild the side-by-side competitor_metrics.json for a user.
 * Reads all competitor files + user's own metrics.
 */
async function rebuildComparisonMetrics(userId) {
  try {
    const competitors = await CompetitorDataStorage.findByUserId(userId);
    const userMetrics = await MetricsStorage.get(userId);
    const comparison = {
      updatedAt: new Date().toISOString(),
      user: userMetrics,
      competitors: competitors.map(c => ({ id: c.id, name: c.name, address: c.address, chain: c.chain, metrics: c.metrics, lastUpdated: c.lastUpdated })),
    };
    await CompetitorMetricsStorage.save(userId, comparison);
  } catch { /* skip */ }
}

/**
 * Index a single competitor: 50 historical txs then live poll.
 * Called when a user adds a competitor via the analyzer.
 */
export async function indexCompetitor(userId, competitor) {
  const { id: competitorId, address, chain, name } = competitor;
  console.log(`🏁 Indexing competitor ${name} (${address}) for user ${userId}`);

  const rpcUrls = getRpcUrls(chain);
  let rpcClient, currentBlock;

  try {
    rpcClient = await getRpcClient(chain, rpcUrls);
    currentBlock = await rpcClient.getBlockNumber();
  } catch (err) {
    console.warn(`⚠️ Competitor RPC init failed for ${address}: ${err.message}`);
    return;
  }

  // ── PHASE 1: Historical ──────────────────────────────────────────────────
  // Scan recent blocks only — high-volume contracts have thousands of logs per block
  const collectedTxs = [];
  const seenHashes   = new Set();
  let scanEnd        = currentBlock;
  let reachedGenesis = false;
  const MAX_SCAN_BLOCKS = 5000; // never scan more than 5000 blocks back
  const scanFloor = currentBlock - MAX_SCAN_BLOCKS;

  while (collectedTxs.length < HISTORY_LIMIT && !reachedGenesis) {
    const scanStart = Math.max(scanFloor, scanEnd - CHUNK_SIZE + 1);
    if (scanStart <= scanFloor) reachedGenesis = true;

    try {
      const logs = await Promise.race([
        rpcClient._makeRpcCall('eth_getLogs', [{
          fromBlock: '0x' + scanStart.toString(16),
          toBlock:   '0x' + scanEnd.toString(16),
          address,
        }]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), LOG_TIMEOUT))
      ]);

      for (const log of (logs || [])) {
        if (log.transactionHash && !seenHashes.has(log.transactionHash)) {
          seenHashes.add(log.transactionHash);
        }
        if (seenHashes.size >= HISTORY_LIMIT) break;
      }

      // Stop scanning once we have enough hashes
      if (seenHashes.size >= HISTORY_LIMIT) reachedGenesis = true;

      const newHashes = Array.from(seenHashes).filter(h => !collectedTxs.find(t => t.hash === h)).slice(0, HISTORY_LIMIT);
      // Fetch txs sequentially with retry — more reliable than parallel for slow gateways
      for (const txHash of newHashes) {
        if (collectedTxs.length >= HISTORY_LIMIT) break;
        let tx = null, receipt = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            [tx, receipt] = await Promise.race([
              Promise.all([
                rpcClient._makeRpcCall('eth_getTransactionByHash', [txHash]),
                rpcClient._makeRpcCall('eth_getTransactionReceipt', [txHash]),
              ]),
              new Promise((_, reject) => setTimeout(() => reject(new Error('tx timeout')), 15000))
            ]);
            break;
          } catch { await new Promise(r => setTimeout(r, 1000)); }
        }
        if (tx) collectedTxs.push({
          hash: tx.hash, from: tx.from, to: tx.to,
          value: tx.value || '0', gasUsed: receipt?.gasUsed || '0',
          gasPrice: tx.gasPrice || '0', blockNumber: parseInt(tx.blockNumber, 16),
          blockTimestamp: receipt?.blockTimestamp ? parseInt(receipt.blockTimestamp, 16) : null,
          status: receipt?.status === '0x1' || receipt?.status === 1,
          input: tx.input || '0x', chain,
        });
      }
    } catch { /* skip chunk */ }

    scanEnd = scanStart - 1;
    if (scanEnd < 0) reachedGenesis = true;
  }

  const metrics = calculateMetrics(collectedTxs);
  const historicalEndBlock = currentBlock;

  const competitorData = {
    id: competitorId, name, address, chain,
    metrics, transactions: collectedTxs,
    lastUpdated: new Date().toISOString(),
    blockRange: { start: scanEnd + 1, end: historicalEndBlock },
  };
  await CompetitorDataStorage.save(userId, address, chain, competitorData);
  await rebuildComparisonMetrics(userId);

  console.log(`✅ Competitor ${name}: ${collectedTxs.length} historical txs saved for user ${userId}`);

  // ── PHASE 2: Live poll ───────────────────────────────────────────────────
  let lastBlock = historicalEndBlock;

  // Save live poll state (keyed by competitorId so multiple competitors work)
  const existingPoll = await LivePollStorage.get(userId) || {};
  await LivePollStorage.save(userId, {
    ...existingPoll,
    [`competitor_${competitorId}`]: {
      active: true, address, chain, competitorId, name, lastBlock,
    },
  });

  const livePoll = async () => {
    try {
      const latestBlock = await rpcClient.getBlockNumber();
      if (latestBlock <= lastBlock) return;

      const logs = await rpcClient._makeRpcCall('eth_getLogs', [{
        fromBlock: '0x' + (lastBlock + 1).toString(16),
        toBlock:   '0x' + latestBlock.toString(16),
        address,
      }]);

      const newHashes = [...new Set((logs || []).map(l => l.transactionHash).filter(Boolean))].slice(0, 50);
      if (newHashes.length === 0) { lastBlock = latestBlock; return; }

      const newTxs = [];
      for (const txHash of newHashes) {
        try {
          const [tx, receipt] = await Promise.all([
            rpcClient._makeRpcCall('eth_getTransactionByHash', [txHash]),
            rpcClient._makeRpcCall('eth_getTransactionReceipt', [txHash]),
          ]);
          if (tx) newTxs.push({
            hash: tx.hash, from: tx.from, to: tx.to,
            value: tx.value || '0', gasUsed: receipt?.gasUsed || '0',
            gasPrice: tx.gasPrice || '0', blockNumber: parseInt(tx.blockNumber, 16),
            status: receipt?.status === '0x1' || receipt?.status === 1,
            input: tx.input || '0x', chain,
          });
        } catch { /* skip */ }
      }

      if (newTxs.length > 0) {
        const current = await CompetitorDataStorage.get(userId, address, chain) || {};
        const allTxs = [...(current.transactions || []), ...newTxs];
        const updatedMetrics = calculateMetrics(allTxs);
        await CompetitorDataStorage.save(userId, address, chain, {
          ...current, metrics: updatedMetrics, transactions: allTxs,
          lastUpdated: new Date().toISOString(),
          blockRange: { ...current.blockRange, end: latestBlock },
        });
        await rebuildComparisonMetrics(userId);

        // ── Auto-run competitive alert checks ────────────────────────
        try {
          const { UserStorage, MetricsStorage, AlertConfigStorage } = await import('../database/index.js');
          const user = await UserStorage.findById(userId);
          const myContractAddress = user?.onboarding?.defaultContract?.address;
          const { checkCompetitorAcquisitionSpike, checkTVLOvertake, checkMomentumShift, makeAlert, saveAlert } = await import('../../services/AlertEngine.js');

          const userAlertConfigs = await AlertConfigStorage.findByUserId(userId);
          const globalCfg = userAlertConfigs.find(c => !c.type && c.enabled);
          const competitorsEnabled = globalCfg?.categories?.competitors !== false;
          const previousMetrics = current.metrics || {};

          if (competitorsEnabled) {
            checkCompetitorAcquisitionSpike(name, updatedMetrics.uniqueUsers, previousMetrics.uniqueUsers || 0, myContractAddress, userId);
            const userMetrics = await MetricsStorage.get(userId);
            if (userMetrics) checkTVLOvertake(name, Number(updatedMetrics.totalValue), Number(userMetrics.totalValue || 0), myContractAddress, userId);
            const compGrowth = previousMetrics.transactions > 0
              ? ((updatedMetrics.transactions - previousMetrics.transactions) / previousMetrics.transactions) * 100 : 0;
            checkMomentumShift(name, compGrowth, 0, myContractAddress, userId);
          }
          for (const cfg of userAlertConfigs.filter(c => c.type === 'competitive' && c.competitorId === competitorId && c.enabled)) {
            const actual = updatedMetrics[cfg.metric];
            if (actual == null) continue;
            let fired = false;
            if (cfg.condition === 'above' && actual > cfg.threshold) fired = true;
            if (cfg.condition === 'below' && actual < cfg.threshold) fired = true;
            const userMetrics = await MetricsStorage.get(userId);
            if (cfg.condition === 'overtakes_me' && userMetrics) fired = actual > (userMetrics[cfg.metric] ?? Infinity);
            if (fired) saveAlert(makeAlert(`competitive_threshold_${cfg.metric}`, 'medium', myContractAddress, userId,
              `Competitor Alert: ${cfg.name || cfg.metric}`,
              `${name} ${cfg.metric} is ${actual} (${cfg.condition} ${cfg.threshold})`
            ));
          }
        } catch (alertErr) {
          console.info(`   ℹ️ Alert check skipped: ${alertErr.message}`);
        }

        console.log(`   📡 Competitor ${name}: +${newTxs.length} live txs for user ${userId}`);
      }

      lastBlock = latestBlock;
      const poll = await LivePollStorage.get(userId) || {};
      await LivePollStorage.save(userId, {
        ...poll,
        [`competitor_${competitorId}`]: { active: true, address, chain, competitorId, name, lastBlock },
      });
    } catch (err) {
      console.info(`   ℹ️ Competitor live poll error (${name}): ${err.message}`);
    }
  };

  const interval = setInterval(livePoll, LIVE_POLL_MS);
  process.once('SIGTERM', () => clearInterval(interval));
  process.once('SIGINT',  () => clearInterval(interval));
}

/**
 * Resume all competitor live polls for a user after server restart.
 */
export async function resumeCompetitorPolls(userId) {
  const pollState = await LivePollStorage.get(userId);
  if (!pollState) return;

  for (const [key, state] of Object.entries(pollState)) {
    if (!key.startsWith('competitor_') || !state.active) continue;
    console.log(`🔄 Resuming competitor poll: ${state.name} for user ${userId}`);
    indexCompetitor(userId, {
      id: state.competitorId, address: state.address,
      chain: state.chain, name: state.name,
    }).catch(err => console.warn(`⚠️ Competitor resume failed: ${err.message}`));
  }
}

/**
 * Get competitor comparison data for a user (used by API endpoint + AI).
 */
export async function getCompetitorMetrics(userId) {
  try {
    return await CompetitorMetricsStorage.get(userId);
  } catch {
    return null;
  }
}
