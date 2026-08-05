/**
 * Resolves ERC-20 `symbol()` / `decimals()` via eth_call, with an in-memory
 * cache (the same token contract repeats constantly within one indexing run).
 *
 * Best-effort: most tokens return a standard ABI-encoded dynamic `string`
 * for symbol(), but some legacy tokens (e.g. MKR) return a fixed `bytes32`
 * instead — both are handled. On any failure, falls back to
 * { symbol: 'UNKNOWN', decimals: 18 } rather than throwing, since a
 * classification/ledger entry is still worth recording even if the token
 * couldn't be identified.
 */

const DECIMALS_SELECTOR = '0x313ce567';
const SYMBOL_SELECTOR   = '0x95d89b41';

const cache = new Map(); // `${chain}:${address}` -> { symbol, decimals }

function decodeUint8(hex) {
  if (!hex || hex === '0x') return 18;
  const n = parseInt(hex.slice(-2), 16);
  return Number.isFinite(n) ? n : 18;
}

function decodeString(hex) {
  if (!hex || hex === '0x') return null;
  const clean = hex.slice(2);
  try {
    // Dynamic ABI string: [offset(32B)][length(32B)][data...]
    const lengthWord = clean.slice(64, 128);
    const length = parseInt(lengthWord, 16);
    if (Number.isFinite(length) && length > 0 && length <= 64) {
      const dataHex = clean.slice(128, 128 + length * 2);
      const bytes = Buffer.from(dataHex, 'hex');
      const str = bytes.toString('utf8').replace(/\0/g, '').trim();
      if (str) return str;
    }
  } catch { /* fall through to bytes32 attempt */ }

  try {
    // Fixed bytes32 fallback (legacy tokens)
    const bytes = Buffer.from(clean.slice(0, 64), 'hex');
    const str = bytes.toString('utf8').replace(/\0/g, '').trim();
    return str || null;
  } catch {
    return null;
  }
}

/**
 * @param {object} rpcClient - the same client used by trigger-indexing.js (`_makeRpcCall`)
 * @param {string} chain
 * @param {string} tokenAddress
 * @returns {Promise<{symbol: string, decimals: number}>}
 */
export async function resolveTokenMetadata(rpcClient, chain, tokenAddress) {
  const key = `${chain}:${tokenAddress.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  let symbol = 'UNKNOWN';
  let decimals = 18;

  try {
    const [decimalsHex, symbolHex] = await Promise.all([
      rpcClient._makeRpcCall('eth_call', [{ to: tokenAddress, data: DECIMALS_SELECTOR }, 'latest']),
      rpcClient._makeRpcCall('eth_call', [{ to: tokenAddress, data: SYMBOL_SELECTOR }, 'latest']),
    ]);
    decimals = decodeUint8(decimalsHex);
    symbol = decodeString(symbolHex) || 'UNKNOWN';
  } catch {
    // Network/RPC failure — keep the UNKNOWN/18 fallback rather than throw,
    // so one bad token lookup doesn't abort the whole ingestion batch.
  }

  const result = { symbol, decimals };
  cache.set(key, result);
  return result;
}

export function _clearCacheForTests() {
  cache.clear();
}

export default { resolveTokenMetadata, _clearCacheForTests };
