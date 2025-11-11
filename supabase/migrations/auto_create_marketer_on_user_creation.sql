-- Auto-Create Marketer Records When Users Are Created
-- Date: 2025-11-07
-- Purpose: Automatically create and link marketer records for any user with role="marketer"

-- This ensures that:
-- 1. When a new user with role="marketer" is created → marketer record auto-created
-- 2. When an existing user's role changes to "marketer" → marketer record auto-created
-- 3. All future marketers automatically get notifications

-- =============================================================================
-- FUNCTION: Auto-create marketer record for marketer users
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_create_marketer_record()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS: Run on INSERT and UPDATE of users table
-- =============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS auto_create_marketer_on_insert ON users;
DROP TRIGGER IF EXISTS auto_create_marketer_on_update ON users;

-- Trigger for new user creation
CREATE TRIGGER auto_create_marketer_on_insert
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_marketer_record();

-- Trigger for when a user's role changes to "marketer"
CREATE TRIGGER auto_create_marketer_on_update
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.role = 'marketer' AND (OLD.role IS NULL OR OLD.role != 'marketer'))
  EXECUTE FUNCTION auto_create_marketer_record();

-- =============================================================================
-- ENHANCED: Keep marketer records in sync with user accounts
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_marketer_with_user()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is a marketer and has a marketer record, keep it in sync
  IF NEW.role = 'marketer' THEN
    UPDATE marketers
    SET 
      name = NEW.name,
      email = NEW.email,
      is_active = NEW.is_active
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing sync trigger if it exists
DROP TRIGGER IF EXISTS sync_marketer_on_user_update ON users;

-- Trigger to keep marketer info in sync when user is updated
CREATE TRIGGER sync_marketer_on_user_update
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.role = 'marketer')
  EXECUTE FUNCTION sync_marketer_with_user();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show all triggers on the users table
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND trigger_name LIKE '%marketer%'
ORDER BY trigger_name;

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION auto_create_marketer_record() IS 
'Automatically creates a marketer record when a user with role=marketer is created or updated';

COMMENT ON FUNCTION sync_marketer_with_user() IS 
'Keeps marketer name, email, and is_active in sync with the linked user account';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ AUTO-MARKETER SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Future behavior:';
  RAISE NOTICE '1. New user with role="marketer" → Marketer record auto-created';
  RAISE NOTICE '2. Existing user role changed to "marketer" → Marketer record auto-created';
  RAISE NOTICE '3. Marketer user info updated → Marketer record auto-synced';
  RAISE NOTICE '';
  RAISE NOTICE 'All future marketers will automatically receive notifications! 🎉';
  RAISE NOTICE '';
END $$;

