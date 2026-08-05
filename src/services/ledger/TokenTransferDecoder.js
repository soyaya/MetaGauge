/**
 * Decodes ERC-20 `Transfer(address,address,uint256)` event logs.
 *
 * Fixes a real bug in trigger-indexing.js's event-sourced collection path:
 * it currently hardcodes `to: contract.address` (the token contract itself,
 * not the real recipient) and never reads the transfer amount from
 * `log.data` (`value` is left as `'0x0'`). The raw log is already fetched
 * and kept on the tx object as `events: [log]` — this module decodes it
 * properly rather than re-fetching anything.
 */

export const ERC20_TRANSFER_TOPIC0 =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function topicToAddress(topic) {
  if (!topic || topic.length < 40) return null;
  return '0x' + topic.slice(-40).toLowerCase();
}

/**
 * @param {object} log - a raw eth_getLogs entry: { address, topics, data, logIndex, ... }
 * @returns {{tokenContract:string, from:string, to:string, rawAmount:string, logIndex:number}|null}
 *   rawAmount is the amount in the token's smallest unit (no decimal adjustment) as a decimal string.
 */
export function decodeERC20TransferLog(log) {
  if (!log || !Array.isArray(log.topics) || log.topics.length < 3) return null;
  if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC0) return null;

  const from = topicToAddress(log.topics[1]);
  const to = topicToAddress(log.topics[2]);
  if (!from || !to) return null;

  let rawAmount = '0';
  try {
    rawAmount = BigInt(log.data || '0x0').toString();
  } catch {
    return null; // malformed data — skip rather than guess
  }

  return {
    tokenContract: (log.address || '').toLowerCase(),
    from,
    to,
    rawAmount,
    logIndex: typeof log.logIndex === 'string' ? parseInt(log.logIndex, 16) : (log.logIndex ?? null),
  };
}

/**
 * Decode every ERC-20 Transfer log attached to a collected transaction
 * (trigger-indexing.js stores raw logs on `tx.events`).
 * @param {object} tx - an entry from trigger-indexing.js's `collectedTxs`
 * @returns {Array<ReturnType<typeof decodeERC20TransferLog>>}
 */
export function decodeTransfersFromTx(tx) {
  if (!Array.isArray(tx?.events) || tx.events.length === 0) return [];
  return tx.events.map(decodeERC20TransferLog).filter(Boolean);
}

/**
 * Convert a raw (smallest-unit) amount into a human-readable decimal amount.
 * @param {string} rawAmount - decimal string of the smallest-unit amount
 * @param {number} decimals
 * @returns {number}
 */
export function toHumanAmount(rawAmount, decimals = 18) {
  try {
    const raw = BigInt(rawAmount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    return Number(whole) + Number(frac) / Number(divisor);
  } catch {
    return 0;
  }
}

export default { decodeERC20TransferLog, decodeTransfersFromTx, toHumanAmount, ERC20_TRANSFER_TOPIC0 };
