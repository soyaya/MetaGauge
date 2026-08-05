# MetaGauge - Neon PostgreSQL + Render Deployment Guide

## 🎯 Overview

This guide walks you through migrating your MetaGauge database to **Neon (serverless PostgreSQL)** and deploying your backend to **Render**.

**Current State:**
- ✅ App already supports PostgreSQL (via `DATABASE_TYPE=postgres`)
- ✅ Connection handling ready (`src/api/database/postgres.js`)
- ✅ Full storage abstraction (`postgresStorage.js`)

**What We'll Do:**
1. Set up Neon PostgreSQL database
2. Configure environment variables
3. Migrate data from local/file storage to Neon
4. Deploy backend to Render
5. Test and verify deployment

---

## 📋 Prerequisites

- [x] Neon account (sign up at https://neon.tech - free tier available)
- [x] Render account (sign up at https://render.com - free tier available)
- [x] Git repository pushed to GitHub/GitLab
- [x] Current `.env` file backed up

---

## Part 1: Neon PostgreSQL Setup

### Step 1: Create Neon Database

1. **Sign up/Login to Neon**
   - Go to https://console.neon.tech
   - Create a new account or sign in

2. **Create a New Project**
   - Click "New Project"
   - Name: `metagauge-production`
   - Region: Choose closest to your users (e.g., `US East (Ohio)` or `Europe (Frankfurt)`)
   - PostgreSQL version: 16 (recommended)
   - Click "Create Project"

3. **Get Connection String**
   - After project creation, you'll see your connection details
   - Copy the **connection string** (looks like this):
   ```
   postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. **Save Connection Details**
   - Database: `neondb` (default)
   - Host: `ep-cool-name-123456.us-east-2.aws.neon.tech`
   - Port: `5432`
   - Username: (shown in dashboard)
   - Password: (shown in dashboard)
   - Connection string: (full string from above)

---

### Step 2: Set Up Database Schema

You have two options:

#### Option A: Use Existing Setup Script (Recommended)

1. **Update your `.env` file:**
```bash
# Database Configuration
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require

# Legacy format (optional, DATABASE_URL takes precedence)
POSTGRES_HOST=ep-cool-name-123456.us-east-2.aws.neon.tech
POSTGRES_PORT=5432
POSTGRES_DB=neondb
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=true
POSTGRES_MAX_CONNECTIONS=10
```

2. **Test connection:**
```bash
npm run db:test
```

Expected output:
```
✅ Database connection successful
   Time: 2025-01-XX...
   Version: PostgreSQL 16.x
```

3. **Create schema:**
```bash
npm run db:schema
```

This will create all necessary tables (users, contracts, metrics, etc.)

4. **Verify schema:**
```bash
npm run db:verify
```

#### Option B: Use SQL Script Directly

If you have `supabase-schema.sql` or need to run custom SQL:

1. **Connect via psql:**
```bash
psql "postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

2. **Run schema file:**
```bash
\i supabase-schema.sql
```

3. **Verify tables:**
```sql
\dt
```

---

### Step 3: Migrate Existing Data

If you have existing data in file storage (`./data/*.json`):

1. **Run migration script:**
```bash
npm run db:migrate
```

This will:
- Read all JSON files from `./data/`
- Insert users, contracts, analyses into PostgreSQL
- Preserve relationships and IDs
- Show progress for each table

2. **Verify migration:**
```bash
npm run db:verify-migration
```

Expected output:
```
Users:       ✅ Match (JSON: 10, PostgreSQL: 10)
Contracts:   ✅ Match (JSON: 25, PostgreSQL: 25)
Analyses:    ✅ Match (JSON: 50, PostgreSQL: 50)
...
```

---

## Part 2: Render Deployment

### Step 1: Prepare Your Repository

1. **Create `render.yaml` (if not exists):**

Your app already has this file! Verify it looks like this:

```yaml
services:
  - type: web
    name: metagauge-api
    env: node
    region: oregon  # or closest to your Neon region
    plan: free      # or 'starter' for production
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_TYPE
        value: postgres
      - key: DATABASE_URL
        sync: false  # Will set manually in Render dashboard
      - key: JWT_SECRET
        generateValue: true
      - key: GEMINI_API_KEY
        sync: false
      - key: PAYSTACK_SECRET_KEY
        sync: false
```

2. **Verify `package.json` scripts:**

Your `start` script should be:
```json
{
  "scripts": {
    "start": "NODE_ENV=production node src/api/server.js"
  }
}
```

✅ Already correct in your project!

3. **Push to GitHub (if not already):**
```bash
git add .
git commit -m "feat: prepare for Neon + Render deployment"
git push origin main
```

---

### Step 2: Create Render Web Service

1. **Login to Render**
   - Go to https://dashboard.render.com
   - Sign in with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `MetaGauge` repository

3. **Configure Service**
   - **Name:** `metagauge-api` (or your preferred name)
   - **Region:** Oregon (or match your Neon region)
   - **Branch:** `main`
   - **Root Directory:** Leave blank (or `/` if prompted)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter for $7/month with always-on)

4. **Add Environment Variables**

Click "Advanced" → "Add Environment Variable" and add these:

```bash
# Database (CRITICAL)
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require

# Server Config
NODE_ENV=production
PORT=10000

# Authentication (Render can auto-generate)
JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars

# AI Services (copy from your .env)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_KEY_2=backup-key-if-any
GEMINI_API_KEY_3=backup-key-if-any

# Blockchain RPC (copy from your .env)
ETHEREUM_RPC_URL=your-ethereum-rpc
SEPOLIA_RPC_URL=your-sepolia-rpc
LISK_RPC_URL=your-lisk-rpc
LISK_SEPOLIA_RPC_URL=your-lisk-sepolia-rpc

# Payment Processing
PAYSTACK_SECRET_KEY=sk_live_...
PAYMENT_ADDRESS=0x...

# Frontend (important for CORS)
FRONTEND_URL=https://your-frontend.pages.dev

# Optional MongoDB (if used)
MONGO_URL=mongodb+srv://...
```

**Security Notes:**
- ✅ Never commit sensitive keys to Git
- ✅ Use Render's secret management
- ✅ Rotate keys regularly

5. **Deploy**
   - Click "Create Web Service"
   - Render will:
     1. Clone your repo
     2. Run `npm install`
     3. Start your server
     4. Assign a URL (e.g., `https://metagauge-api.onrender.com`)

6. **Monitor Deployment**
   - Watch the logs in real-time
   - Look for:
     ```
     🚀 Multi-Chain Analytics API Server running on port 10000
     ✅ PostgreSQL client connected
     ✅ Database connection successful
     ```

---

### Step 3: Configure Frontend

Update your frontend's `.env` or Cloudflare Pages environment variables:

```bash
# In frontend/.env or Cloudflare Pages settings
NEXT_PUBLIC_API_URL=https://metagauge-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://metagauge-api.onrender.com
```

If using Cloudflare Pages:
1. Go to Pages project → Settings → Environment variables
2. Update `NEXT_PUBLIC_API_URL`
3. Redeploy frontend

---

## Part 3: Verification & Testing

### Step 1: Health Check

```bash
curl https://metagauge-api.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "version": "1.0.0",
  "storage": "postgres",
  "environment": "production"
}
```

### Step 2: Test Database Connection

```bash
curl https://metagauge-api.onrender.com/api/auth/register \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User"
  }'
```

Should return `201 Created` with user data.

### Step 3: Verify Data Migration

1. **Check user count in Neon dashboard:**
   - Go to Neon console → SQL Editor
   - Run: `SELECT COUNT(*) FROM users;`
   - Should match your local count

2. **Test login:**
```bash
curl https://metagauge-api.onrender.com/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-existing-user@email.com",
    "password": "your-password"
  }'
```

Should return JWT token.

### Step 4: Test Full Flow

1. Login → Get token
2. Add contract → Should save to Neon
3. Run analysis → Should store results in Neon
4. Check frontend → Should load data from Render API

---

## 🔧 Troubleshooting

### Issue 1: "Database connection failed"

**Symptoms:**
```
❌ Database connection failed: connect ECONNREFUSED
```

**Solutions:**
1. Verify `DATABASE_URL` is correct in Render
2. Check Neon database is not paused (free tier pauses after inactivity)
3. Verify SSL is enabled: `?sslmode=require` in connection string
4. Check Neon IP allowlist (if configured)

**Quick Fix:**
```bash
# In Render dashboard, check logs
# Look for: "🔍 PG config — host: ..."
# Verify host matches Neon endpoint
```

---

### Issue 2: "SSL/TLS error"

**Symptoms:**
```
❌ self signed certificate in certificate chain
```

**Solution:**
Update your `postgres.js` config:
```javascript
ssl: { 
  rejectUnauthorized: false  // Already set in your code!
}
```

---

### Issue 3: "Too many connections"

**Symptoms:**
```
❌ sorry, too many clients already
```

**Solutions:**
1. **Reduce connection pool:**
```bash
# In Render environment variables
POSTGRES_MAX_CONNECTIONS=5  # Down from 10
```

2. **Use connection pooling (Neon native):**
   - Neon provides pooled connections automatically
   - Use the pooled connection string from dashboard

3. **Upgrade Neon plan:**
   - Free tier: 100 concurrent connections
   - Pro tier: 1000+ connections

---

### Issue 4: "Slow queries"

**Symptoms:**
- API times out
- Logs show: `⚠️ Slow query (3000ms)`

**Solutions:**
1. **Add indexes** (critical for performance):
```sql
-- Already in your schema, verify they exist
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_contracts_user ON contracts(user_id);
CREATE INDEX idx_contracts_address ON contracts(target_address);
CREATE INDEX idx_metrics_contract ON metrics(contract_id);
```

2. **Check query execution plan:**
```sql
EXPLAIN ANALYZE SELECT * FROM contracts WHERE user_id = 'xxx';
```

3. **Use Neon's query insights:**
   - Neon Console → Database → Query Insights
   - Shows slowest queries

---

### Issue 5: Render App Sleeping (Free Tier)

**Symptoms:**
- First request takes 30+ seconds
- Subsequent requests are fast

**Cause:** Free tier spins down after 15 min inactivity

**Solutions:**

**Option A: Upgrade to Paid Plan**
- Starter plan: $7/month (always on)

**Option B: Keep-Alive Service (Free)**
1. **Use UptimeRobot:**
   - Sign up at https://uptimerobot.com
   - Add monitor: `https://metagauge-api.onrender.com/health`
   - Check interval: 5 minutes

2. **Use Cron-Job.org:**
   - Sign up at https://cron-job.org
   - Create job: GET `https://metagauge-api.onrender.com/health`
   - Schedule: Every 10 minutes

**Option C: Frontend Polling**
```javascript
// In your frontend, ping API every 10 minutes
setInterval(async () => {
  fetch('https://metagauge-api.onrender.com/health');
}, 10 * 60 * 1000);
```

---

## 📊 Performance Optimization

### 1. Connection Pooling

Your app already uses `pg.Pool`, but verify config:
```javascript
// src/api/database/postgres.js
{
  max: 10,                    // Max connections (reduce to 5 for free tier)
  idleTimeoutMillis: 30000,   // Close idle after 30s
  connectionTimeoutMillis: 10000  // Fail fast if can't connect
}
```

### 2. Query Optimization

**Before (slow):**
```javascript
const users = await query('SELECT * FROM users');
const user = users.rows.find(u => u.email === email);
```

**After (fast):**
```javascript
const result = await query('SELECT * FROM users WHERE email = $1', [email]);
const user = result.rows[0];
```

### 3. Batch Operations

**Before:**
```javascript
for (const contract of contracts) {
  await query('INSERT INTO contracts ...', [contract]);
}
```

**After:**
```javascript
await query(`
  INSERT INTO contracts (...)
  VALUES ${contracts.map((_, i) => `($${i*3+1}, $${i*3+2}, $${i*3+3})`).join(',')}
`, contracts.flatMap(c => [c.id, c.address, c.chain]));
```

### 4. Caching (Future Enhancement)

Add Redis for frequently accessed data:
```bash
# Render.com also offers Redis as an add-on
# Or use Upstash (serverless Redis)
```

---

## 🚀 Post-Deployment Checklist

- [ ] Health endpoint returns 200
- [ ] Can register new user
- [ ] Can login with existing user
- [ ] Can add contract
- [ ] Can run analysis
- [ ] Frontend connects successfully
- [ ] WebSocket connections work
- [ ] AI features functional
- [ ] Payment webhooks working (if applicable)
- [ ] All environment variables set
- [ ] Monitoring set up (optional)
- [ ] Backups enabled in Neon (automatic in free tier)

---

## 📈 Monitoring & Maintenance

### Neon Dashboard

- **Usage:** Monitor storage, connections, queries
- **Backups:** Free tier has automatic backups (24h retention)
- **Branching:** Create dev/staging branches (like Git for databases)

### Render Dashboard

- **Logs:** Real-time server logs
- **Metrics:** CPU, memory, request count
- **Alerts:** Set up for downtime/errors

### Recommended: Add Error Tracking

1. **Sentry** (free tier):
```bash
npm install @sentry/node
```

```javascript
// src/api/server.js
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });
```

2. **LogTail** (free tier):
```bash
npm install winston-logtail
```

---

## 💰 Cost Breakdown

### Free Tier (Viable for MVP/Testing)

**Neon:**
- Storage: 0.5 GB free
- Compute: 100 hours/month
- Connections: 100 concurrent
- ✅ Perfect for early stage

**Render:**
- Free web service (spins down after 15 min)
- 750 hours/month
- ✅ Good for testing

**Total: $0/month**

### Production Tier (Recommended)

**Neon Pro:**
- Storage: 10 GB
- Always on
- 1000 connections
- **Cost: $19/month**

**Render Starter:**
- Always on
- 512 MB RAM
- **Cost: $7/month**

**Total: $26/month** (scales with usage)

---

## 🔄 Rollback Plan

If something goes wrong:

### Option 1: Switch Back to File Storage

```bash
# In Render, change environment variable
DATABASE_TYPE=file

# Redeploy
```

Your app will fall back to file-based storage (your `./data/` folder)

### Option 2: Local Neon + Render File

- Keep Neon for local development
- Use file storage on Render (mounted persistent disk)

### Option 3: Full Rollback

- Revert Git commit
- Redeploy from previous commit
- Data is safe in Neon (can export)

---

## 📚 Additional Resources

- **Neon Docs:** https://neon.tech/docs
- **Render Docs:** https://render.com/docs
- **PostgreSQL Best Practices:** https://wiki.postgresql.org/wiki/Don't_Do_This
- **Your App Docs:** See `ARCHITECTURE.md` and `POSTGRES_MIGRATION_PLAN.md`

---

## ✅ Quick Start Summary

**For someone who just wants to deploy:**

1. **Neon:**
   ```bash
   # Create project → Copy DATABASE_URL
   ```

2. **Update `.env`:**
   ```bash
   DATABASE_TYPE=postgres
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   ```

3. **Setup schema:**
   ```bash
   npm run db:schema
   npm run db:migrate  # If you have existing data
   ```

4. **Render:**
   - Connect GitHub repo
   - Paste DATABASE_URL in env vars
   - Deploy!

5. **Test:**
   ```bash
   curl https://your-app.onrender.com/health
   ```

**Done! 🎉**

---

## 🤝 Support

**Need Help?**
- Check Render logs first (most issues show up there)
- Neon has excellent docs and support
- Your app has comprehensive error logging (`winston`)

**Common Mistakes:**
- ❌ Forgot to set `DATABASE_TYPE=postgres`
- ❌ Wrong connection string format
- ❌ SSL not enabled (`?sslmode=require`)
- ❌ Environment variables not set in Render

**Success Indicators:**
- ✅ Logs show: `✅ PostgreSQL client connected`
- ✅ Health endpoint returns `"storage": "postgres"`
- ✅ Can create users and contracts
- ✅ Frontend loads data

---

**Created:** January 2025  
**Status:** Ready for production  
**Estimated Setup Time:** 30-60 minutes

Good luck with your deployment! 🚀
