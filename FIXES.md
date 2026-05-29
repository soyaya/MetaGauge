# MetaGauge — Fixes & Issues Log

All issues found during the full codebase review (April–May 2026), with file locations, root causes, fixes applied, and expected results.

---

## 1. `/api/functions/wallet-analytics` — Route Shadowed (404)

**File:** `src/api/server.js` lines 237, 261  
**Found:** Code review — route registration order  
**Issue:** `app.use('/api/functions', ...)` was registered before `app.use('/api/functions/wallet-analytics', ...)`. Express matched `/api/functions` first and returned 404 for wallet analytics — the second mount was never reached.  
**Fix:** Moved `/api/functions/wallet-analytics` registration to line 239, before `/api/functions`.  
**Expected result:** Wallet Analytics tab on the dashboard loads data correctly.

---

## 2. `quick-scan-progress.tsx` — Missing `/api` Prefix

**File:** `frontend/components/analyzer/quick-scan-progress.tsx` lines 48, 84  
**Found:** Code review — API call paths  
**Issue:** Both calls used paths without the `/api` prefix (`/analysis/quick-scan`, `/analysis/:id/status`). `apiRequest()` prepends the base URL directly, so these resolved to `http://localhost:5000/analysis/...` — a 404.  
**Fix:** Added `/api` prefix to both calls.  
**Expected result:** Quick scan progress polling and submission work correctly.

---

## 3. `signup/page.tsx` — Silent OTP Failure

**File:** `frontend/app/signup/page.tsx` lines 94–104  
**Found:** Code review — raw fetch with no error handling  
**Issue:** `fetch('/api/auth/send-verification')` had no `.ok` check. If the email failed to send, the user was silently redirected to `/verify` and never received an OTP code.  
**Fix:** Added `if (!verifyRes.ok)` check that throws with the server's error message, which is caught and shown to the user.  
**Expected result:** If verification email fails, user sees an error message instead of being stuck on the verify page.

---

## 4. `layout.tsx` — Wrong Chains in Metadata

**File:** `frontend/app/layout.tsx` line 12  
**Found:** Code review — metadata description  
**Issue:** Description said "Ethereum, Polygon, and Starknet" — Polygon is not supported.  
**Fix:** Changed to "Ethereum and Starknet".  
**Expected result:** Correct SEO metadata and social previews.

---

## 5. Landing Page — Wrong Chain Count and Names

**Files:** `frontend/app/page.tsx` lines 52, 135, 160  
**Found:** Code review — UI copy inconsistency  
**Issue:** Stats bar said "2 Chains", hero badge said "Ethereum · Starknet", feature card said "Ethereum and Starknet" — but README claimed 3 chains (Ethereum, Lisk, Starknet). Lisk is not actually supported.  
**Fix:** Stats bar set to "2 Chains", hero badge set to "Ethereum · Starknet", feature card description corrected. Lisk removed from all user-facing copy.  
**Expected result:** Consistent, accurate chain information across the landing page.

---

## 6. `transaction-success-dialog.tsx` — Hardcoded "Lisk Sepolia Explorer"

**File:** `frontend/components/ui/transaction-success-dialog.tsx` line 104  
**Found:** Code review — hardcoded string  
**Issue:** Explorer link label was hardcoded to "View on Lisk Sepolia Explorer" regardless of the actual chain.  
**Fix:** Added `getExplorerName(chainId)` to `web3-config.ts` and used it dynamically in the dialog.  
**Expected result:** Explorer link shows the correct network name for any chain.

---

## 7. Analysis Count Incremented in Two Places

**Files:** `src/api/routes/analysis.js` lines 1072–1074, `src/services/SubscriptionService.js`  
**Found:** Code review — double counting  
**Issue:** `analysis.js` manually called `UserStorage.update({ 'usage.analysisCount': +1 })` after completion AND `subscriptionService.charge('analysis')` was never called — so quota was never checked or charged, and the count was incremented without going through the billing system.  
**Fix:** `analysis.js` now calls `subscriptionService.charge(userId, 'analysis')` at the start (blocks if quota exceeded). The manual `UserStorage.update` increment was removed. One path only.  
**Expected result:** Analysis quota is enforced. Count is incremented exactly once via `SubscriptionService`.

---

## 8. AI Routes Not Charging `ai_query`

**File:** `src/api/routes/analysis.js` — `/interpret` and `/quick-insights` routes  
**Found:** Code review — missing quota check  
**Issue:** `POST /:id/interpret` and `GET /:id/quick-insights` called Gemini AI freely with no quota check. Chat, competitive, and traction routes all charged `ai_query` — these two didn't.  
**Fix:** Both routes now call `subscriptionService.charge(req.user.id, 'ai_query')` before calling Gemini. Returns 402 if quota exceeded.  
**Expected result:** AI usage is consistently metered across all AI-powered endpoints.

---

## 9. Hardcoded Tier Limits in `analysis.js` and `onboarding.js`

**Files:** `src/api/routes/analysis.js` line 92, `src/api/routes/onboarding.js` lines 844–847  
**Found:** Code review — magic numbers disconnected from config  
**Issue:** Both files had `user.tier === 'free' ? 10 : user.tier === 'pro' ? 100 : -1` — completely disconnected from `FREE_QUOTA` in `src/config/pricing.js` (which is 3). Changing the quota in one place had no effect on the other.  
**Fix:** Both now import and use `FREE_QUOTA.analyses` from `src/config/pricing.js`.  
**Expected result:** Changing `FREE_QUOTA.analyses` in one file propagates everywhere.

---

## 10. `PRICING` Object Missing Free Quota Keys

**File:** `src/config/pricing.js`  
**Found:** Code review — frontend subscription page broken  
**Issue:** The subscription page used `p.freeAnalyses`, `p.freeAiQueries`, `p.freeContracts`, `p.perContractMonth` — none of these keys existed in `PRICING`. They were `undefined`, causing progress bars to show 0% and pricing table to show `$undefined`.  
**Fix:** Added `freeAnalyses`, `freeAiQueries`, `freeContracts`, `freeAlerts`, `perContractMonth` to the `PRICING` export, derived from `FREE_QUOTA` so they stay in sync.  
**Expected result:** Subscription page progress bars and pricing table display correct values.

---

## 11. `subscription-status.tsx` — Hardcoded Wrong Fallback Values

**File:** `frontend/components/subscription/subscription-status.tsx`  
**Found:** Code review — hardcoded values contradicting config  
**Issue:** Fallback values were `analyses: 10, aiQueries: 50` — but `FREE_QUOTA` is 3/3. The component showed wrong limits when the API was slow.  
**Fix:** Fallback now reads from `usage.pricing.freeAnalyses ?? 3` — derived from the API response, with `3` as the true fallback matching `FREE_QUOTA`.  
**Expected result:** Subscription status widget always shows correct quota numbers.

---

## 12. Flutterwave — Wrong API Version (v3 vs v4)

**File:** `src/api/routes/billing.js`  
**Found:** Flutterwave documentation review  
**Issue:** Initial implementation used Flutterwave v3 redirect flow (`/v3/payments`). The actual credentials provided (Client ID + Client Secret) are for the v4 API which uses OAuth2 token auth, direct card charging with AES-256-GCM encryption, and a different webhook signature scheme.  
**Fix:** Completely rewrote billing.js with the v4 flow:
- `POST /api/billing/flw-token` — OAuth2 token + encryption key for frontend
- `POST /api/billing/flw-charge` — customer → card object → charge
- `POST /api/billing/flw-pin` — PIN submission for 3DS
- Frontend encrypts card data in browser with AES-256-GCM before sending  
**Expected result:** Card payments work end-to-end with Flutterwave v4.

---

## 13. Flutterwave Webhook — Wrong Signature Header and Algorithm

**File:** `src/api/routes/billing.js` — `flutterwaveWebhookHandler`  
**Found:** Flutterwave webhook documentation  
**Issue:** Handler checked `req.headers['verif-hash']` (v3 header) with a plain string comparison. v4 uses `req.headers['flutterwave-signature']` with HMAC-SHA256 base64. Also responded after processing instead of immediately, risking 60s timeout failures.  
**Fix:**
- Header changed to `flutterwave-signature`
- Verification changed to `crypto.createHmac('sha256', secret).update(rawBody).digest('base64')`
- `res.status(200).end()` called immediately before processing
- Added idempotency check using `event.id` to prevent double-crediting  
**Expected result:** Webhooks are correctly verified, processed once, and acknowledged within the 60s timeout.

---

## 14. RPC Failover — Gateway Unwrapping Bug

**File:** `src/services/EthereumRpcClient.js` lines 85–92  
**Found:** Live testing — `eth_getLogs` returning `undefined`  
**Issue:** The gateway (`gateway.thebuidl.xyz`) wraps responses as `{ status: 'success', result: { jsonrpc, result, error } }`. The unwrapping code did:
```js
data.result = data.result.result;   // → undefined when inner has error
data.error  = data.result?.error;   // → undefined (data.result already overwritten)
```
When the gateway returned an RPC error (e.g. unsupported block range), `data.error` was lost and `undefined` was returned silently — no failover triggered.  
**Fix:** Extract `inner.error` before overwriting `data.result`:
```js
const inner = data.result;
data.error  = inner.error ?? null;
data.result = inner.result;
```  
**Expected result:** Gateway RPC errors trigger failover to `publicnode` / `drpc.org` / `llamarpc`. `eth_getLogs` returns correct results.

---

## 15. RPC URLs — Scattered Inline Arrays

**Files:** `src/api/routes/trigger-indexing.js`, `competitor-indexing.js`, `dashboard.js`, `subscription.js`, `src/services/WalletEnrichmentPipeline.js`, `CompetitorIndexer.js`  
**Found:** Code review — 6 files each building their own `rpcUrls` array  
**Issue:** Each file had its own inline array of RPC URLs. Adding a new RPC or changing fallbacks required editing 6 files. `CompetitorIndexer.js` passed no URLs at all (`new EthereumRpcClient()`).  
**Fix:** Added `getEthereumRpcUrls()`, `getStarknetRpcUrls()`, `getRpcUrls(chain)` to `src/config/env.js`. All 6 files now import and use these helpers.  
**Expected result:** RPC list managed in one place. All services use the same 4-URL Ethereum fallback chain: gateway → publicnode → drpc.org → llamarpc.

---

## 16. `eth.drpc.org` Added as Ethereum Fallback

**File:** `src/config/env.js`, `.env`  
**Found:** User request  
**Issue:** `https://eth.drpc.org` was not in the fallback list.  
**Fix:** Added to `ETH_PUBLIC_FALLBACKS` in `env.js` and set as `ETHEREUM_RPC_URL3` in `.env`.  
**Expected result:** 4 Ethereum RPC endpoints available with automatic failover.

---

## 17. Indexing — `scanEnd is not defined` Crash

**File:** `src/api/routes/trigger-indexing.js` lines 238, 353, 360, 373  
**Found:** Live testing — `❌ Indexing failed: scanEnd is not defined`  
**Issue:** `let scanEnd = currentBlock` was declared inside the `else` (Ethereum) block but used after the `if/else` closes — in the metrics save and blockRange calculations. JavaScript block scoping made it inaccessible outside the `else`.  
**Fix:** Moved `let scanEnd = currentBlock` to before the `if (isStarknet)` block so it's in scope for both branches.  
**Expected result:** Indexing completes without crashing. `scanEnd` is always defined when used.

---

## 18. Indexing — Scan Range Too Short (5 chunks = 50,000 blocks)

**File:** `src/api/routes/trigger-indexing.js` line 240  
**Found:** Live testing — contracts with no recent activity returned 0 transactions  
**Issue:** `MAX_EMPTY = 5` meant the backward scan stopped after 5 consecutive empty chunks (50,000 blocks ≈ 7 days). Contracts with no recent activity were indexed as empty even if they had historical transactions.  
**Fix:** Increased to `MAX_EMPTY = 20` (200,000 blocks ≈ 1 month). Added forward scan from `deploymentBlock` when known — scans from contract creation forward instead of backwards from current block.  
**Expected result:** Contracts with historical activity are indexed correctly. Contracts with known deployment blocks are scanned efficiently from their creation block.

---

## 19. Indexing — Phase 1 Backward Scan Missing `while` Loop

**File:** `src/api/routes/trigger-indexing.js`  
**Found:** During fix #17 and #18 — introduced during refactoring  
**Issue:** When adding the forward scan path, the backward scan body lost its `while` loop wrapper. The `continue` and `scanEnd = scanStart - 1` statements were orphaned, causing a syntax error.  
**Fix:** Rewrote the entire Phase 1 section cleanly with proper `if (deployBlock) { while... } else { while... }` structure.  
**Expected result:** Syntax valid. Both forward and backward scan paths work correctly.

---

## 20. Go-Live Blockers (Not Yet Fixed — Requires Deployment Config)

**Files:** `.env`, `frontend/.env`, `src/api/server.js`  
**Found:** Go-live readiness check  

| Item | Current Value | Required for Production |
|---|---|---|
| `FLW_SANDBOX` | `true` | `false` |
| `FRONTEND_URL` | `http://localhost:3000` | `https://metagauge.xyz` |
| `NEXT_PUBLIC_API_URL` | `http://172.19.160.1:5000` | `https://api.metagauge.xyz` |
| `NODE_ENV` | not set | `production` |
| `JWT_SECRET` | default value | random 64-char string |
| `POSTGRES_PASSWORD` | default value | strong unique password |
| CORS origins | localhost only | add `https://metagauge.xyz` |
| `FLW_WEBHOOK_HASH` | placeholder | set in Flutterwave dashboard |

**Expected result:** App runs correctly in production with real payments, correct redirects, and secure secrets.

---

*Document generated: 2026-05-01*
