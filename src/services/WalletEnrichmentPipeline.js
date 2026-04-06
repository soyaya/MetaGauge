/**
 * WalletEnrichmentPipeline
 *
 * Kafka-style pipeline for wallet enrichment:
 *   Producer  → writes jobs to a persistent queue (JSON file)
 *   Consumer  → reads jobs, processes in order, writes results
 *   Dead-letter queue → failed jobs after MAX_RETRIES
 *
 * Guarantees:
 *   - Ordered processing (FIFO per contract)
 *   - At-least-once delivery (retry on failure)
 *   - Backpressure (BATCH_SIZE + BATCH_DELAY)
 *   - Persistence (survives server restart)
 *   - Idempotent (skip already-fresh entries)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { RpcRequestQueue } from './RpcRequestQueue.js';

const QUEUE_DIR   = './data/wallet-pipeline';
const CACHE_DIR   = './data/wallet-enrichment';
const CACHE_TTL   = 30 * 60 * 1000;  // 30 min
const BATCH_SIZE  = 3;                // wallets per batch (conservative for public RPCs)
const BATCH_DELAY = 3000;             // ms between batches
const MAX_RETRIES = 3;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BLOCK_LOOKBACK = 2000;

const rpcQueue = new RpcRequestQueue('free'); // rate-limited RPC calls

async function ensureDirs() {
  await mkdir(QUEUE_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
}

// ── Queue file helpers ────────────────────────────────────────────────────────

function queueFile(contractAddress, chain) {
  return join(QUEUE_DIR, `${contractAddress}_${chain}_queue.json`);
}

function cacheFile(contractAddress, chain) {
  return join(CACHE_DIR, `${contractAddress}_${chain}.json`);
}

async function readQueue(contractAddress, chain) {
  try {
    return JSON.parse(await readFile(queueFile(contractAddress, chain), 'utf8'));
  } catch { return { pending: [], processing: [], dlq: [] }; }
}

async function writeQueue(contractAddress, chain, q) {
  await writeFile(queueFile(contractAddress, chain), JSON.stringify(q, null, 2), 'utf8');
}

async function readCache(contractAddress, chain) {
  try {
    return JSON.parse(await readFile(cacheFile(contractAddress, chain), 'utf8'));
  } catch { return {}; }
}

async function writeCache(contractAddress, chain, data) {
  await writeFile(cacheFile(contractAddress, chain), JSON.stringify(data, null, 2), 'utf8');
}

// ── Producer: enqueue wallets that need enrichment ────────────────────────────

export async function produce(contractAddress, chain, walletAddresses) {
  await ensureDirs();
  const cache = await readCache(contractAddress, chain);
  const q     = await readQueue(contractAddress, chain);
  const now   = Date.now();

  const alreadyQueued = new Set([
    ...q.pending.map(j => j.address),
    ...q.processing.map(j => j.address),
  ]);

  let added = 0;
  for (const address of walletAddresses) {
    if (alreadyQueued.has(address)) continue;
    const cached = cache[address];
    const fresh  = cached && !cached.error && (now - new Date(cached.enrichedAt).getTime()) < CACHE_TTL;
    if (fresh) continue;

    q.pending.push({ address, contractAddress, chain, retries: 0, enqueuedAt: new Date().toISOString() });
    added++;
  }

  if (added > 0) {
    await writeQueue(contractAddress, chain, q);
    console.log(`📬 Pipeline: queued ${added} wallets for ${contractAddress.slice(0,10)}...`);
    // Kick off consumer in background
    consume(contractAddress, chain).catch(() => {});
  }

  return { queued: added, total: walletAddresses.length };
}

// ── Consumer: process queue in order ─────────────────────────────────────────

const activeConsumers = new Set();

export async function consume(contractAddress, chain) {
  const key = `${contractAddress}_${chain}`;
  if (activeConsumers.has(key)) return; // already running
  activeConsumers.add(key);

  try {
    let rpc;
    const rpcUrls = chain.toLowerCase() === 'starknet'
      ? [process.env.STARKNET_RPC_URL1, process.env.STARKNET_RPC_URL2].filter(Boolean)
      : [process.env.ETHEREUM_RPC_URL1, process.env.ETHEREUM_RPC_URL2, process.env.ETHEREUM_RPC_URL3].filter(Boolean);

    if (chain.toLowerCase() === 'starknet') {
      const { StarknetRpcClient } = await import('./StarknetRpcClient.js');
      rpc = new StarknetRpcClient(rpcUrls);
    } else {
      const { EthereumRpcClient } = await import('./EthereumRpcClient.js');
      rpc = new EthereumRpcClient(rpcUrls);
    }

    let currentBlock = await rpcQueue.enqueue(() => rpc.getBlockNumber());

    while (true) {
      const q = await readQueue(contractAddress, chain);
      if (q.pending.length === 0) break;

      // Take a batch from pending → processing
      const batch = q.pending.splice(0, BATCH_SIZE);
      q.processing.push(...batch);
      await writeQueue(contractAddress, chain, q);

      const cache = await readCache(contractAddress, chain);

      // Process batch in parallel (within rate limits)
      await Promise.all(batch.map(async job => {
        try {
          const result = await enrichWallet(rpc, job.address, currentBlock);
          cache[job.address] = result;
          console.log(`  ✅ Enriched ${job.address.slice(0,10)}... (nonce: ${result.totalTxsEver})`);
        } catch (err) {
          job.retries++;
          job.lastError = err.message;
          if (job.retries < MAX_RETRIES) {
            // Re-queue for retry
            const qRetry = await readQueue(contractAddress, chain);
            qRetry.pending.unshift(job); // front of queue
            await writeQueue(contractAddress, chain, qRetry);
            console.warn(`  ⚠️ Retry ${job.retries}/${MAX_RETRIES} for ${job.address.slice(0,10)}...`);
          } else {
            // Dead-letter queue
            const qDlq = await readQueue(contractAddress, chain);
            qDlq.dlq.push({ ...job, failedAt: new Date().toISOString() });
            await writeQueue(contractAddress, chain, qDlq);
            console.error(`  ❌ DLQ: ${job.address.slice(0,10)}... after ${MAX_RETRIES} retries`);
          }
        }
      }));

      // Remove processed jobs from processing list
      const qFinal = await readQueue(contractAddress, chain);
      const batchAddrs = new Set(batch.map(j => j.address));
      qFinal.processing = qFinal.processing.filter(j => !batchAddrs.has(j.address));
      await writeQueue(contractAddress, chain, qFinal);
      await writeCache(contractAddress, chain, cache);

      if (q.pending.length > 0) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }
  } finally {
    activeConsumers.delete(key);
  }
}

// ── Enrichment: fetch on-chain data for one wallet ────────────────────────────

async function enrichWallet(rpc, walletAddr, currentBlock) {
  const padded   = '0x000000000000000000000000' + walletAddr.slice(2).toLowerCase();
  const fromBlock = '0x' + Math.max(0, currentBlock - BLOCK_LOOKBACK).toString(16);

  const [nonce, balance, logsOut, logsIn] = await Promise.all([
    rpcQueue.enqueue(() => rpc._makeRpcCall('eth_getTransactionCount', [walletAddr, 'latest'])),
    rpcQueue.enqueue(() => rpc._makeRpcCall('eth_getBalance',          [walletAddr, 'latest'])),
    rpcQueue.enqueue(() => rpc._makeRpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, padded] }])),
    rpcQueue.enqueue(() => rpc._makeRpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, null, padded] }])),
  ]);

  const outLogs = logsOut || [];
  const inLogs  = logsIn  || [];

  return {
    address:           walletAddr,
    totalTxsEver:      parseInt(nonce, 16),
    ethBalance:        Number((parseInt(balance, 16) / 1e18).toFixed(6)),
    recentTransferOut: outLogs.length,
    recentTransferIn:  inLogs.length,
    contractsUsed:     [...new Set([...outLogs, ...inLogs].map(l => l.address))],
    enrichedAt:        new Date().toISOString(),
  };
}

// ── Status: get pipeline state ────────────────────────────────────────────────

export async function getPipelineStatus(contractAddress, chain) {
  const q     = await readQueue(contractAddress, chain);
  const cache = await readCache(contractAddress, chain);
  const now   = Date.now();
  const fresh = Object.values(cache).filter(e => e && !e.error && (now - new Date(e.enrichedAt).getTime()) < CACHE_TTL).length;
  return {
    pending:    q.pending.length,
    processing: q.processing.length,
    dlq:        q.dlq.length,
    cached:     Object.keys(cache).length,
    fresh,
    isRunning:  activeConsumers.has(`${contractAddress}_${chain}`),
  };
}

// ── Read enrichment results (for API response) ────────────────────────────────

export async function getEnrichmentResults(contractAddress, chain, walletAddresses) {
  const cache = await readCache(contractAddress, chain);
  const data  = {};
  for (const addr of walletAddresses) {
    data[addr] = cache[addr] || null;
  }
  return data;
}
