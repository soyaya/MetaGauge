/**
 * WalletEnrichmentService
 * Fetches on-chain data per wallet: nonce, balance, recent Transfer events.
 * Results cached to disk. Enrichment runs in background — callers get
 * whatever is cached immediately and fresh data arrives on next poll.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const CACHE_DIR  = './data/wallet-enrichment';
const CACHE_TTL  = 30 * 60 * 1000; // 30 min
const BATCH_SIZE = 5;               // wallets per batch
const BATCH_DELAY = 2000;           // ms between batches (rate limit)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BLOCK_LOOKBACK = 2000;        // ~6.5 hours of blocks

async function ensureDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

function cacheFile(contractAddress, chain) {
  return join(CACHE_DIR, `${contractAddress}_${chain}.json`);
}

async function readCache(contractAddress, chain) {
  try {
    const raw = await readFile(cacheFile(contractAddress, chain), 'utf8');
    return JSON.parse(raw);
  } catch { return {}; }
}

async function writeCache(contractAddress, chain, data) {
  await ensureDir();
  await writeFile(cacheFile(contractAddress, chain), JSON.stringify(data, null, 2), 'utf8');
}

async function enrichWallet(rpc, walletAddr, currentBlock) {
  const padded = '0x000000000000000000000000' + walletAddr.slice(2).toLowerCase();
  const fromBlock = '0x' + Math.max(0, currentBlock - BLOCK_LOOKBACK).toString(16);

  const [nonce, balance, logsOut, logsIn] = await Promise.allSettled([
    rpc._makeRpcCall('eth_getTransactionCount', [walletAddr, 'latest']),
    rpc._makeRpcCall('eth_getBalance',          [walletAddr, 'latest']),
    rpc._makeRpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, padded] }]),
    rpc._makeRpcCall('eth_getLogs', [{ fromBlock, toBlock: 'latest', topics: [TRANSFER_TOPIC, null, padded] }]),
  ]);

  const totalTxsEver = nonce.status === 'fulfilled' ? parseInt(nonce.value, 16) : null;
  const ethBalance   = balance.status === 'fulfilled' ? Number((parseInt(balance.value, 16) / 1e18).toFixed(6)) : null;

  const outLogs = logsOut.status === 'fulfilled' ? (logsOut.value || []) : [];
  const inLogs  = logsIn.status  === 'fulfilled' ? (logsIn.value  || []) : [];

  const contractsUsed = [...new Set([...outLogs, ...inLogs].map(l => l.address))];

  return {
    address:       walletAddr,
    totalTxsEver,
    ethBalance,
    recentTransferOut: outLogs.length,
    recentTransferIn:  inLogs.length,
    contractsUsed,
    enrichedAt: new Date().toISOString(),
  };
}

/**
 * Get cached enrichment data immediately, trigger background refresh if stale.
 */
export async function getWalletEnrichment(contractAddress, chain, walletAddresses, rpcUrls) {
  await ensureDir();
  const cache = await readCache(contractAddress, chain);
  const now   = Date.now();

  // Return cached data immediately
  const result = {};
  const stale  = [];

  for (const addr of walletAddresses) {
    const entry = cache[addr];
    if (entry && (now - new Date(entry.enrichedAt).getTime()) < CACHE_TTL) {
      result[addr] = entry;
    } else {
      stale.push(addr);
      result[addr] = entry || null; // return stale/null immediately
    }
  }

  // Background enrichment for stale wallets
  if (stale.length > 0) {
    enrichInBackground(contractAddress, chain, stale, rpcUrls, cache).catch(() => {});
  }

  return { data: result, staleCount: stale.length, totalCount: walletAddresses.length };
}

async function enrichInBackground(contractAddress, chain, wallets, rpcUrls, existingCache) {
  try {
    let rpc;
    if (chain.toLowerCase() === 'starknet') {
      const { StarknetRpcClient } = await import('./StarknetRpcClient.js');
      rpc = new StarknetRpcClient(rpcUrls);
    } else {
      const { EthereumRpcClient } = await import('./EthereumRpcClient.js');
      rpc = new EthereumRpcClient(rpcUrls);
    }

    const currentBlock = await rpc.getBlockNumber();
    const cache = { ...existingCache };

    // Process in batches to avoid rate limiting
    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      const batch = wallets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async addr => {
        try {
          cache[addr] = await enrichWallet(rpc, addr, currentBlock);
        } catch (e) {
          // Mark as attempted so we don't retry immediately
          cache[addr] = { address: addr, error: e.message, enrichedAt: new Date().toISOString() };
        }
      }));
      await writeCache(contractAddress, chain, cache);
      if (i + BATCH_SIZE < wallets.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }
    console.log(`✅ Enriched ${wallets.length} wallets for ${contractAddress}`);
  } catch (e) {
    console.warn(`⚠️ Wallet enrichment failed: ${e.message}`);
  }
}
