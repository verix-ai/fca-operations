-- EMERGENCY FIX: Remove Infinite Recursion in RLS Policies
-- Date: 2025-11-07
-- Purpose: Fix the infinite recursion error in users table RLS policies

-- =============================================================================
-- DISABLE RLS TEMPORARILY (to allow us to fix it)
-- =============================================================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DROP ALL EXISTING POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can create their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Allow user signup" ON users;

-- =============================================================================
-- SIMPLE RLS POLICIES (NO RECURSION)
-- =============================================================================

-- Enable RLS again
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1. Allow authenticated users to INSERT their own profile (for signup)
CREATE POLICY "allow_own_insert"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 2. Allow authenticated users to SELECT their own profile
CREATE POLICY "allow_own_select"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 3. Allow authenticated users to UPDATE their own profile
CREATE POLICY "allow_own_update"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Allow service role to do everything (for server-side operations)
CREATE POLICY "service_role_all"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS INFINITE RECURSION FIXED!';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies are now simple and safe:';
  RAISE NOTICE '1. Users can view/update their own profile';
  RAISE NOTICE '2. Users can create their own profile during signup';
  RAISE NOTICE '3. Service role has full access (for admin operations)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Admin UI operations will use service role key';
  RAISE NOTICE '';
END $$;

