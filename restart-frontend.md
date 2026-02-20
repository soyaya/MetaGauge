# Frontend Not Updating - Restart Instructions

## Why Frontend Hasn't Updated

The frontend dev server is still running with the OLD compiled code. Even though we:
- ✅ Saved all file changes
- ✅ Deleted the `.next` folder

The dev server needs to be **restarted** to pick up the changes.

## How to Restart Frontend

### Step 1: Stop the Current Dev Server

Find the terminal window running the frontend and press:
```
Ctrl + C
```

Or if you can't find it, kill the process:

**Windows:**
```bash
# Find the process
netstat -ano | findstr :3000

# Kill it (replace PID with the number from above)
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
```

### Step 2: Start Fresh Dev Server

```bash
cd mvp-workspace/frontend
npm run dev
```

### Step 3: Hard Refresh Browser

After the dev server starts:
1. Open your browser
2. Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
3. Or open DevTools (F12) → Right-click refresh → "Empty Cache and Hard Reload"

## What You Should See After Restart

### Dashboard (No Quick/Marathon Sync buttons):
```
Dashboard
[New Analysis Button]  ← Only this button!

Defi
DEFI • lisk

Address: 0x1231DEB6...
Purpose: [Your purpose]
Onboarded: Feb 15, 2026  ← Changed from "Started"
Deployment Block: [Number]  ← Should be a number, not "lisk"

Subscription: Free
Historical Data: 7 days
```

### Onboarding Form:
```
Project Start Date (Optional)
For your reference only. The onboarding date will be used in the dashboard.
[Date Input]
```

## Verification Checklist

After restarting, verify:

- [ ] No "Quick Sync" button on dashboard
- [ ] No "Marathon Sync" button on dashboard
- [ ] Dashboard shows "Onboarded:" instead of "Started:"
- [ ] Onboarding form shows "Project Start Date (Optional)"
- [ ] Onboarding form has help text about reference only
- [ ] No runtime errors in browser console

## If Frontend Still Doesn't Update

### 1. Check if changes are really saved:
```bash
cd mvp-workspace/frontend
grep "Onboarded" app/dashboard/page.tsx
# Should show: <p><strong>Onboarded:</strong>

grep "cache-busting" lib/api.ts
# Should show: // Add cache-busting timestamp
```

### 2. Clear browser cache completely:
- Chrome: Settings → Privacy → Clear browsing data → Cached images and files
- Firefox: Settings → Privacy → Clear Data → Cached Web Content
- Edge: Settings → Privacy → Clear browsing data → Cached images and files

### 3. Try incognito/private mode:
- Open a new incognito/private window
- Navigate to your app
- Check if changes appear

### 4. Check dev server output:
Look for compilation messages like:
```
✓ Compiled /app/dashboard/page in XXXms
✓ Compiled /app/onboarding/page in XXXms
```

### 5. Force rebuild:
```bash
cd mvp-workspace/frontend
rm -rf .next node_modules/.cache
npm run dev
```

## Common Issues

### Issue: "Quick Sync" button still showing
**Cause**: Browser serving cached JavaScript
**Fix**: Hard refresh (Ctrl+Shift+R) or clear cache

### Issue: "Started" still showing instead of "Onboarded"
**Cause**: Dev server not restarted
**Fix**: Stop and restart dev server

### Issue: Changes not compiling
**Cause**: Syntax error in files
**Fix**: Check terminal for compilation errors

### Issue: Port 3000 already in use
**Cause**: Old dev server still running
**Fix**: Kill the process (see Step 1 above)

## Need Help?

If frontend still doesn't update after following all steps:

1. **Check file contents**:
   ```bash
   cat mvp-workspace/frontend/app/dashboard/page.tsx | grep "Onboarded"
   ```

2. **Check git status**:
   ```bash
   cd mvp-workspace
   git status
   git diff frontend/app/dashboard/page.tsx
   ```

3. **Verify dev server is running**:
   - Should see "Ready" message in terminal
   - Should be accessible at http://localhost:3000

All changes ARE saved - you just need to restart the dev server! 🚀
