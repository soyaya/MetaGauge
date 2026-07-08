/**
 * FinancialProfileService
 * Manages financial profile inputs for each user+contract pair.
 *
 * One-time fields  → financial_profiles + funding_rounds  (never re-asked once saved)
 * Monthly fields   → financial_period_inputs              (asked once per month)
 *
 * The "missing fields" logic is what drives the AI chat input collector —
 * the AI only asks for fields that are genuinely absent from the DB.
 */

import { query, transaction } from '../api/database/postgres.js';

// ── Field definitions ──────────────────────────────────────────────────────

/**
 * One-time profile fields.
 * label     → human-readable name for AI to use when asking
 * question  → exact question the AI should ask the user
 * type      → string | number | boolean | date
 * required  → if true, documents cannot be generated without this field
 * depends   → only ask if another field equals a value: { field, value }
 */
export const ONE_TIME_FIELDS = [
  {
    key: 'project_stage',
    label: 'Project Stage',
    question: 'What stage is your project at? Options: pre-seed, seed, series-a, series-b, growth, or public.',
    type: 'string',
    required: true,
    valid: ['pre-seed', 'seed', 'series-a', 'series-b', 'growth', 'public'],
  },
  {
    key: 'founded_date',
    label: 'Founded Date',
    question: 'When was the project founded or the smart contract first deployed? (e.g. March 2023 or 2023-03)',
    type: 'date',
    required: false,
  },
  {
    key: 'team_size',
    label: 'Team Size',
    question: 'How many full-time contributors are on the team?',
    type: 'number',
    required: false,
  },
  {
    key: 'has_token',
    label: 'Has Token',
    question: 'Does your project have a native token?',
    type: 'boolean',
    required: true,
  },
  {
    key: 'token_symbol',
    label: 'Token Symbol',
    question: 'What is the token symbol? (e.g. ETH, USDC, XYZ)',
    type: 'string',
    required: false,
    depends: { field: 'has_token', value: true },
  },
  {
    key: 'token_total_supply',
    label: 'Token Total Supply',
    question: 'What is the total token supply? (number only)',
    type: 'number',
    required: false,
    depends: { field: 'has_token', value: true },
  },
  {
    key: 'token_treasury_amount',
    label: 'Treasury Token Holdings',
    question: 'How many tokens does the project treasury currently hold?',
    type: 'number',
    required: false,
    depends: { field: 'has_token', value: true },
  },
  {
    key: 'treasury_wallet_address',
    label: 'Treasury Wallet Address',
    question: 'What is the treasury wallet address? (for balance sheet tracking)',
    type: 'string',
    required: false,
    depends: { field: 'has_token', value: true },
  },
  {
    key: 'revenue_model',
    label: 'Revenue Model',
    question: 'How does the project generate revenue? Options: protocol-fees, token-sales, subscription, other.',
    type: 'string',
    required: true,
    valid: ['protocol-fees', 'token-sales', 'subscription', 'other'],
  },
  {
    key: 'cost_per_tx_subsidy',
    label: 'Gas Subsidy per Transaction',
    question: 'Does the project subsidise gas costs for users? If yes, what is the average USD subsidy per transaction? (Enter 0 if none)',
    type: 'number',
    required: false,
  },
  {
    key: 'raised_funding',
    label: 'Has Raised Funding',
    question: 'Has the project raised any external funding (VC, grants, token sales)?',
    type: 'boolean',
    required: true,
  },
  // Note: funding_rounds are collected separately after raised_funding = true
];

/**
 * Monthly recurring fields.
 * These are asked at the start of each calendar month if not yet provided for that period.
 */
export const MONTHLY_FIELDS = [
  {
    key: 'marketing_spend',
    label: 'Marketing & Advertising Spend',
    question: 'What was the total marketing and advertising spend this month? (USD, enter 0 if none)',
    type: 'number',
    required: true,
  },
  {
    key: 'payroll',
    label: 'Payroll / Team Costs',
    question: 'What was the total payroll and team compensation this month? (USD, enter 0 if none)',
    type: 'number',
    required: true,
  },
  {
    key: 'infra_cost',
    label: 'Infrastructure Costs',
    question: 'What were total infrastructure costs this month — RPC providers, hosting, servers? (USD, enter 0 if none)',
    type: 'number',
    required: false,
  },
  {
    key: 'legal_audit_cost',
    label: 'Legal & Audit Costs',
    question: 'Any legal or smart contract audit costs this month? (USD, enter 0 if none)',
    type: 'number',
    required: false,
  },
  {
    key: 'other_opex',
    label: 'Other Operating Costs',
    question: 'Any other operating costs not covered above this month? (USD, enter 0 if none)',
    type: 'number',
    required: false,
  },
  {
    key: 'off_chain_revenue',
    label: 'Off-chain Revenue',
    question: 'Any revenue this month not captured on-chain — e.g. consulting, subscriptions, grants received? (USD, enter 0 if none)',
    type: 'number',
    required: false,
  },
  {
    key: 'cash_balance',
    label: 'Current Cash / Stablecoin Balance',
    question: 'What is the current total USD cash and stablecoin balance across all wallets and bank accounts?',
    type: 'number',
    required: true,
  },
  {
    key: 'token_treasury_movement',
    label: 'Token Treasury Movement',
    question: 'Did the treasury buy or sell any tokens this month? Enter the net USD value — positive if bought, negative if sold. (0 if no movement)',
    type: 'number',
    required: false,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns current period in YYYY-MM format
 */
export function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Normalise a boolean answer from chat
 * Handles: yes/no, true/false, 1/0
 */
function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value).toLowerCase().trim();
  return ['yes', 'true', '1', 'y'].includes(v);
}

/**
 * Parse and validate a single field value before saving
 */
export function parseFieldValue(fieldDef, rawValue) {
  const v = String(rawValue).trim();

  if (fieldDef.type === 'boolean') {
    return parseBool(v);
  }

  if (fieldDef.type === 'number') {
    const n = parseFloat(v.replace(/[$,]/g, ''));
    if (isNaN(n)) throw new Error(`"${v}" is not a valid number`);
    return n;
  }

  if (fieldDef.type === 'date') {
    // Accept "March 2023", "2023-03", "2023-03-15"
    const cleaned = v.replace(/\s+/g, ' ');
    const parsed = new Date(cleaned);
    if (isNaN(parsed.getTime())) {
      // Try "Month YYYY" format
      const monthYear = new Date(`1 ${cleaned}`);
      if (isNaN(monthYear.getTime())) throw new Error(`"${v}" is not a recognised date`);
      return monthYear.toISOString().split('T')[0];
    }
    return parsed.toISOString().split('T')[0];
  }

  // string
  if (fieldDef.valid && !fieldDef.valid.includes(v.toLowerCase())) {
    throw new Error(`"${v}" is not valid. Options: ${fieldDef.valid.join(', ')}`);
  }
  return fieldDef.valid ? v.toLowerCase() : v;
}

// ── Profile CRUD ──────────────────────────────────────────────────────────

/**
 * Get the financial profile for a user+contract.
 * Returns null if not yet created.
 */
export async function getProfile(userId, contractId) {
  const result = await query(
    `SELECT * FROM financial_profiles WHERE user_id = $1 AND contract_id = $2`,
    [userId, contractId]
  );
  if (result.rows.length === 0) return null;

  const profile = result.rows[0];

  // Attach funding rounds if any
  const rounds = await query(
    `SELECT * FROM funding_rounds WHERE profile_id = $1 ORDER BY round_date ASC`,
    [profile.id]
  );
  profile.funding_rounds = rounds.rows;

  return profile;
}

/**
 * Save one or more one-time profile fields.
 * Creates the profile row if it doesn't exist (upsert).
 */
export async function saveProfileField(userId, contractId, field, value) {
  const allowed = ONE_TIME_FIELDS.map(f => f.key);
  if (!allowed.includes(field)) {
    throw new Error(`Unknown profile field: ${field}`);
  }

  // Upsert — create profile row if missing, update field if exists
  await query(
    `INSERT INTO financial_profiles (user_id, contract_id, ${field})
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, contract_id)
     DO UPDATE SET ${field} = EXCLUDED.${field}, updated_at = NOW()`,
    [userId, contractId, value]
  );
}

/**
 * Save multiple profile fields at once.
 */
export async function saveProfileFields(userId, contractId, fields) {
  // fields = { key: value, ... }
  const entries = Object.entries(fields);
  if (entries.length === 0) return;

  const allowed = ONE_TIME_FIELDS.map(f => f.key);
  for (const [key] of entries) {
    if (!allowed.includes(key)) throw new Error(`Unknown profile field: ${key}`);
  }

  const setClauses = entries.map(([key], i) => `${key} = $${i + 3}`).join(', ');
  const values = entries.map(([, val]) => val);

  await query(
    `INSERT INTO financial_profiles (user_id, contract_id, ${entries.map(([k]) => k).join(', ')})
     VALUES ($1, $2, ${values.map((_, i) => `$${i + 3}`).join(', ')})
     ON CONFLICT (user_id, contract_id)
     DO UPDATE SET ${setClauses}, updated_at = NOW()`,
    [userId, contractId, ...values]
  );
}

/**
 * Add a funding round to a profile.
 * Creates the profile row first if needed.
 */
export async function addFundingRound(userId, contractId, round) {
  // Ensure profile exists
  await query(
    `INSERT INTO financial_profiles (user_id, contract_id, raised_funding)
     VALUES ($1, $2, true)
     ON CONFLICT (user_id, contract_id)
     DO UPDATE SET raised_funding = true, updated_at = NOW()`,
    [userId, contractId]
  );

  // Get profile id
  const profileResult = await query(
    `SELECT id FROM financial_profiles WHERE user_id = $1 AND contract_id = $2`,
    [userId, contractId]
  );
  const profileId = profileResult.rows[0].id;

  // Insert round
  await query(
    `INSERT INTO funding_rounds (profile_id, round, amount_usd, round_date, lead_investor)
     VALUES ($1, $2, $3, $4, $5)`,
    [profileId, round.round, round.amount_usd, round.date || null, round.lead_investor || null]
  );
}

// ── Monthly inputs CRUD ───────────────────────────────────────────────────

/**
 * Get monthly inputs for a given period.
 * Returns null if not yet provided.
 */
export async function getPeriodInputs(userId, contractId, period) {
  const result = await query(
    `SELECT * FROM financial_period_inputs
     WHERE user_id = $1 AND contract_id = $2 AND period = $3`,
    [userId, contractId, period]
  );
  return result.rows[0] || null;
}

/**
 * Save a single monthly field for a given period.
 * Upserts the period row.
 */
export async function savePeriodField(userId, contractId, period, field, value) {
  const allowed = MONTHLY_FIELDS.map(f => f.key);
  if (!allowed.includes(field)) {
    throw new Error(`Unknown monthly field: ${field}`);
  }

  await query(
    `INSERT INTO financial_period_inputs (user_id, contract_id, period, ${field})
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, contract_id, period)
     DO UPDATE SET ${field} = EXCLUDED.${field}, updated_at = NOW()`,
    [userId, contractId, period, value]
  );
}

/**
 * Save multiple monthly fields at once.
 */
export async function savePeriodFields(userId, contractId, period, fields) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;

  const allowed = MONTHLY_FIELDS.map(f => f.key);
  for (const [key] of entries) {
    if (!allowed.includes(key)) throw new Error(`Unknown monthly field: ${key}`);
  }

  const setClauses = entries.map(([key], i) => `${key} = $${i + 4}`).join(', ');
  const values = entries.map(([, val]) => val);

  await query(
    `INSERT INTO financial_period_inputs
       (user_id, contract_id, period, ${entries.map(([k]) => k).join(', ')})
     VALUES ($1, $2, $3, ${values.map((_, i) => `$${i + 4}`).join(', ')})
     ON CONFLICT (user_id, contract_id, period)
     DO UPDATE SET ${setClauses}, updated_at = NOW()`,
    [userId, contractId, period, ...values]
  );
}

// ── Missing fields logic ──────────────────────────────────────────────────

/**
 * Returns the list of fields still needed to generate financial documents.
 * This is the single source of truth that drives the AI chat collector.
 *
 * Returns:
 * {
 *   mode: 'input_collection' | 'monthly_collection' | 'complete',
 *   missingOneTime: [ { key, label, question, type } ],
 *   missingMonthly: [ { key, label, question, type } ],
 *   missingFundingRounds: boolean,
 *   period: '2026-07',
 *   complete: boolean
 * }
 */
export async function getMissingFields(userId, contractId) {
  const period = currentPeriod();
  const [profile, periodInputs] = await Promise.all([
    getProfile(userId, contractId),
    getPeriodInputs(userId, contractId, period),
  ]);

  // ── One-time fields ──
  const missingOneTime = [];
  for (const field of ONE_TIME_FIELDS) {
    // Check dependency
    if (field.depends) {
      const depValue = profile?.[field.depends.field];
      if (depValue !== field.depends.value) continue; // skip if dependency not met
    }

    const currentValue = profile?.[field.key];
    if (currentValue === null || currentValue === undefined || currentValue === '') {
      missingOneTime.push(field);
    }
  }

  // ── Funding rounds ──
  // Ask for at least one round if raised_funding = true and no rounds saved yet
  const missingFundingRounds =
    profile?.raised_funding === true &&
    (!profile.funding_rounds || profile.funding_rounds.length === 0);

  // ── Monthly fields ──
  const missingMonthly = [];
  for (const field of MONTHLY_FIELDS) {
    const currentValue = periodInputs?.[field.key];
    if (currentValue === null || currentValue === undefined) {
      missingMonthly.push(field);
    }
  }

  const complete = missingOneTime.length === 0 && !missingFundingRounds && missingMonthly.length === 0;

  let mode = 'complete';
  if (missingOneTime.length > 0 || missingFundingRounds) {
    mode = 'input_collection';
  } else if (missingMonthly.length > 0) {
    mode = 'monthly_collection';
  }

  return {
    mode,
    missingOneTime,
    missingMonthly,
    missingFundingRounds,
    period,
    profile: profile || null,
    periodInputs: periodInputs || null,
    complete,
  };
}

// ── Full data fetch (for document engine) ────────────────────────────────

/**
 * Returns all financial inputs needed by FinancialDocumentEngine.
 * Combines profile + funding rounds + monthly inputs for a given period.
 */
export async function getAllInputs(userId, contractId, period) {
  const [profile, periodInputs] = await Promise.all([
    getProfile(userId, contractId),
    getPeriodInputs(userId, contractId, period || currentPeriod()),
  ]);

  return {
    profile: profile || {},
    fundingRounds: profile?.funding_rounds || [],
    periodInputs: periodInputs || {},
    period: period || currentPeriod(),
  };
}

/**
 * Get all periods that have inputs saved for a user+contract.
 * Used to populate the period selector in the frontend.
 */
export async function getAvailablePeriods(userId, contractId) {
  const result = await query(
    `SELECT period, updated_at
     FROM financial_period_inputs
     WHERE user_id = $1 AND contract_id = $2
     ORDER BY period DESC`,
    [userId, contractId]
  );
  return result.rows;
}

// ── Completeness check (quick version for API) ───────────────────────────

/**
 * Quick check — returns true if documents can be generated for the given period.
 * Does not return the full missing fields list.
 */
export async function isReadyToGenerate(userId, contractId, period) {
  const missing = await getMissingFields(userId, contractId);
  if (!missing.complete) return false;

  // Also check the specific period has inputs
  const inputs = await getPeriodInputs(userId, contractId, period || currentPeriod());
  return inputs !== null;
}
