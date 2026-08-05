# 🚀 Render Environment Variables - Ready to Paste

Copy each variable below and paste into Render Dashboard → Settings → Environment

---

## ✅ REQUIRED (Must Have)

### Database (Already Configured)
```
DATABASE_TYPE
postgres
```

```
DATABASE_URL
postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-orange-mountain-ayvxv4gp-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Server
```
NODE_ENV
production
```

```
PORT
10000
```

```
FRONTEND_URL
https://www.metagauge.xyz
```

### Authentication (GENERATE NEW SECRET!)
```bash
# Run this command to generate:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

```
JWT_SECRET
YOUR_GENERATED_SECRET_HERE_MIN_64_CHARS
```

---

## ⚠️ IMPORTANT (Add Your Keys)

### AI Service - Google Gemini
Get keys from: https://makersuite.google.com/app/apikey

```
GEMINI_API_KEY
YOUR_PRIMARY_GEMINI_KEY
```

```
GEMINI_API_KEY_2
YOUR_BACKUP_KEY_1
```

```
GEMINI_API_KEY_3
YOUR_BACKUP_KEY_2
```

### Blockchain RPC
Get keys from: https://www.alchemy.com or https://infura.io

```
ETHEREUM_RPC_URL
https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

```
SEPOLIA_RPC_URL
https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

```
LISK_RPC_URL
https://rpc.api.lisk.com
```

```
LISK_SEPOLIA_RPC_URL
https://rpc.sepolia-api.lisk.com
```

### Payment Processing
Get from: https://dashboard.paystack.com

```
PAYSTACK_SECRET_KEY
sk_live_YOUR_PAYSTACK_SECRET
```

```
PAYMENT_ADDRESS
0xYOUR_WALLET_ADDRESS
```

---

## 🔧 OPTIONAL (Recommended for Better Performance)

### Database Pool Settings
```
POSTGRES_MAX_CONNECTIONS
5
```

### Rate Limiting
```
RATE_LIMIT_MAX_REQUESTS
200
```

### Feature Flags
```
ENABLE_AI_FEATURES
true
```

---

## 📋 Quick Checklist for Render

1. **Create Web Service**
   - New + → Web Service
   - Connect GitHub repo: `MetaGauge`
   - Branch: `main`

2. **Build Settings**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

3. **Add Environment Variables**
   - Copy each variable above
   - Click "Add Environment Variable"
   - Paste key and value

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (~5 minutes)

5. **Test**
   - Visit: `https://your-app.onrender.com/health`
   - Should return: `{"status":"healthy","storage":"postgres"}`

6. **Update Frontend**
   - Update your frontend at https://www.metagauge.xyz
   - Change API_URL to your Render URL

---

## 🎯 Minimum Required Variables (Can deploy with just these)

```
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-orange-mountain-ayvxv4gp-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://www.metagauge.xyz
JWT_SECRET=<generate-new-secret>
```

Everything else can be added later!

---

## 🔐 Security Notes

- ✅ Never commit `.env` files to Git
- ✅ Use different JWT_SECRET for production
- ✅ Rotate secrets every 90 days
- ✅ Use `sk_live_` Paystack keys for production
- ✅ Keep Neon credentials safe

---

## 📞 Need Help?

After deployment:
1. Check Render logs for errors
2. Test: `curl https://your-app.onrender.com/health`
3. Verify: `"storage": "postgres"` in response

Good luck! 🚀
