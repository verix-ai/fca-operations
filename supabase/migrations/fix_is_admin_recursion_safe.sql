-- ===================================================================
-- SAFE FIX: Replace is_admin() and fix RLS recursion
-- This version safely handles existing policies
-- ===================================================================

BEGIN;

-- ===================================================================
-- PART 1: Replace is_admin() with a SECURITY DEFINER version
-- ===================================================================

-- Drop the old is_admin() function if it exists
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Create new SECURITY DEFINER version that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- This runs with elevated privileges, bypassing RLS
  -- No recursion possible!
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO public;

-- ===================================================================
-- PART 2: Create helper functions for better RLS policies
-- ===================================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role, 'viewer');
END;
$$;

-- Get current user's organization
CREATE OR REPLACE FUNCTION public.current_user_organization()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_org uuid;
BEGIN
  SELECT organization_id INTO user_org
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_organization() TO authenticated;

-- ===================================================================
-- PART 3: Fix sync_marketer_with_user trigger function
-- ===================================================================

CREATE OR REPLACE FUNCTION public.sync_marketer_with_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user is a marketer and has a marketer record, keep it in sync
  IF NEW.role = 'marketer' THEN
    UPDATE marketers
    SET 
      name = NEW.name,
      email = NEW.email,
      is_active = NEW.is_active,
      updated_at = NOW()
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ===================================================================
-- PART 4: Drop ALL existing policies on users table
-- ===================================================================

DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- PART 5: Create fresh RLS policies
-- ===================================================================

-- Policy 1: Users can SELECT their own profile (most important!)
CREATE POLICY "users_select_own" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = id
);

-- Policy 2: Admins can SELECT all users in their organization
CREATE POLICY "admins_select_org" 
ON public.users 
FOR SELECT 
TO authenticated
USING (
  public.is_admin()
  AND organization_id = public.current_user_organization()
);

-- Policy 3: Users can UPDATE their own profile (basic info only)
CREATE POLICY "users_update_own" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);

-- Policy 4: Admins can UPDATE users in their organization
CREATE POLICY "admins_update_org" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (
  public.is_admin()
  AND organization_id = public.current_user_organization()
)
WITH CHECK (
  public.is_admin()
  AND organization_id = public.current_user_organization()
);

-- Policy 5: Allow INSERT for new user (signup/invite flow)
CREATE POLICY "users_insert_own" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = id
);

-- Policy 6: Admins can INSERT users in their org
CREATE POLICY "admins_insert_org" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (
  public.is_admin()
  AND organization_id = public.current_user_organization()
);

-- Policy 7: Service role bypass (for system operations)
CREATE POLICY "service_role_all" 
ON public.users 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 8: Allow anon to insert during signup
CREATE POLICY "anon_insert_own" 
ON public.users 
FOR INSERT 
TO anon
WITH CHECK (true);

COMMIT;

-- ===================================================================
-- VERIFICATION
-- ===================================================================

SELECT '=== ✅ FIXED FUNCTIONS ===' AS status;

SELECT 
  routine_name,
  security_type,
  routine_schema
FROM information_schema.routines
WHERE routine_name IN ('is_admin', 'current_user_role', 'current_user_organization', 'sync_marketer_with_user')
  AND routine_schema = 'public'
ORDER BY routine_name;

SELECT '=== ✅ NEW RLS POLICIES ===' AS status;

SELECT 
  policyname,
  cmd AS operation,
  roles,
  LEFT(qual::text, 50) AS using_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

SELECT '=== ✅ POLICY COUNT ===' AS status;

SELECT 
  COUNT(*) AS total_policies,
  'Expected: 8 policies' AS note
FROM pg_policies 
WHERE tablename = 'users';

SELECT '=== ✅ COMPLETE ===' AS final_status;

