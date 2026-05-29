/**
 * Contract Indexing
 *
 * Phase 1 — Historical: fetch up to 50 past transactions involving the contract,
 *   scanning backwards from the current block until either:
 *   (a) 50 transactions are collected, or
 *   (b) the contract's deployment block is reached (no more history).
 *
 * Phase 2 — Live: once historical phase completes, start polling for new
 *   transactions from the last processed block forward, appending to the DB
 *   for continuous metrics calculation.
 */

import { UserStorage, AnalysisStorage, LivePollStorage, MetricsStorage, AlertConfigStorage } from '../database/index.js';

import { AlertNotificationService } from '../../services/AlertNotificationService.js';
import { checkRetentionDrop, checkBotSurge, checkChurnSpike } from '../../services/AlertEngine.js';
import { PatternProfileService } from '../../services/PatternProfileService.js';
import subscriptionService from '../../services/SubscriptionService.js';
import { getRpcUrls } from '../../config/env.js';

const HISTORY_LIMIT = 50;       // max historical transactions to fetch
const CHUNK_SIZE   = 10000;     // blocks per eth_getLogs call (increased for faster scanning)
const LIVE_POLL_MS = 30_000;    // poll every 30 seconds for new data

// ─── RPC URL helper — imported from central config ───────────────────────────

// ─── Metrics helper ──────────────────────────────────────────────────────────

function calculateMetrics(transactions) {
  const uniqueUsers  = new Set(transactions.map(tx => tx.from)).size;
  const totalValue   = transactions.reduce((s, tx) => s + BigInt(tx.value   || '0'), BigInt(0));
  const totalGas     = transactions.reduce((s, tx) => s + BigInt(tx.gasUsed || '0'), BigInt(0));
  const successfulTxs = transactions.filter(tx => tx.status).length;
  return {
    transactions:  transactions.length,
    uniqueUsers,
    totalValue:    totalValue.toString(),
    avgGasUsed:    transactions.length ? Number(totalGas / BigInt(transactions.length)) : 0,
    successRate:   transactions.length ? ((successfulTxs / transactions.length) * 100).toFixed(2) : 0,
    failureRate:   transactions.length ? (((transactions.length - successfulTxs) / transactions.length) * 100).toFixed(2) : 0,
    volume:        totalValue.toString(),
  };
}

// ─── Function signature extractor ────────────────────────────────────────────

async function extractAndStoreFunctionSignatures(contractAddress, chain, transactions) {
  try {
    const { FunctionAnalyticsStorage } = await import('../../services/FunctionAnalyticsStorage.js');
    const storage = new FunctionAnalyticsStorage();

    const interactions = transactions
      .filter(tx => tx.input && tx.input.length >= 10 && tx.input !== '0x')
      .map(tx => ({
        signature:     tx.input.slice(0, 10),
        txTo:          tx.to || null,          // store destination so we can label router calls
        walletAddress: tx.from,
        transactionHash: tx.hash,
        blockNumber:   tx.blockNumber,
        timestamp:     tx.blockTimestamp
          ? new Date(tx.blockTimestamp * 1000).toISOString()
          : new Date().toISOString(),
        gasUsed:       tx.gasUsed ? parseInt(tx.gasUsed, 16) : 0,
        status:        tx.status,
      }));

    if (interactions.length === 0) return;

    // Merge with existing interactions (avoid duplicates by tx hash)
    const existing = await storage.getInteractions(contractAddress, chain);
    const existingHashes = new Set(existing.map(i => i.transactionHash));
    const newInteractions = interactions.filter(i => !existingHashes.has(i.transactionHash));

    if (newInteractions.length > 0) {
      await storage.saveInteractions(contractAddress, chain, [...existing, ...newInteractions]);
      console.log(`   📝 Stored ${newInteractions.length} function signature interactions`);
    }
  } catch (err) {
    console.warn(`   ⚠️ Function signature extraction failed: ${err.message}`);
  }
}

export async function triggerDefaultContractIndexing(req, res) {
  try {
    const user = await UserStorage.findById(req.user.id);

    if (!user?.onboarding?.defaultContract?.address) {
      return res.status(400).json({
        error: 'No default contract configured',
        message: 'Please complete onboarding first',
      });
    }

    const contract = user.onboarding.defaultContract;

    if (contract.isIndexed) {
      return res.json({ message: 'Contract already indexed', progress: 100 });
    }

    // ── Charge for analysis (pay-as-you-go) ─────────────────────────────────
    // Skip charge for mock requests (from internal scheduler)
    if (res.json !== undefined && !req._internal) {
      const charge = await subscriptionService.charge(req.user.id, 'analysis');
      if (!charge.allowed) {
        return res.status(402).json({
          error: charge.reason === 'quota_exceeded' ? 'Free quota exhausted' : 'Insufficient balance',
          message: charge.reason === 'quota_exceeded'
            ? 'You\'ve used your free analyses for this month. Top up at /subscription to continue.'
            : `This analysis costs $0.10. Your balance is $${charge.balance}. Top up at /subscription.`,
          balance: charge.balance,
          required: charge.required,
          reason: charge.reason,
        });
      }
    }

    // ── Guard: skip if an active/completed analysis already exists for this contract ──
    const existingAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const activeAnalysis = existingAnalyses.find(a =>
      a.metadata?.isDefaultContract &&
      (a.status === 'running' || a.status === 'pending' || a.status === 'completed') &&
      a.contractAddress === contract.address
    );
    if (activeAnalysis) {
      console.log(`⚠️ Indexing already in progress/completed for ${contract.address} (analysis ${activeAnalysis.id}), skipping duplicate`);
      return res.json({ message: 'Indexing already in progress', analysisId: activeAnalysis.id, progress: activeAnalysis.progress || 0 });
    }

    console.log(`🚀 Indexing triggered for ${contract.address} on ${contract.chain}`);

    // ── Initialise RPC client ────────────────────────────────────────────────
    const rpcUrls = getRpcUrls(contract.chain);
    let rpcClient;
    let currentBlock;

    try {
      if (contract.chain.toLowerCase() === 'starknet') {
        const { StarknetRpcClient } = await import('../../services/StarknetRpcClient.js');
        rpcClient = new StarknetRpcClient(rpcUrls);
      } else {
        const { EthereumRpcClient } = await import('../../services/EthereumRpcClient.js');
        rpcClient = new EthereumRpcClient(rpcUrls);
      }
      currentBlock = await rpcClient.getBlockNumber();
      console.log(`✅ Current block: ${currentBlock}`);
    } catch (err) {
      console.info(`ℹ️ RPC init issue: ${err.message}`);
      return res.json({
        message: 'Indexing queued — blockchain connection is being established',
        analysisId: null,
        progress: 0,
        status: 'queued',
      });
    }

    // ── Create analysis record ───────────────────────────────────────────────
    const analysis = await AnalysisStorage.create({
      userId: req.user.id,
      contractAddress: contract.address,
      chain: contract.chain,
      analysisType: 'quick-index',
      status: 'running',
      progress: 0,
      metadata: {
        isDefaultContract: true,
        startedAt: new Date().toISOString(),
        historicalLimit: HISTORY_LIMIT,
      },
    });

    // Respond immediately — heavy work runs in background
    res.json({ message: 'Indexing started', analysisId: analysis.id, progress: 0 });

    // ── Background work ──────────────────────────────────────────────────────
    setImmediate(async () => {
      const updateProgress = async (pct, step) => {
        try {
          const freshUser = await UserStorage.findById(req.user.id);
          await UserStorage.update(req.user.id, {
            onboarding: {
              ...freshUser.onboarding,
              defaultContract: {
                ...freshUser.onboarding.defaultContract,
                indexingProgress: pct,
                currentStep: step,
              },
            },
          });
          await AnalysisStorage.update(analysis.id, { progress: pct, currentStep: step });
        } catch (e) {
          console.error('Progress update failed:', e.message);
        }
      };

      try {
        await updateProgress(10, 'Starting historical fetch...');

        // ── PHASE 1: Historical ──────────────────────────────────────────────
        console.log(`📜 PHASE 1: Fetching up to ${HISTORY_LIMIT} historical transactions`);

        const collectedTxs = [];
        let reachedGenesis = false;
        let scanEnd = currentBlock;
        const isStarknet = contract.chain.toLowerCase() === 'starknet';

        if (isStarknet) {
          // ── Starknet ─────────────────────────────────────────────────────
          try {
            const scanStart = Math.max(0, currentBlock - CHUNK_SIZE);
            console.log(`   🔍 Starknet: fetching events ${scanStart}–${currentBlock}`);
            await updateProgress(20, 'Fetching Starknet events...');
            const result = await rpcClient.getTransactionsByAddress(contract.address, scanStart, currentBlock);
            const txs = (result?.transactions || []).slice(0, HISTORY_LIMIT);
            for (const tx of txs) {
              collectedTxs.push({
                hash: tx.hash, from: tx.from, to: tx.to || contract.address,
                value: '0', gasUsed: tx.gasUsed || '0', gasPrice: '0',
                blockNumber: tx.blockNumber || 0, blockTimestamp: tx.blockTimestamp || null,
                status: tx.status, input: tx.input || '0x', chain: 'starknet',
              });
            }
            console.log(`✅ Starknet: collected ${collectedTxs.length} transactions`);
          } catch (err) {
            console.warn(`   ⚠️ Starknet historical fetch failed: ${err.message}`);
          }
        } else {
          // ── Ethereum: eth_getLogs ─────────────────────────────────────────
          const seenHashes = new Set();
          let emptyChunks  = 0;
          const MAX_EMPTY  = 20;
          const startTime  = Date.now();
          const MAX_TIME   = 5 * 60 * 1000;
          const deployBlock = contract.deploymentBlock ? parseInt(contract.deploymentBlock) : null;

          if (deployBlock && deployBlock > 0) {
            // Forward scan from deployment block (efficient for known contracts)
            console.log(`   📍 Deployment block: ${deployBlock}, scanning forward`);
            let scanFrom = deployBlock;
            while (collectedTxs.length < HISTORY_LIMIT && scanFrom <= currentBlock) {
              if (Date.now() - startTime > MAX_TIME) break;
              const scanTo = Math.min(scanFrom + CHUNK_SIZE - 1, currentBlock);
              console.log(`   🔍 Scanning blocks ${scanFrom}–${scanTo} (have ${collectedTxs.length}/${HISTORY_LIMIT})`);
              try {
                const logs = await rpcClient._makeRpcCall('eth_getLogs', [{
                  address: contract.address,
                  fromBlock: '0x' + scanFrom.toString(16),
                  toBlock:   '0x' + scanTo.toString(16),
                }]);
                if (Array.isArray(logs) && logs.length > 0) {
                  emptyChunks = 0;
                  for (const log of logs) {
                    const txHash = log.transactionHash;
                    if (!txHash || seenHashes.has(txHash)) continue;
                    seenHashes.add(txHash);
                    collectedTxs.push({
                      hash: txHash,
                      from: log.topics?.[1] ? '0x' + log.topics[1].slice(26) : '0x0',
                      to: contract.address, value: '0x0', gasUsed: '0', gasPrice: '0',
                      blockNumber: parseInt(log.blockNumber, 16), _blockHex: log.blockNumber,
                      status: true, input: '0x', chain: contract.chain,
                      events: [log], source: 'event',
                    });
                    if (collectedTxs.length >= HISTORY_LIMIT) break;
                  }
                } else {
                  emptyChunks++;
                  if (emptyChunks >= MAX_EMPTY) break;
                }
              } catch (err) {
                console.warn(`   ⚠️ getLogs error: ${err.message}`);
                emptyChunks++;
                if (emptyChunks >= MAX_EMPTY) break;
              }
              scanFrom = scanTo + 1;
              scanEnd = scanTo;
            }
          } else {
            // Backward scan from current block
            while (collectedTxs.length < HISTORY_LIMIT && !reachedGenesis && emptyChunks < MAX_EMPTY) {
              if (Date.now() - startTime > MAX_TIME) {
                console.log(`   ⏰ Timeout reached, stopping with ${collectedTxs.length} transactions`);
                break;
              }
              const scanStart = Math.max(0, scanEnd - CHUNK_SIZE + 1);
              if (scanStart === 0) reachedGenesis = true;
              console.log(`   🔍 Scanning blocks ${scanStart}–${scanEnd} (have ${collectedTxs.length}/${HISTORY_LIMIT})`);
              try {
                const logs = await rpcClient._makeRpcCall('eth_getLogs', [{
                  fromBlock: '0x' + scanStart.toString(16),
                  toBlock:   '0x' + scanEnd.toString(16),
                  address:   contract.address,
                }]);
                if (!logs || logs.length === 0) {
                  emptyChunks++;
                  scanEnd = scanStart - 1;
                  continue;
                }
                emptyChunks = 0;
                const blockTsMap = {};
                for (const log of (Array.isArray(logs) ? logs : [])) {
                  if (log.blockTimestamp && log.blockNumber)
                    blockTsMap[log.blockNumber] = parseInt(log.blockTimestamp, 16);
                  if (log.transactionHash && !seenHashes.has(log.transactionHash))
                    seenHashes.add(log.transactionHash);
                  if (seenHashes.size >= HISTORY_LIMIT) break;
                }
                const newHashes = Array.from(seenHashes).filter(h => !collectedTxs.find(t => t.hash === h));
                for (let i = 0; i < newHashes.length && collectedTxs.length < HISTORY_LIMIT; i += 10) {
                  const batch = newHashes.slice(i, i + 10);
                  const results = await Promise.all(batch.map(async txHash => {
                    try {
                      const [tx, receipt] = await Promise.all([
                        rpcClient._makeRpcCall('eth_getTransactionByHash', [txHash]),
                        rpcClient._makeRpcCall('eth_getTransactionReceipt', [txHash]),
                      ]);
                      if (!tx) return null;
                      return {
                        hash: tx.hash, from: tx.from, to: tx.to,
                        value: tx.value || '0', gasUsed: receipt?.gasUsed || '0',
                        gasPrice: tx.gasPrice || '0',
                        blockNumber: parseInt(tx.blockNumber, 16),
                        blockTimestamp: blockTsMap[tx.blockNumber] || null,
                        status: receipt?.status === '0x1' || receipt?.status === 1,
                        input: tx.input || '0x', chain: contract.chain,
                      };
                    } catch { return null; }
                  }));
                  collectedTxs.push(...results.filter(Boolean));
                }
              } catch (logsErr) {
                console.warn(`   ⚠️ eth_getLogs failed: ${logsErr.message}`);
              }
              const pct = Math.min(80, 10 + Math.round((collectedTxs.length / HISTORY_LIMIT) * 70));
              await updateProgress(pct, `Historical: ${collectedTxs.length}/${HISTORY_LIMIT} transactions`);
              scanEnd = scanStart - 1;
              if (scanEnd < 0) reachedGenesis = true;
            }
          }
        }

        console.log(`✅ PHASE 1 COMPLETE: ${collectedTxs.length} historical transactions collected`);

        // ── Enrich with block timestamps ────────────────────────────────────
        const blockTimestampCache = {};
        // Use blockNumber (int) to build hex if _blockHex missing
        const uniqueBlocks = [...new Set(collectedTxs.map(tx =>
          tx._blockHex || (tx.blockNumber ? '0x' + tx.blockNumber.toString(16) : null)
        ).filter(Boolean))];
        await Promise.all(uniqueBlocks.map(async (blockHex) => {
          try {
            const block = await rpcClient._makeRpcCall('eth_getBlockByNumber', [blockHex, false]);
            if (block?.timestamp) blockTimestampCache[blockHex] = parseInt(block.timestamp, 16);
          } catch { /* skip */ }
        }));
        for (const tx of collectedTxs) {
          const blockHex = tx._blockHex || (tx.blockNumber ? '0x' + tx.blockNumber.toString(16) : null);
          if (blockHex && blockTimestampCache[blockHex]) {
            tx.blockTimestamp = blockTimestampCache[blockHex];
          }
          delete tx._blockHex;
        }

        // ── Save historical results ──────────────────────────────────────────
        const metrics = calculateMetrics(collectedTxs);
        const historicalEndBlock = currentBlock;

        await AnalysisStorage.update(analysis.id, {
          status:      'completed',
          progress:    100,
          results: {
            target: {
              contract:     { address: contract.address, chain: contract.chain, name: contract.name },
              metrics,
              transactions: collectedTxs,
              summary: {
                totalTransactions: collectedTxs.length,
                uniqueUsers:       metrics.uniqueUsers,
                blockRange:        { start: scanEnd + 1, end: historicalEndBlock },
                reachedGenesis,
              },
            },
          },
          metadata: {
            isDefaultContract: true,
            blockRange:        { start: scanEnd + 1, end: historicalEndBlock },
            historicalComplete: true,
            completedAt:       new Date().toISOString(),
          },
          completedAt: new Date().toISOString(),
        });

        // Save computed metrics to per-user metrics store
        await MetricsStorage.save(req.user.id, {
          contractAddress: contract.address,
          chain: contract.chain,
          analysisId: analysis.id,
          ...metrics,
          blockRange: { start: scanEnd + 1, end: historicalEndBlock },
        });

        // Update pattern profile with latest metrics
        PatternProfileService.update(req.user.id, metrics).catch(() => {});

        // Re-fetch user to get latest onboarding state before updating
        const freshUser = await UserStorage.findById(req.user.id);
        await UserStorage.update(req.user.id, {
          onboarding: {
            ...freshUser.onboarding,
            defaultContract: {
              ...freshUser.onboarding.defaultContract,
              isIndexed:        true,
              indexingProgress: 100,
              lastAnalysisId:   analysis.id,
            },
          },
        });

        await updateProgress(100, 'Historical complete — starting live monitoring');
        console.log(`🎉 Historical phase done. Starting live monitoring from block ${historicalEndBlock + 1}`);

        // Extract function signatures from historical transactions
        await extractAndStoreFunctionSignatures(contract.address, contract.chain, collectedTxs);

        // ── PHASE 2: Live monitoring ─────────────────────────────────────────
        console.log(`📡 PHASE 2: Live monitoring from block ${historicalEndBlock + 1}`);
        let lastBlock = historicalEndBlock;

        // Save live poll state so it survives server restarts
        await LivePollStorage.save(req.user.id, {
          active: true,
          contractAddress: contract.address,
          chain: contract.chain,
          analysisId: analysis.id,
          lastBlock,
        });

        const livePoll = async () => {
          try {
            const latestBlock = await rpcClient.getBlockNumber();
            if (latestBlock <= lastBlock) return;

            console.log(`   📡 Live: scanning blocks ${lastBlock + 1}–${latestBlock}`);

            let newTxs = [];

            if (contract.chain.toLowerCase() === 'starknet') {
              // Starknet: use starknet_getEvents
              try {
                const result = await rpcClient.getTransactionsByAddress(contract.address, lastBlock + 1, latestBlock);
                newTxs = (result?.transactions || []).slice(0, 50).map(tx => ({
                  hash:           tx.hash,
                  from:           tx.from,
                  to:             tx.to || contract.address,
                  value:          '0',
                  gasUsed:        tx.gasUsed || '0',
                  gasPrice:       '0',
                  blockNumber:    tx.blockNumber || 0,
                  blockTimestamp: tx.blockTimestamp || null,
                  status:         tx.status,
                  input:          tx.input || '0x',
                  chain:          'starknet',
                }));
              } catch (e) {
                console.warn(`   ⚠️ Starknet live poll failed: ${e.message}`);
              }
            } else {
              // Ethereum: eth_getLogs
              const logs = await rpcClient._makeRpcCall('eth_getLogs', [{
                fromBlock: '0x' + (lastBlock + 1).toString(16),
                toBlock:   '0x' + latestBlock.toString(16),
                address:   contract.address,
              }]);

              const logTsMap = {};
              for (const log of (Array.isArray(logs) ? logs : [])) {
                if (log.blockTimestamp && log.blockNumber)
                  logTsMap[log.blockNumber] = parseInt(log.blockTimestamp, 16);
              }

              const cappedHashes = [...new Set((Array.isArray(logs) ? logs : []).map(l => l.transactionHash).filter(Boolean))].slice(0, 50);

              for (const txHash of cappedHashes) {
                try {
                  const [tx, receipt] = await Promise.all([
                    rpcClient._makeRpcCall('eth_getTransactionByHash', [txHash]),
                    rpcClient._makeRpcCall('eth_getTransactionReceipt', [txHash]),
                  ]);
                  if (tx) newTxs.push({
                    hash:           tx.hash,
                    from:           tx.from,
                    to:             tx.to,
                    value:          tx.value || '0',
                    gasUsed:        receipt?.gasUsed || '0',
                    gasPrice:       tx.gasPrice || '0',
                    blockNumber:    parseInt(tx.blockNumber, 16),
                    blockTimestamp: logTsMap[tx.blockNumber] || null,
                    status:         receipt?.status === '0x1' || receipt?.status === 1,
                    input:          tx.input || '0x',
                    chain:          contract.chain,
                  });
                } catch (e) {
                  console.warn(`   ⚠️ Live tx fetch failed ${txHash}: ${e.message}`);
                }
              }
            }

            if (newTxs.length > 0) {
              // Append to existing analysis results
              const current = await AnalysisStorage.findById(analysis.id);
              const existingTxs = current?.results?.target?.transactions || [];
              const allTxs      = [...existingTxs, ...newTxs];
              const updatedMetrics = calculateMetrics(allTxs);

              await AnalysisStorage.update(analysis.id, {
                results: {
                  target: {
                    ...current?.results?.target,
                    metrics:      updatedMetrics,
                    transactions: allTxs,
                    summary: {
                      ...current?.results?.target?.summary,
                      totalTransactions: allTxs.length,
                      uniqueUsers:       updatedMetrics.uniqueUsers,
                      blockRange:        { start: current?.results?.target?.summary?.blockRange?.start, end: latestBlock },
                      lastLiveUpdate:    new Date().toISOString(),
                    },
                  },
                },
                metadata: {
                  ...current?.metadata,
                  lastLiveBlock: latestBlock,
                  lastLiveUpdate: new Date().toISOString(),
                },
              });

              // Update per-user metrics store
              await MetricsStorage.save(req.user.id, {
                contractAddress: contract.address,
                chain: contract.chain,
                analysisId: analysis.id,
                ...updatedMetrics,
                blockRange: { start: current?.results?.target?.summary?.blockRange?.start, end: latestBlock },
                lastLiveUpdate: new Date().toISOString(),
              });

              console.log(`   ✅ Live: appended ${newTxs.length} txs (total: ${allTxs.length})`);

              // ── Alert checking ──────────────────────────────────────────
              try {
                const user = await UserStorage.findById(req.user.id);
                const alertConfigs = await AlertConfigStorage.findByUserId(req.user.id).catch(() => []);
                const activeConfig = alertConfigs.find(c => c.enabled) || null;

                if (activeConfig) {
                  const notifier = new AlertNotificationService();
                  const channels = notifier.getAllowedChannels(user?.tier || 'free');
                  const thresholds = activeConfig.thresholds || {};

                  // Run checks with correct signatures
                  const triggered = [
                    checkRetentionDrop(updatedMetrics, contract.address, req.user.id, thresholds),
                    checkBotSurge(
                      [], // bots array — use botPct proxy
                      updatedMetrics.uniqueUsers || 1,
                      contract.address, req.user.id, thresholds
                    ),
                    checkChurnSpike(
                      updatedMetrics.churnRate || 0,
                      0, // no previous — first run won't trigger
                      contract.address, req.user.id, thresholds
                    ),
                  ].filter(Boolean);

                  for (const alert of triggered) {
                    await notifier.sendAlert(
                      { ...alert, contractAddress: contract.address },
                      activeConfig.notifications?.email ? channels : ['inApp'],
                      user?.email,
                      activeConfig.notifications?.webhookUrl,
                      updatedMetrics
                    );
                  }
                }
              } catch (alertErr) {
                console.warn('[Alert] check failed:', alertErr.message);
              }

              // Extract function signatures from new live transactions
              await extractAndStoreFunctionSignatures(contract.address, contract.chain, newTxs);

              // Push update to frontend via WebSocket
              try {
                const { wsManager } = await import('../server.js').then(m => ({ wsManager: m.wsManager })).catch(() => ({}));
                if (wsManager) {
                  wsManager.sendToUser(req.user.id, {
                    type: 'metrics_update',
                    metrics: updatedMetrics,
                    totalTransactions: allTxs.length,
                    lastBlock: latestBlock,
                    timestamp: new Date().toISOString(),
                  });

                  // Notify about significant new transactions
                  const whaleThreshold = 1; // ETH
                  const whaleTxs = newTxs.filter(t => Number(t.value || 0) / 1e18 >= whaleThreshold);
                  const failedNew = newTxs.filter(t => !t.status);

                  if (whaleTxs.length > 0) {
                    wsManager.sendToUser(req.user.id, {
                      type: 'transaction_alert',
                      severity: 'info',
                      title: `${whaleTxs.length} whale transaction${whaleTxs.length > 1 ? 's' : ''} detected`,
                      message: `Large value transaction(s) on ${contract.name}`,
                      txs: whaleTxs.slice(0, 3).map(t => ({ hash: t.hash, valueETH: (Number(t.value || 0) / 1e18).toFixed(4) })),
                      timestamp: new Date().toISOString(),
                    });
                  }
                  if (failedNew.length > 2) {
                    wsManager.sendToUser(req.user.id, {
                      type: 'transaction_alert',
                      severity: 'warning',
                      title: `${failedNew.length} failed transactions`,
                      message: `Elevated failure rate detected on ${contract.name}`,
                      timestamp: new Date().toISOString(),
                    });
                  }
                }
              } catch (_) { /* WebSocket push is best-effort */ }
            }

            lastBlock = latestBlock;
            // Persist lastBlock so live poll resumes correctly after restart
            await LivePollStorage.save(req.user.id, {
              active: true,
              contractAddress: contract.address,
              chain: contract.chain,
              analysisId: analysis.id,
              lastBlock,
            });
          } catch (err) {
            console.info(`   ℹ️ Live poll error: ${err.message}`);
          }
        };

        // Run live poll on an interval indefinitely
        const interval = setInterval(livePoll, LIVE_POLL_MS);

        // Clean up if the process exits
        process.once('SIGTERM', () => clearInterval(interval));
        process.once('SIGINT',  () => clearInterval(interval));

      } catch (err) {
        console.error(`❌ Indexing failed: ${err.message}`);
        await AnalysisStorage.update(analysis.id, {
          status:       'failed',
          errorMessage: 'Indexing failed. Please try again.',
        });
        const errUser = await UserStorage.findById(req.user.id);
        await UserStorage.update(req.user.id, {
          onboarding: {
            ...errUser.onboarding,
            defaultContract: {
              ...errUser.onboarding.defaultContract,
              indexingProgress: 0,
              currentStep: 'Failed — will retry',
            },
          },
        });
      }
    });

  } catch (err) {
    console.error('Failed to trigger indexing:', err);
    res.status(500).json({
      error:    'Unable to start indexing',
      message:  'Blockchain connection is temporarily unavailable. Please try again.',
      canRetry: true,
    });
  }
}

/**
 * Resume live polling for a user after server restart.
 * Called on startup for each user with an active LivePollStorage entry.
 */
export async function resumeLivePoll({ userId, contractAddress, chain, analysisId, lastBlock: savedLastBlock }) {
  console.log(`🔄 Resuming live poll for user ${userId} contract ${contractAddress} from block ${savedLastBlock}`);

  // If lastBlock is null, recover from the analysis record
  let lastBlock = savedLastBlock;
  if (!lastBlock && analysisId) {
    try {
      const analysis = await AnalysisStorage.findById(analysisId);
      lastBlock = analysis?.metadata?.blockRange?.end || analysis?.results?.target?.summary?.blockRange?.end || null;
      if (lastBlock) {
        await LivePollStorage.save(userId, { active: true, contractAddress, chain, analysisId, lastBlock });
        console.log(`✅ Recovered lastBlock ${lastBlock} from analysis ${analysisId}`);
      }
    } catch (e) { /* ignore */ }
  }

  if (!lastBlock) {
    console.warn(`⚠️ resumeLivePoll: no lastBlock for ${contractAddress}, skipping`);
    return;
  }

  const rpcUrls = getRpcUrls(chain);
  let rpcClient;
  try {
    if (chain.toLowerCase() === 'starknet') {
      const { StarknetRpcClient } = await import('../../services/StarknetRpcClient.js');
      rpcClient = new StarknetRpcClient(rpcUrls);
    } else {
      const { EthereumRpcClient } = await import('../../services/EthereumRpcClient.js');
      rpcClient = new EthereumRpcClient(rpcUrls);
    }
  } catch (err) {
    console.warn(`⚠️ Resume live poll: RPC init failed for ${contractAddress}: ${err.message}`);
    return;
  }

  const livePoll = async () => {
    try {
      const latestBlock = await rpcClient.getBlockNumber();
      if (latestBlock <= lastBlock) return;

      let newTxs = [];

      if (chain.toLowerCase() === 'starknet') {
        try {
          const result = await rpcClient.getTransactionsByAddress(contractAddress, lastBlock + 1, latestBlock);
          newTxs = (result?.transactions || []).slice(0, 50).map(tx => ({
            hash: tx.hash, from: tx.from, to: tx.to || contractAddress,
            value: '0', gasUsed: tx.gasUsed || '0', gasPrice: '0',
            blockNumber: tx.blockNumber || 0, blockTimestamp: tx.blockTimestamp || null,
            status: tx.status, input: tx.input || '0x', chain: 'starknet',
          }));
        } catch (e) {
          console.warn(`   ⚠️ Starknet resume poll failed: ${e.message}`);
        }
      } else {
        const logs = await rpcClient._makeRpcCall('eth_getLogs', [{
          fromBlock: '0x' + (lastBlock + 1).toString(16),
          toBlock:   '0x' + latestBlock.toString(16),
          address:   contractAddress,
        }]);

        const hashes = [...new Set((Array.isArray(logs) ? logs : []).map(l => l.transactionHash).filter(Boolean))].slice(0, 50);
        for (const txHash of hashes) {
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
      }

      if (newTxs.length > 0) {
          const current = await AnalysisStorage.findById(analysisId);
          const allTxs = [...(current?.results?.target?.transactions || []), ...newTxs];
          const updatedMetrics = calculateMetrics(allTxs);

          await AnalysisStorage.update(analysisId, {
            results: {
              target: {
                ...current?.results?.target,
                metrics: updatedMetrics,
                transactions: allTxs,
                summary: { ...current?.results?.target?.summary, totalTransactions: allTxs.length, uniqueUsers: updatedMetrics.uniqueUsers, blockRange: { start: current?.results?.target?.summary?.blockRange?.start, end: latestBlock }, lastLiveUpdate: new Date().toISOString() },
              },
            },
            metadata: { ...current?.metadata, lastLiveBlock: latestBlock, lastLiveUpdate: new Date().toISOString() },
          });

          await MetricsStorage.save(userId, {
            contractAddress, chain, analysisId, ...updatedMetrics,
            blockRange: { start: current?.results?.target?.summary?.blockRange?.start, end: latestBlock },
            lastLiveUpdate: new Date().toISOString(),
          });

          await extractAndStoreFunctionSignatures(contractAddress, chain, newTxs);
          console.log(`   ✅ Resumed live: +${newTxs.length} txs for user ${userId}`);
        }

      lastBlock = latestBlock;
      await LivePollStorage.save(userId, { active: true, contractAddress, chain, analysisId, lastBlock });
    } catch (err) {
      console.info(`   ℹ️ Resumed live poll error for ${userId}: ${err.message}`);
    }
  };

  const interval = setInterval(livePoll, LIVE_POLL_MS);
  process.once('SIGTERM', () => clearInterval(interval));
  process.once('SIGINT',  () => clearInterval(interval));
}
