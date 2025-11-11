-- Fix: User Signup RLS Policies
-- Date: 2025-11-07
-- Purpose: Allow new users to create their own profile during signup

-- =============================================================================
-- ENABLE RLS ON USERS TABLE (if not already enabled)
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DROP EXISTING POLICIES (to recreate them properly)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Allow user signup" ON users;
DROP POLICY IF EXISTS "Users can create their own profile" ON users;

-- =============================================================================
-- CREATE NEW RLS POLICIES
-- =============================================================================

-- 1. Allow authenticated users to INSERT their own profile (critical for signup!)
CREATE POLICY "Users can create their own profile"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 2. Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 3. Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Allow admins to view all users
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  )
);

-- 5. Allow admins to insert users (for manual user creation)
CREATE POLICY "Admins can insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  )
);

-- 6. Allow admins to update all users
CREATE POLICY "Admins can update all users"
ON users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  )
);

-- =============================================================================
-- FIX: INVITES TABLE RLS (to prevent "already used" issues)
-- =============================================================================

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view invites by token" ON invites;
DROP POLICY IF EXISTS "Admins can manage invites" ON invites;
DROP POLICY IF EXISTS "System can update invites" ON invites;

-- Allow anyone (even non-authenticated) to view invites by token
CREATE POLICY "Anyone can view invites by token"
ON invites
FOR SELECT
TO public
USING (true);

-- Allow authenticated users to update invites (for marking as used)
CREATE POLICY "Authenticated users can update invites"
ON invites
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow admins to do everything with invites
CREATE POLICY "Admins can manage invites"
ON invites
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  )
);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show all policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Show all policies on invites table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'invites'
ORDER BY policyname;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ User signup RLS policies fixed!';
  RAISE NOTICE '';
  RAISE NOTICE 'New users can now:';
  RAISE NOTICE '1. Create their own profile during signup';
  RAISE NOTICE '2. View and update their own profile';
  RAISE NOTICE '3. Use invites without "already used" errors';
  RAISE NOTICE '';
  RAISE NOTICE 'Admins can:';
  RAISE NOTICE '1. View all users';
  RAISE NOTICE '2. Create and update all users';
  RAISE NOTICE '3. Manage all invites';
  RAISE NOTICE '';
END $$;

