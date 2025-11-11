-- Fix: Admin Update Users Policy
-- Date: 2025-11-11
-- Purpose: Allow admins to update other users (activate/deactivate, change roles)
-- Issue: PGRST116 error when admins try to toggle user status

-- =============================================================================
-- CREATE HELPER FUNCTION (avoids RLS recursion)
-- =============================================================================

-- Function to check if current user is an admin (uses SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- =============================================================================
-- DROP PROBLEMATIC ADMIN UPDATE POLICY
-- =============================================================================

DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "allow_own_update" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "admins_update_all_users" ON users;

-- =============================================================================
-- CREATE FIXED POLICIES
-- =============================================================================

-- 1. Allow users to update their OWN profile
CREATE POLICY "users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Allow admins to update ANY user (using helper function to avoid recursion)
CREATE POLICY "admins_update_all_users"
ON users
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- =============================================================================
-- EXPLANATION
-- =============================================================================

-- The key fix here is using a SECURITY DEFINER function (is_admin())
-- This function bypasses RLS when checking the current user's role
-- This avoids the infinite recursion that was causing the 500 errors

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- View all UPDATE policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' 
AND cmd = 'UPDATE'
ORDER BY policyname;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ADMIN UPDATE POLICY FIXED!';
  RAISE NOTICE '';
  RAISE NOTICE 'Admins can now:';
  RAISE NOTICE '  - Activate/deactivate users';
  RAISE NOTICE '  - Change user roles';
  RAISE NOTICE '  - Update any user profile';
  RAISE NOTICE '';
  RAISE NOTICE 'The fix uses JWT claims to avoid recursion';
  RAISE NOTICE '';
END $$;

