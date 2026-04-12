/**
 * FunnelService
 * User-defined funnel tracking and feature adoption rates.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const FUNNELS_FILE = join(DATA_DIR, 'funnels.json');
const MAPPINGS_FILE = join(DATA_DIR, 'function_mappings.json');

function readJson(file) {
  if (!existsSync(file)) return [];
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return []; }
}

function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// --- Function Mappings ---

export function getFunctionMappings(contractId) {
  return readJson(MAPPINGS_FILE).filter(m => m.contractId === contractId);
}

export function saveFunctionMapping(contractId, signature, displayName) {
  const all = readJson(MAPPINGS_FILE);
  const idx = all.findIndex(m => m.contractId === contractId && m.signature === signature);
  const entry = { contractId, signature, displayName, updatedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = entry; else all.push(entry);
  writeJson(MAPPINGS_FILE, all);
  return entry;
}

// --- Funnels ---

export function getFunnels(contractId) {
  return readJson(FUNNELS_FILE).filter(f => f.contractId === contractId);
}

export function saveFunnel(contractId, name, steps) {
  const all = readJson(FUNNELS_FILE);
  const funnel = {
    id: `${contractId}-${Date.now()}`,
    contractId,
    name,
    steps, // [{ order, signature, name }]
    createdAt: new Date().toISOString()
  };
  all.push(funnel);
  writeJson(FUNNELS_FILE, all);
  return funnel;
}

export function getFunnel(funnelId) {
  return readJson(FUNNELS_FILE).find(f => f.id === funnelId) || null;
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
