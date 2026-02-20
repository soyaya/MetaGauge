# PostgreSQL User Data Retrieval Fix

**Date:** 2026-02-08  
**Issue:** `Cannot read properties of undefined (reading 'defaultContract')`  
**Status:** ✅ Fixed

## Problem

After completing onboarding, the code tried to access `user.onboarding.defaultContract` but got `undefined` because:

1. User data is stored in `users` table
2. Onboarding data is stored in `user_onboarding` table (separate)
3. `findById()` only queried the `users` table
4. The `onboarding` object was never attached to the user

## Root Cause

```javascript
// Before fix - only queries users table
static async findById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

// Result: user object has NO onboarding property
// user.onboarding.defaultContract → ERROR: Cannot read properties of undefined
```

## Solution

Modified all user retrieval methods to fetch and attach onboarding and preferences data:

### 1. Fixed `findById()`
```javascript
static async findById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  
  const user = toCamelCase(result.rows[0]);
  
  // Fetch onboarding data from separate table
  const onboarding = await this.getOnboarding(id);
  if (onboarding) {
    user.onboarding = onboarding;
  }
  
  // Fetch preferences data from separate table
  const preferences = await this.getPreferences(id);
  if (preferences) {
    user.preferences = preferences;
  }
  
  return user;
}
```

### 2. Fixed `findByEmail()`
Same pattern - fetch user, then attach onboarding and preferences.

### 3. Fixed `findByApiKey()`
Same pattern - fetch user, then attach onboarding and preferences.

### 4. Fixed `getOnboarding()` to parse JSONB
```javascript
static async getOnboarding(userId) {
  const result = await query(
    'SELECT * FROM user_onboarding WHERE user_id = $1',
    [userId]
  );
  if (!result.rows[0]) return null;
  
  const onboarding = toCamelCase(result.rows[0]);
  
  // Parse JSONB fields (PostgreSQL returns them as strings sometimes)
  if (onboarding.socialLinks && typeof onboarding.socialLinks === 'string') {
    onboarding.socialLinks = JSON.parse(onboarding.socialLinks);
  }
  if (onboarding.defaultContract && typeof onboarding.defaultContract === 'string') {
    onboarding.defaultContract = JSON.parse(onboarding.defaultContract);
  }
  
  return onboarding;
}
```

## Data Flow

### Before Fix
```
UserStorage.findById(userId)
  ↓
Query: SELECT * FROM users WHERE id = ?
  ↓
Return: { id, email, name, tier, ... }
  ↓
user.onboarding → undefined ❌
```

### After Fix
```
UserStorage.findById(userId)
  ↓
Query: SELECT * FROM users WHERE id = ?
  ↓
user = { id, email, name, tier, ... }
  ↓
Query: SELECT * FROM user_onboarding WHERE user_id = ?
  ↓
onboarding = { completed, socialLinks, defaultContract, ... }
  ↓
user.onboarding = onboarding
  ↓
Query: SELECT * FROM user_preferences WHERE user_id = ?
  ↓
preferences = { emailNotifications, ... }
  ↓
user.preferences = preferences
  ↓
Return: Complete user object with all data ✅
```

## Impact

### Methods Fixed
- ✅ `PostgresUserStorage.findById()`
- ✅ `PostgresUserStorage.findByEmail()`
- ✅ `PostgresUserStorage.findByApiKey()`
- ✅ `PostgresUserStorage.getOnboarding()`

### Now Works
- ✅ Onboarding completion
- ✅ Default contract indexing
- ✅ Accessing `user.onboarding.defaultContract`
- ✅ Accessing `user.onboarding.socialLinks`
- ✅ Accessing `user.preferences`

## Testing

### Test user retrieval:
```javascript
const user = await UserStorage.findById(userId);
console.log(user.onboarding.defaultContract); // ✅ Works now!
console.log(user.onboarding.socialLinks);     // ✅ Works now!
console.log(user.preferences);                // ✅ Works now!
```

### Verify in PostgreSQL:
```sql
-- Check user
SELECT id, email, name FROM users WHERE id = 'USER_ID';

-- Check onboarding (separate table)
SELECT 
  completed, 
  social_links, 
  default_contract 
FROM user_onboarding 
WHERE user_id = 'USER_ID';

-- Check preferences (separate table)
SELECT * FROM user_preferences WHERE user_id = 'USER_ID';
```

## File Changes

**File:** `src/api/database/postgresStorage.js`

**Lines Modified:**
- `findById()` - Lines 45-63
- `findByEmail()` - Lines 65-83
- `findByApiKey()` - Lines 85-103
- `getOnboarding()` - Lines 210-228

## Why This Happened

In the file-based storage, `onboarding` was stored as a nested object inside the user JSON:

```json
{
  "id": "...",
  "email": "...",
  "onboarding": {
    "completed": true,
    "defaultContract": { ... }
  }
}
```

In PostgreSQL, we normalized the data into separate tables for better structure:
- `users` table - core user data
- `user_onboarding` table - onboarding data
- `user_preferences` table - preferences data

But we forgot to JOIN them when retrieving users!

## Status

✅ All user retrieval methods now return complete user objects  
✅ Onboarding data properly attached  
✅ Preferences data properly attached  
✅ JSONB fields properly parsed  
✅ No more "Cannot read properties of undefined" errors  

---

**The onboarding flow should now work end-to-end with PostgreSQL!**
