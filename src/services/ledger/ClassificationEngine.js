/**
 * ClassificationEngine — JS port of classification_engine.py.
 *
 * Interprets a decoded token transfer into a proposed chart-of-accounts
 * code, following the same decision order as the reference implementation
 * and blockchain-data-interpretation-schema.md §3:
 *   1. Internal transfer (both sides company-controlled)  -> INTERNAL, conf 1.0
 *   2. Rule match against contract_registry                -> registry's account code
 *   3. Heuristic match against a recurring, previously-
 *      confirmed counterparty for this company              -> conf 0.85
 *   4. Unresolved default                                    -> conf 0.30, pending
 *
 * Deliberately DB-free (like the Python reference, which takes plain
 * dicts/lists in its constructor) so it stays unit-testable without a
 * database — callers (LedgerIngestionService) load contract_registry /
 * wallet_registry / recurring-pattern data and pass it in as plain data.
 *
 * Out of scope for Phase 1: LLM-assisted classification (reference doc's
 * step 5). Anything below CONFIRM_THRESHOLD is left `pending` for manual
 * confirmation.
 */

export const CONFIRM_THRESHOLD = 0.75;

export class ClassificationEngine {
  /**
   * @param {string[]} companyWallets - addresses the company controls (any case)
   * @param {Map<string, {label:string, protocolType:string, defaultAccountCode:string, confidenceWeight:number}>} contractRegistry
   *   keyed by lowercase address
   * @param {Map<string, string>} recurringPatterns - lowercase counterparty address -> account_code,
   *   built from this company's prior confirmed classifications
   */
  constructor(companyWallets = [], contractRegistry = new Map(), recurringPatterns = new Map()) {
    this.companyWallets = new Set(companyWallets.map((a) => a.toLowerCase()));
    this.contractRegistry = contractRegistry;
    this.recurringPatterns = recurringPatterns;
  }

  /**
   * @param {{from:string, to:string, amount:number, tokenSymbol?:string}} transfer
   * @returns {{proposedAccountCode:string, confidence:number, source:string, rationale:string, status:string}}
   */
  classify(transfer) {
    const frm = (transfer.from || '').toLowerCase();
    const to = (transfer.to || '').toLowerCase();

    // 1. Internal transfer check — moving funds between the company's own wallets
    if (this.companyWallets.has(frm) && this.companyWallets.has(to)) {
      return {
        proposedAccountCode: 'INTERNAL',
        confidence: 1.0,
        source: 'rule',
        rationale: 'Both addresses are company-controlled wallets; not a P&L event.',
        status: 'confirmed',
      };
    }

    const fromIsCompany = this.companyWallets.has(frm);
    const counterparty = fromIsCompany ? to : frm;
    const direction = fromIsCompany ? 'outflow' : 'inflow';

    // 2. Rule-based match against contract registry
    const registryHit = this.contractRegistry.get(counterparty);
    if (registryHit) {
      const accountCode = resolveRegistryAccount(registryHit, direction);
      return {
        proposedAccountCode: accountCode,
        confidence: registryHit.confidenceWeight,
        source: 'rule',
        rationale: `Counterparty matched registry label '${registryHit.label}' (${registryHit.protocolType}).`,
        status: registryHit.confidenceWeight >= CONFIRM_THRESHOLD ? 'confirmed' : 'pending',
      };
    }

    // 3. Heuristic match — recurring counterparty previously classified for this company
    if (this.recurringPatterns.has(counterparty)) {
      return {
        proposedAccountCode: this.recurringPatterns.get(counterparty),
        confidence: 0.85,
        source: 'heuristic',
        rationale: 'Counterparty address matches a previously confirmed recurring pattern.',
        status: 'confirmed',
      };
    }

    // 4. No confident signal — conservative placeholder, requires user confirmation
    const defaultCode = direction === 'inflow' ? '4040' : '6040';
    return {
      proposedAccountCode: defaultCode,
      confidence: 0.30,
      source: 'unresolved',
      rationale:
        'No rule or heuristic match; below confirmation threshold — requires user confirmation before posting.',
      status: 'pending',
    };
  }
}

/**
 * Some protocol types need direction-aware account mapping (e.g. lending
 * pool deposits vs. withdrawals map to different accounts).
 */
function resolveRegistryAccount(registryHit, direction) {
  if (registryHit.protocolType === 'lending') {
    return direction === 'outflow' ? '1130' : '1030'; // moving into vs. out of a position
  }
  if (registryHit.protocolType === 'dex') {
    return '1030'; // asset conversion, not a P&L event
  }
  return registryHit.defaultAccountCode;
}

export default ClassificationEngine;
