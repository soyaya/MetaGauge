/**
 * CohortCalculator
 * Groups wallets by first-interaction calendar week.
 * Calculates D1, D7, D30, D90 retention rates.
 */

const DAY_S = 86400;

/**
 * Get ISO week start (Monday) for a timestamp in seconds.
 */
function weekStart(timestampS) {
  const d = new Date(timestampS * 1000);
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Calculate cohort retention from users + transactions.
 * @param {Object[]} users - [{ address, firstSeen }]
 * @param {Object[]} transactions - [{ from, blockTimestamp }]
 * @returns {Object[]} cohorts sorted by cohort_week desc
 */
export function calculateCohorts(users = [], transactions = []) {
  // Build per-wallet sorted timestamps (seconds)
  const txByWallet = {};
  for (const tx of transactions) {
    if (!tx.from || !tx.blockTimestamp) continue;
    if (!txByWallet[tx.from]) txByWallet[tx.from] = [];
    txByWallet[tx.from].push(tx.blockTimestamp);
  }

  // Group wallets by cohort week (week of first interaction)
  const cohortMap = {}; // week -> [{ address, firstTs, allTs[] }]
  for (const wallet of users) {
    const allTs = (txByWallet[wallet.address] || []).sort((a, b) => a - b);
    if (!allTs.length) continue;
    const firstTs = allTs[0];
    const week = weekStart(firstTs);
    if (!cohortMap[week]) cohortMap[week] = [];
    cohortMap[week].push({ address: wallet.address, firstTs, allTs });
  }

  // Calculate retention for each cohort
  const cohorts = [];
  for (const [week, members] of Object.entries(cohortMap)) {
    const size = members.length;
    const retained = (dayOffset) => {
      const lo = dayOffset * DAY_S - DAY_S * 2; // ±2 day window
      const hi = dayOffset * DAY_S + DAY_S * 2;
      return members.filter(m =>
        m.allTs.some(ts => {
          const delta = ts - m.firstTs;
          return delta >= lo && delta <= hi && delta > 0;
        })
      ).length;
    };

    cohorts.push({
      cohort_week: week,
      size,
      d1: retained(1),
      d7: retained(7),
      d30: retained(30),
      d90: retained(90),
      d1_rate: size ? +(retained(1) / size * 100).toFixed(1) : 0,
      d7_rate: size ? +(retained(7) / size * 100).toFixed(1) : 0,
      d30_rate: size ? +(retained(30) / size * 100).toFixed(1) : 0,
      d90_rate: size ? +(retained(90) / size * 100).toFixed(1) : 0,
    });
  }

  return cohorts.sort((a, b) => b.cohort_week.localeCompare(a.cohort_week));
}
