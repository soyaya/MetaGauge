# MetaGauge — Production Issues

---

## 🔴 CRITICAL (App-Breaking)

### 1. `performDefaultContractRefresh` not defined
- **File:** `src/api/routes/onboarding.js`
- **Issue:** Function called but never defined or imported → `ReferenceError` crash at runtime
- **Fix:** Define the function or remove the call. It should re-trigger indexing for the contract using `streamingIndexer.startIndexing(contract)`.

---

### 2. Subscription verification is a stub
- **File:** `src/api/routes/subscription.js`
- **Issue:** `verifySubscriptionPayment` always returns `valid: true` with tier `'starter'` — any tx hash upgrades any user for free
- **Fix:** Implement real on-chain verification using ethers.js to check the tx hash against the payment contract address and amount.

---

### 3. `contract` variable undefined in traction routes
- **File:** `src/api/routes/traction.js`
- **Issue:** `GET /tasks/:taskId/recommendation` and `POST /tasks/:taskId/check` reference `contract` which is never defined → always `undefined`
- **Fix:** Fetch the contract from `ContractStorage.findById(req.params.contractId)` before using it.

---

### 4. `getUserInsights()` not async but uses await
- **File:** `src/services/SimpleAIService.js`
- **Issue:** Function uses `await` internally but is not declared `async` → runtime crash
- **Fix:** Add `async` keyword to the function declaration.

---

### 5. Assignment persistence is stubbed
- **File:** `src/services/SimpleAIService.js`
- **Issue:** `readAssignments()`, `writeAssignments()`, `readImprovements()`, `writeImprovements()` are empty stubs → assignments never save
- **Fix:** Implement using `AITasksStorage` from `database/index.js` (already exists).

---

### 6. Monthly subscription reset never persists
- **File:** `src/services/SubscriptionService.js`
- **Issue:** `_maybeResetMonthly()` passes snake_case keys (`usage_count`) to `UserStorage.update()` which expects camelCase → update silently does nothing
- **Fix:** Change keys to camelCase: `usageCount`, `lastResetDate`, etc.

---

### 7. Users cannot delete their own account
- **File:** `src/api/routes/users.js`
- **Issue:** `DELETE /delete-account` is guarded by `requireRole('admin')` → regular users get 403
- **Fix:** Change guard to `authenticateToken` only, and ensure the route deletes `req.user.id` not an arbitrary ID.

---

### 8. OTP verification is fake
- **File:** `frontend/lib/api.ts`
- **Issue:** `verifyOTP` always returns `{ success: true }` regardless of input → email verification is completely bypassed
- **Fix:** Make a real `POST /api/auth/verify-otp` call and return the actual response.

---

### 9. Expired JWT treated as valid
- **File:** `frontend/components/auth/auth-provider.tsx`
- **Issue:** `isAuthenticated` is `!!token` (string presence check only) → expired tokens in localStorage pass as valid until the first 401
- **Fix:** Decode the JWT on load (using `jwt-decode`) and check the `exp` field. Clear token and redirect if expired.

---

### 10. Subscription page fires unauthenticated API call
- **File:** `frontend/app/subscription/page.tsx`
- **Issue:** `load()` is called in `useEffect([], [])` before `authLoading` resolves → fires for unauthenticated users
- **Fix:** Add `authLoading` and `isAuthenticated` to the effect's dependencies and guard: `if (authLoading || !isAuthenticated) return`.

---

### 11. Analyzer page fires agent API call twice
- **File:** `frontend/app/analyzer/page.tsx`
- **Issue:** The `useEffect` for `api.agent.analyze` is duplicated exactly → doubles API usage on every mount
- **Fix:** Remove the duplicate `useEffect` block.

---

### 12. Missing `billing` column in users table
- **File:** `scripts/create-schema.js`
- **Issue:** `SubscriptionService` reads/writes `user.billing` but the column doesn't exist in the schema → DB error on any subscription action
- **Fix:** Add `billing JSONB DEFAULT '{}'` to the `users` table definition. Run: `ALTER TABLE users ADD COLUMN IF NOT EXISTS billing JSONB DEFAULT '{}';`

---

### 13. Missing `social_credentials` column in users table
- **File:** `scripts/create-schema.js`
- **Issue:** `users.js` route reads/writes `social_credentials` but column doesn't exist
- **Fix:** Add `social_credentials JSONB DEFAULT '{}'` to users table. Run: `ALTER TABLE users ADD COLUMN IF NOT EXISTS social_credentials JSONB DEFAULT '{}';`

---

### 14. Non-atomic file writes (file storage mode)
- **File:** `src/api/database/fileStorage.js`
- **Issue:** Write is not atomic — crash between backup copy and new write corrupts the JSON file permanently
- **Fix:** Write to a `.tmp` file first, then `fs.renameSync()` to the target (rename is atomic on most OS).

---

### 15. No file locking (file storage mode)
- **File:** `src/api/database/fileStorage.js`
- **Issue:** Concurrent writes from multiple requests corrupt JSON files
- **Fix:** Use a per-file async mutex (e.g. `async-mutex` package) around all read-write operations.

---

## 🟠 HIGH (Serious Bugs)

### 16. JWT secret has insecure hardcoded fallback
- **File:** `src/api/middleware/auth.js`
- **Issue:** Falls back to `'your-super-secret-jwt-key-change-in-production'` if `JWT_SECRET` env var not set
- **Fix:** Throw an error on startup if `JWT_SECRET` is not set. Never use a fallback.

---

### 17. All users get `role: 'admin'` in JWT
- **File:** `src/api/middleware/auth.js`
- **Issue:** `generateToken()` hardcodes `role: 'admin'` for every user
- **Fix:** Pass the actual user role from the DB: `role: user.role || 'user'`.

---

### 18. bcrypt cost factor too low
- **Files:** `src/api/routes/auth.js`, `src/api/routes/users.js`
- **Issue:** bcrypt rounds set to `6` — far too fast for production (brute-forceable)
- **Fix:** Change to `12`: `bcrypt.hash(password, 12)`.

---

### 19. OTP leaked in API response
- **File:** `src/api/routes/auth.js`
- **Issue:** `devOtp` returned in the response body when email sending fails — exposes the OTP in production
- **Fix:** Remove `devOtp` from all responses. Log it only in development: `if (process.env.NODE_ENV === 'development') console.log(otp)`.

---

### 20. Social credentials stored unencrypted
- **File:** `src/api/routes/users.js`
- **Issue:** Twitter/LinkedIn API keys and secrets stored as plain text in the user record
- **Fix:** Encrypt with `crypto.createCipheriv` using a server-side key before storing, decrypt on read.

---

### 21. ABI validation always skips parsing
- **File:** `src/api/routes/contracts.js`
- **Issue:** Checks `abi.startsWith('{')` but valid ABIs are arrays starting with `[` → validation always skips
- **Fix:** Change to `abi.startsWith('[')`.

---

### 22. Lisk missing from RPC config in contracts route
- **File:** `src/api/routes/contracts.js`
- **Issue:** Lisk not in `envRpcConfig` map → Lisk contracts skip on-chain validation silently
- **Fix:** Add Lisk RPC URLs to the config map using `process.env.LISK_RPC_URL1`.

---

### 23. `toSnakeCase()` doesn't recurse
- **File:** `src/api/database/postgresStorage.js`
- **Issue:** Nested camelCase objects produce wrong column names silently
- **Fix:** Add recursion for nested objects (same pattern as `toCamelCase`), but skip `Date` instances.

---

### 24. `UserStorage.update()` mutates caller's argument
- **File:** `src/api/database/postgresStorage.js`
- **Issue:** Deletes keys from the passed `updates` object in-place — causes subtle bugs in callers that reuse the object
- **Fix:** Work on a copy: `const snakeUpdates = toSnakeCase({ ...updates })`.

---

### 25. Schema runs outside a transaction
- **File:** `scripts/create-schema.js`
- **Issue:** If any statement fails mid-run, the schema is left half-created with no rollback
- **Fix:** Wrap all statements in `BEGIN; ... COMMIT;` or use a single transaction in the script.

---

### 26. `alert_configs.contract_id` type mismatch
- **File:** `scripts/create-schema.js`
- **Issue:** `contract_id VARCHAR(255)` but `contracts.id` is `UUID` → no referential integrity, joins silently fail
- **Fix:** Change to `contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE`.

---

### 27. `getUserById()` returns hardcoded email
- **File:** `src/services/SimpleAIService.js`
- **Issue:** Always returns `{ email: 'user@example.com' }` → all notifications go to the wrong address
- **Fix:** Replace with `await UserStorage.findById(userId)`.

---

### 28. ETH price hardcoded as $2500
- **Files:** `src/api/routes/onboarding.js`, `src/api/routes/traction.js`
- **Issue:** USD calculations always use $2500 regardless of actual price
- **Fix:** Call `priceService.getEthPrice()` which is already imported in both files.

---

### 29. `monitorAnalysis` uses unbounded recursion
- **File:** `frontend/lib/api.ts`
- **Issue:** Recursive polling with no max depth → stack overflow on long-running analyses
- **Fix:** Convert to a `setInterval` loop with a max attempt counter and timeout.

---

### 30. `usage.limit` hardcoded to 10 on profile page
- **File:** `frontend/app/profile/page.tsx`
- **Issue:** Pro/Enterprise users always see `10` as their limit
- **Fix:** Read the limit from the subscription status API response.

---

### 31. `exportCSV` exports undefined fields
- **File:** `frontend/app/analyzer/page.tsx`
- **Issue:** Accesses `data.defiMetrics?.bounceRate` and `avgSessionDuration` which don't exist on that object
- **Fix:** Map to the correct fields from the actual data structure.

---

### 32. `lisk` chain missing from onboarding UI
- **File:** `frontend/app/onboarding/page.tsx`
- **Issue:** Lisk is supported by the backend but not listed as an option in the chain selector
- **Fix:** Add `{ value: 'lisk', label: 'Lisk', ... }` to the `CHAINS` array.

---

### 33. Chat message can be sent twice on double-click
- **File:** `frontend/components/chat/chat-interface.tsx`
- **Issue:** No deduplication guard on `handleSendMessage`
- **Fix:** Disable the send button while `isLoading` is true (already tracked in state).

---

## 🟡 MEDIUM (UX / Reliability)

### 34. Rate limiting disabled
- **File:** `src/api/server.js`
- **Fix:** Uncomment and re-enable the global rate limiter middleware.

---

### 35. Debug endpoints exposed in production
- **File:** `src/api/server.js`
- **Issue:** `/api/test-register`, `/test`, `/test-post` are live
- **Fix:** Wrap with `if (process.env.NODE_ENV !== 'production')` or remove entirely.

---

### 36. WebSocket allows user impersonation
- **File:** `src/api/server.js`
- **Issue:** `register` message accepts any `userId` from client without verifying the JWT
- **Fix:** Extract `userId` from the verified JWT token sent during the WebSocket handshake, not from the message payload.

---

### 37. `initializeIndexerRoutes` called twice
- **File:** `src/api/server.js`
- **Issue:** `/api/indexer` routes registered twice
- **Fix:** Remove the duplicate call.

---

### 38. In-memory rate limit stores grow unbounded
- **Files:** `src/services/ChatAIService.js`, `src/services/GeminiAIService.js`
- **Issue:** `chatRateLimitStore` / `rateLimitStore` Maps never evict entries → memory leak over time
- **Fix:** Add TTL eviction or use Redis for rate limiting state.

---

### 39. `generateSuggestedQuestions` always returns hardcoded questions
- **File:** `src/services/ChatAIService.js`
- **Fix:** Implement the Gemini call to generate context-aware questions based on the contract data.

---

### 40. `KB_DIR` breaks if server not started from project root
- **File:** `src/services/RAGContextBuilder.js`
- **Fix:** Use `import.meta.url` / `__dirname` to resolve the path relative to the file, not `process.cwd()`.

---

### 41. `fileStorage.js` `findAll()` reads every user's files
- **File:** `src/api/database/fileStorage.js`
- **Issue:** O(n users) disk reads on every query — won't scale
- **Fix:** Migrate to PostgreSQL (already supported) or add an in-memory index.

---

### 42. Chain logos loaded from external CDN
- **File:** `frontend/app/onboarding/page.tsx`
- **Issue:** Coingecko CDN images break if CDN is down
- **Fix:** Download and serve chain logos from `/public/images/chains/`.

---

### 43. Competitor cards use array index as React key
- **File:** `frontend/components/analyzer/competitive-tab.tsx`
- **Issue:** `key={i}` causes React to reuse wrong component state when a competitor is removed
- **Fix:** Use `key={competitor.address}` or a stable unique ID.

---

### 44. `confirm()` used for competitor removal
- **File:** `frontend/components/analyzer/competitive-tab.tsx`
- **Issue:** Native `confirm()` is blocked in iframes and inconsistent with app UI
- **Fix:** Replace with a shadcn `AlertDialog` confirmation modal.

---

### 45. `logout` causes full page reload
- **File:** `frontend/components/auth/auth-provider.tsx`
- **Fix:** Replace `window.location.href = '/'` with `router.push('/')` from `useRouter`.

---

### 46. `localStorage` accessed without SSR guard
- **File:** `frontend/components/auth/auth-provider.tsx`
- **Fix:** Wrap all `localStorage` calls with `if (typeof window !== 'undefined')`.

---

### 47. Stale error persists when switching chat sessions
- **File:** `frontend/app/chat/page.tsx`
- **Fix:** Call `setError('')` at the start of `createOrLoadContractSession` and `loadChatSessions`.

---

### 48. All `console.log` debug statements in production
- **Files:** `frontend/lib/api.ts`, `frontend/app/dashboard/page.tsx`, multiple others
- **Fix:** Remove or gate behind `process.env.NODE_ENV === 'development'`.

---

## Quick DB Fixes (Run Now)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_credentials JSONB DEFAULT '{}';
ALTER TABLE alert_configs ALTER COLUMN contract_id TYPE UUID USING contract_id::UUID;
```
