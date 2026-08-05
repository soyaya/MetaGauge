# MetaGauge - Neon Database & Render Deployment Plan

## 🎯 Current Status

Based on `src/env.txt`, you have partial Neon credentials:
- **PGUSER:** `neondb_owner`
- **PGPASSWORD:** `npg_DrCVPcg3aJ0E`

**Missing:** Full connection string and endpoint details from Neon dashboard.

---

## 📋 Step-by-Step Migration Plan

### Phase 1: Get Complete Neon Credentials (5 minutes)

1. **Login to Neon Console**
   - Go to: https://console.neon.tech
   - Navigate to your project dashboard

2. **Get Full Connection Details**
   - Click on your project
   - Go to "Connection Details" or "Dashboard"
   - Copy these values:

   ```
   Host (Endpoint): ep-xxxxx-xxxxx.us-east-2.aws.neon.tech
   Database: neondb
   Port: 5432
   User: neondb_owner
   Password: npg_DrCVPcg3aJ0E (you already have this)
   
   Connection String (pooled - RECOMMENDED):
   postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-xxxxx-xxxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

3. **Update Your `.env` File**

   Replace your `.env` with:

   ```bash
   # Server Config
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3002
   
   # Authentication
   JWT_SECRET=local-dev-jwt-secret-change-me-1234567890
   
   # Database - NEON POSTGRESQL
   DATABASE_TYPE=postgres
   DATABASE_URL=postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-xxxxx-xxxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   
   # Alternative format (DATABASE_URL takes precedence)
   POSTGRES_HOST=ep-xxxxx-xxxxx-pooler.us-east-2.aws.neon.tech
   POSTGRES_PORT=5432
   POSTGRES_DB=neondb
   POSTGRES_USER=neondb_owner
   POSTGRES_PASSWORD=npg_DrCVPcg3aJ0E
   POSTGRES_SSL=true
   POSTGRES_MAX_CONNECTIONS=5
   
   # Your existing API keys
   GEMINI_API_KEY=your-gemini-key-here
   ETHEREUM_RPC_URL=your-rpc-url-here
   ```

   **⚠️ Important:** Use the **pooled connection string** (ends with `-pooler`) for better performance.

---

### Phase 2: Test Neon Connection (2 minutes)

1. **Test Connection**
   ```bash
   npm run db:test
   ```

   **Expected Output:**
   ```
   ✅ Database connection successful
   Time: 2025-01-XX...
   Version: PostgreSQL 16.x
   ```

   **If it fails:**
   - Check your connection string is correct
   - Verify Neon project is not paused (free tier auto-pauses)
   - Check `sslmode=require` is in the URL

2. **Wake Up Neon (if paused)**
   - Go to Neon console
   - Click on your project
   - It will auto-wake on any connection attempt

---

### Phase 3: Create Database Schema (5 minutes)

Your app already has schema creation scripts:

1. **Create All Tables**
   ```bash
   npm run db:schema
   ```

   This will create:
   - users
   - contracts
   - analyses
   - metrics
   - chat_sessions
   - chat_messages
   - alerts
   - subscriptions
   - And ~30 more tables

2. **Verify Schema**
   ```bash
   npm run db:verify
   ```

   Should show all tables created successfully.

---

### Phase 4: Migrate Existing Data (10 minutes)

**Only if you have existing data in `./data/*.json` files:**

1. **Check What Data You Have**
   ```bash
   ls ./data/*.json
   ls ./data/users/*/
   ```

2. **Run Migration**
   ```bash
   npm run db:migrate
   ```

   This will:
   - Read all JSON files
   - Insert into PostgreSQL
   - Show progress per table

3. **Verify Migration**
   ```bash
   npm run db:verify-migration
   ```

   **Expected:**
   ```
   Users:       ✅ Match (JSON: 10, PostgreSQL: 10)
   Contracts:   ✅ Match (JSON: 25, PostgreSQL: 25)
   Analyses:    ✅ Match (JSON: 50, PostgreSQL: 50)
   ```

**If you have NO existing data:**
- Skip this phase
- Start fresh with Neon

---

### Phase 5: Test Locally with Neon (5 minutes)

1. **Start Your Server**
   ```bash
   npm run dev
   ```

   **Look for:**
   ```
   🔄 Loading PostgreSQL storage...
   ✅ PostgreSQL storage loaded
   ✅ PostgreSQL client connected
   🚀 Multi-Chain Analytics API Server running on port 5000
   💾 Storage: PostgreSQL
   ```

2. **Test API Endpoints**

   **Register a user:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!",
       "name": "Test User"
     }'
   ```

   **Login:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!"
     }'
   ```

3. **Check Neon Dashboard**
   - Go to Neon Console → SQL Editor
   - Run: `SELECT * FROM users;`
   - Should see your test user

---

### Phase 6: Prepare for Render Deployment (10 minutes)

1. **Create Production Environment File**

   Create `MetaGauge/.env.production`:
   ```bash
   # DO NOT COMMIT THIS FILE
   
   # Server
   NODE_ENV=production
   PORT=10000
   FRONTEND_URL=https://your-frontend.pages.dev
   
   # Database (Same Neon credentials)
   DATABASE_TYPE=postgres
   DATABASE_URL=postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-xxxxx-xxxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   
   # Authentication (Generate new for production!)
   JWT_SECRET=YOUR_PRODUCTION_JWT_SECRET_MIN_32_CHARS
   
   # AI Keys
   GEMINI_API_KEY=your-gemini-key
   GEMINI_API_KEY_2=backup-key-1
   GEMINI_API_KEY_3=backup-key-2
   
   # Blockchain RPC
   ETHEREUM_RPC_URL=your-ethereum-rpc
   SEPOLIA_RPC_URL=your-sepolia-rpc
   LISK_RPC_URL=https://rpc.api.lisk.com
   LISK_SEPOLIA_RPC_URL=https://rpc.sepolia-api.lisk.com
   
   # Payments
   PAYSTACK_SECRET_KEY=sk_live_your_key
   PAYMENT_ADDRESS=0xYourWalletAddress
   ```

2. **Generate Production JWT Secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Copy output to `JWT_SECRET`

3. **Update `.gitignore`**
   Verify these are ignored:
   ```
   .env
   .env.local
   .env.production
   src/env.txt
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "chore: prepare for Neon + Render deployment"
   git push origin main
   ```

---

### Phase 7: Deploy to Render (15 minutes)

1. **Login to Render**
   - Go to: https://dashboard.render.com
   - Sign in with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select `MetaGauge` repo
   - Branch: `main`

3. **Configure Build Settings**
   ```
   Name: metagauge-api
   Region: Oregon (or closest to your Neon region)
   Branch: main
   Root Directory: (leave blank)
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

4. **Add Environment Variables**

   Click "Advanced" → Add these one by one:

   ```bash
   DATABASE_TYPE=postgres
   DATABASE_URL=postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-xxxxx-xxxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   NODE_ENV=production
   PORT=10000
   FRONTEND_URL=https://your-frontend.pages.dev
   JWT_SECRET=your-production-secret-here
   GEMINI_API_KEY=your-key
   ETHEREUM_RPC_URL=your-rpc
   PAYSTACK_SECRET_KEY=your-key
   PAYMENT_ADDRESS=0xYourAddress
   ```

   **Pro Tip:** Copy from your `.env.production` file

5. **Deploy**
   - Click "Create Web Service"
   - Watch deployment logs
   - Look for: `✅ PostgreSQL client connected`

6. **Get Your URL**
   - Render assigns: `https://metagauge-api.onrender.com`
   - Test: `https://metagauge-api.onrender.com/health`

---

### Phase 8: Update Frontend (5 minutes)

1. **Update Frontend Environment**

   **If using Cloudflare Pages:**
   - Go to: Pages → Your Project → Settings → Environment Variables
   - Update:
     ```
     NEXT_PUBLIC_API_URL=https://metagauge-api.onrender.com
     NEXT_PUBLIC_WS_URL=wss://metagauge-api.onrender.com
     ```
   - Redeploy

   **If local frontend:**
   - Update `frontend/.env`:
     ```bash
     NEXT_PUBLIC_API_URL=https://metagauge-api.onrender.com
     NEXT_PUBLIC_WS_URL=wss://metagauge-api.onrender.com
     ```

2. **Test Full Flow**
   - Open your frontend
   - Register/Login
   - Add a contract
   - Verify data appears in Neon dashboard

---

## 🔧 Quick Troubleshooting

### Issue: "Database connection failed"

**Check:**
1. Is Neon project paused? (Go to Neon console, click project to wake)
2. Is connection string correct? (Check for typos)
3. Is SSL enabled? (`?sslmode=require` in URL)

**Fix:**
```bash
# Test connection directly
psql "postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-xxxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

---

### Issue: "Too many connections"

**Cause:** Free tier has 100 connection limit

**Fix:**
```bash
# In .env, reduce pool size
POSTGRES_MAX_CONNECTIONS=5  # Down from 10
```

---

### Issue: Render app sleeps (free tier)

**Cause:** Free tier spins down after 15 minutes

**Fix Options:**
1. Upgrade to Starter ($7/month - always on)
2. Use UptimeRobot to ping every 10 minutes
3. Frontend pings `/health` every 10 minutes

---

### Issue: Slow first request

**Cause:** Render cold start + Neon wake up

**Expected:** 5-10 seconds first request, <1s after

**Fix:** Upgrade to paid tiers or accept cold starts

---

## 📊 Cost Summary

### Free Tier (Current Setup)
- **Neon:** Free (0.5GB storage, 100 hours compute/month)
- **Render:** Free (spins down after 15 min)
- **Total:** $0/month

### Production Tier (Recommended)
- **Neon Pro:** $19/month (10GB, always on, better performance)
- **Render Starter:** $7/month (always on, 512MB RAM)
- **Total:** $26/month

---

## ✅ Success Checklist

- [ ] Neon connection string obtained
- [ ] `.env` updated with DATABASE_URL
- [ ] `npm run db:test` passes
- [ ] `npm run db:schema` creates tables
- [ ] `npm run db:migrate` completes (if you have data)
- [ ] Local server connects to Neon
- [ ] Can register/login locally
- [ ] Data appears in Neon SQL Editor
- [ ] Code pushed to GitHub
- [ ] Render service created
- [ ] Environment variables set in Render
- [ ] Deployment successful
- [ ] `/health` endpoint returns 200
- [ ] Frontend updated with new API URL
- [ ] Full user flow tested

---

## 🚀 Quick Start Commands

```bash
# 1. Test Neon connection
npm run db:test

# 2. Create schema
npm run db:schema

# 3. Migrate data (if any)
npm run db:migrate

# 4. Start locally
npm run dev

# 5. Deploy
git push origin main
# Then create Render service via dashboard
```

---

## 📞 Next Steps

1. **Get your full Neon connection string** from dashboard
2. **Update `.env`** with DATABASE_URL
3. **Test locally** (phases 2-5)
4. **Deploy to Render** (phases 6-7)
5. **Update frontend** (phase 8)

**Estimated Total Time:** 60 minutes

---

**Need Help?**
- Check Render deployment logs first
- Verify Neon project is active
- Test connection string with `psql` command
- Your app has good error logging to help debug

Good luck! 🎉
