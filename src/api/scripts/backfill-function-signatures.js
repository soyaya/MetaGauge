/**
 * Backfill function signatures from existing analyses
 * Run once to populate function-analytics storage for existing users
 */

import { AnalysisStorage } from '../database/index.js';
import { FunctionAnalyticsStorage } from '../../services/FunctionAnalyticsStorage.js';

async function backfill() {
  console.log('🔄 Backfilling function signatures from existing analyses...');
  const storage = new FunctionAnalyticsStorage();
  const analyses = await AnalysisStorage.findAll();
  let total = 0;

  for (const analysis of analyses) {
    if (analysis.status !== 'completed') continue;
    const txs = analysis.results?.target?.transactions || [];
    if (!txs.length) continue;

    const contractAddress = analysis.results?.target?.contract?.address;
    const chain = analysis.results?.target?.contract?.chain;
    if (!contractAddress || !chain) continue;

    const interactions = txs
      .filter(tx => tx.input && tx.input.length >= 10 && tx.input !== '0x')
      .map(tx => ({
        signature:       tx.input.slice(0, 10),
        walletAddress:   tx.from,
        transactionHash: tx.hash,
        blockNumber:     tx.blockNumber,
        timestamp:       tx.blockTimestamp
          ? new Date(tx.blockTimestamp * 1000).toISOString()
          : new Date().toISOString(),
        gasUsed: tx.gasUsed ? parseInt(tx.gasUsed, 16) : 0,
        status:  tx.status,
      }));

    if (!interactions.length) continue;

    const existing = await storage.getInteractions(contractAddress, chain);
    const existingHashes = new Set(existing.map(i => i.transactionHash));
    const newOnes = interactions.filter(i => !existingHashes.has(i.transactionHash));

    if (newOnes.length > 0) {
      await storage.saveInteractions(contractAddress, chain, [...existing, ...newOnes]);
      total += newOnes.length;
      console.log(`  ✅ ${contractAddress} (${chain}): +${newOnes.length} interactions`);
    }
  }

  console.log(`✅ Backfill complete: ${total} interactions stored`);
}

backfill().catch(console.error);
