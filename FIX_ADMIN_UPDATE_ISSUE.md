# Fix: Admin Cannot Update Users (PGRST116 Error)

## 🐛 Problem

When admins try to activate/deactivate users in the Settings page, they get this error:

```
PATCH https://...supabase.co/rest/v1/users?id=eq.XXX 406 (Not Acceptable)
Error: Cannot coerce the result to a single JSON object
Code: PGRST116 - The result contains 0 rows
```

## 🔍 Root Cause

The RLS (Row Level Security) policies on the `users` table only allow users to update their **own** profile. There was no working policy for admins to update **other** users.

Previous attempts to fix this caused **infinite recursion** because the admin check queried the same `users` table that was being protected by RLS.

## ✅ Solution

Created a new migration: `fix_admin_update_users_policy.sql`

The fix uses a **SECURITY DEFINER function** (`is_admin()`) that bypasses RLS when checking if the current user is an admin. This avoids recursion.

## 🚀 How to Apply the Fix

### Step 1: Go to Supabase Dashboard

1. Open your Supabase project: https://supabase.com/dashboard
2. Go to **SQL Editor**

### Step 2: Run the Migration

Copy and paste the contents of:
```
supabase/migrations/fix_admin_update_users_policy.sql
```

Into the SQL Editor and click **RUN**.

### Step 3: Verify

Run this query to check the policies are correct:

```sql
-- Check UPDATE policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' 
AND cmd = 'UPDATE';

-- Test the is_admin() function
SELECT is_admin();
```

You should see:
- `users_update_own` - for users updating themselves
- `admins_update_all_users` - for admins updating anyone
- `is_admin()` should return `true` if you're logged in as an admin

### Step 4: Test in Your App

1. Go to **Settings** → **Team Members**
2. Try to activate/deactivate a user
3. Should work without errors! ✅

## 📋 What This Migration Does

1. **Creates `is_admin()` function** - Checks if current user is admin (bypasses RLS using SECURITY DEFINER)
2. **Drops old broken policies** - Removes conflicting/recursive policies
3. **Creates two new policies:**
   - `users_update_own` - Users can update their own profile
   - `admins_update_all_users` - Admins can update any user (uses `is_admin()`)

## 🧪 Testing Checklist

After applying the migration:

- [ ] Admin can activate/deactivate users
- [ ] Admin can change user roles
- [ ] Regular users can still update their own profile
- [ ] Regular users CANNOT update other users
- [ ] No 406/PGRST116 errors in console

## 🔄 Alternative: Apply via Supabase CLI

If you have Supabase CLI installed locally:

```bash
# Make sure you're in the project root
cd "/Users/jalexander/Documents/10. Python Projects/FCA"

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

## ℹ️ Additional Notes

**Why SECURITY DEFINER?**
- Normal functions run with the permissions of the caller
- SECURITY DEFINER functions run with the permissions of the function owner
- This allows the function to check the users table without triggering RLS
- The RLS policy then uses this function result to make decisions

**Is this secure?**
- Yes! The function only checks the current user's role
- It uses `auth.uid()` which can't be spoofed
- The function is read-only (no data modification)
- Only checks admin status, nothing more

---

**Questions?** Check the migration file for detailed comments and verification queries.

