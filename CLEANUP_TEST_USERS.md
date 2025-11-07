# How to Clean Up Test Users

When testing the invite flow, you may need to remove test users to retry the signup process. Here's the complete cleanup procedure.

## The Problem

The error "User already registered" appears because:
1. User exists in `auth.users` (Supabase Auth)
2. User exists in `public.users` (your database)
3. Invite is marked as `used = true`

**All three must be cleaned up** for the same email to sign up again.

## Complete Cleanup Procedure

### Option 1: Using Supabase Dashboard (Easiest)

#### Step 1: Delete User from Authentication
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Users**
4. Search for the email: `dreamteamzceo@gmail.com`
5. Click the **"..."** menu next to the user
6. Click **"Delete User"**
7. Confirm deletion

This will:
- ✅ Delete from `auth.users`
- ✅ **Automatically delete from `public.users`** (if you have CASCADE setup)

#### Step 2: Reset or Delete the Invite
1. Navigate to **Table Editor** → **invites**
2. Find the invite for `dreamteamzceo@gmail.com`
3. Either:
   - **Option A:** Edit the row, set `used = false` and `used_at = null` (reuse invite)
   - **Option B:** Delete the row (create new invite from UI)

#### Step 3: Verify Cleanup
1. Check **Authentication** → **Users**: Email should not exist
2. Check **Table Editor** → **users**: Email should not exist
3. Check **Table Editor** → **invites**: Should show `used = false` or not exist

---

### Option 2: Using SQL Editor (Partial)

#### Step 1: Run Cleanup SQL
1. Go to Supabase Dashboard → **SQL Editor**
2. Copy the contents of `cleanup-test-user.sql`
3. Or run these commands:

```sql
-- Delete from public.users
DELETE FROM public.users 
WHERE email = 'dreamteamzceo@gmail.com';

-- Reset invite (mark as unused)
UPDATE public.invites
SET used = false, used_at = NULL
WHERE email = 'dreamteamzceo@gmail.com';
```

#### Step 2: Delete from Authentication (MUST BE DONE VIA DASHBOARD)
⚠️ **IMPORTANT:** You **cannot** delete from `auth.users` via SQL Editor for security reasons.

You MUST use the Dashboard:
1. Go to **Authentication** → **Users**
2. Find and delete the user manually

---

## Quick Reference Commands

### Check User Status
```sql
-- Check public.users
SELECT * FROM public.users WHERE email = 'dreamteamzceo@gmail.com';

-- Check invites
SELECT * FROM public.invites WHERE email = 'dreamteamzceo@gmail.com';

-- Check auth.users (Dashboard only)
-- Go to: Authentication > Users
```

### Delete Everything
```sql
-- 1. Delete from public.users
DELETE FROM public.users WHERE email = 'dreamteamzceo@gmail.com';

-- 2. Reset invite
UPDATE public.invites
SET used = false, used_at = NULL
WHERE email = 'dreamteamzceo@gmail.com';

-- 3. Delete from auth.users (MUST use Dashboard)
-- Go to: Authentication > Users > Delete
```

---

## Automated Cleanup Script (Optional)

For frequent testing, you can create a utility function:

```sql
-- Create cleanup function (run once)
CREATE OR REPLACE FUNCTION cleanup_test_user(test_email TEXT)
RETURNS TABLE(
  deleted_from_users BOOLEAN,
  reset_invite BOOLEAN,
  auth_user_status TEXT
) AS $$
BEGIN
  -- Delete from public.users
  DELETE FROM public.users WHERE email = test_email;
  deleted_from_users := FOUND;
  
  -- Reset invite
  UPDATE public.invites
  SET used = false, used_at = NULL
  WHERE email = test_email AND used = true;
  reset_invite := FOUND;
  
  -- Note: Cannot delete from auth.users via SQL
  auth_user_status := 'Must delete manually from Dashboard: Authentication > Users';
  
  RETURN QUERY SELECT deleted_from_users, reset_invite, auth_user_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage:
SELECT * FROM cleanup_test_user('dreamteamzceo@gmail.com');
```

Then you still need to manually delete from Authentication > Users.

---

## For Your Current Situation

**Email:** `dreamteamzceo@gmail.com`

### Quick Fix (Recommended):
1. **Go to Supabase Dashboard**
2. **Authentication → Users**
3. **Search for:** `dreamteamzceo@gmail.com`
4. **Click "..." → Delete User**
5. **Table Editor → invites**
6. **Find the invite and either:**
   - Set `used = false`, `used_at = null` (to reuse)
   - Delete it (then create new invite from Settings page)

### After Cleanup:
- User should be able to sign up again with the same email
- The invite link should work properly
- No "User already registered" error

---

## Prevention for Testing

To avoid this issue during testing:

### Option 1: Use Unique Test Emails
```
test+1@example.com
test+2@example.com
test+3@example.com
```
Gmail ignores everything after `+`, so they all go to `test@example.com`

### Option 2: Use Temporary Email Services
- https://temp-mail.org
- https://10minutemail.com
- https://mailinator.com

### Option 3: Set Up Test Environment
- Use a separate Supabase project for testing
- Use test email accounts
- Clear database after each test cycle

---

## Common Issues

### "User already registered" even after deleting from public.users
**Cause:** User still exists in `auth.users`  
**Fix:** Delete from Authentication → Users in Dashboard

### Invite doesn't work after deleting user
**Cause:** Invite is still marked as `used = true`  
**Fix:** Reset invite with SQL or delete and recreate

### Can't delete user from SQL
**Cause:** Security restriction on `auth.users`  
**Fix:** Use Dashboard → Authentication → Users

### CASCADE delete not working
**Cause:** Foreign key constraint not set up  
**Fix:** Add CASCADE constraint or delete manually from both tables

