-- COMPREHENSIVE RLS FIX - All Tables
-- Date: 2025-11-07
-- Purpose: Fix ALL RLS issues preventing user signup and operations

-- =============================================================================
-- 1. USERS TABLE - Complete Reset
-- =============================================================================

-- Disable RLS temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON users';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies
-- 1a. Allow anyone to INSERT (for signup)
CREATE POLICY "users_insert_own"
ON users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 1b. Allow anyone to SELECT their own row
CREATE POLICY "users_select_own"
ON users
FOR SELECT
USING (auth.uid() = id);

-- 1c. Allow anyone to UPDATE their own row
CREATE POLICY "users_update_own"
ON users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 1d. Service role can do anything
CREATE POLICY "users_service_all"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- 2. MARKETERS TABLE - Complete Reset
-- =============================================================================

-- Disable RLS temporarily
ALTER TABLE marketers DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'marketers') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON marketers';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE marketers ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies
-- 2a. Allow users to SELECT their own marketer record
CREATE POLICY "marketers_select_own"
ON marketers
FOR SELECT
USING (user_id = auth.uid());

-- 2b. Allow users to UPDATE their own marketer record
CREATE POLICY "marketers_update_own"
ON marketers
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2c. Allow everyone to SELECT all marketers (needed for dropdowns/referrals)
CREATE POLICY "marketers_select_all"
ON marketers
FOR SELECT
USING (true);

-- 2d. Service role can do anything (for triggers and admin)
CREATE POLICY "marketers_service_all"
ON marketers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- 3. UPDATE TRIGGER TO USE SECURITY DEFINER
-- =============================================================================

-- Recreate the auto-create marketer function with SECURITY DEFINER
DROP FUNCTION IF EXISTS auto_create_marketer_record() CASCADE;

CREATE OR REPLACE FUNCTION auto_create_marketer_record()
RETURNS TRIGGER
SECURITY DEFINER  -- This runs with the function owner's privileges (bypasses RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if this is a user with role="marketer"
  IF NEW.role = 'marketer' THEN
    
    -- Check if a marketer record already exists
    IF NOT EXISTS (SELECT 1 FROM marketers WHERE user_id = NEW.id) THEN
      
      -- Create the marketer record
      INSERT INTO marketers (
        organization_id,
        user_id,
        name,
        email,
        is_active
      ) VALUES (
        NEW.organization_id,
        NEW.id,
        NEW.name,
        NEW.email,
        NEW.is_active
      );
      
      RAISE NOTICE '✅ Auto-created marketer record for user: % (%)', NEW.name, NEW.email;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS auto_create_marketer_on_insert ON users;
DROP TRIGGER IF EXISTS auto_create_marketer_on_update ON users;

CREATE TRIGGER auto_create_marketer_on_insert
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_marketer_record();

CREATE TRIGGER auto_create_marketer_on_update
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.role = 'marketer' AND (OLD.role IS NULL OR OLD.role != 'marketer'))
  EXECUTE FUNCTION auto_create_marketer_record();

-- =============================================================================
-- 4. INVITES TABLE - Ensure proper access
-- =============================================================================

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'invites') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON invites';
    END LOOP;
END $$;

-- Allow anyone to SELECT invites
CREATE POLICY "invites_select_all"
ON invites
FOR SELECT
TO public
USING (true);

-- Allow authenticated users to UPDATE invites (for marking as used)
CREATE POLICY "invites_update_all"
ON invites
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Service role can do anything
CREATE POLICY "invites_service_all"
ON invites
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('users', 'marketers', 'invites')
ORDER BY tablename, policyname;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPREHENSIVE RLS FIX COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed tables:';
  RAISE NOTICE '  ✅ users - Simple policies, no recursion';
  RAISE NOTICE '  ✅ marketers - Simple policies, trigger uses SECURITY DEFINER';
  RAISE NOTICE '  ✅ invites - Open for signup flow';
  RAISE NOTICE '';
  RAISE NOTICE 'User signup should now work perfectly!';
  RAISE NOTICE '';
END $$;

