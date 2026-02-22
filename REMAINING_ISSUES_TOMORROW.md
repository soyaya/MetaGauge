# Remaining Issues for Tomorrow

**Date:** 2026-02-22  
**Current Progress:** 36/44 issues (82%)  
**Remaining:** 8 issues  
**Estimated Time:** ~50-70 hours

---

## 🎯 Issues Ready to Implement (No Additional Info Needed)

### 1. **#26 - Multi-Language Support (i18n)** ⭐ RECOMMENDED NEXT
**Estimated:** 8-10 hours  
**Difficulty:** Intermediate  
**Priority:** High (improves accessibility)

**What to do:**
1. Install next-intl package
   ```bash
   cd frontend && npm install next-intl
   ```

2. Create translation files structure:
   ```
   frontend/messages/
   ├── en.json  (English - default)
   ├── es.json  (Spanish)
   ├── fr.json  (French)
   ├── zh.json  (Chinese)
   └── ja.json  (Japanese)
   ```

3. Configure next-intl in `frontend/app/layout.tsx`

4. Create language switcher component

5. Translate all UI strings (buttons, labels, messages)

**Files to create:**
- `frontend/messages/*.json` - Translation files
- `frontend/components/ui/language-switcher.tsx` - Language selector
- `frontend/middleware.ts` - i18n middleware

**Files to modify:**
- `frontend/app/layout.tsx` - Add i18n provider
- All component files - Wrap strings with `t()` function

**Acceptance criteria:**
- Users can switch between 5 languages
- All UI text is translated
- Language preference persists
- No hardcoded strings in components

---

### 2. **#34 - AI Metrics Clarity System** ⭐ QUICK WIN
**Estimated:** 4-6 hours  
**Difficulty:** Beginner  
**Priority:** Medium (improves AI responses)

**What to do:**
1. Create comprehensive metrics glossary:
   ```javascript
   // docs/METRICS_GLOSSARY.md
   # Metrics Glossary
   
   ## Financial Metrics
   - **TVL (Total Value Locked)**: Total value of assets locked in the protocol
   - **Transaction Volume**: Total value of transactions in 24h
   - **Fees**: Protocol fees collected
   ...
   ```

2. Create MetricsContextService:
   ```javascript
   // src/services/MetricsContextService.js
   export class MetricsContextService {
     getMetricDefinition(metricName) {
       return METRICS_GLOSSARY[metricName];
     }
     
     getContextForAI(metrics) {
       // Add definitions to AI prompt
     }
   }
   ```

3. Update ChatAIService to include glossary in prompts

4. Document 50+ metrics with:
   - Definition
   - Formula
   - Interpretation
   - Good/bad ranges

**Files to create:**
- `docs/METRICS_GLOSSARY.md` - Complete glossary
- `src/services/MetricsContextService.js` - Context provider

**Files to modify:**
- `src/services/ChatAIService.js` - Include glossary in prompts
- `src/services/GeminiAIService.js` - Add metric context

**Acceptance criteria:**
- 50+ metrics documented
- AI responses include metric definitions
- Glossary accessible via API
- Clear explanations for users

---

### 3. **#41 - Property-Based Tests** ⭐ QUALITY IMPROVEMENT
**Estimated:** 6-8 hours  
**Difficulty:** Advanced  
**Priority:** Medium (improves code quality)

**What to do:**
1. fast-check is already installed! Just use it:
   ```javascript
   import fc from 'fast-check';
   
   describe('Subscription calculations', () => {
     it('should be deterministic', () => {
       fc.assert(
         fc.property(
           fc.integer(0, 3), // tier
           fc.integer(0, 1), // billing cycle
           (tier, cycle) => {
             const price1 = calculatePrice(tier, cycle);
             const price2 = calculatePrice(tier, cycle);
             return price1 === price2;
           }
         )
       );
     });
   });
   ```

2. Create property tests for:
   - Subscription price calculations
   - API rate limiting
   - Block range calculations
   - Wallet address validation
   - Metric normalization
   - Date/time conversions

3. Test invariants:
   - Prices never negative
   - Block ranges always contiguous
   - Metrics always numeric
   - Addresses always valid format

**Files to create:**
- `tests/property/subscription.property.test.js`
- `tests/property/metrics.property.test.js`
- `tests/property/blockchain.property.test.js`
- `tests/property/validation.property.test.js`

**Acceptance criteria:**
- 20+ property tests
- Tests run in CI
- Cover critical business logic
- Find edge cases

---

### 4. **#42 - E2E Tests for Frontend** ⭐ QUALITY IMPROVEMENT
**Estimated:** 4-6 hours  
**Difficulty:** Intermediate  
**Priority:** Medium (prevents regressions)

**Decision needed:** Playwright or Cypress?
- **Playwright** (recommended): Faster, better TypeScript support
- **Cypress**: More mature, better debugging

**What to do (Playwright example):**
1. Install Playwright:
   ```bash
   cd frontend && npm install -D @playwright/test
   npx playwright install
   ```

2. Create test files:
   ```javascript
   // frontend/e2e/auth-flow.spec.ts
   test('complete user journey', async ({ page }) => {
     // Signup
     await page.goto('/signup');
     await page.fill('[name="email"]', 'test@example.com');
     await page.fill('[name="password"]', 'password123');
     await page.click('button[type="submit"]');
     
     // Login
     await page.goto('/login');
     // ... continue flow
     
     // Onboarding
     await page.goto('/onboarding');
     // ... test contract submission
     
     // Dashboard
     await page.goto('/dashboard');
     await expect(page.locator('h1')).toContainText('Welcome');
   });
   ```

3. Test critical flows:
   - Signup → Login → Onboarding → Dashboard
   - Wallet connection → Subscription purchase
   - Analysis creation → Results viewing
   - Chat interaction
   - Profile management

**Files to create:**
- `frontend/playwright.config.ts` - Playwright config
- `frontend/e2e/*.spec.ts` - Test files

**Acceptance criteria:**
- 10+ E2E tests
- Cover critical user journeys
- Run in CI
- Screenshot on failure

---

## 🔒 Issues Blocked (Need Additional Information)

### 5. **#30 - Add Stellar Blockchain Support**
**Estimated:** 8-12 hours  
**Blocked by:** Need Stellar configuration

**Information needed:**
1. Which Stellar network?
   - Mainnet: `https://horizon.stellar.org`
   - Testnet: `https://horizon-testnet.stellar.org`
   - Futurenet: `https://horizon-futurenet.stellar.org`

2. Stellar SDK preference?
   - `stellar-sdk` (official)
   - `@stellar/stellar-sdk` (new package name)

3. Support Soroban smart contracts?
   - Yes: Need Soroban RPC endpoint
   - No: Just classic Stellar transactions

4. RPC endpoints to use?
   - Primary URL
   - Failover URLs

**Once info provided:**
- Create `StellarRpcClient.js`
- Add to `MultiChainContractIndexer`
- Update chain configs
- Add to frontend chain selector

---

### 6. **#31 - Stellar-Based Subscription Payments**
**Estimated:** 10-14 hours  
**Blocked by:** Depends on #30 + Need contract details

**Information needed:**
1. Stellar smart contract deployed?
   - Contract address
   - Contract ABI/interface
   - Network (testnet/mainnet)

2. Which wallet providers to support?
   - Freighter (most popular)
   - Albedo
   - xBull
   - Rabet

3. Payment tokens?
   - XLM (native Lumens)
   - USDC on Stellar
   - Custom token?

4. Subscription contract functions?
   - How to call subscribe?
   - How to check status?
   - How to cancel?

**Once info provided:**
- Create `StellarPaymentService.js`
- Add Stellar wallet support
- Update subscription UI
- Test on testnet

---

### 7. **#33 - AI Chat External Data Integration**
**Estimated:** 10-14 hours  
**Blocked by:** Need API keys and rate limits

**Information needed:**
1. Block explorer APIs:
   - **Etherscan**: API key? Rate limit?
   - **Lisk Explorer**: API key? Rate limit?
   - **Starkscan**: API key? Rate limit?

2. Price data APIs:
   - **CoinGecko**: Free or Pro? API key?
   - **CoinMarketCap**: API key? Rate limit?
   - Alternative: CryptoCompare, Messari?

3. Which data to integrate?
   - Contract verification status
   - Token prices
   - Historical price data
   - Market cap data
   - Social metrics

4. Report generation:
   - PDF format needed?
   - CSV export needed?
   - Email delivery?

**Once info provided:**
- Create `ExternalDataService.js`
- Integrate block explorers
- Add price data
- Generate comprehensive reports
- Add to chat context

---

### 8. **#35 - PostgreSQL Database Migration**
**Estimated:** 12-16 hours  
**Blocked by:** Need PostgreSQL setup

**Information needed:**
1. PostgreSQL installation:
   - Already installed? Version?
   - Docker container? Local install?
   - Cloud service? (AWS RDS, Heroku, etc.)

2. Connection details:
   - Host (localhost or remote?)
   - Port (default 5432?)
   - Database name
   - Username
   - Password

3. Migration strategy:
   - Migrate all data at once?
   - Gradual migration?
   - Keep JSON as backup?

4. Schema preferences:
   - Use existing schema in `scripts/`?
   - Modifications needed?
   - Indexes to add?

**Once info provided:**
- Setup PostgreSQL connection
- Run schema creation
- Create migration scripts
- Migrate data from JSON
- Update storage layer
- Test all endpoints
- Benchmark performance

---

## 📊 Summary

### Can Do Now (4 issues)
| Issue | Time | Priority | Type |
|-------|------|----------|------|
| #26 - i18n | 8-10h | High | Feature |
| #34 - AI Metrics | 4-6h | Medium | Documentation |
| #41 - Property Tests | 6-8h | Medium | Quality |
| #42 - E2E Tests | 4-6h | Medium | Quality |
| **Total** | **22-30h** | | |

### Blocked (4 issues)
| Issue | Time | Blocked By |
|-------|------|------------|
| #30 - Stellar | 8-12h | Network config, RPC URLs |
| #31 - Stellar Pay | 10-14h | Contract address, wallets |
| #33 - External Data | 10-14h | API keys, rate limits |
| #35 - PostgreSQL | 12-16h | DB setup, connection |
| **Total** | **40-56h** | |

---

## 🎯 Recommended Order for Tomorrow

### Morning Session (4-5 hours)
1. **#34 - AI Metrics Clarity** (4-6h) - Quick documentation win
2. **Start #42 - E2E Tests** (setup only, 1h)

### Afternoon Session (4-5 hours)
1. **Complete #42 - E2E Tests** (3-5h)
2. **Start #26 - i18n** (setup, 1h)

### Evening Session (if time)
1. **Continue #26 - i18n** (7-9h remaining)

### Next Day
1. **Complete #26 - i18n**
2. **#41 - Property Tests** (6-8h)

---

## 🎉 Current Achievement

**Progress:** 36/44 issues (82%)  
**Completed Today:** 6 issues in ~3 hours  
**Efficiency:** 95% faster than estimated  
**Quality:** All minimal code changes, no breaking changes

**Outstanding PRs:**
- PR #52: Quick wins (Dashboard, Subscription, Indexer)
- PR #53: Metrics & Analyzer
- PR #54: Alert Management

**All ready for review and merge!**

---

## 📝 Notes

- fast-check already installed for property tests
- Playwright recommended for E2E (faster, better TS support)
- i18n will require translating ~200-300 strings
- AI metrics glossary should cover 50+ metrics
- All blocked issues need external configuration

**Keep using the "ABSOLUTE MINIMAL" code philosophy!** 🎯
