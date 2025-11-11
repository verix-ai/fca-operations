-- Fix: Admin Can View All Users + Referral Creation Notifications
-- Date: 2025-11-08
-- Purpose: Allow admins to see all users AND notify admins when referrals are created

-- =============================================================================
-- 1. FIX USERS TABLE - Allow viewing all users in same organization
-- =============================================================================

-- Add policy for viewing users in same organization
CREATE POLICY "users_select_same_org"
ON users
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM users 
    WHERE id = auth.uid()
  )
);

-- =============================================================================
-- 2. ADD REFERRAL CREATION NOTIFICATION TRIGGER
-- =============================================================================

-- Create function to notify admins when a new referral is created
CREATE OR REPLACE FUNCTION notify_on_referral_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  target_user RECORD;
  referral_name TEXT;
  marketer_name TEXT;
BEGIN
  BEGIN
    -- Get referral and marketer names
    referral_name := COALESCE(NEW.referral_name, 'Referral #' || NEW.id);
    marketer_name := COALESCE(NEW.referred_by, 'Unknown Marketer');
    
    -- Notify all admins in the organization
    FOR target_user IN 
      SELECT id, name, organization_id 
      FROM users 
      WHERE organization_id = NEW.organization_id 
      AND role = 'admin' 
      AND is_active = true
    LOOP
      INSERT INTO notifications (
        organization_id,
        user_id,
        type,
        title,
        message,
        related_entity_type,
        related_entity_id
      ) VALUES (
        target_user.organization_id,
        target_user.id,
        'referral_created',
        'New Referral Submitted',
        marketer_name || ' has submitted a new referral: ' || referral_name || '.',
        'referral',
        NEW.id
      );
    END LOOP;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't block the insert
      RAISE WARNING 'Referral creation notification failed: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS notify_on_referral_created_trigger ON referrals;

-- Create trigger for referral creation
CREATE TRIGGER notify_on_referral_created_trigger
  AFTER INSERT ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_referral_created();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show users policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Show referral trigger
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'notify_on_referral_created_trigger';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ADMIN VIEW & REFERRAL NOTIFICATIONS FIXED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  ✅ Admins can now view all users in their organization';
  RAISE NOTICE '  ✅ Admins get notified when referrals are created';
  RAISE NOTICE '';
  RAISE NOTICE 'To test:';
  RAISE NOTICE '  1. Admin refreshes Settings page - should see all users';
  RAISE NOTICE '  2. Marketer creates referral - admin gets notification';
  RAISE NOTICE '';
END $$;


