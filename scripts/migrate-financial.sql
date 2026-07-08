-- =============================================================================
-- MetaGauge Financial Intelligence System — Migration
-- Phase 1: Financial Documents + Chat Context
-- Phase 2: Research Store
-- Phase 3: Growth Fingerprints + Project Registry
-- =============================================================================

-- ── Phase 1: Financial Profiles (one-time inputs) ────────────────────────────

CREATE TABLE IF NOT EXISTS financial_profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id               UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  project_stage             VARCHAR(20),       -- pre-seed/seed/series-a/series-b/growth/public
  founded_date              DATE,
  team_size                 INTEGER,
  has_token                 BOOLEAN DEFAULT false,
  token_symbol              VARCHAR(20),
  token_total_supply        NUMERIC,
  token_treasury_amount     NUMERIC,
  treasury_wallet_address   VARCHAR(100),
  raised_funding            BOOLEAN DEFAULT false,
  revenue_model             VARCHAR(50),       -- protocol-fees/token-sales/subscription/other
  cost_per_tx_subsidy       NUMERIC,           -- USD per tx the project subsidises
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_id     ON financial_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_profiles_contract_id ON financial_profiles(contract_id);

-- ── Funding rounds (one profile can have many rounds) ────────────────────────

CREATE TABLE IF NOT EXISTS funding_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  round           VARCHAR(30),                 -- pre-seed/seed/series-a/series-b/grant/token-sale
  amount_usd      NUMERIC,
  round_date      DATE,
  lead_investor   VARCHAR(200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funding_rounds_profile_id ON funding_rounds(profile_id);

-- ── Phase 1: Monthly recurring cost inputs ───────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_period_inputs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id               UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  period                    VARCHAR(7) NOT NULL,   -- format: YYYY-MM  e.g. 2026-07
  marketing_spend           NUMERIC,               -- total marketing & ads USD
  payroll                   NUMERIC,               -- total team payroll USD
  infra_cost                NUMERIC,               -- RPC, hosting, servers USD
  legal_audit_cost          NUMERIC,               -- legal, audits USD
  other_opex                NUMERIC,               -- any other operating costs USD
  token_treasury_movement   NUMERIC,               -- net tokens bought(+)/sold(-) from treasury
  off_chain_revenue         NUMERIC,               -- revenue not captured on-chain
  cash_balance              NUMERIC,               -- current USD cash/stablecoin balance
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contract_id, period)
);

CREATE INDEX IF NOT EXISTS idx_financial_period_inputs_user_contract ON financial_period_inputs(user_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_financial_period_inputs_period         ON financial_period_inputs(period);

-- ── Phase 1: Generated financial documents ───────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id           UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  period                VARCHAR(7) NOT NULL,         -- YYYY-MM
  income_statement      JSONB,                       -- full P&L structure
  cash_flow_statement   JSONB,                       -- full cash flow structure
  balance_sheet         JSONB,                       -- full balance sheet structure
  unit_economics        JSONB,                       -- CAC, LTV, burn, runway etc
  kpi_dashboard         JSONB,                       -- KPIs + sector benchmarks
  forward_model         JSONB,                       -- 12-month Base/Bull/Bear model
  executive_summary     TEXT,                        -- Gemini 2-paragraph narrative
  cfo_commentary        JSONB,                       -- { pl, cf, bs, ue, kpi, fm } each a text paragraph
  red_flags             JSONB,                       -- array of strings
  investor_qa           JSONB,                       -- array of { question, answer }
  pdf_path              VARCHAR(500),                -- path to generated PDF file
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contract_id, period)
);

CREATE INDEX IF NOT EXISTS idx_financial_documents_user_contract ON financial_documents(user_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_financial_documents_period         ON financial_documents(period);

-- ── Phase 1: Financial chat sessions (one per user per contract) ─────────────

CREATE TABLE IF NOT EXISTS financial_chat_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id       UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  financial_mode    VARCHAR(30) NOT NULL DEFAULT 'input_collection',
                    -- input_collection | monthly_collection | analysis
  context_summary   TEXT,                            -- Gemini-maintained rolling summary
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_chat_sessions_user_contract ON financial_chat_sessions(user_id, contract_id);

-- ── Phase 1: Financial chat messages ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_chat_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES financial_chat_sessions(id) ON DELETE CASCADE,
  role              VARCHAR(10) NOT NULL,             -- user | assistant
  content           TEXT NOT NULL,
  field_collected   VARCHAR(50),                      -- which input field was saved in this turn (if any)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_chat_messages_session_id ON financial_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_financial_chat_messages_created_at  ON financial_chat_messages(session_id, created_at DESC);

-- ── Phase 2: Research data store ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_data (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address    VARCHAR(100) NOT NULL,
  chain               VARCHAR(30)  NOT NULL,
  defillama_data      JSONB,                          -- TVL history, fees, protocol rank
  coingecko_data      JSONB,                          -- price, mcap, volume, sentiment
  github_data         JSONB,                          -- commits, contributors, stars, issues
  sector_benchmarks   JSONB,                          -- median CAC, LTV, retention for category
  summary             JSONB,                          -- structured summary for RAG injection
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE(contract_address, chain)
);

CREATE INDEX IF NOT EXISTS idx_research_data_contract ON research_data(contract_address, chain);
CREATE INDEX IF NOT EXISTS idx_research_data_expires  ON research_data(expires_at);

-- ── Phase 3: Growth fingerprints ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS growth_fingerprints (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address        VARCHAR(100) NOT NULL,
  chain                   VARCHAR(30)  NOT NULL,
  user_growth_velocity    JSONB,                      -- { w1, w4, w12 } user counts
  retention_curve_shape   JSONB,                      -- { d1, d7, d30 } retention %
  revenue_acceleration    JSONB,                      -- array of MoM revenue growth rates
  cac_trend               VARCHAR(20),                -- improving | stable | degrading
  onchain_density         NUMERIC,                    -- avg txs per active user per week
  tvl_trajectory          JSONB,                      -- weekly TVL change array
  stage                   VARCHAR(20),                -- early | growth | mature
  match_score             INTEGER,                    -- 0-100 early growth match score
  matched_comps           JSONB,                      -- top 3 { name, score, pattern_notes }
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contract_address, chain)
);

CREATE INDEX IF NOT EXISTS idx_growth_fingerprints_contract   ON growth_fingerprints(contract_address, chain);
CREATE INDEX IF NOT EXISTS idx_growth_fingerprints_score      ON growth_fingerprints(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_growth_fingerprints_stage      ON growth_fingerprints(stage);

-- ── Phase 3: Project registry (opt-in featured projects) ─────────────────────

CREATE TABLE IF NOT EXISTS project_registry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id         UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  contract_address    VARCHAR(100) NOT NULL,
  chain               VARCHAR(30)  NOT NULL,
  display_name        VARCHAR(100),
  category            VARCHAR(50),
  stage               VARCHAR(20),
  contact_email       VARCHAR(200),
  contact_website     VARCHAR(500),
  documents_public    BOOLEAN NOT NULL DEFAULT false,  -- whether financial docs are visible to others
  is_active           BOOLEAN NOT NULL DEFAULT true,
  featured_since      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_project_registry_active         ON project_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_project_registry_contract       ON project_registry(contract_address, chain);
CREATE INDEX IF NOT EXISTS idx_project_registry_category_chain ON project_registry(category, chain);

-- ── Triggers: auto-update updated_at columns ─────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_financial_profiles_updated_at
    BEFORE UPDATE ON financial_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_financial_period_inputs_updated_at
    BEFORE UPDATE ON financial_period_inputs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_financial_chat_sessions_updated_at
    BEFORE UPDATE ON financial_chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_project_registry_updated_at
    BEFORE UPDATE ON project_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
