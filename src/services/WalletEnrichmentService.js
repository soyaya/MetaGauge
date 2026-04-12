/**
 * WalletEnrichmentService
 * Fetches on-chain data per wallet: nonce, balance, recent Transfer events.
 * Results cached in DB. Enrichment runs in background.
 */

import { WalletEnrichmentStorage } from '../api/database/index.js';

const CACHE_TTL  = 30 * 60 * 1000;
const BATCH_SIZE = 5;
const BATCH_DELAY = 2000;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BLOCK_LOOKBACK = 2000;

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
  const cache = await WalletEnrichmentStorage.getCache(contractAddress, chain);
  const now   = Date.now();

  const result = {};
  const stale  = [];

  for (const addr of walletAddresses) {
    const entry = cache[addr.toLowerCase()];
    if (entry && (now - new Date(entry.enrichedAt).getTime()) < CACHE_TTL) {
      result[addr] = entry;
    } else {
      stale.push(addr);
      result[addr] = entry || null;
    }
  }

  if (stale.length > 0) {
    enrichInBackground(contractAddress, chain, stale, rpcUrls).catch(() => {});
  }

  return { data: result, staleCount: stale.length, totalCount: walletAddresses.length };
}

async function enrichInBackground(contractAddress, chain, wallets, rpcUrls) {
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

    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      const batch = wallets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async addr => {
        try {
          const data = await enrichWallet(rpc, addr, currentBlock);
          await WalletEnrichmentStorage.saveWallet(contractAddress, chain, addr, data);
        } catch (e) {
          await WalletEnrichmentStorage.saveWallet(contractAddress, chain, addr,
            { address: addr, error: e.message, enrichedAt: new Date().toISOString() });
        }
      }));
      if (i + BATCH_SIZE < wallets.length) await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
    console.log(`✅ Enriched ${wallets.length} wallets for ${contractAddress}`);
  } catch (e) {
    console.warn(`⚠️ Wallet enrichment failed: ${e.message}`);
  }
}
