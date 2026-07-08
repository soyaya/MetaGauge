/**
 * Research Agent API Routes
 * POST /api/research/run    — trigger research for a contract
 * GET  /api/research/:addr/:chain           — get latest findings
 * GET  /api/research/:addr/:chain/benchmarks — sector benchmarks only
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query } from '../database/postgres.js';
import ResearchAgent from '../../services/ResearchAgent.js';

const router = Router();
router.use(authenticateToken);

// ── Verify user owns (or can see) the contract ─────────────────────────────

async function verifyContract(userId, contractAddress, chain) {
  const result = await query(
    `SELECT id, name, target_address AS address, target_chain AS chain FROM contracts
     WHERE user_id=$1 AND target_address=$2 AND target_chain=$3 LIMIT 1`,
    [userId, contractAddress?.toLowerCase(), chain || 'ethereum']
  );
  return result.rows[0] || null;
}

// ── POST /api/research/run ─────────────────────────────────────────────────
// Trigger research for a contract. Respects TTL unless force=true.

router.post('/run', async (req, res) => {
  try {
    const { contractAddress, chain, tokenSymbol, projectSlug, githubRepo, category, force } = req.body;
    if (!contractAddress) return res.status(400).json({ error: 'contractAddress required' });

    const contract = await verifyContract(req.user.id, contractAddress, chain);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const data = await ResearchAgent.run({
      contractAddress,
      chain: chain || 'ethereum',
      tokenSymbol:  tokenSymbol  || contract.token_symbol || null,
      projectSlug:  projectSlug  || contract.defillama_slug || null,
      githubRepo:   githubRepo   || contract.github_url || null,
      category:     category     || contract.category || null,
      forceRefresh: !!force,
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[research/run]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/research/:addr/:chain ─────────────────────────────────────────

router.get('/:contractAddress/:chain', async (req, res) => {
  try {
    const { contractAddress, chain } = req.params;

    const result = await query(
      `SELECT *, expires_at > NOW() AS fresh FROM research_data
       WHERE contract_address=$1 AND chain=$2`,
      [contractAddress?.toLowerCase(), chain]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null, message: 'No research data yet. POST /api/research/run to trigger.' });
    }

    res.json({ success: true, data: result.rows[0], fresh: result.rows[0].fresh });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/research/:addr/:chain/benchmarks ──────────────────────────────

router.get('/:contractAddress/:chain/benchmarks', async (req, res) => {
  try {
    const { contractAddress, chain } = req.params;

    const result = await query(
      `SELECT sector_benchmarks, summary->>'protocol_category' as category, fetched_at
       FROM research_data WHERE contract_address=$1 AND chain=$2`,
      [contractAddress?.toLowerCase(), chain]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, benchmarks: null });
    }

    res.json({
      success:    true,
      benchmarks: result.rows[0].sector_benchmarks,
      category:   result.rows[0].category,
      fetched_at: result.rows[0].fetched_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/research/:addr/:chain/summary ─────────────────────────────────
// Returns the RAG-ready summary string

router.get('/:contractAddress/:chain/summary', async (req, res) => {
  try {
    const { contractAddress, chain } = req.params;
    const ragContext = await ResearchAgent.getRAGContext(contractAddress, chain);
    res.json({ success: true, rag_context: ragContext });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
