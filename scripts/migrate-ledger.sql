-- =============================================================================
-- MetaGauge Ledger — Migration
-- Phase 1: Blockchain transaction classification + canonical double-entry ledger
--
-- Layer 1 (raw)            Layer 2 (interpreted)         Layer 3 (canonical)
-- raw_transactions     ->  classification_results   ->   ledger_entries
-- token_transfers
-- contract_registry / wallet_registry (reference data used by classification)
--
-- Note: this app has no numeric `chain_id` anywhere (contracts.target_chain,
-- research_data.chain, growth_fingerprints.chain are all VARCHAR chain names
-- like 'ethereum'/'starknet'/'lisk') — these tables use `chain VARCHAR(30)`
-- to match, instead of an EVM numeric chain_id.
--
-- There is no separate `companies` table in this schema — a `contracts` row
-- (scoped by user_id + contract_id) is the "company" unit everywhere
-- (financial_profiles, financial_period_inputs, etc.), so these tables
-- follow the same (user_id, contract_id) scoping convention.
-- =============================================================================

-- ── Reference data: known contracts/addresses and what they mean ────────────

CREATE TABLE IF NOT EXISTS contract_registry (
  chain                   VARCHAR(30)  NOT NULL,
  address                 VARCHAR(100) NOT NULL,
  label                   VARCHAR(200) NOT NULL,        -- "Uniswap V3 Router", "Coinbase Withdrawal"
  protocol_type           VARCHAR(30),                  -- dex | lending | cex | payroll_processor | staking
  default_account_code    VARCHAR(10)  NOT NULL,         -- see src/config/chartOfAccounts.js
  confidence_weight       NUMERIC(3,2) NOT NULL DEFAULT 0.90,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain, address)
);

-- ── Company-controlled wallets, with a stated purpose ────────────────────────
-- Minimal slice of the "Wallets & Chains" onboarding intake — just enough for
-- the classification engine to know which addresses are internal to a given
-- (user_id, contract_id). If no rows exist for a contract, the classification
-- engine falls back to treating contracts.target_address as the sole wallet.

CREATE TABLE IF NOT EXISTS wallet_registry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id   UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  chain         VARCHAR(30)  NOT NULL,
  address       VARCHAR(100) NOT NULL,
  label         VARCHAR(100),                  -- "Treasury", "Payroll", "Ops"
  purpose       TEXT,                          -- free-text explanation, per intake framework
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contract_id, chain, address)
);

CREATE INDEX IF NOT EXISTS idx_wallet_registry_user_contract ON wallet_registry(user_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_wallet_registry_address        ON wallet_registry(chain, address);

-- ── Layer 1: raw, as-fetched. Never edited. ──────────────────────────────────

CREATE TABLE IF NOT EXISTS raw_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain               VARCHAR(30)  NOT NULL,
  tx_hash             VARCHAR(100) NOT NULL,
  block_number        BIGINT NOT NULL,
  block_timestamp     TIMESTAMPTZ,
  from_address        VARCHAR(100) NOT NULL,
  to_address          VARCHAR(100),
  value_native        NUMERIC(38,18) DEFAULT 0,
  gas_used            NUMERIC(38,0),
  gas_price_native    NUMERIC(38,18),
  method_signature    VARCHAR(20),
  method_name         VARCHAR(100),
  raw_input_data      TEXT,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_raw_transactions_block ON raw_transactions(chain, block_number);

-- One raw_transaction can contain multiple token movements (batch txns, swaps)

CREATE TABLE IF NOT EXISTS token_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id               UUID NOT NULL REFERENCES raw_transactions(id) ON DELETE CASCADE,
  token_contract      VARCHAR(100),               -- NULL = native asset (ETH)
  token_symbol        VARCHAR(20),
  token_decimals      INTEGER,
  from_address        VARCHAR(100) NOT NULL,
  to_address          VARCHAR(100) NOT NULL,
  amount              NUMERIC(38,18) NOT NULL,
  log_index           INTEGER NOT NULL DEFAULT 0,   -- 0 for native transfers (at most one per tx)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tx_id, log_index)                          -- idempotent re-ingestion (live-poll can overlap historical)
);

CREATE INDEX IF NOT EXISTS idx_token_transfers_tx   ON token_transfers(tx_id);
CREATE INDEX IF NOT EXISTS idx_token_transfers_from ON token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_to   ON token_transfers(to_address);

-- ── Layer 2: interpretation results — one row per transfer, before ledger ────

CREATE TABLE IF NOT EXISTS classification_results (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id             UUID NOT NULL REFERENCES token_transfers(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id             UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  proposed_account_code   VARCHAR(10) NOT NULL,
  confidence              NUMERIC(3,2) NOT NULL,
  source                  VARCHAR(20) NOT NULL,        -- rule | heuristic | unresolved | user
  rationale               TEXT,
  status                  VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | confirmed | overridden
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transfer_id)
);

CREATE INDEX IF NOT EXISTS idx_classification_results_user_contract ON classification_results(user_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_classification_results_status         ON classification_results(status);

-- ── Layer 3: canonical, double-entry ledger — the system of record ──────────
-- Corrections append new rows (superseded_by), never overwrite.

CREATE TABLE IF NOT EXISTS ledger_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id         UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  period              VARCHAR(7) NOT NULL,             -- YYYY-MM
  account_code        VARCHAR(10) NOT NULL,
  debit               NUMERIC(20,2) NOT NULL DEFAULT 0,
  credit              NUMERIC(20,2) NOT NULL DEFAULT 0,
  source              VARCHAR(20) NOT NULL,            -- onchain | form | correction
  tx_id               UUID REFERENCES raw_transactions(id),
  classification_id   UUID REFERENCES classification_results(id),
  confidence          NUMERIC(3,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by       UUID REFERENCES ledger_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_contract_period ON ledger_entries(user_id, contract_id, period);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account               ON ledger_entries(account_code);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tx                    ON ledger_entries(tx_id);

-- ── Feedback loop: user corrections to a prior classification ───────────────
-- Table only for Phase 1 — no RAG re-embedding job yet (later phase).

CREATE TABLE IF NOT EXISTS corrections (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id         UUID NOT NULL REFERENCES classification_results(id) ON DELETE CASCADE,
  original_account_code     VARCHAR(10) NOT NULL,
  corrected_account_code    VARCHAR(10) NOT NULL,
  note                      TEXT,
  corrected_by              UUID REFERENCES users(id),
  corrected_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corrections_classification ON corrections(classification_id);
