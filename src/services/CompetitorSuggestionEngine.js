/**
 * CompetitorSuggestionEngine
 * Suggests up to 5 competitors based on category and wallet overlap.
 */

import { findAll as findAllCompetitors } from '../api/database/CompetitorStorage.js';
import { getAllResults } from './CompetitorIndexer.js';

/**
 * Suggest competitors for a contract.
 * @param {Object} contract - { id, targetContract: { category, chain } }
 * @param {Object[]} allContracts - all indexed contracts
 * @param {Object[]} userWallets - wallet addresses active on user's contract
 */
export function suggest(contract, allContracts = [], userWallets = []) {
  const userCategory = contract.targetContract?.category || '';
  const userChain = contract.targetContract?.chain || '';
  const userWalletSet = new Set(userWallets.map(w => (w.address || w).toLowerCase()));
  const existingIds = new Set(findAllCompetitors(contract.id).map(c => c.address.toLowerCase()));

  const results = getAllResults();
  const candidates = [];

  for (const other of allContracts) {
    if (other.id === contract.id) continue;
    const addr = other.targetContract?.address?.toLowerCase();
    if (!addr || existingIds.has(addr)) continue;

    let score = 0;
    // Same category
    if (userCategory && other.targetContract?.category === userCategory) score += 40;
    // Same chain
    if (userChain && other.targetContract?.chain === userChain) score += 20;
    // Wallet overlap
    const otherResult = Object.values(results).find(r => r.address?.toLowerCase() === addr);
    if (otherResult?.wallets) {
      const overlap = otherResult.wallets.filter(w => userWalletSet.has(w.toLowerCase())).length;
      score += Math.min(40, overlap * 2);
    }

    if (score > 0) candidates.push({ address: addr, chain: other.targetContract?.chain, name: other.name, score });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}
