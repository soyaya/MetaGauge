# Requirements Document — MetaGauge Admin Dashboard

## Introduction

The MetaGauge Admin Dashboard is a standalone, role-gated control plane for platform operators. It shares the same PostgreSQL database as the main app but is served at `/admin` with its own layout, visually distinct from the user-facing analytics dashboard.

**Authentication is hardcoded** — admin credentials are set via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). There is no self-registration for admins. The admin session uses a separate JWT signed with `ADMIN_JWT_SECRET`.

The admin can read and mutate every entity in the system: users, contracts, subscriptions, alerts, AI usage, indexing jobs, billing, feature flags, announcements, RPC config, rate limits, email settings, and selected runtime `.env` values — all without a server restart where possible.

---

## Glossary

- **Admin**: Operator authenticated via hardcoded credentials. Full CRUD on all platform data.
- **Platform_User**: A registered end-user of MetaGauge (role: analyst or viewer).
- **Tier**: Subscription level — `free`, `starter`, `pro`, `enterprise`.
- **Indexing_Job**: Background task fetching on-chain data for a contract.
- **Audit_Event**: Append-only record of every admin action.
- **Feature_Flag**: Named boolean toggling a platform capability at runtime.
- **Announcement**: System-wide banner shown to all authenticated users.
- **Churn_Risk_Score**: 0–100. Formula: `(days_since_last_login/30)×40 + (1−alert_ack_rate)×30 + (1−ai_engagement_rate)×30`, capped at 100.
- **Engagement_Score**: 0–100 composite of login frequency (33%), dashboard page views (33%), and actions taken (33%) over last 30 days.
- **Time_To_Value**: Elapsed time from registration to first completed indexing job.
- **DAU/WAU/MAU**: Unique users active in last 24h / 7d / 30d.
- **MRR**: Monthly Recurring Revenue estimated from active paid subscriptions.
- **Runtime_Config**: A subset of `.env` values the admin can update live via the dashboard (stored in DB, overrides file `.env` at runtime).

---

## Architecture Notes

- Admin frontend: Next.js, route prefix `/admin`, separate layout component.
- Admin backend: Express routes under `/api/admin/*`, protected by `requireAdminAuth` middleware.
- Shared DB: Same PostgreSQL instance as main app. Admin reads/writes directly.
- No separate admin database or service.
- All admin mutations record an `Audit_Event` before returning a response.

---

## Requirement 1 — Admin Authentication (Hardcoded)

**Story:** As an operator, I log in with hardcoded credentials so that no self-registration path exists for admin access.

1. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are read from environment variables at server startup.
2. `POST /api/admin/auth/login` accepts `{ email, password }`, validates against env vars, and returns a signed JWT (`ADMIN_JWT_SECRET`, 8h expiry).
3. All `/api/admin/*` routes (except `/login`) require the `requireAdminAuth` middleware which validates this JWT.
4. Failed login attempts are rate-limited to 5 per 15 minutes per IP; the 6th attempt returns HTTP 429.
5. The admin frontend at `/admin/login` is the only entry point. Navigating to any `/admin/*` page without a valid token redirects to `/admin/login`.
6. The admin JWT is stored in `httpOnly` cookie, not `localStorage`.
7. `POST /api/admin/auth/logout` clears the cookie and invalidates the token server-side (token blocklist in DB).
8. On successful login, a `Security_Event` of type `admin_login` is recorded with IP and timestamp.

---

## Requirement 2 — Admin Layout & Navigation

1. The admin layout renders a persistent left sidebar with links to all sections listed below.
2. The layout is visually distinct from the main app (different color scheme, "ADMIN" badge in header).
3. Sidebar header shows the admin email and a logout button.
4. Active nav item is highlighted without full page reload (Next.js client navigation).
5. A "Back to Main App" link opens the main app in a new tab.
6. The sidebar collapses to icons on small screens.

---

## Requirement 3 — CRM: User Management (Full CRUD)

**Story:** As an admin, I need complete control over every user account.

### 3.1 User List
1. Paginated table (default 25/page) with columns: name, email, role, tier, status (Active/Deactivated/Locked), registration date, last login, total contracts, total analyses, monthly analysis count, API key count, 2FA status, OAuth provider.
2. Search by name or email (case-insensitive partial match, results within 1s).
3. Filter by: tier, status, role, OAuth provider, date range (registered), date range (last login).
4. Sort by: registration date (default desc), last login, tier, analysis count.
5. Export filtered list as CSV.

### 3.2 Create User
1. Admin can create a user with: name, email, password, role (analyst/viewer), tier.
2. System sends a welcome email if SMTP is configured.
3. Records `Audit_Event` of type `user_created`.

### 3.3 Edit User
1. Admin can update: name, email, role, tier, `isActive`, `emailVerified`, preferences.
2. Admin can manually set a user's password (hashed before save).
3. Admin can regenerate a user's API key.
4. Admin cannot change their own admin credentials from this panel (separate setting).
5. Records `Audit_Event` of type `user_updated` with diff of changed fields.

### 3.4 Deactivate / Reactivate
1. Deactivating sets `isActive = false`, invalidates all active sessions, returns HTTP 403 on next request.
2. Reactivating sets `isActive = true`.
3. Both record `Audit_Event`.

### 3.5 Delete User (GDPR Erase)
1. Hard delete: removes all PII, anonymises analytics rows, deletes contracts/analyses/alerts/chat history.
2. Confirmation dialog shows count of records to be deleted.
3. Records `Audit_Event` of type `user_data_erased`.
4. Export user data as ZIP before deletion (GDPR right of access).

### 3.6 Account Lock / Unlock
1. Admin can manually lock or unlock any account.
2. Locked accounts return HTTP 403 with message "Account locked. Contact support."
3. Records `Security_Event` of type `account_locked` or `account_unlocked`.

### 3.7 Session Management
1. Per-user panel shows all active sessions: device, IP, browser, last active.
2. Admin can revoke a single session or all sessions for a user.
3. Records `Audit_Event` of type `session_revoked` or `all_sessions_revoked`.

### 3.8 Internal Notes
1. Admin can add, edit, delete free-text notes on any user profile.
2. Notes are never exposed to the user via any API.
3. Each note stores: author (admin email), timestamp, text.
4. Records `Audit_Event` of type `admin_note_saved`.

### 3.9 User Context Panel
Opened via "View Context" on any user row. Displays within 3s:

**Account & Activity**
- Registration date, last login, days since last login, total login count (all time), current active session count, Engagement_Score (color-coded: green 70–100, yellow 40–69, red 0–39), Churn_Risk_Score (green 0–30, yellow 31–60, red 61–100), Time_To_Value.
- 30-day sparkline: daily logins + daily dashboard page views.

**Contracts & Indexing**
- Total contracts registered, breakdown by indexing status (Healthy/In Progress/Stalled/Failed), total blocks indexed, total transactions indexed.

**Usage & Billing**
- Monthly analysis count vs. tier limit, total analyses all-time, current balance, total spent, last billing event.

**Alerts**
- Total alert configs, total alerts fired, acknowledgement rate, unacknowledged count.

**AI Usage**
- Total AI advice items, engagement rate (rated), implementation rate, total chat sessions, total chat messages, total briefings generated/read.

**Exports & Sharing**
- Total CSV exports, total PDF reports, total share tokens created, active share tokens, total share token views.

---

## Requirement 4 — CRM: Subscription & Billing Management

1. Table of all users: email, tier, subscription start, renewal date, payment status (Active/Past Due/Cancelled), MRR contribution.
2. Filter by tier and payment status. Past Due rows highlighted in amber.
3. Admin can manually change a user's tier. Change applies entitlements and rate limits within 60s. Records `Audit_Event` of type `subscription_tier_changed`.
4. Revenue summary panel: count of users per tier, estimated MRR per tier, total platform MRR.
5. Pricing config panel (see Requirement 12) shows current `PRICE_PER_ANALYSIS`, `PRICE_PER_AI_QUERY`, `PRICE_PER_CONTRACT_MONTH`, `PRICE_PER_ALERT_EMAIL`, free tier allowances — all editable live.
6. Billing transaction log per user: date, type, amount, description.

---

## Requirement 5 — Platform Overview (KPIs)

Loads within 3s. Auto-refreshes every 60s.

### 5.1 Top-Line Metrics
- Total registered users, users registered last 7 days, users registered last 30 days.
- Total contracts indexed, contracts added last 7 days.
- Total analyses run (all time), analyses run today, analyses run this month.
- Total active indexing jobs, total stalled/failed jobs.
- Total alerts fired (all time), alerts fired today.
- Total AI queries (all time), AI queries today.
- Total chat sessions, total chat messages.
- Platform MRR, total revenue all-time.
- Total API keys active.

### 5.2 Engagement Metrics
- DAU, WAU, MAU, DAU/MAU ratio (%).
- 30-day trend chart for DAU/WAU/MAU on a single line chart.
- Feature adoption rates (% of MAU who used each feature at least once in last 30 days): contract indexing, alerts, competitive intelligence, AI Growth Advisor, CSV/PDF export, share links, scenario modeling, chat.

### 5.3 Cohort Retention Table
- Users registered per calendar month, % still active at 7d / 30d / 90d post-registration.

### 5.4 Tier Distribution
- Doughnut chart: user count per tier.
- Bar chart: MRR per tier.

### 5.5 New User Registrations
- 30-day bar chart of daily registrations.

---

## Requirement 6 — Churn Risk Dashboard

1. Table of all users sorted by Churn_Risk_Score desc: email, tier, score, days since last login, alert ack rate, AI engagement rate, "View Context" link.
2. Filter by risk classification (High/Medium/Low) and tier.
3. Summary panel: count of High/Medium/Low risk users, % of paying users (starter+pro+enterprise) who are High risk.
4. Churn_Risk_Scores recalculated every 24h. Page shows timestamp of last recalculation.
5. When a user transitions from Medium → High, system records `Audit_Event` of type `churn_risk_escalated`.

---

## Requirement 7 — Indexing Health Monitor

### 7.1 Contract Health Table
- All contracts across all users: address, chain, owner email, status (Healthy/In Progress/Stalled/Failed), last indexed block, last indexed timestamp, error message.
- Stalled = last indexed timestamp > 2h ago and status is not Completed/Failed.
- Failed = most recent job ended with error.
- Summary row: total contracts, count per status.
- Filter by status. Click row → detail panel showing last 5 job records (start, end, blocks processed, error).

### 7.2 System Health Panel
- Total active jobs, queued jobs, avg job duration (last 24h), failed jobs (last 24h).
- RPC endpoint status per chain: Operational / Degraded.
- Overall status: "Operational" only when all RPCs reachable and no failures in last 1h.

---

## Requirement 8 — Audit Log

1. Paginated table (50/page, desc by timestamp): timestamp, admin/actor email, action type, target resource type, target resource ID, details (JSON).
2. Filter by: date range, actor, action type.
3. Results within 2s.
4. Append-only — no edit or delete through any interface.
5. Retained minimum 90 days.
6. Export filtered results as CSV (`Content-Disposition: attachment; filename="audit-log-[date].csv"`).
7. Stored fields: `event_id`, `actor_user_id`, `action_type`, `target_resource_type`, `target_resource_id`, `details` (JSONB), `created_at`.

**Tracked action types (minimum):**
`user_created`, `user_updated`, `user_deactivated`, `user_reactivated`, `user_data_erased`, `user_data_exported`, `role_changed`, `session_revoked`, `all_sessions_revoked`, `admin_note_saved`, `subscription_tier_changed`, `contract_deleted`, `alert_config_changed`, `api_key_revoked`, `rate_limit_override_applied`, `rate_limit_override_expired`, `feature_flag_changed`, `feature_flag_override_set`, `announcement_published`, `announcement_deleted`, `announcement_expired`, `ip_access_controls_updated`, `runtime_config_updated`, `email_delivery_retried`, `bulk_action_applied`, `churn_risk_escalated`, `admin_login`, `2fa_enforcement_enabled`.

---

## Requirement 9 — Security Event Log

1. Separate from audit log. Paginated table: timestamp, event type, affected user email, source IP, details.
2. Filter by: date range, event type, affected user email.
3. Retained minimum 90 days.
4. Tracked event types: `failed_login`, `account_locked`, `account_unlocked`, `suspicious_activity` (new country/device), `brute_force_detected`, `admin_login`.
5. After 5 consecutive failed logins for a user, system auto-locks account and records `account_locked` Security_Event.
6. Admin unlocks via User Management. Records `account_unlocked`.

---

## Requirement 10 — API Key Management

1. Table of all API keys across all users: key prefix (last 4 chars), owner email, created date, last used, request count (last 30d), status (Active/Revoked), current rate limit tier, % of rate limit consumed this window.
2. Filter by owner email and status. Sort by request count desc.
3. Admin can revoke any key. Revoked keys return HTTP 401 within 5s. Records `Audit_Event`.
4. Admin can set a temporary rate limit override: value (req/min) + expiry timestamp. Applied within 30s. Records `Audit_Event`. On expiry, reverts to tier default and records `rate_limit_override_expired`.
5. Visual indicator on keys with active overrides showing override value and time remaining.

---

## Requirement 11 — Feature Flags & Kill Switches

1. Table of all Feature_Flags: name, description, global state (Enabled/Disabled), per-user override count.
2. Toggle global state. Applied within 30s, no server restart. Records `Audit_Event` with flag name, old state, new state.
3. Per-user override: specify user + state. Applied within 30s. Records `Audit_Event`.
4. Precedence: per-user override > global state.

---

## Requirement 12 — Runtime Configuration Editor

**Story:** As an admin, I want to adjust key platform settings live without editing `.env` and restarting the server.

1. Admin dashboard exposes a "Runtime Config" panel with editable fields for:
   - **Pricing**: `PRICE_PER_ANALYSIS`, `PRICE_PER_AI_QUERY`, `PRICE_PER_CONTRACT_MONTH`, `PRICE_PER_ALERT_EMAIL`, `FREE_ANALYSES_PER_MONTH`, `FREE_AI_QUERIES_PER_MONTH`, `FREE_CONTRACTS`.
   - **Rate Limits**: `RATE_LIMIT_REQUESTS` (global req/min), per-tier analysis limits (free/starter/pro/enterprise monthly).
   - **AI**: `GEMINI_MODEL` (dropdown of valid models), Gemini API key (write-only, masked).
   - **Email**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, SMTP password (write-only), `FROM_EMAIL`.
   - **RPC Endpoints**: `ETHEREUM_RPC_URL1/2/3`, `LISK_RPC_URL1/2`, `STARKNET_RPC_URL1/2` — editable text fields with a "Test Connection" button per URL.
   - **Indexer**: `ANALYSIS_BLOCK_RANGE`, indexer chunk size, max concurrent jobs.
   - **Auth**: `JWT_EXPIRES_IN` (token TTL), session max age.
   - **CORS**: `CORS_ORIGIN` (comma-separated allowed origins).
2. Values are stored in a `runtime_config` table in PostgreSQL. At startup and on each request, the app checks this table and overrides the in-memory config.
3. Saving any value records `Audit_Event` of type `runtime_config_updated` with key, old value, new value.
4. Sensitive values (passwords, API keys) are masked in the UI (show last 4 chars only) and never returned in API responses.
5. A "Test SMTP" button sends a test email to the admin email address.
6. A "Reload Config" button forces the server to re-read the `runtime_config` table immediately.

---

## Requirement 13 — System Announcements

1. Compose announcement: type (info/warning/maintenance), message text, optional expiry timestamp.
2. Published announcement appears as banner at top of main dashboard for all authenticated users within 30s.
3. List of active announcements with type, message, expiry, edit/delete actions.
4. Delete removes banner from all user views within 30s. Records `Audit_Event`.
5. Per-user dismiss state persisted so banner doesn't reappear.
6. On expiry, banner auto-removed. Records `Audit_Event` of type `announcement_expired`.

---

## Requirement 14 — IP Access Controls

1. Panel to add/edit/remove entries in IP_Allowlist and IP_Blocklist (individual IPs or CIDR ranges).
2. Non-empty allowlist: reject all requests not matching any entry (HTTP 403).
3. Blocklist match: always reject (HTTP 403), regardless of allowlist.
4. Changes applied within 60s. Records `Audit_Event` of type `ip_access_controls_updated`.
5. Log of last 100 blocked IP attempts: IP, timestamp, block reason.

---

## Requirement 15 — Email Delivery Monitoring

1. Metrics for last 7 days: total sent by type (invitation/briefing/alert/verification/password-reset), delivery success rate %, bounce rate %.
2. Table of last 20 failed deliveries: recipient, type, failure reason, timestamp.
3. "Retry" button re-queues the email. Records `Audit_Event` of type `email_delivery_retried`.
4. If retry fails again, updates failure record with new reason and timestamp.
5. Panel auto-refreshes every 5 minutes.

---

## Requirement 16 — Platform Health

Auto-refreshes every 30s. Shows timestamp of last refresh.

1. Server uptime (current session + 30-day historical uptime %).
2. Memory usage (current + 24h sparkline), CPU usage (current + 24h sparkline).
3. DB connection pool: active, idle, waiting counts. Status "Saturated" when idle=0 and waiting>0.
4. WebSocket connection count.
5. Background job queue: pending, processing, failed counts.
6. HTTP 5xx error rate (per minute, last 60 minutes line chart).
7. Warning indicators when: CPU > 90%, memory > 90%, failed jobs > 10, error rate > 5/min.

---

## Requirement 17 — Bulk User Actions

1. Checkbox per row + "Select All" in user table header.
2. Bulk action toolbar when ≥1 selected: bulk role change, bulk tier change, bulk deactivate, bulk reactivate, bulk delete.
3. Confirmation dialog: action type + count of affected users.
4. On confirm: apply to all selected, record single `Audit_Event` of type `bulk_action_applied` with action type and full list of affected user IDs.
5. Partial failures: complete remaining, report failure count in notification, include failed IDs in Audit_Event.

---

## Requirement 18 — Permission Matrix Viewer

1. Read-only table: rows = every API endpoint + UI action, columns = Admin / Analyst / Viewer, cells = ✓ or ✗.
2. Auto-generated from live RBAC config at page load — always reflects current state.
3. Filter by role (show only rows where role has access) and by resource name (text search).
4. Read-only — no changes through this interface.

---

## Requirement 19 — 2FA Enforcement

1. User table shows "2FA Enabled" column (Enabled/Disabled) per user.
2. Platform-wide "Enforce 2FA for Admins" toggle. When enabled, records `Audit_Event` of type `2fa_enforcement_enabled`.
3. When enforcement is on, any Admin-role user without 2FA configured is redirected to 2FA setup before accessing any route.

---

## Requirement 20 — Invite Team Members

1. "Invite User" form: email + role (analyst/viewer).
2. Validates email not already registered. Error if duplicate.
3. Creates pending Invitation record, sends invite email within 60s.
4. Pending invitations table: email, role, invited date, "Revoke" action.
5. Revoke deletes Invitation record. Records `Audit_Event` of type `invitation_revoked`.
6. Invited user registers via invite link → role auto-assigned.

---

## Requirement 21 — Competitive Intelligence Admin View

1. Table of all competitor contracts tracked across all users: address, chain, tracked by (user email), added date, last indexed timestamp, indexing status.
2. Admin can delete any competitor contract. Records `Audit_Event`.
3. Summary: total competitor contracts tracked, breakdown by chain.

---

## Requirement 22 — Alert Management Admin View

1. Table of all alert configurations across all users: user email, contract, alert type, threshold, created date, last fired, total fires, acknowledged count.
2. Admin can deactivate or delete any alert config. Records `Audit_Event` of type `alert_config_changed`.
3. Summary: total alert configs, total alerts fired today/this week/all-time.

---

## Requirement 23 — AI Usage Admin View

1. Table of AI usage per user: email, total advice items, engagement rate, implementation rate, total chat sessions, total messages, total briefings, Gemini API calls this month.
2. Platform-wide Gemini API call count today / this month vs. quota.
3. Admin can disable AI features for a specific user (per-user feature flag override).

---

## Non-Functional Requirements

1. All admin API responses must complete within 3s under normal load.
2. Admin routes must never be accessible without a valid admin JWT — middleware applied at router level, not per-route.
3. The `runtime_config` table is the source of truth for all editable settings; file `.env` is the fallback default only.
4. All admin mutations are atomic — if the DB write fails, the Audit_Event is not recorded and the operation returns an error.
5. Admin frontend must work on Chrome, Firefox, and Edge (latest 2 versions).
6. Admin session auto-expires after 8h of inactivity.
