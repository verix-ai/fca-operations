-- Fix: Marketers Table RLS Policies
-- Date: 2025-11-07
-- Purpose: Allow the auto-create trigger to work properly

-- =============================================================================
-- FIX MARKETERS TABLE RLS
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own marketer record" ON marketers;
DROP POLICY IF EXISTS "Users can update their own marketer record" ON marketers;
DROP POLICY IF EXISTS "Admins can manage marketers" ON marketers;
DROP POLICY IF EXISTS "Service role can do everything" ON marketers;

-- Disable RLS temporarily
ALTER TABLE marketers DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE marketers ENABLE ROW LEVEL SECURITY;

-- 1. Allow users to view their own marketer record
CREATE POLICY "allow_own_marketer_select"
ON marketers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. Allow users to update their own marketer record
CREATE POLICY "allow_own_marketer_update"
ON marketers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Allow service role to do everything (for triggers and admin operations)
CREATE POLICY "service_role_marketers_all"
ON marketers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Allow authenticated users to view all marketers (needed for lookups)
CREATE POLICY "allow_all_marketers_select"
ON marketers
FOR SELECT
TO authenticated
USING (true);

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ MARKETERS TABLE RLS FIXED!';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies:';
  RAISE NOTICE '1. Users can view their own marketer record';
  RAISE NOTICE '2. Users can update their own marketer record';
  RAISE NOTICE '3. Service role has full access (for triggers)';
  RAISE NOTICE '4. All authenticated users can view marketers (for referrals)';
  RAISE NOTICE '';
  RAISE NOTICE 'The auto-create trigger can now create marketer records!';
  RAISE NOTICE '';
END $$;

