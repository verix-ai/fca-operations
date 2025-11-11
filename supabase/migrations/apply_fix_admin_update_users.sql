-- =============================================================================
-- Fix: Admin Update Users Policy - COMPLETE MIGRATION
-- Run this entire script in Supabase SQL Editor
-- =============================================================================

-- Step 1: Create is_admin() helper function
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

-- Step 2: Grant permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 3: Drop old conflicting policies
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "allow_own_update" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "admins_update_all_users" ON users;

-- Step 4: Create new working policies
CREATE POLICY "users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "admins_update_all_users"
ON users
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- =============================================================================
-- Verification (runs automatically)
-- =============================================================================

-- Check if function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    RAISE NOTICE '✅ is_admin() function created successfully';
  ELSE
    RAISE NOTICE '❌ is_admin() function NOT created';
  END IF;
END $$;

-- Check policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'users' 
  AND cmd = 'UPDATE';
  
  IF policy_count = 2 THEN
    RAISE NOTICE '✅ 2 UPDATE policies created successfully';
  ELSE
    RAISE NOTICE '❌ Expected 2 policies, found: %', policy_count;
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Admins can now update other users';
  RAISE NOTICE 'Go test in Settings > Team Members';
  RAISE NOTICE '';
END $$;

