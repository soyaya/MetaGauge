# 🔗 Update Frontend to Use Render API

## Quick Guide

Once your Render backend is deployed, update your frontend at **https://www.metagauge.xyz** with these steps:

---

## 1️⃣ Get Your Render API URL

After Render deployment completes, you'll get a URL like:
```
https://metagauge-api-xxxx.onrender.com
```

Or check Render dashboard for your service URL.

---

## 2️⃣ Update Frontend Environment Variables

### For Cloudflare Pages:

1. Go to: https://dash.cloudflare.com
2. Navigate to: **Pages** → **Your Project** → **Settings** → **Environment variables**
3. Update or add:

```
NEXT_PUBLIC_API_URL
https://your-render-url.onrender.com
```

4. Click **Save**
5. Go to **Deployments** → Click **Retry deployment**

---

### For Vercel:

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to: **Settings** → **Environment Variables**
4. Update:

```
NEXT_PUBLIC_API_URL = https://your-render-url.onrender.com
```

5. **Save**
6. **Deployments** → **Redeploy**

---

## 3️⃣ Local Development (Optional)

Update `frontend/.env.local`:

```bash
# Production API (Render)
NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com

# Or for local development, keep:
# NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 4️⃣ Verify Connection

After redeploying frontend:

1. **Open:** https://www.metagauge.xyz
2. **Open Browser Console** (F12)
3. **Check Network Tab** - API calls should go to your Render URL
4. **Test:** Register/Login

**If you see errors:**
- Check API URL is correct (no trailing slash)
- Verify Render backend is running
- Check CORS settings (should be automatic)

---

## ✅ Success Checklist

- [ ] Render API URL obtained
- [ ] Frontend env var updated
- [ ] Frontend redeployed
- [ ] Can access https://www.metagauge.xyz
- [ ] API calls going to Render (check Network tab)
- [ ] Can register/login
- [ ] No console errors

---

## 🔍 Testing Your Setup

```bash
# Test API directly
curl https://your-render-url.onrender.com/health

# Should return:
# {"status":"healthy","storage":"postgres"}
```

Then test from frontend:
1. Register new user
2. Login
3. Add contract
4. Verify data persists

---

## 🎉 You're Live!

Once everything works:
- ✅ Backend: Running on Render + Neon
- ✅ Frontend: Live at https://www.metagauge.xyz
- ✅ Database: PostgreSQL on Neon
- ✅ Users can register and use your app!

---

**Need help?** Share your Render URL and any errors you see!
