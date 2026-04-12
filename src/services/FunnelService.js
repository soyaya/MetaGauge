/**
 * FunnelService
 * User-defined funnel tracking and feature adoption rates.
 */

import { FunnelStorage } from '../api/database/index.js';

// --- Function Mappings ---

export async function getFunctionMappings(contractId) {
  return FunnelStorage.getFunctionMappings(contractId);
}

export async function saveFunctionMapping(contractId, signature, displayName) {
  return FunnelStorage.saveFunctionMapping(contractId, signature, displayName);
}

// --- Funnels ---

export async function getFunnels(contractId) {
  return FunnelStorage.getFunnels(contractId);
}

export async function saveFunnel(contractId, name, steps) {
  return FunnelStorage.saveFunnel(contractId, name, steps);
}

export async function getFunnel(funnelId) {
  return FunnelStorage.getFunnel(funnelId);
}

/**
 * Calculate funnel conversion from transactions.
 * A wallet completes a step if it called that function at any point (non-linear ok).
 */
export function calculateConversion(funnel, transactions = []) {
  const steps = funnel.steps || [];
  if (!steps.length) return { steps: [], conversion_rate: 0 };

  // Build per-wallet set of method IDs called
  const walletMethods = {};
  for (const tx of transactions) {
    if (!tx.from) continue;
    if (!walletMethods[tx.from]) walletMethods[tx.from] = new Set();
    const methodId = tx.input?.slice(0, 10) || tx.methodId || '';
    if (methodId) walletMethods[tx.from].add(methodId);
    if (tx.functionSignature) walletMethods[tx.from].add(tx.functionSignature);
  }

  const wallets = Object.keys(walletMethods);
  const total = wallets.length;

  const stepResults = steps.map((step, i) => {
    const sig = step.signature;
    const methodId = sig?.slice(0, 10) || sig;
    const entered = wallets.filter(w => walletMethods[w].has(sig) || walletMethods[w].has(methodId)).length;
    return { order: i + 1, name: step.name || sig, signature: sig, entered, conversion: total ? +(entered / total * 100).toFixed(1) : 0 };
  });

  // Overall: wallets that completed ALL steps
  const completed = wallets.filter(w =>
    steps.every(step => {
      const sig = step.signature;
      const methodId = sig?.slice(0, 10) || sig;
      return walletMethods[w].has(sig) || walletMethods[w].has(methodId);
    })
  ).length;

  return {
    steps: stepResults,
    total_wallets: total,
    completed,
    conversion_rate: total ? +(completed / total * 100).toFixed(1) : 0
  };
}

// --- Feature Adoption ---

/**
 * % of active wallets that called each function in the last 30 days.
 */
export function calculateFeatureAdoption(users = [], transactions = []) {
  const cutoff = Date.now() / 1000 - 30 * 86400;
  const recentTxs = transactions.filter(tx => (tx.blockTimestamp || 0) >= cutoff);

  const activeWallets = new Set(recentTxs.map(tx => tx.from).filter(Boolean));
  const total = activeWallets.size;
  if (!total) return [];

  // Count unique wallets per method
  const methodWallets = {};
  for (const tx of recentTxs) {
    if (!tx.from) continue;
    const key = tx.functionSignature || tx.input?.slice(0, 10) || tx.methodId || 'unknown';
    if (!methodWallets[key]) methodWallets[key] = new Set();
    methodWallets[key].add(tx.from);
  }

  return Object.entries(methodWallets)
    .map(([signature, wallets]) => ({
      signature,
      adopting_wallets: wallets.size,
      adoption_rate: +(wallets.size / total * 100).toFixed(1)
    }))
    .sort((a, b) => b.adopting_wallets - a.adopting_wallets);
}
