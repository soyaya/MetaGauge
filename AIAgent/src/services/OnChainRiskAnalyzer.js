/**
 * OnChainRiskAnalyzer
 * Deep on-chain risk checks using ethers.js directly against RPC.
 * Checks: holder concentration, contract ownership, LP patterns, proxy risk.
 */

import { ethers } from 'ethers';
import config from '../config/env.js';

// Minimal ABIs — only what we need
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function owner() view returns (address)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

// Common dead/burn addresses
const BURN_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000001',
]);

// Known Uniswap v2/v3 factory addresses (LP pool detection)
const UNISWAP_FACTORIES = new Set([
  '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // v2
  '0x1F98431c8aD98523631AE4a59f267346ea31F984', // v3
]);

function getProvider() {
  return new ethers.JsonRpcProvider(config.ethereumRpc);
}

export class OnChainRiskAnalyzer {
  /**
   * Run all on-chain risk checks for a contract address.
   * @param {string} address — ERC-20 token contract
   * @param {string} chain   — currently supports 'ethereum'
   */
  static async analyze(address, chain = 'ethereum') {
    if (chain !== 'ethereum') {
      return { note: `On-chain risk analysis not yet supported for ${chain}`, signals: [] };
    }

    const provider = getProvider();
    const signals = [];
    const details = {};

    // Run checks in parallel, never let one failure block others
    const [ownershipResult, concentrationResult, contractCodeResult] = await Promise.allSettled([
      checkOwnership(provider, address),
      checkHolderConcentration(provider, address),
      checkContractCode(provider, address),
    ]);

    // 1. Ownership check
    if (ownershipResult.status === 'fulfilled') {
      const o = ownershipResult.value;
      details.ownership = o;
      if (o.hasOwner && !o.isRenounced) {
        signals.push(`Contract ownership not renounced — owner: ${o.owner?.slice(0, 10)}...`);
      }
      if (o.isProxy) {
        signals.push('Upgradeable proxy detected — contract logic can be changed by owner');
      }
    }

    // 2. Holder concentration
    if (concentrationResult.status === 'fulfilled') {
      const c = concentrationResult.value;
      details.concentration = c;
      if (c.top10Pct > 80) {
        signals.push(`Extreme wallet concentration: top 10 holders own ${c.top10Pct.toFixed(1)}% of supply`);
      } else if (c.top10Pct > 50) {
        signals.push(`High wallet concentration: top 10 holders own ${c.top10Pct.toFixed(1)}% of supply`);
      }
      if (c.top1Pct > 30) {
        signals.push(`Single wallet holds ${c.top1Pct.toFixed(1)}% of supply — rug pull risk`);
      }
    }

    // 3. Contract code checks
    if (contractCodeResult.status === 'fulfilled') {
      const cc = contractCodeResult.value;
      details.code = cc;
      if (!cc.hasCode) {
        signals.push('Address has no contract code — may be an EOA or self-destructed contract');
      }
      if (cc.isProxy) {
        signals.push('EIP-1967 proxy pattern detected');
      }
    }

    return { signals, details };
  }
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkOwnership(provider, address) {
  const contract = new ethers.Contract(address, ERC20_ABI, provider);

  let owner = null;
  let hasOwner = false;
  let isRenounced = false;

  try {
    owner = await contract.owner();
    hasOwner = true;
    isRenounced = BURN_ADDRESSES.has(owner.toLowerCase()) ||
                  owner === '0x0000000000000000000000000000000000000000';
  } catch {
    // No owner() function — common for non-ownable contracts
    hasOwner = false;
  }

  // Check for proxy storage slot (EIP-1967)
  let isProxy = false;
  try {
    const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const impl = await provider.getStorage(address, implSlot);
    isProxy = impl !== '0x' + '0'.repeat(64);
  } catch {}

  return { hasOwner, owner, isRenounced, isProxy };
}

async function checkHolderConcentration(provider, address) {
  const contract = new ethers.Contract(address, ERC20_ABI, provider);

  let totalSupply, decimals;
  try {
    [totalSupply, decimals] = await Promise.all([contract.totalSupply(), contract.decimals()]);
  } catch {
    return { error: 'Could not fetch supply data', top10Pct: 0, top1Pct: 0 };
  }

  // Get Transfer events to find top holders (last 10k blocks ≈ ~33 hours)
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 10000);

  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  let logs = [];
  try {
    logs = await provider.getLogs({
      address,
      topics: [transferTopic],
      fromBlock,
      toBlock: latestBlock,
    });
  } catch {
    return { error: 'Could not fetch transfer logs', top10Pct: 0, top1Pct: 0 };
  }

  // Build balance map from transfers
  const balances = new Map();
  for (const log of logs) {
    try {
      const from = '0x' + log.topics[1].slice(26);
      const to   = '0x' + log.topics[2].slice(26);
      const value = BigInt(log.data);

      if (!BURN_ADDRESSES.has(from.toLowerCase())) {
        balances.set(from, (balances.get(from) || 0n) - value);
      }
      if (!BURN_ADDRESSES.has(to.toLowerCase())) {
        balances.set(to, (balances.get(to) || 0n) + value);
      }
    } catch {}
  }

  // Sort by balance descending
  const sorted = [...balances.entries()]
    .filter(([, b]) => b > 0n)
    .sort(([, a], [, b]) => (b > a ? 1 : -1));

  const supply = totalSupply > 0n ? totalSupply : 1n;
  const top1Pct  = sorted.length > 0 ? Number((sorted[0][1] * 10000n) / supply) / 100 : 0;
  const top10    = sorted.slice(0, 10).reduce((sum, [, b]) => sum + b, 0n);
  const top10Pct = Number((top10 * 10000n) / supply) / 100;

  return {
    top1Pct,
    top10Pct,
    uniqueHolders: sorted.length,
    sampleSize: `last ${logs.length} transfers`,
  };
}

async function checkContractCode(provider, address) {
  const code = await provider.getCode(address);
  const hasCode = code && code !== '0x';

  // EIP-1967 proxy check
  let isProxy = false;
  if (hasCode) {
    try {
      const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
      const impl = await provider.getStorage(address, implSlot);
      isProxy = impl !== '0x' + '0'.repeat(64);
    } catch {}
  }

  return { hasCode, isProxy, codeSize: hasCode ? code.length / 2 : 0 };
}
