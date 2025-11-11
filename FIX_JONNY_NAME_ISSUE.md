# Fix: "Jonny" Name Display Issue

## 🔍 Problem Summary

**Symptom:** The app shows "Jonny" instead of your actual name from the database.

**Root Cause:** The `is_admin()` function queries the `users` table without `SECURITY DEFINER`, causing infinite RLS policy recursion:

1. App tries to load user profile from database
2. RLS policy calls `is_admin()` function
3. `is_admin()` queries `users` table (triggers RLS again)
4. **Infinite loop** → 10 second timeout
5. App falls back to auth session metadata → displays "Jonny"

## ✅ Solution

Replace the `is_admin()` function with a `SECURITY DEFINER` version that bypasses RLS, breaking the recursion loop.

## 📋 Steps to Fix

### 1. Apply the Migration

1. Open **Supabase Dashboard** → SQL Editor
2. Open `/supabase/migrations/fix_is_admin_recursion.sql`
3. Copy and paste the entire contents
4. Click **Run**
5. Verify you see the success messages at the end

### 2. Verify the Fix

1. Run `/test-after-fix.sql` in Supabase SQL Editor
2. You should see:
   - ✅ `is_admin()` is now SECURITY DEFINER
   - ✅ All 3 helper functions exist
   - ✅ `sync_marketer_with_user` is SECURITY DEFINER
   - ✅ 8 RLS policies are in place

### 3. Test in Your App

1. **Refresh your browser** (hard refresh: Cmd+Shift+R)
2. **Log in** if needed
3. Profile should load instantly (no 10-second timeout)
4. **"Jonny" should be replaced** with your actual name from the database!

## 🛠️ Technical Details

### What Changed:

1. **`is_admin()` function**
   - Now uses `SECURITY DEFINER` → bypasses RLS → no recursion

2. **New helper functions:**
   - `current_user_role()` - safely gets user role
   - `current_user_organization()` - safely gets user org

3. **`sync_marketer_with_user` trigger**
   - Now uses `SECURITY DEFINER` (was missing before)

4. **Updated RLS policies**
   - Uses new non-recursive helper functions
   - Proper organization filtering for admins

### Files:

- **Fix:** `supabase/migrations/fix_is_admin_recursion.sql`
- **Test:** `test-after-fix.sql`

## 🔍 Understanding the Issue

### Before Fix:
```
User loads profile
  ↓
RLS checks admins_update_all_users policy
  ↓
Policy calls is_admin()
  ↓
is_admin() queries users table (affected by RLS!)
  ↓
RLS checks policies again
  ↓
Calls is_admin() again
  ↓
INFINITE LOOP → TIMEOUT → Fallback to "Jonny"
```

### After Fix:
```
User loads profile
  ↓
RLS checks admins_update_org policy
  ↓
Policy calls is_admin()
  ↓
is_admin() runs with SECURITY DEFINER (bypasses RLS!)
  ↓
Returns result immediately
  ↓
Profile loads successfully → Shows real name from database ✅
```

## 🚨 If Issues Persist

If "Jonny" still appears after applying the fix:

1. **Check browser cache:** Hard refresh (Cmd+Shift+R)
2. **Check console logs:** Look for "Profile load timeout" errors
3. **Verify migration ran:** Run `test-after-fix.sql` to confirm
4. **Check database data:** Verify your user record has the correct name

## 📊 Expected Results

- **Before:** Profile load takes 10+ seconds, times out, shows "Jonny"
- **After:** Profile loads in < 1 second, shows your real name from database

---

**Created:** 2025-11-11  
**Status:** Ready to apply  
**Migration File:** `supabase/migrations/fix_is_admin_recursion.sql`

