# Neon Connection Troubleshooting

## ❌ Issue: Password Authentication Failed

The connection string you provided is being rejected with "password authentication failed".

### Possible Causes:

1. **Password has special characters that need URL encoding**
2. **Neon password was rotated/changed**
3. **Using wrong connection string format**
4. **Database is paused (Neon auto-pauses after inactivity)**

---

## ✅ Solution Steps:

### Step 1: Get Fresh Credentials from Neon

1. **Go to Neon Console:**
   - Visit: https://console.neon.tech
   - Select your project

2. **Go to Dashboard → Connection Details**

3. **Get the CORRECT connection string:**
   - Look for "Connection string (pooled)"
   - Click the copy button (ensures correct encoding)
   - Should look like:
     ```
     postgresql://neondb_owner:<ENCODED_PASSWORD>@ep-orange-mountain-ayvxv4gp-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```

4. **Check if password has special characters:**
   - If your password contains: `@`, `#`, `:`, `/`, `?`, `&`, `=`, `%`
   - Neon should auto-encode it in the connection string
   - Example: `P@ssw0rd!` becomes `P%40ssw0rd%21`

---

### Step 2: Reset Password (If Needed)

If you can't connect with the current password:

1. **In Neon Console:**
   - Go to Settings → Reset Password
   - Generate new password
   - Copy new connection string

2. **Or create a new role:**
   - Go to Roles → Create Role
   - Give it database access
   - Use that connection string instead

---

### Step 3: Update Your `.env`

Once you have the correct connection string:

```bash
DATABASE_URL=<paste-exact-connection-string-from-neon>
```

**Important:** Use the EXACT string from Neon - don't modify it!

---

### Step 4: Test Connection

```bash
npm run db:test
```

**Expected:**
```
✅ Database connection successful
   Time: 2025-01-XX...
   Version: PostgreSQL 16.x
```

---

## 🔍 Alternative: Direct psql Test

Test connection outside of Node.js:

```bash
# Windows (if psql installed)
psql "postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-orange-mountain-ayvxv4gp-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# If this works, it's a Node.js config issue
# If this fails, it's a Neon credentials issue
```

---

## 🛠️ Quick Fix Checklist

- [ ] Wake up Neon project (click on it in console)
- [ ] Copy fresh connection string from dashboard
- [ ] Verify no extra spaces in `.env`
- [ ] Check DATABASE_URL is on ONE line
- [ ] Restart your terminal/IDE
- [ ] Try `npm run db:test` again

---

## 📞 Current Status

**Your connection string:**
```
postgresql://neondb_owner:npg_DrCVPcg3aJ0E@ep-orange-mountain-ayvxv4gp-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Possible issues:**
1. Password `npg_DrCVPcg3aJ0E` might be old/incorrect
2. Your `src/env.txt` might have partial/outdated credentials

**Next step:** Get a fresh connection string from Neon dashboard

---

## ✅ Once Connected

After successful connection test:

```bash
# Create schema
npm run db:schema

# Verify tables created
npm run db:verify

# Start development server
npm run dev
```

Then you'll see:
```
✅ PostgreSQL client connected
🚀 Multi-Chain Analytics API Server running on port 5000
💾 Storage: PostgreSQL
```

Ready to continue once you have the fresh connection string! 🚀
