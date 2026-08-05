/**
 * Minimal token USD pricing for ledger valuation.
 *
 * This app has no price-oracle integration anywhere — FinancialDocumentEngine
 * already falls back to a single hardcoded `ethUsd = 2500` constant wherever
 * a price is needed. This module follows that same precedent rather than
 * introducing a new oracle dependency (out of scope for the ledger/
 * classification phase).
 *
 * Unknown tokens return `null` — callers must skip posting a USD ledger
 * entry rather than fabricate a price. Direction/counterparty/classification
 * still gets recorded regardless of pricing.
 */

const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDC.E']);
const NATIVE_SYMBOLS = new Set(['ETH', 'WETH']);

export const NATIVE_USD_FALLBACK = 2500; // matches FinancialDocumentEngine's ethUsd default

/**
 * @param {string} symbol - token symbol, uppercased comparison
 * @returns {number|null} USD price per 1 token unit, or null if unknown
 */
export function priceForToken(symbol) {
  if (!symbol) return null;
  const s = symbol.toUpperCase();
  if (STABLECOIN_SYMBOLS.has(s)) return 1;
  if (NATIVE_SYMBOLS.has(s)) return NATIVE_USD_FALLBACK;
  return null;
}

export default { priceForToken, NATIVE_USD_FALLBACK };
