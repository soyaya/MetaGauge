/**
 * MetricsCalculator
 * Calculates LTV, RPAW, Revenue Concentration, and Reactivated wallets.
 */

const DAY_MS = 86400 * 1000;

/**
 * LTV = sum of gas fees paid + total ETH/token value sent to contract by wallet
 * @param {Object} wallet - { totalValue, totalGasSpent }
 */
export function calculateLTV(wallet) {
  const value = parseFloat(wallet.totalValue || 0);
  const gas = parseFloat(wallet.totalGasSpent || 0);
  return value + gas;
}

/**
 * RPAW = total contract revenue in period / count of active wallets in that period
 * @param {Object[]} users
 * @param {number} periodDays
 */
export function calculateRPAW(users = [], periodDays = 30) {
  const cutoff = Date.now() - periodDays * DAY_MS;
  const activeWallets = users.filter(w => w.lastSeen && new Date(w.lastSeen).getTime() >= cutoff);
  if (!activeWallets.length) return 0;

  const totalRevenue = activeWallets.reduce((sum, w) => sum + calculateLTV(w), 0);
  return totalRevenue / activeWallets.length;
}

/**
 * Revenue Concentration = % of total revenue from top 10 wallets
 * @param {Object[]} users
 */
export function calculateRevenueConcentration(users = []) {
  if (!users.length) return 0;
  const sorted = [...users].sort((a, b) => calculateLTV(b) - calculateLTV(a));
  const top10Revenue = sorted.slice(0, 10).reduce((sum, w) => sum + calculateLTV(w), 0);
  const totalRevenue = sorted.reduce((sum, w) => sum + calculateLTV(w), 0);
  if (!totalRevenue) return 0;
  return (top10Revenue / totalRevenue) * 100;
}

/**
 * Reactivated wallets: previously churned (>30d gap), now active again
 * @param {Object[]} users
 * @param {Object[]} transactions
 */
export function findReactivatedWallets(users = [], transactions = []) {
  const now = Date.now();
  const thirtyDays = 30 * DAY_MS;

  // Build per-wallet sorted tx timestamps
  const txByWallet = {};
  for (const tx of transactions) {
    if (!tx.from) continue;
    if (!txByWallet[tx.from]) txByWallet[tx.from] = [];
    txByWallet[tx.from].push((tx.blockTimestamp || 0) * 1000);
  }

  const reactivated = [];
  for (const wallet of users) {
    const timestamps = (txByWallet[wallet.address] || []).sort((a, b) => a - b);
    if (timestamps.length < 2) continue;

    // Find the largest gap between consecutive txs
    let maxGap = 0;
    let reactivationTime = null;
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      if (gap > maxGap) {
        maxGap = gap;
        reactivationTime = timestamps[i];
      }
    }

    // Was churned (gap > 30d) and came back (last tx within 30d)
    const lastTs = timestamps[timestamps.length - 1];
    if (maxGap > thirtyDays && (now - lastTs) <= thirtyDays) {
      reactivated.push({
        address: wallet.address,
        reactivatedAt: new Date(reactivationTime).toISOString(),
        gapDays: Math.round(maxGap / DAY_MS)
      });
    }
  }
  return reactivated;
}

/**
 * Full metrics summary for a contract
 */
export function calculateAll(users = [], transactions = [], periodDays = 30) {
  const ltvByWallet = Object.fromEntries(users.map(w => [w.address, calculateLTV(w)]));
  return {
    rpaw: calculateRPAW(users, periodDays),
    revenueConcentration: calculateRevenueConcentration(users),
    reactivated: findReactivatedWallets(users, transactions),
    ltvByWallet
  };
}
