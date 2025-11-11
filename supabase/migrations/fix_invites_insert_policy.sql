-- Fix: Invites Table INSERT Policy
-- Date: 2025-11-10
-- Purpose: Add missing INSERT policy for invites table to allow admins to create invites

-- =============================================================================
-- INVITES TABLE - Add INSERT Policy for Admins
-- =============================================================================

-- Enable RLS (should already be enabled)
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Admins can create invites" ON invites;
DROP POLICY IF EXISTS "Admins can insert invites" ON invites;

-- Create a simple INSERT policy for admins
-- This policy checks if the current user is an admin in the users table
CREATE POLICY "Admins can insert invites"
ON invites
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.is_active = true
  )
);

-- Also ensure DELETE policy exists for admins
DROP POLICY IF EXISTS "Admins can delete invites" ON invites;

CREATE POLICY "Admins can delete invites"
ON invites
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.is_active = true
  )
);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show all policies on invites table
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
WHERE tablename = 'invites'
ORDER BY cmd, policyname;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ INVITES INSERT POLICY FIXED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Admins can now:';
  RAISE NOTICE '  ✅ INSERT invites (create new invitations)';
  RAISE NOTICE '  ✅ SELECT invites (view invitations)';
  RAISE NOTICE '  ✅ UPDATE invites (mark as used)';
  RAISE NOTICE '  ✅ DELETE invites (cancel invitations)';
  RAISE NOTICE '';
  RAISE NOTICE 'Run this migration in your Supabase SQL Editor.';
  RAISE NOTICE '';
END $$;

