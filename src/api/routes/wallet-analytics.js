/**
 * Wallet Analytics API
 * GET /api/functions/wallet-analytics?contractAddress=&chain=
 *
 * Computes per-wallet and per-feature analytics from stored transactions.
 * Cross-app comparisons are marked as unavailable (require external indexer).
 */

import express from 'express';
import { FunctionAnalyticsStorage } from '../../services/FunctionAnalyticsStorage.js';
import { AnalysisStorage, UserStorage } from '../database/index.js';

export const walletAnalyticsRouter = express.Router();

const METHOD_NAMES = {
  '0xa9059cbb': 'Transfer',    '0x095ea7b3': 'Approve',
  '0x23b872dd': 'TransferFrom','0x40c10f19': 'Mint',
  '0x42966c68': 'Burn',        '0x2e1a7d4d': 'Withdraw',
  '0xd0e30db0': 'Deposit',     '0x09c5eabe': 'Execute',
  '0x3593564c': 'Execute V2',
};

const hexToNum = v => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.startsWith('0x')) return parseInt(v, 16);
  return Number(v) || 0;
};

const featureLabel = input => {
  if (!input || input === '0x') return 'ETH Transfer';
  const sig = input.slice(0, 10);
  return METHOD_NAMES[sig] || sig;
};

import { produce, getEnrichmentResults, getPipelineStatus } from '../../services/WalletEnrichmentPipeline.js';

walletAnalyticsRouter.get('/', async (req, res) => {
  try {
    const { contractAddress, chain } = req.query;
    if (!contractAddress || !chain) {
      return res.status(400).json({ error: 'contractAddress and chain required' });
    }

    const allAnalyses = await AnalysisStorage.findByUserId(req.user.id);
    const latest = allAnalyses
      .filter(a => a.status === 'completed' &&
        a.results?.target?.contract?.address?.toLowerCase() === contractAddress.toLowerCase())
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))[0];

    const txs = latest?.results?.target?.transactions || [];
    const ETH_PRICE = 2500;

    // ── Per-wallet stats ────────────────────────────────────────────────────
    const walletMap = {};
    txs.forEach(tx => {
      if (!walletMap[tx.from]) {
        walletMap[tx.from] = { txs: [], gasSpentETH: 0, failed: 0, success: 0, valueInWei: BigInt(0), features: new Set() };
      }
      const w = walletMap[tx.from];
      w.txs.push(tx);
      const gasUsed  = hexToNum(tx.gasUsed);
      const gasPrice = hexToNum(tx.gasPrice);
      w.gasSpentETH += gasUsed * gasPrice / 1e18;
      if (tx.status) w.success++; else w.failed++;
      try { w.valueInWei += BigInt(tx.value || '0'); } catch {}
      w.features.add(featureLabel(tx.input));
    });

    const wallets = Object.entries(walletMap).map(([address, w]) => ({
      address,
      txCount:       w.txs.length,
      successTx:     w.success,
      failedTx:      w.failed,
      failedPct:     w.txs.length > 0 ? Number(((w.failed / w.txs.length) * 100).toFixed(1)) : 0,
      gasSpentETH:   Number(w.gasSpentETH.toFixed(6)),
      gasSpentUSD:   Number((w.gasSpentETH * ETH_PRICE).toFixed(4)),
      valueInETH:    Number((Number(w.valueInWei) / 1e18).toFixed(6)),
      features:      Array.from(w.features),
      status:        w.txs.length >= 10 ? 'whale' : w.txs.length >= 2 ? 'active' : 'dormant',
    })).sort((a, b) => b.txCount - a.txCount);

    // ── Feature analytics ───────────────────────────────────────────────────
    const featureMap = {};
    txs.forEach(tx => {
      const f = featureLabel(tx.input);
      if (!featureMap[f]) featureMap[f] = { name: f, txCount: 0, wallets: new Set(), success: 0, failed: 0, gasTotal: 0, volumeETH: 0 };
      const fm = featureMap[f];
      fm.txCount++;
      fm.wallets.add(tx.from);
      if (tx.status) fm.success++; else fm.failed++;
      fm.gasTotal += hexToNum(tx.gasUsed) * hexToNum(tx.gasPrice) / 1e18;
      try { fm.volumeETH += Number(BigInt(tx.value || '0')) / 1e18; } catch {}
    });

    const features = Object.values(featureMap).map(f => ({
      name:         f.name,
      txCount:      f.txCount,
      walletCount:  f.wallets.size,
      successTx:    f.success,
      failedTx:     f.failed,
      failedPct:    f.txCount > 0 ? Number(((f.failed / f.txCount) * 100).toFixed(1)) : 0,
      avgGasUSD:    f.txCount > 0 ? Number((f.gasTotal / f.txCount * ETH_PRICE).toFixed(4)) : 0,
      volumeETH:    Number(f.volumeETH.toFixed(6)),
      adoptionPct:  wallets.length > 0 ? Number(((f.wallets.size / wallets.length) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.txCount - a.txCount);

    // ── Wallet segments ─────────────────────────────────────────────────────
    const active  = wallets.filter(w => w.status !== 'dormant');
    const dormant = wallets.filter(w => w.status === 'dormant');
    const whales  = wallets.filter(w => w.status === 'whale');

    // ── Aggregate insights ──────────────────────────────────────────────────
    const totalGasUSD    = wallets.reduce((s, w) => s + w.gasSpentUSD, 0);
    const totalFailed    = wallets.reduce((s, w) => s + w.failedTx, 0);
    const totalSuccess   = wallets.reduce((s, w) => s + w.successTx, 0);
    const totalVolumeETH = wallets.reduce((s, w) => s + w.valueInETH, 0);
    const avgGasUSD      = wallets.length > 0 ? Number((totalGasUSD / wallets.length).toFixed(4)) : 0;

    // ── Productivity score (0-100) ──────────────────────────────────────────
    const successRate  = txs.length > 0 ? (totalSuccess / txs.length) * 100 : 0;
    const activeRate   = wallets.length > 0 ? (active.length / wallets.length) * 100 : 0;
    const topFeaturePct = features[0]?.adoptionPct || 0;
    const productivityScore = Math.round((successRate * 0.4) + (activeRate * 0.4) + (topFeaturePct * 0.2));

    // ── Alerts (auto-generated) ─────────────────────────────────────────────
    const alerts = [];
    if (successRate < 90)  alerts.push({ type: 'warning', metric: 'Success Rate',   value: `${successRate.toFixed(1)}%`, action: 'Investigate failed transactions — reduce friction in key flows' });
    if (activeRate < 20)   alerts.push({ type: 'warning', metric: 'Active Wallets', value: `${activeRate.toFixed(1)}%`, action: 'Only ' + active.length + ' of ' + wallets.length + ' wallets returned — improve retention hooks' });
    if (dormant.length > wallets.length * 0.7) alerts.push({ type: 'warning', metric: 'Dormant Wallets', value: dormant.length, action: 'Over 70% of wallets are dormant — add re-engagement incentives' });
    if (features[0] && features[0].failedPct > 10) alerts.push({ type: 'warning', metric: `${features[0].name} Failures`, value: `${features[0].failedPct}%`, action: `Top feature "${features[0].name}" has high failure rate — fix UX flow` });

    // ── Pipeline: produce jobs + read cached results ─────────────────────────
    const rpcUrls = chain.toLowerCase() === 'starknet'
      ? [process.env.STARKNET_RPC_URL1, process.env.STARKNET_RPC_URL2].filter(Boolean)
      : [process.env.ETHEREUM_RPC_URL1, process.env.ETHEREUM_RPC_URL2, process.env.ETHEREUM_RPC_URL3].filter(Boolean);

    const walletAddrs = wallets.slice(0, 50).map(w => w.address);

    // Produce: enqueue stale wallets (non-blocking — consumer runs in background)
    const produced = walletAddrs.length > 0
      ? await produce(contractAddress, chain, walletAddrs)
      : { queued: 0, total: 0 };

    // Read whatever is already cached (immediately available)
    const enrichmentData = walletAddrs.length > 0
      ? await getEnrichmentResults(contractAddress, chain, walletAddrs)
      : {};

    const pipelineStatus = await getPipelineStatus(contractAddress, chain);

    // Merge enrichment into wallet list
    const enrichedWallets = wallets.slice(0, 50).map(w => ({
      ...w,
      onChain: enrichmentData[w.address] || null,
    }));

    // Cross-app insights from enrichment
    const enrichedEntries = Object.values(enrichmentData).filter(e => e && !e.error);
    const crossAppInsights = {
      avgTotalTxsEver:      enrichedEntries.length > 0 ? Math.round(enrichedEntries.reduce((s,e) => s + (e.totalTxsEver||0), 0) / enrichedEntries.length) : 0,
      avgEthBalance:        enrichedEntries.length > 0 ? Number((enrichedEntries.reduce((s,e) => s + (e.ethBalance||0), 0) / enrichedEntries.length).toFixed(4)) : 0,
      avgRecentTransferOut: enrichedEntries.length > 0 ? Number((enrichedEntries.reduce((s,e) => s + (e.recentTransferOut||0), 0) / enrichedEntries.length).toFixed(1)) : 0,
      totalContractsUsed:   [...new Set(enrichedEntries.flatMap(e => e.contractsUsed||[]))].length,
      enrichedWallets:      enrichedEntries.length,
      pipeline: {
        pending:    pipelineStatus.pending,
        processing: pipelineStatus.processing,
        dlq:        pipelineStatus.dlq,
        isRunning:  pipelineStatus.isRunning,
        justQueued: produced.queued,
      },
      note: pipelineStatus.pending > 0 || pipelineStatus.isRunning
        ? `Pipeline running — ${pipelineStatus.pending} wallets queued. Refresh in ~${Math.ceil(pipelineStatus.pending / 3) * 3}s`
        : enrichedEntries.length > 0 ? 'All wallets enriched' : 'Enrichment starting...',
    };

    res.json({
      contractAddress,
      chain,
      summary: {
        totalWallets:    wallets.length,
        activeWallets:   active.length,
        dormantWallets:  dormant.length,
        whaleWallets:    whales.length,
        totalTxs:        txs.length,
        totalVolumeETH:  Number(totalVolumeETH.toFixed(4)),
        totalVolumeUSD:  Number((totalVolumeETH * ETH_PRICE).toFixed(2)),
        totalGasUSD:     Number(totalGasUSD.toFixed(2)),
        avgGasUSD,
        totalFailed,
        totalSuccess,
        successRate:     Number(successRate.toFixed(1)),
        productivityScore,
      },
      features,
      wallets: enrichedWallets,
      alerts,
      crossAppInsights,
    });
  } catch (err) {
    console.error('wallet-analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
