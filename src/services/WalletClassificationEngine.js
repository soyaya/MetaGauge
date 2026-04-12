/**
 * WalletClassificationEngine
 * Classifies wallets into segments based on on-chain behavior.
 * Priority order: Bot → High-risk → Whale → New → Active → Churned
 */

const SEGMENTS = { BOT: 'Bot', HIGH_RISK: 'High-risk', WHALE: 'Whale', NEW: 'New', ACTIVE: 'Active', CHURNED: 'Churned' };
const NOW_MS = () => Date.now();
const DAY_MS = 86400 * 1000;

/**
 * Classify a single wallet from its history array of transactions.
 * @param {Object} wallet - { address, transactionCount, totalValue, totalGasSpent, firstSeen, lastSeen, transactions[] }
 * @param {Object[]} allWallets - full wallet list (needed for whale threshold)
 * @returns {string} segment
 */
export function classifyWallet(wallet, allWallets = []) {
  const now = NOW_MS();
  const lastSeen = wallet.lastSeen ? new Date(wallet.lastSeen).getTime() : 0;
  const firstSeen = wallet.firstSeen ? new Date(wallet.firstSeen).getTime() : 0;
  const txs = wallet.transactions || [];

  // Bot: >100 txs in any 24h window OR same input repeated >5 times within 60s
  if (_isBotByFrequency(txs) || _isBotByRepetition(txs)) return SEGMENTS.BOT;

  // High-risk: failed tx rate > 40%
  if (txs.length > 0) {
    const failed = txs.filter(tx => tx.status === false || tx.status === 0).length;
    if (failed / txs.length > 0.4) return SEGMENTS.HIGH_RISK;
  }

  // Whale: top 10 by total volume
  if (allWallets.length >= 10) {
    const sorted = [...allWallets].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
    const top10 = new Set(sorted.slice(0, 10).map(w => w.address));
    if (top10.has(wallet.address)) return SEGMENTS.WHALE;
  }

  // New: first interaction within 7 days
  if (firstSeen && (now - firstSeen) <= 7 * DAY_MS) return SEGMENTS.NEW;

  // Active: interacted within 30 days
  if (lastSeen && (now - lastSeen) <= 30 * DAY_MS) return SEGMENTS.ACTIVE;

  // Churned: last interaction > 30 days ago
  return SEGMENTS.CHURNED;
}

/**
 * Classify all wallets from a fullReport.users array.
 * @param {Object[]} users
 * @param {Object[]} transactions - full tx list for bot detection
 * @returns {{ segments: Object, walletMap: Object }}
 */
export function classifyAll(users = [], transactions = []) {
  // Build per-wallet tx map for bot detection
  const txByWallet = {};
  for (const tx of transactions) {
    if (!txByWallet[tx.from]) txByWallet[tx.from] = [];
    txByWallet[tx.from].push(tx);
  }

  const walletMap = {};
  const segments = { Bot: [], 'High-risk': [], Whale: [], New: [], Active: [], Churned: [] };

  const walletsWithTxs = users.map(w => ({ ...w, transactions: txByWallet[w.address] || [] }));

  for (const wallet of walletsWithTxs) {
    const segment = classifyWallet(wallet, walletsWithTxs);
    walletMap[wallet.address] = segment;
    segments[segment].push(wallet.address);
  }

  return {
    segments,
    walletMap,
    counts: Object.fromEntries(Object.entries(segments).map(([k, v]) => [k, v.length]))
  };
}

// --- Bot heuristics ---

function _isBotByFrequency(txs) {
  if (txs.length < 100) return false;
  // Group by 24h windows
  const sorted = [...txs].sort((a, b) => (a.blockTimestamp || 0) - (b.blockTimestamp || 0));
  for (let i = 0; i < sorted.length; i++) {
    const windowStart = sorted[i].blockTimestamp || 0;
    const windowEnd = windowStart + 86400;
    let count = 0;
    for (let j = i; j < sorted.length && (sorted[j].blockTimestamp || 0) <= windowEnd; j++) count++;
    if (count > 100) return true;
  }
  return false;
}

function _isBotByRepetition(txs) {
  if (txs.length < 6) return false;
  const sorted = [...txs].sort((a, b) => (a.blockTimestamp || 0) - (b.blockTimestamp || 0));
  for (let i = 0; i <= sorted.length - 6; i++) {
    const window = sorted.slice(i, i + 6);
    const timeSpan = (window[5].blockTimestamp || 0) - (window[0].blockTimestamp || 0);
    if (timeSpan <= 60) {
      const inputs = new Set(window.map(tx => tx.input || tx.methodId || ''));
      if (inputs.size === 1) return true; // same input 6 times in 60s
    }
  }
  return false;
}

export { SEGMENTS };
