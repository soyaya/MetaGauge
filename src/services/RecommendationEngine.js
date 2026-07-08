/**
 * RecommendationEngine
 * Finds early-stage projects with growth patterns matching successful comps.
 * Used by the Discover tab and the AI chat when users ask about investment.
 *
 * Two modes:
 *   findHighGrowthProjects(filters) — DB query, scored by match_score
 *   generateInvestorBrief(project, gemini) — Gemini writes the investment brief
 */

import { query } from '../api/database/postgres.js';
import { GoogleGenAI } from '@google/genai';

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

// ── Find matched projects ──────────────────────────────────────────────────

/**
 * Find all registry projects with high early-growth match scores.
 * Optional: filter by category, chain, stage, minScore.
 */
export async function findHighGrowthProjects(filters = {}) {
  const { chain, category, stage, minScore = 50, limit = 20 } = filters;

  const conditions = [
    'pr.is_active = true',
    `gf.match_score >= ${parseInt(minScore) || 50}`,
  ];
  const params = [];
  let idx = 1;

  if (chain)    { conditions.push(`pr.chain = $${idx++}`);           params.push(chain); }
  if (category) { conditions.push(`pr.category ILIKE $${idx++}`);    params.push(`%${category}%`); }
  if (stage)    { conditions.push(`gf.stage = $${idx++}`);           params.push(stage); }

  params.push(limit);

  const result = await query(
    `SELECT
       pr.contract_address, pr.chain, pr.display_name, pr.category, pr.stage,
       pr.contact_email, pr.contact_website, pr.documents_public,
       pr.featured_since,
       c.name AS contract_name,
       gf.match_score, gf.matched_comps, gf.stage AS fingerprint_stage,
       gf.retention_curve_shape, gf.cac_trend, gf.onchain_density,
       gf.revenue_acceleration, gf.user_growth_velocity,
       rd.summary AS research_summary,
       fd.income_statement, fd.unit_economics, fd.executive_summary,
       fd.period AS doc_period
     FROM project_registry pr
     JOIN growth_fingerprints gf
       ON gf.contract_address = pr.contract_address AND gf.chain = pr.chain
     LEFT JOIN contracts c ON c.id = pr.contract_id
     LEFT JOIN research_data rd
       ON rd.contract_address = pr.contract_address AND rd.chain = pr.chain
     LEFT JOIN LATERAL (
       SELECT income_statement, unit_economics, executive_summary, period
       FROM financial_documents
       WHERE contract_id = pr.contract_id
       ORDER BY period DESC LIMIT 1
     ) fd ON true
     WHERE ${conditions.join(' AND ')}
     ORDER BY gf.match_score DESC
     LIMIT $${idx}`,
    params
  );

  return result.rows;
}

// ── Natural language search ────────────────────────────────────────────────

/**
 * Parse a natural language query into structured filters using simple heuristics.
 * e.g. "DeFi on Ethereum with Uniswap-like growth" → { category: 'Dex', chain: 'ethereum' }
 */
export function parseSearchQuery(query) {
  const q = query?.toLowerCase() || '';
  const filters = {};

  // Chain detection
  if (q.includes('ethereum') || q.includes('eth'))       filters.chain = 'ethereum';
  else if (q.includes('starknet'))                        filters.chain = 'starknet';
  else if (q.includes('lisk'))                            filters.chain = 'lisk';
  else if (q.includes('arbitrum'))                        filters.chain = 'arbitrum';

  // Category detection
  if (q.includes('dex') || q.includes('swap') || q.includes('uniswap'))    filters.category = 'Dex';
  else if (q.includes('lend') || q.includes('aave') || q.includes('borrow')) filters.category = 'Lending';
  else if (q.includes('nft') || q.includes('blur'))                          filters.category = 'NFT';
  else if (q.includes('deriv') || q.includes('gmx') || q.includes('perp'))  filters.category = 'Derivatives';
  else if (q.includes('yield') || q.includes('farm'))                        filters.category = 'Yield';

  // Stage
  if (q.includes('early') || q.includes('seed') || q.includes('start'))     filters.stage = 'early';
  else if (q.includes('growth') || q.includes('growing'))                    filters.stage = 'growth';

  // Min score
  if (q.includes('high') || q.includes('strong'))                            filters.minScore = 70;
  else if (q.includes('any') || q.includes('all'))                           filters.minScore = 0;
  else                                                                         filters.minScore = 50;

  return filters;
}

// ── Investor brief generation ──────────────────────────────────────────────

/**
 * Generate an AI-written investor brief for a project.
 * Written by Gemini, grounded in the actual fingerprint + research data.
 */
export async function generateInvestorBrief(project) {
  const client = getGeminiClient();

  const topComp = project.matched_comps?.[0];
  const ret     = project.retention_curve_shape;
  const res     = project.research_summary;
  const ue      = project.unit_economics;
  const kpi     = project.income_statement;

  const fallback = `${project.display_name || project.contract_name || 'This project'} shows an Early Growth Match Score of ${project.match_score}/100, most closely resembling ${topComp?.name || 'successful early protocols'}. ${topComp?.notes || ''}`;

  if (!client) return fallback;

  const prompt = `You are a venture capital analyst writing a 3–4 sentence investment brief for a blockchain protocol.
Be specific, cite numbers, and make a clear investment thesis. Be direct — no marketing language.

PROJECT DATA:
- Name: ${project.display_name || project.contract_name || 'Unknown'}
- Chain: ${project.chain}
- Category: ${project.category || 'DeFi'}
- Stage: ${project.fingerprint_stage || project.stage || 'early'}
- Early Growth Match Score: ${project.match_score}/100
- Best comp match: ${topComp?.name || 'N/A'} (score: ${topComp?.score || 0}/100)
- Match rationale: ${topComp?.notes || 'pattern similarity identified'}
- D1 Retention: ${ret?.d1 || 0}%
- D7 Retention: ${ret?.d7 || 0}%
- D30 Retention: ${ret?.d30 || 0}%
- CAC Trend: ${project.cac_trend || 'unknown'}
- On-chain density: ${project.onchain_density || 0} txs/user/week
- TVL: ${res?.tvl_usd ? '$' + Math.round(res.tvl_usd).toLocaleString() : 'N/A'}
- Token price: ${res?.price_usd ? '$' + res.price_usd : 'N/A'}
- LTV:CAC: ${ue?.ratios?.ltv_cac_label || 'N/A'}
- Monthly burn: ${ue?.burn_and_runway?.total_monthly_burn ? '$' + ue.burn_and_runway.total_monthly_burn : 'N/A'}
- Runway: ${ue?.burn_and_runway?.runway_label || 'N/A'}

Write exactly 3–4 sentences:
1. What the project does and why the growth pattern is significant
2. The specific metric that most closely aligns with the comp's early stage
3. The investment thesis — what early entry could mean
4. One key risk to monitor

Return only the brief text. No bullet points. No headers.`;

  try {
    const result = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      contents: prompt,
    });
    return result.text || fallback;
  } catch {
    return fallback;
  }
}

export default {
  findHighGrowthProjects,
  parseSearchQuery,
  generateInvestorBrief,
};
