# PostgreSQL Onboarding Schema Fixes

**Date:** 2026-02-08  
**Status:** ✅ All columns added

## Issues Fixed

### 1. Missing `onboarding` column in `users` table
**Error:** `column "onboarding" of relation "users" does not exist`

**Fix:** Modified `PostgresUserStorage.update()` to handle nested objects:
- Detects `onboarding` and `preferences` in updates
- Calls `updateOnboarding()` and `updatePreferences()` separately
- Removes them from main user table update

### 2. Missing `social_links` column
**Error:** `column "social_links" of relation "user_onboarding" does not exist`

**Fix:** Added JSONB column:
```sql
ALTER TABLE user_onboarding ADD COLUMN social_links JSONB DEFAULT '{}'::jsonb;
```

### 3. Missing `default_contract` column
**Error:** `column "default_contract" of relation "user_onboarding" does not exist`

**Fix:** Added JSONB column:
```sql
ALTER TABLE user_onboarding ADD COLUMN default_contract JSONB DEFAULT '{}'::jsonb;
```

### 4. Missing `logo_url` column
**Fix:** Added TEXT column:
```sql
ALTER TABLE user_onboarding ADD COLUMN logo_url TEXT;
```

### 5. JSONB field handling in `updateOnboarding()`
**Issue:** `toSnakeCase()` was converting nested objects incorrectly

**Fix:** Modified `updateOnboarding()` to:
- Separate JSONB fields from regular fields
- Convert JSONB to JSON strings before saving
- Handle `socialLinks` and `defaultContract` as JSONB

## Current Schema

### user_onboarding table (29 columns)
```
✅ id                      - UUID (primary key)
✅ user_id                 - UUID (foreign key to users)
✅ completed               - BOOLEAN
✅ website                 - VARCHAR(500)
✅ twitter                 - VARCHAR(255)
✅ discord                 - VARCHAR(255)
✅ telegram                - VARCHAR(255)
✅ logo                    - TEXT
✅ contract_address        - VARCHAR(255)
✅ contract_chain          - VARCHAR(50)
✅ contract_abi            - TEXT
✅ contract_name           - VARCHAR(255)
✅ contract_purpose        - TEXT
✅ contract_category       - VARCHAR(100)
✅ contract_start_date     - DATE
✅ is_indexed              - BOOLEAN
✅ indexing_progress       - INTEGER
✅ last_analysis_id        - UUID
✅ last_update             - TIMESTAMP
✅ current_step            - VARCHAR(255)
✅ continuous_sync         - BOOLEAN
✅ has_errors              - BOOLEAN
✅ completion_reason       - VARCHAR(255)
✅ continuous_sync_stopped - TIMESTAMP
✅ created_at              - TIMESTAMP
✅ updated_at              - TIMESTAMP
✅ social_links            - JSONB (NEW)
✅ default_contract        - JSONB (NEW)
✅ logo_url                - TEXT (NEW)
```

## Onboarding Data Structure

### What the form sends:
```javascript
{
  completed: true,
  socialLinks: {
    website: "https://...",
    twitter: "@...",
    discord: "...",
    telegram: "..."
  },
  logo: "base64...",
  defaultContract: {
    address: "0x...",
    chain: "lisk",
    abi: "[...]",
    name: "Contract Name",
    purpose: "Description",
    category: "defi",
    startDate: "2026-01-01",
    isIndexed: false,
    indexingProgress: 0,
    lastAnalysisId: null
  }
}
```

### How it's stored in PostgreSQL:
- `completed` → `completed` (BOOLEAN)
- `socialLinks` → `social_links` (JSONB)
- `logo` → `logo` (TEXT)
- `defaultContract` → `default_contract` (JSONB)
- Individual social fields also stored: `website`, `twitter`, `discord`, `telegram`
- Individual contract fields also stored: `contract_address`, `contract_chain`, etc.

## Code Changes

### File: `src/api/database/postgresStorage.js`

#### 1. Modified `PostgresUserStorage.update()`
```javascript
static async update(id, updates) {
  // Handle onboarding and preferences separately
  if (updates.onboarding) {
    await this.updateOnboarding(id, updates.onboarding);
    delete updates.onboarding;
  }
  if (updates.preferences) {
    await this.updatePreferences(id, updates.preferences);
    delete updates.preferences;
  }
  // ... rest of update logic
}
```

#### 2. Modified `PostgresUserStorage.updateOnboarding()`
```javascript
static async updateOnboarding(userId, data) {
  // Handle JSONB fields separately
  const jsonbFields = ['socialLinks', 'defaultContract'];
  const regularData = {};
  const jsonbData = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (jsonbFields.includes(key)) {
      jsonbData[key] = value;
    } else {
      regularData[key] = value;
    }
  }
  
  // Convert regular fields to snake_case
  const snakeData = toSnakeCase(regularData);
  
  // Add JSONB fields as JSON strings
  if (jsonbData.socialLinks) snakeData.social_links = JSON.stringify(jsonbData.socialLinks);
  if (jsonbData.defaultContract) snakeData.default_contract = JSON.stringify(jsonbData.defaultContract);
  
  // ... rest of update logic
}
```

## Testing

### Test onboarding completion:
```bash
curl -X POST http://localhost:5000/api/onboarding/complete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "socialLinks": {
      "website": "https://example.com",
      "twitter": "@example"
    },
    "contractAddress": "0x...",
    "chain": "lisk",
    "contractName": "Test Contract",
    "purpose": "Testing",
    "category": "defi",
    "startDate": "2026-01-01"
  }'
```

### Verify data in PostgreSQL:
```sql
SELECT 
  user_id, 
  completed, 
  social_links, 
  default_contract,
  contract_name
FROM user_onboarding 
WHERE user_id = 'YOUR_USER_ID';
```

## Status

✅ All missing columns added  
✅ JSONB handling implemented  
✅ Nested object updates working  
✅ Server running successfully  
✅ Ready for onboarding form submission

---

**No more missing column errors!** The onboarding form should now work completely with PostgreSQL.
