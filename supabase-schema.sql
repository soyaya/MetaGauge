CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  tier VARCHAR(50) DEFAULT 'free',
  api_key VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  analysis_count INTEGER DEFAULT 0,
  monthly_analysis_count INTEGER DEFAULT 0,
  last_analysis TIMESTAMP,
  monthly_reset_date TIMESTAMP DEFAULT NOW(),
  competitor_analysis_count INTEGER DEFAULT 0,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  subscription JSONB DEFAULT '{}',
  billing JSONB DEFAULT '{}',
  social_credentials JSONB DEFAULT '{}',
  usage JSONB DEFAULT '{}',
  onboarding JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  sync_hour INTEGER DEFAULT 0,
  sync_minute INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

CREATE TABLE IF NOT EXISTS user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  website VARCHAR(500),
  twitter VARCHAR(255),
  discord VARCHAR(255),
  telegram VARCHAR(255),
  logo TEXT,
  contract_address VARCHAR(255),
  contract_chain VARCHAR(50),
  contract_abi TEXT,
  contract_name VARCHAR(255),
  contract_purpose TEXT,
  contract_category VARCHAR(100),
  contract_start_date VARCHAR(50),
  is_indexed BOOLEAN DEFAULT false,
  indexing_progress INTEGER DEFAULT 0,
  last_analysis_id VARCHAR(255),
  last_update TIMESTAMP,
  current_step VARCHAR(255),
  continuous_sync BOOLEAN DEFAULT false,
  continuous_sync_started TIMESTAMP,
  continuous_sync_stopped TIMESTAMP,
  has_errors BOOLEAN DEFAULT false,
  completion_reason VARCHAR(255),
  deployment_block BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_onboarding_user ON user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_contract ON user_onboarding(contract_address, contract_chain);

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  analysis_notifications BOOLEAN DEFAULT true,
  default_chain VARCHAR(50) DEFAULT 'ethereum',
  custom_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_address VARCHAR(255) NOT NULL,
  target_chain VARCHAR(50) NOT NULL,
  target_name VARCHAR(255),
  target_abi TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  last_analyzed TIMESTAMP,
  analysis_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_address ON contracts(target_address, target_chain);

CREATE TABLE IF NOT EXISTS contract_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  abi TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cc_contract ON contract_competitors(contract_id);

CREATE TABLE IF NOT EXISTS contract_rpc_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  chain VARCHAR(50) NOT NULL,
  rpc_urls TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_analysis_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  block_range INTEGER DEFAULT 1000,
  whale_threshold DECIMAL(20,8) DEFAULT 10,
  max_concurrent_requests INTEGER DEFAULT 10,
  failover_timeout INTEGER DEFAULT 30000,
  max_retries INTEGER DEFAULT 2,
  output_formats TEXT[] DEFAULT ARRAY['json','csv','markdown'],
  custom_params JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_id)
);

CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  config_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  contract_address VARCHAR(255),
  chain VARCHAR(50),
  analysis_type VARCHAR(50) NOT NULL DEFAULT 'single',
  status VARCHAR(50) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  results JSONB,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  has_errors BOOLEAN DEFAULT false,
  logs JSONB DEFAULT '[]',
  current_step VARCHAR(255),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_contract ON analyses(contract_address, chain);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) DEFAULT 'New Chat',
  contract_address VARCHAR(255),
  contract_chain VARCHAR(50),
  contract_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_contract ON chat_sessions(contract_address, contract_chain);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  components JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  is_streaming BOOLEAN DEFAULT false,
  tokens_used INTEGER,
  model VARCHAR(100),
  processing_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  user_message TEXT NOT NULL,
  assistant_reply TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_user ON support_messages(user_id);

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  snapshot JSONB DEFAULT '{}',
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_mh_user_date ON metrics_history(user_id, date DESC);

CREATE TABLE IF NOT EXISTS live_poll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contract_address VARCHAR(255),
  contract_chain VARCHAR(50),
  last_block BIGINT,
  active BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_live_poll_active ON live_poll(active);

CREATE TABLE IF NOT EXISTS traction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  productivity_score INTEGER DEFAULT 0,
  tasks JSONB DEFAULT '[]',
  last_checked TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS alert_configs (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contract_id VARCHAR(255),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_configs_user ON alert_configs(user_id);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(user_id, is_read);

CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  insights JSONB DEFAULT '[]',
  resolved_issues JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '[]',
  contract_summary TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks(user_id);

CREATE TABLE IF NOT EXISTS competitor_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  transactions JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, address, chain)
);
CREATE INDEX IF NOT EXISTS idx_comp_data_user ON competitor_data(user_id);

CREATE TABLE IF NOT EXISTS competitor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50),
  content TEXT,
  status VARCHAR(50),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_user ON social_posts(user_id);

CREATE TABLE IF NOT EXISTS briefings (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50),
  title VARCHAR(500),
  content TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_briefings_user ON briefings(user_id);

CREATE TABLE IF NOT EXISTS ai_advice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_advice_user ON ai_advice(user_id);

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON ai_insights(user_id);

CREATE TABLE IF NOT EXISTS share_tokens (
  token VARCHAR(255) PRIMARY KEY,
  contract_id VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message_id VARCHAR(255),
  session_id VARCHAR(255),
  rating INTEGER,
  note TEXT,
  component_type VARCHAR(100),
  saved_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

CREATE TABLE IF NOT EXISTS abuse_fingerprints (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB DEFAULT '{"fingerprints":{},"emailDomains":{},"contractAddresses":{}}',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benchmarks (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(255),
  feedback TEXT,
  metric_before JSONB,
  metric_after JSONB,
  chain VARCHAR(50),
  contract_type VARCHAR(100),
  saved_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learnings_task ON ai_learnings(task_id);

CREATE TABLE IF NOT EXISTS wallet_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  enriched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_address, chain, wallet_address)
);
CREATE INDEX IF NOT EXISTS idx_we_contract ON wallet_enrichment(contract_address, chain);

CREATE TABLE IF NOT EXISTS wallet_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  queue JSONB NOT NULL DEFAULT '{"pending":[],"processing":[],"dlq":[]}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_address, chain)
);

CREATE TABLE IF NOT EXISTS function_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_address, chain, type)
);
CREATE INDEX IF NOT EXISTS idx_fa_contract ON function_analytics(contract_address, chain);

CREATE TABLE IF NOT EXISTS funnels (
  id VARCHAR(255) PRIMARY KEY,
  contract_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  steps JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funnels_contract ON funnels(contract_id);

CREATE TABLE IF NOT EXISTS function_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id VARCHAR(255) NOT NULL,
  signature VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_id, signature)
);
CREATE INDEX IF NOT EXISTS idx_fm_contract ON function_mappings(contract_id);

CREATE TABLE IF NOT EXISTS competitor_analyses (
  id VARCHAR(255) PRIMARY KEY,
  address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  data JSONB DEFAULT '{}',
  indexed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ca_address ON competitor_analyses(address, chain);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
