/**
 * ProjectRegistryService
 * Manages the opt-in registry of projects that want to be
 * featured in the Discover tab for investors.
 *
 * Privacy model:
 *   - Project is only discoverable if is_active = true
 *   - Financial documents only visible if documents_public = true
 *   - Growth fingerprint and match score always visible to investors
 */

import { query } from '../api/database/postgres.js';

// ── Opt-in / Opt-out ──────────────────────────────────────────────────────

export async function optIn(userId, contractId, contractAddress, chain, meta = {}) {
  const { displayName, category, stage, contactEmail, contactWebsite, documentsPublic } = meta;

  await query(
    `INSERT INTO project_registry
       (user_id, contract_id, contract_address, chain,
        display_name, category, stage,
        contact_email, contact_website, documents_public,
        is_active, featured_since)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,NOW())
     ON CONFLICT (user_id, contract_id) DO UPDATE SET
       display_name     = COALESCE(EXCLUDED.display_name, project_registry.display_name),
       category         = COALESCE(EXCLUDED.category, project_registry.category),
       stage            = COALESCE(EXCLUDED.stage, project_registry.stage),
       contact_email    = COALESCE(EXCLUDED.contact_email, project_registry.contact_email),
       contact_website  = COALESCE(EXCLUDED.contact_website, project_registry.contact_website),
       documents_public = EXCLUDED.documents_public,
       is_active        = true,
       updated_at       = NOW()`,
    [userId, contractId, contractAddress?.toLowerCase(), chain,
     displayName || null, category || null, stage || null,
     contactEmail || null, contactWebsite || null, !!documentsPublic]
  );
}

export async function optOut(userId, contractId) {
  await query(
    `UPDATE project_registry SET is_active=false, updated_at=NOW()
     WHERE user_id=$1 AND contract_id=$2`,
    [userId, contractId]
  );
}

export async function getRegistration(userId, contractId) {
  const result = await query(
    `SELECT * FROM project_registry WHERE user_id=$1 AND contract_id=$2`,
    [userId, contractId]
  );
  return result.rows[0] || null;
}

// ── Paid featured listings ─────────────────────────────────────────────────

/**
 * Activate (or renew) a paid featured listing after a successful payment.
 * Called from the payment webhook — never directly from a route, since it
 * grants `is_active` without re-checking payment.
 */
export async function activateFeatured(userId, contractId, contractAddress, chain, plan, reference, amountUSD, meta = {}) {
  const { displayName, category, stage, contactEmail, contactWebsite, documentsPublic } = meta;
  const interval = plan === 'yearly' ? `INTERVAL '1 year'` : `INTERVAL '1 month'`;

  await query(
    `INSERT INTO project_registry
       (user_id, contract_id, contract_address, chain,
        display_name, category, stage,
        contact_email, contact_website, documents_public,
        is_active, featured_since, plan, paid_until, payment_reference, amount_paid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,NOW(),$11,NOW() + ${interval},$12,$13)
     ON CONFLICT (user_id, contract_id) DO UPDATE SET
       display_name       = COALESCE(EXCLUDED.display_name, project_registry.display_name),
       category           = COALESCE(EXCLUDED.category, project_registry.category),
       stage              = COALESCE(EXCLUDED.stage, project_registry.stage),
       contact_email      = COALESCE(EXCLUDED.contact_email, project_registry.contact_email),
       contact_website    = COALESCE(EXCLUDED.contact_website, project_registry.contact_website),
       documents_public   = EXCLUDED.documents_public,
       is_active          = true,
       plan               = EXCLUDED.plan,
       -- Renewing before expiry extends from the current paid_until; renewing after
       -- expiry (or first activation) starts fresh from now.
       paid_until         = GREATEST(project_registry.paid_until, NOW()) + ${interval},
       payment_reference  = EXCLUDED.payment_reference,
       amount_paid        = EXCLUDED.amount_paid,
       updated_at         = NOW()`,
    [userId, contractId, contractAddress?.toLowerCase(), chain,
     displayName || null, category || null, stage || null,
     contactEmail || null, contactWebsite || null, !!documentsPublic,
     plan, reference || null, amountUSD || null]
  );
}

/**
 * Daily sweep: un-feature any listing whose paid period has lapsed.
 * Returns the number of listings deactivated.
 */
export async function deactivateExpired() {
  const result = await query(
    `UPDATE project_registry SET is_active=false, updated_at=NOW()
     WHERE is_active=true AND paid_until IS NOT NULL AND paid_until < NOW()
     RETURNING id`
  );
  return result.rows.length;
}

// ── Public registry listing ───────────────────────────────────────────────

/**
 * List all active featured projects with their fingerprint + research data.
 * Filters: chain, category, stage, minMatchScore
 */
export async function getRegistry(filters = {}) {
  const { chain, category, stage, minMatchScore = 0, limit = 50, offset = 0 } = filters;

  const conditions = ['pr.is_active = true'];
  const params = [];
  let idx = 1;

  if (chain) { conditions.push(`pr.chain = $${idx++}`); params.push(chain); }
  if (category) { conditions.push(`pr.category ILIKE $${idx++}`); params.push(`%${category}%`); }
  if (stage) { conditions.push(`pr.stage = $${idx++}`); params.push(stage); }
  if (minMatchScore > 0) {
    conditions.push(`gf.match_score >= $${idx++}`);
    params.push(minMatchScore);
  }

  params.push(limit, offset);

  const result = await query(
    `SELECT
       pr.*,
       c.name          AS contract_name,
       c.target_address AS contract_address_check,
       gf.match_score,
       gf.matched_comps,
       gf.stage    AS fingerprint_stage,
       gf.retention_curve_shape,
       gf.cac_trend,
       gf.onchain_density,
       gf.revenue_acceleration,
       rd.summary  AS research_summary,
       fd.income_statement,
       fd.unit_economics,
       fd.kpi_dashboard
     FROM project_registry pr
     LEFT JOIN contracts c ON c.id = pr.contract_id
     LEFT JOIN growth_fingerprints gf
       ON gf.contract_address = pr.contract_address AND gf.chain = pr.chain
     LEFT JOIN research_data rd
       ON rd.contract_address = pr.contract_address AND rd.chain = pr.chain
     LEFT JOIN LATERAL (
       SELECT income_statement, unit_economics, kpi_dashboard
       FROM financial_documents
       WHERE contract_id = pr.contract_id
       ORDER BY period DESC LIMIT 1
     ) fd ON true
     WHERE ${conditions.join(' AND ')}
     ORDER BY gf.match_score DESC NULLS LAST, pr.featured_since ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  return result.rows;
}

/**
 * Get full project card for a single featured project.
 * Only returns financial documents if documents_public = true.
 */
export async function getProjectCard(contractAddress, chain, requestingUserId = null) {
  const result = await query(
    `SELECT
       pr.*,
       c.name AS contract_name,
       gf.match_score, gf.matched_comps, gf.stage AS fingerprint_stage,
       gf.retention_curve_shape, gf.cac_trend, gf.onchain_density,
       gf.user_growth_velocity, gf.revenue_acceleration,
       rd.summary AS research_summary,
       fd.income_statement, fd.unit_economics, fd.kpi_dashboard,
       fd.executive_summary, fd.period AS doc_period
     FROM project_registry pr
     LEFT JOIN contracts c ON c.id = pr.contract_id
     LEFT JOIN growth_fingerprints gf
       ON gf.contract_address = pr.contract_address AND gf.chain = pr.chain
     LEFT JOIN research_data rd
       ON rd.contract_address = pr.contract_address AND rd.chain = pr.chain
     LEFT JOIN LATERAL (
       SELECT income_statement, unit_economics, kpi_dashboard,
              executive_summary, period
       FROM financial_documents
       WHERE contract_id = pr.contract_id
       ORDER BY period DESC LIMIT 1
     ) fd ON true
     WHERE pr.contract_address = $1 AND pr.chain = $2 AND pr.is_active = true`,
    [contractAddress?.toLowerCase(), chain]
  );

  const row = result.rows[0];
  if (!row) return null;

  // Enforce privacy: hide financial docs unless public or requester is the owner
  const isOwner = requestingUserId && row.user_id === requestingUserId;
  if (!row.documents_public && !isOwner) {
    row.income_statement  = null;
    row.unit_economics    = null;
    row.kpi_dashboard     = null;
    row.executive_summary = null;
  }

  return row;
}

export default {
  optIn, optOut, getRegistration, getRegistry, getProjectCard,
  activateFeatured, deactivateExpired,
};
