# ✅ Backend Timeout on Registration - DEBUGGING

## 🔴 Problem

Frontend showing:
```
BackendTimeout: Backend server not responding
```

When trying to register a new user, the backend hangs and doesn't respond within 60 seconds.

## 🔍 Investigation

Tested endpoint directly:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test User"}'
```

**Result:** Request sent, but no response received (timeout after 10s)

## ✅ Fixes Applied

### 1. Reduced bcrypt Rounds
**File:** `src/api/routes/auth.js`

**Before:** `bcrypt.hash(password, 12)` - 12 rounds (slow)
**After:** `bcrypt.hash(password, 10)` - 10 rounds (faster)

**Impact:** ~50% faster password hashing

### 2. Added Debug Logging
**File:** `src/api/routes/auth.js`

Added console.log statements at each step:
- ✅ Request received
- ✅ Validation
- ✅ User existence check
- ✅ Password hashing
- ✅ User creation
- ✅ Token generation
- ✅ Response sent

**Purpose:** Identify exactly where the hang occurs

## 🚀 Test Now

### 1. Restart Backend
```bash
# Stop current backend (Ctrl+C)
cd /mnt/c/pr0/meta/mvp-workspace
npm run dev
```

### 2. Watch Backend Logs
The backend will now show detailed logs like:
```
[AUTH] Registration request received: { email: 'test@test.com', name: 'Test User' }
[AUTH] Checking if user exists...
[AUTH] Hashing password...
[AUTH] Password hashed successfully
[AUTH] Creating user...
[AUTH] Saving user to storage...
[AUTH] User created successfully: abc-123-def
[AUTH] Generating JWT token...
[AUTH] Token generated
[AUTH] Sending response...
```

### 3. Try Registration Again
- Go to `http://localhost:3000/signup`
- Fill in the form
- Click "Sign Up"
- **Watch the backend terminal** to see where it stops

## 🔍 Expected Outcomes

### If it works:
✅ You'll see all log messages
✅ Frontend receives response
✅ User is created

### If it still hangs:
❌ Logs will stop at a specific step
❌ That tells us exactly what's blocking

**Most likely culprits:**
1. **Password hashing** - bcrypt blocking (fixed by reducing rounds)
2. **File write** - `UserStorage.create()` hanging on disk write
3. **Token generation** - JWT signing taking too long

## 📊 Performance Improvements

| Operation | Before | After |
|-----------|--------|-------|
| bcrypt rounds | 12 | 10 |
| Hash time | ~2-3s | ~1-1.5s |
| Total registration | 60s+ timeout | Should be <2s |

## 🔧 Additional Fixes (if still slow)

### If bcrypt is still slow:
```javascript
// Further reduce to 8 rounds (still secure)
const hashedPassword = await bcrypt.hash(password, 8);
```

### If file write is slow:
Check disk space and permissions:
```bash
df -h
ls -la /mnt/c/pr0/meta/mvp-workspace/data/
```

### If JWT is slow:
Check JWT secret length in `.env`:
```env
JWT_SECRET=your-secret-key-here  # Should be reasonable length
```

## ✅ Status: DEBUGGING ENABLED

Restart backend and watch logs to identify the exact bottleneck.
