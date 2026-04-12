/**
 * BotDetectionService
 * Evaluates wallets against bot heuristics.
 * Bot-flagged wallets are excluded from retention/LTV by default.
 * Supports manual review mode.
 */

const HEURISTICS = {
  HIGH_FREQUENCY: 'high_frequency',      // >100 txs in any 24h window
  REPETITIVE_INPUT: 'repetitive_input',  // same input >5 times within 60s
  HIGH_FAILURE_RATE: 'high_failure_rate' // failed tx rate > 40%
};

/**
 * Evaluate a single wallet for bot behaviour.
 * @param {Object} wallet - { address, transactions[] }
 * @returns {{ isBot: boolean, heuristics: string[], score: number }}
 */
export function isBot(wallet) {
  const txs = wallet.transactions || [];
  const triggered = [];

  if (_checkHighFrequency(txs)) triggered.push(HEURISTICS.HIGH_FREQUENCY);
  if (_checkRepetitiveInput(txs)) triggered.push(HEURISTICS.REPETITIVE_INPUT);
  if (_checkHighFailureRate(txs)) triggered.push(HEURISTICS.HIGH_FAILURE_RATE);

  return {
    isBot: triggered.length > 0,
    heuristics: triggered,
    score: Math.min(100, triggered.length * 34) // rough 0-100 score
  };
}

/**
 * Evaluate all wallets in a contract analysis.
 * @param {Object[]} users
 * @param {Object[]} transactions
 * @returns {{ bots: Object[], clean: string[] }}
 */
export function evaluateContract(users = [], transactions = []) {
  const txByWallet = {};
  for (const tx of transactions) {
    if (!tx.from) continue;
    if (!txByWallet[tx.from]) txByWallet[tx.from] = [];
    txByWallet[tx.from].push(tx);
  }

  const bots = [];
  const clean = [];

  for (const wallet of users) {
    const result = isBot({ ...wallet, transactions: txByWallet[wallet.address] || [] });
    if (result.isBot) {
      bots.push({ address: wallet.address, heuristics: result.heuristics, score: result.score, status: 'pending_review' });
    } else {
      clean.push(wallet.address);
    }
  }

  return { bots, clean };
}

/**
 * Filter out bot wallets from a user list (for clean retention/LTV calculations).
 * @param {Object[]} users
 * @param {string[]} botAddresses
 */
export function excludeBots(users = [], botAddresses = []) {
  const botSet = new Set(botAddresses);
  return users.filter(w => !botSet.has(w.address));
}

// --- Heuristic implementations ---

function _checkHighFrequency(txs) {
  if (txs.length < 100) return false;
  const sorted = [...txs].sort((a, b) => (a.blockTimestamp || 0) - (b.blockTimestamp || 0));
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].blockTimestamp || 0;
    let count = 0;
    for (let j = i; j < sorted.length && (sorted[j].blockTimestamp || 0) <= start + 86400; j++) count++;
    if (count > 100) return true;
  }
  return false;
}

function _checkRepetitiveInput(txs) {
  if (txs.length < 6) return false;
  const sorted = [...txs].sort((a, b) => (a.blockTimestamp || 0) - (b.blockTimestamp || 0));
  for (let i = 0; i <= sorted.length - 6; i++) {
    const window = sorted.slice(i, i + 6);
    const span = (window[5].blockTimestamp || 0) - (window[0].blockTimestamp || 0);
    if (span <= 60) {
      const inputs = new Set(window.map(tx => tx.input || tx.methodId || ''));
      if (inputs.size === 1) return true;
    }
  }
  return false;
}

function _checkHighFailureRate(txs) {
  if (txs.length < 5) return false;
  const failed = txs.filter(tx => tx.status === false || tx.status === 0).length;
  return failed / txs.length > 0.4;
}

export { HEURISTICS };
