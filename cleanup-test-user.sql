-- Cleanup Script for Test User
-- Run this in Supabase SQL Editor to remove test user completely
-- Email: dreamteamzceo@gmail.com

-- Step 1: Check if user exists in public.users
SELECT id, email, name, role, organization_id, created_at 
FROM public.users 
WHERE email = 'dreamteamzceo@gmail.com';

-- Step 2: Check if user exists in auth.users (you can only see this in Supabase Dashboard)
-- Go to: Authentication > Users and search for the email

-- Step 3: Check invite status
SELECT id, email, role, used, used_at, expires_at, created_at
FROM public.invites
WHERE email = 'dreamteamzceo@gmail.com'
ORDER BY created_at DESC;

-- ============================================
-- CLEANUP COMMANDS (run these to clean up)
-- ============================================

-- Step 4: Delete from public.users (if exists)
DELETE FROM public.users 
WHERE email = 'dreamteamzceo@gmail.com';

-- Step 5: Reset the invite (mark as unused) or delete and recreate
-- Option A: Mark invite as unused (to reuse same invite)
UPDATE public.invites
SET used = false, used_at = NULL
WHERE email = 'dreamteamzceo@gmail.com'
  AND used = true;

-- Option B: Delete old invites (then create new one from UI)
-- DELETE FROM public.invites
-- WHERE email = 'dreamteamzceo@gmail.com';

-- Step 6: Delete from auth.users
-- IMPORTANT: This MUST be done via Supabase Dashboard
-- You CANNOT delete auth.users via SQL from the SQL Editor
-- Go to: Authentication > Users > Find user > Click "..." > Delete User

-- ============================================
-- VERIFICATION (run after cleanup)
-- ============================================

-- Verify user is deleted from public.users
SELECT COUNT(*) as public_users_count
FROM public.users 
WHERE email = 'dreamteamzceo@gmail.com';
-- Should return 0

-- Verify invite status
SELECT id, email, used, used_at
FROM public.invites
WHERE email = 'dreamteamzceo@gmail.com';
-- Should show used = false or no results if deleted

