# Render Environment Variables - Copy & Paste

## Instructions
Copy each variable below and add to Render Dashboard → Settings → Environment

---

## ✅ REQUIRED VARIABLES (Must Have)

### DATABASE_TYPE
```
postgres
```

### DATABASE_URL
```
postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-orange-mountain-ayvxv4gp-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### NODE_ENV
```
production
```

### PORT
```
10000
```

### FRONTEND_URL
```
https://www.metagauge.xyz
```

### JWT_SECRET
```
a8e77faafea5b731307c059411dffc6620965a302e3063284194e94447ae660adb531b259ed61a02a69376f008a757ef06132e7add6f3fa7aff96fb009f255ee
```

---

## ⚠️ IMPORTANT - Add Your API Keys

### GEMINI_API_KEY
```
YOUR_GEMINI_API_KEY_HERE
```

### GEMINI_API_KEY_2
```
YOUR_BACKUP_KEY_1
```

### GEMINI_API_KEY_3
```
YOUR_BACKUP_KEY_2
```

### ETHEREUM_RPC_URL
```
YOUR_ETHEREUM_RPC_URL
```

### SEPOLIA_RPC_URL
```
YOUR_SEPOLIA_RPC_URL
```

### LISK_RPC_URL
```
https://rpc.api.lisk.com
```

### LISK_SEPOLIA_RPC_URL
```
https://rpc.sepolia-api.lisk.com
```

### PAYSTACK_SECRET_KEY
```
YOUR_PAYSTACK_SECRET_KEY
```

### PAYMENT_ADDRESS
```
YOUR_WALLET_ADDRESS
```

---

## 🔧 OPTIONAL BUT RECOMMENDED

### POSTGRES_MAX_CONNECTIONS
```
5
```

### POSTGRES_SSL
```
true
```

### RATE_LIMIT_MAX_REQUESTS
```
200
```

### ENABLE_AI_FEATURES
```
true
```

---

## 📝 Notes

- Replace `YOUR_*` placeholders with your actual keys
- JWT_SECRET above was generated for you
- Neon database URL is already configured
- Add more Gemini keys (up to GEMINI_API_KEY_10) for redundancy

---

## ✅ Minimum to Start

If you want to deploy IMMEDIATELY with basic functionality:

**Just add these 6 variables:**
1. DATABASE_TYPE = `postgres`
2. DATABASE_URL = `(your Neon connection string)`
3. NODE_ENV = `production`
4. PORT = `10000`
5. FRONTEND_URL = `https://www.metagauge.xyz`
6. JWT_SECRET = `(generated secret above)`

**Everything else can be added later!**

---

## 🚀 After Adding Variables

1. Click "Create Web Service" or "Deploy"
2. Wait ~5 minutes for deployment
3. Get your Render URL: `https://your-app.onrender.com`
4. Test: `curl https://your-app.onrender.com/health`
5. Update frontend with your Render URL

---

## Need Help?

- **Get Gemini API Key:** https://makersuite.google.com/app/apikey
- **Get Alchemy RPC:** https://www.alchemy.com (free tier available)
- **Get Paystack Keys:** https://dashboard.paystack.com

---

**Ready to deploy! 🎉**
