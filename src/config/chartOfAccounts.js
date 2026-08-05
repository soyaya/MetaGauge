/**
 * Chart of Accounts — Phase 1 ledger
 *
 * Static for now; no per-company customization need yet (see plan). Codes
 * match classification_engine.py's reference implementation and the worked
 * examples in blockchain-data-interpretation-schema.md §4.
 *
 * `type` drives how FinancialDocumentEngine aggregates ledger_entries:
 *   revenue / cogs / opex  -> income statement lines
 *   asset                  -> balance sheet / not a P&L event
 *   internal                -> excluded entirely (not posted to the ledger)
 */

export const ACCOUNT_CODES = {
  INTERNAL: { label: 'Internal transfer (not a P&L event)', type: 'internal' },

  // Revenue
  '4010': { label: 'Product/Service Revenue',         type: 'revenue' },
  '4020': { label: 'Grant Income',                    type: 'revenue' },
  '4030': { label: 'Protocol/Token Revenue',           type: 'revenue' },
  '4040': { label: 'Other Revenue (unconfirmed)',      type: 'revenue' },

  // Operating expenses
  '6010': { label: 'Salaries & Wages',                 type: 'opex' },
  '6040': { label: 'G&A (unconfirmed)',                type: 'opex' },
  '6060': { label: 'Software & Tools',                 type: 'opex' },

  // Asset positions (not P&L events — balance sheet reclassification only)
  '1030': { label: 'Liquid/short-term crypto assets',  type: 'asset' },
  '1130': { label: 'Lending / long-term DeFi position', type: 'asset' },
};

export function isKnownAccountCode(code) {
  return Object.prototype.hasOwnProperty.call(ACCOUNT_CODES, code);
}

export function accountType(code) {
  return ACCOUNT_CODES[code]?.type || 'unknown';
}

export default ACCOUNT_CODES;
