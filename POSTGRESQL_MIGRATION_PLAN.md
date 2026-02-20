# 🗄️ PostgreSQL Migration Plan - Metagauge

## 📋 Overview

Migrate from **file-based JSON storage** to **PostgreSQL database** for:
- Better performance
- ACID transactions
- Concurrent access
- Scalability
- Data integrity
- Advanced querying

---

## 📊 Current Data Structure Analysis

### **Current Storage Files:**
1. `data/users.json` - User accounts and profiles
2. `data/contracts.json` - Contract configurations
3. `data/analyses.json` - Analysis results and progress
4. Chat sessions (in-memory/file)
5. Chat messages (in-memory/file)

### **Current Storage Classes:**
1. `UserStorage` - User operations
2. `ContractStorage` - Contract configurations
3. `AnalysisStorage` - Analysis results
4. `ChatSessionStorage` - Chat sessions
5. `ChatMessageStorage` - Chat messages

---

## 🗂️ Database Schema Design

### **1. Users Table**

```sql
CREATE TABLE users (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Authentication
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Account Status
  tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro', 'enterprise')),
  api_key VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  
  -- Usage Tracking
  analysis_count INTEGER DEFAULT 0,
  monthly_analysis_count INTEGER DEFAULT 0,
  last_analysis TIMESTAMP,
  monthly_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_users_email (email),
  INDEX idx_users_api_key (api_key),
  INDEX idx_users_tier (tier)
);
```

**JSON Fields to Extract:**
- `usage` → columns: `analysis_count`, `monthly_analysis_count`, `last_analysis`, `monthly_reset_date`
- `onboarding` → separate table
- `preferences` → separate table or JSONB column

---

### **2. User Onboarding Table**

```sql
CREATE TABLE user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Onboarding Status
  completed BOOLEAN DEFAULT false,
  
  -- Social Links
  website VARCHAR(500),
  twitter VARCHAR(255),
  discord VARCHAR(255),
  telegram VARCHAR(255),
  logo TEXT, -- Base64 or URL
  
  -- Default Contract Info
  contract_address VARCHAR(255),
  contract_chain VARCHAR(50),
  contract_abi TEXT,
  contract_name VARCHAR(255),
  contract_purpose TEXT,
  contract_category VARCHAR(100),
  contract_start_date DATE,
  
  -- Indexing Status
  is_indexed BOOLEAN DEFAULT false,
  indexing_progress INTEGER DEFAULT 0,
  last_analysis_id UUID,
  last_update TIMESTAMP,
  current_step VARCHAR(255),
  continuous_sync BOOLEAN DEFAULT false,
  has_errors BOOLEAN DEFAULT false,
  completion_reason VARCHAR(255),
  continuous_sync_stopped TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id),
  INDEX idx_onboarding_user (user_id),
  INDEX idx_onboarding_contract (contract_address, contract_chain)
);
```

---

### **3. User Preferences Table**

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification Settings
  email_notifications BOOLEAN DEFAULT true,
  analysis_notifications BOOLEAN DEFAULT true,
  
  -- Default Settings
  default_chain VARCHAR(50) DEFAULT 'ethereum',
  
  -- Additional Preferences (JSONB for flexibility)
  custom_settings JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id),
  INDEX idx_preferences_user (user_id)
);
```

---

### **4. Contracts Table**

```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Contract Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Target Contract
  target_address VARCHAR(255) NOT NULL,
  target_chain VARCHAR(50) NOT NULL,
  target_name VARCHAR(255),
  target_abi TEXT, -- JSON string
  
  -- Configuration
  tags TEXT[], -- Array of tags
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Analysis Stats
  last_analyzed TIMESTAMP,
  analysis_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_contracts_user (user_id),
  INDEX idx_contracts_address (target_address, target_chain),
  INDEX idx_contracts_active (is_active),
  INDEX idx_contracts_default (user_id, is_default)
);
```

---

### **5. Contract Competitors Table**

```sql
CREATE TABLE contract_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  
  -- Competitor Info
  address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  abi TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_competitors_contract (contract_id),
  INDEX idx_competitors_address (address, chain)
);
```

---

### **6. Contract RPC Config Table**

```sql
CREATE TABLE contract_rpc_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  
  -- RPC Configuration
  chain VARCHAR(50) NOT NULL,
  rpc_urls TEXT[], -- Array of RPC URLs
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_rpc_contract (contract_id),
  INDEX idx_rpc_chain (chain)
);
```

---

### **7. Contract Analysis Params Table**

```sql
CREATE TABLE contract_analysis_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  
  -- Analysis Parameters
  block_range INTEGER DEFAULT 1000,
  whale_threshold DECIMAL(20, 8) DEFAULT 10,
  max_concurrent_requests INTEGER DEFAULT 10,
  failover_timeout INTEGER DEFAULT 30000,
  max_retries INTEGER DEFAULT 2,
  output_formats TEXT[] DEFAULT ARRAY['json', 'csv', 'markdown'],
  
  -- Additional Params (JSONB for flexibility)
  custom_params JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(contract_id),
  INDEX idx_params_contract (contract_id)
);
```

---

### **8. Analyses Table**

```sql
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  config_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  
  -- Analysis Info
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('single', 'quick_scan', 'competitive', 'comparative')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Results (JSONB for flexibility)
  results JSONB,
  
  -- Metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}',
  
  -- Error Handling
  error_message TEXT,
  has_errors BOOLEAN DEFAULT false,
  
  -- Logs (Array of log messages)
  logs TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Timestamps
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update TIMESTAMP,
  current_step VARCHAR(255),
  
  INDEX idx_analyses_user (user_id),
  INDEX idx_analyses_config (config_id),
  INDEX idx_analyses_status (status),
  INDEX idx_analyses_type (analysis_type),
  INDEX idx_analyses_created (created_at DESC)
);
```

---

### **9. Chat Sessions Table**

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Session Info
  title VARCHAR(500) DEFAULT 'New Chat',
  
  -- Contract Context
  contract_address VARCHAR(255),
  contract_chain VARCHAR(50),
  contract_name VARCHAR(255),
  
  -- Session Status
  is_active BOOLEAN DEFAULT true,
  message_count INTEGER DEFAULT 0,
  
  -- Timestamps
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_contract (contract_address, contract_chain),
  INDEX idx_sessions_active (is_active),
  INDEX idx_sessions_updated (updated_at DESC)
);
```

---

### **10. Chat Messages Table**

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  -- Message Info
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- AI Response Components (JSONB)
  components JSONB, -- Charts, metrics, insights
  
  -- Metadata
  tokens_used INTEGER,
  model VARCHAR(100),
  processing_time INTEGER, -- milliseconds
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_messages_session (session_id),
  INDEX idx_messages_created (created_at DESC)
);
```

---

## 📦 Migration Strategy

### **Phase 1: Setup (Day 1)**
1. ✅ Install PostgreSQL dependencies
2. ✅ Create database connection module
3. ✅ Create migration scripts
4. ✅ Test database connection

### **Phase 2: Schema Creation (Day 1-2)**
1. ✅ Create all tables with proper indexes
2. ✅ Add foreign key constraints
3. ✅ Add check constraints
4. ✅ Create database functions/triggers for `updated_at`

### **Phase 3: Data Migration (Day 2-3)**
1. ✅ Migrate users.json → users table
2. ✅ Extract onboarding data → user_onboarding table
3. ✅ Extract preferences → user_preferences table
4. ✅ Migrate contracts.json → contracts + related tables
5. ✅ Migrate analyses.json → analyses table
6. ✅ Verify data integrity

### **Phase 4: Code Refactoring (Day 3-4)**
1. ✅ Create PostgreSQL storage classes
2. ✅ Replace UserStorage with PostgresUserStorage
3. ✅ Replace ContractStorage with PostgresContractStorage
4. ✅ Replace AnalysisStorage with PostgresAnalysisStorage
5. ✅ Update all API routes
6. ✅ Add transaction support

### **Phase 5: Testing (Day 4-5)**
1. ✅ Unit tests for each storage class
2. ✅ Integration tests for API endpoints
3. ✅ Performance testing
4. ✅ Data consistency verification

### **Phase 6: Deployment (Day 5)**
1. ✅ Backup current JSON files
2. ✅ Run migration in production
3. ✅ Monitor for errors
4. ✅ Rollback plan ready

---

## 🔧 Technical Implementation

### **Dependencies to Add:**
```json
{
  "pg": "^8.16.3",           // PostgreSQL client
  "pg-pool": "^3.7.0",       // Connection pooling
  "dotenv": "^17.2.3"        // Already installed
}
```

### **Environment Variables:**
```env
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=metagauge
POSTGRES_USER=metagauge_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_SSL=false
POSTGRES_MAX_CONNECTIONS=20
```

---

## 📈 Benefits of Migration

### **Performance:**
- ✅ 10-100x faster queries with indexes
- ✅ Concurrent access without file locking
- ✅ Efficient joins across tables

### **Scalability:**
- ✅ Handle millions of records
- ✅ Horizontal scaling with read replicas
- ✅ Connection pooling

### **Data Integrity:**
- ✅ ACID transactions
- ✅ Foreign key constraints
- ✅ Data validation at database level

### **Features:**
- ✅ Complex queries (aggregations, joins)
- ✅ Full-text search
- ✅ JSONB for flexible schema
- ✅ Automatic backups

---

## 🚨 Risks & Mitigation

### **Risk 1: Data Loss**
**Mitigation:** 
- Backup JSON files before migration
- Verify data after each migration step
- Keep JSON files as backup for 30 days

### **Risk 2: Downtime**
**Mitigation:**
- Run migration during low-traffic period
- Use blue-green deployment
- Test migration on staging first

### **Risk 3: Performance Issues**
**Mitigation:**
- Add proper indexes
- Use connection pooling
- Monitor query performance
- Optimize slow queries

---

## 📝 Migration Checklist

### **Pre-Migration:**
- [ ] Install PostgreSQL locally
- [ ] Create database and user
- [ ] Test connection
- [ ] Backup all JSON files
- [ ] Review schema design

### **Migration:**
- [ ] Run schema creation scripts
- [ ] Migrate users data
- [ ] Migrate contracts data
- [ ] Migrate analyses data
- [ ] Verify data integrity
- [ ] Test all API endpoints

### **Post-Migration:**
- [ ] Monitor performance
- [ ] Check error logs
- [ ] Verify data consistency
- [ ] Update documentation
- [ ] Archive JSON files

---

## 🎯 Estimated Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Setup** | 4 hours | Install, configure, test connection |
| **Schema** | 8 hours | Create tables, indexes, constraints |
| **Migration** | 12 hours | Migrate data, verify integrity |
| **Refactoring** | 16 hours | Update code, add transactions |
| **Testing** | 12 hours | Unit, integration, performance tests |
| **Deployment** | 4 hours | Backup, migrate, monitor |
| **Total** | **56 hours** | ~7 working days |

---

## ✅ Ready to Proceed?

This plan covers:
- ✅ Complete database schema (10 tables)
- ✅ Data migration strategy
- ✅ Code refactoring approach
- ✅ Testing plan
- ✅ Risk mitigation
- ✅ Timeline estimation

**Next Steps:**
1. Review and approve schema design
2. Set up PostgreSQL database
3. Start with Phase 1: Setup

Let me know if you want to proceed or need any modifications to the plan!
