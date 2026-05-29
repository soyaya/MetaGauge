/**
 * WalletEnrichmentPipeline
 * Kafka-style pipeline for wallet enrichment with DB-backed queue.
 */

import { WalletEnrichmentStorage, WalletPipelineStorage } from '../api/database/index.js';
import { RpcRequestQueue } from './RpcRequestQueue.js';
import { getRpcUrls } from '../config/env.js';

const CACHE_TTL   = 30 * 60 * 1000;
const BATCH_SIZE  = 3;
const BATCH_DELAY = 3000;
const MAX_RETRIES = 3;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BLOCK_LOOKBACK = 2000;

const rpcQueue = new RpcRequestQueue('free');
const activeConsumers = new Set();

export async function produce(contractAddress, chain, walletAddresses) {
  const cache = await WalletEnrichmentStorage.getCache(contractAddress, chain);
  const q     = await WalletPipelineStorage.readQueue(contractAddress, chain);
  const now   = Date.now();

  const alreadyQueued = new Set([
    ...q.pending.map(j => j.address),
    ...q.processing.map(j => j.address),
  ]);

  let added = 0;
  for (const address of walletAddresses) {
    if (alreadyQueued.has(address)) continue;
    const cached = cache[address.toLowerCase()];
    const fresh  = cached && !cached.error && (now - new Date(cached.enrichedAt).getTime()) < CACHE_TTL;
    if (fresh) continue;
    q.pending.push({ address, contractAddress, chain, retries: 0, enqueuedAt: new Date().toISOString() });
    added++;
  }

  if (added > 0) {
    await WalletPipelineStorage.writeQueue(contractAddress, chain, q);
    console.log(`📬 Pipeline: queued ${added} wallets for ${contractAddress.slice(0,10)}...`);
    consume(contractAddress, chain).catch(() => {});
  }

  return { queued: added, total: walletAddresses.length };
}

export async function consume(contractAddress, chain) {
  const key = `${contractAddress}_${chain}`;
  if (activeConsumers.has(key)) return;
  activeConsumers.add(key);

  try {
    const rpcUrls = getRpcUrls(chain);

    let rpc;
    if (chain.toLowerCase() === 'starknet') {
      const { StarknetRpcClient } = await import('./StarknetRpcClient.js');
      rpc = new StarknetRpcClient(rpcUrls);
    } else {
      const { EthereumRpcClient } = await import('./EthereumRpcClient.js');
      rpc = new EthereumRpcClient(rpcUrls);
    }

    const currentBlock = await rpcQueue.enqueue(() => rpc.getBlockNumber());

    while (true) {
      const q = await WalletPipelineStorage.readQueue(contractAddress, chain);
      if (q.pending.length === 0) break;

      const batch = q.pending.splice(0, BATCH_SIZE);
      q.processing.push(...batch);
      await WalletPipelineStorage.writeQueue(contractAddress, chain, q);

      await Promise.all(batch.map(async job => {
        try {
          const result = await enrichWallet(rpc, job.address, currentBlock);
          await WalletEnrichmentStorage.saveWallet(contractAddress, chain, job.address, result);
          console.log(`  ✅ Enriched ${job.address.slice(0,10)}...`);
        } catch (err) {
          job.retries++;
          job.lastError = err.message;
          const qRetry = await WalletPipelineStorage.readQueue(contractAddress, chain);
          if (job.retries < MAX_RETRIES) {
            qRetry.pending.unshift(job);
            console.warn(`  ⚠️ Retry ${job.retries}/${MAX_RETRIES} for ${job.address.slice(0,10)}...`);
          } else {
            qRetry.dlq.push({ ...job, failedAt: new Date().toISOString() });
            console.error(`  ❌ DLQ: ${job.address.slice(0,10)}... after ${MAX_RETRIES} retries`);
          }
          await WalletPipelineStorage.writeQueue(contractAddress, chain, qRetry);
        }
      }));

      const qFinal = await WalletPipelineStorage.readQueue(contractAddress, chain);
      const batchAddrs = new Set(batch.map(j => j.address));
      qFinal.processing = qFinal.processing.filter(j => !batchAddrs.has(j.address));
      await WalletPipelineStorage.writeQueue(contractAddress, chain, qFinal);

      if (q.pending.length > 0) await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  } finally {
    activeConsumers.delete(key);
  }
}

async function enrichWallet(rpc, walletAddr, currentBlock) {
  const padded    = '0x000000000000000000000000' + walletAddr.slice(2).toLowerCase();
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

export async function getPipelineStatus(contractAddress, chain) {
  const q     = await WalletPipelineStorage.readQueue(contractAddress, chain);
  const cache = await WalletEnrichmentStorage.getCache(contractAddress, chain);
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

export async function getEnrichmentResults(contractAddress, chain, walletAddresses) {
  const cache = await WalletEnrichmentStorage.getCache(contractAddress, chain);
  const data  = {};
  for (const addr of walletAddresses) {
    data[addr] = cache[addr.toLowerCase()] || null;
  }
  return data;
}
