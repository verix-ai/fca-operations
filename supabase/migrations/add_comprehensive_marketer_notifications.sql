-- Comprehensive Marketer Notification System
-- Date: 2025-11-07
-- Purpose: Notify marketers of all key client events

-- =============================================================================
-- 1. NOTIFICATION: Case Management Company Assigned to Referral
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_cm_company_assignment()
RETURNS TRIGGER AS $$
DECLARE
  marketer_user_id UUID;
  referral_name TEXT;
  cm_company_name TEXT;
BEGIN
  -- Check if cm_company was just assigned (NULL to value or value changed)
  IF NEW.cm_company IS NOT NULL AND (OLD.cm_company IS NULL OR OLD.cm_company != NEW.cm_company) THEN
    
    -- Get referral name
    referral_name := COALESCE(NEW.referral_name, 'Referral #' || NEW.id);
    cm_company_name := NEW.cm_company;
    
    -- Get the marketer's linked user_id
    IF NEW.marketer_id IS NOT NULL THEN
      SELECT user_id INTO marketer_user_id
      FROM marketers
      WHERE id = NEW.marketer_id
        AND user_id IS NOT NULL
        AND organization_id = NEW.organization_id;
      
      -- If marketer has a user account, send notification
      IF marketer_user_id IS NOT NULL THEN
        -- Verify the user is active
        IF EXISTS (SELECT 1 FROM users WHERE id = marketer_user_id AND is_active = true) THEN
          INSERT INTO notifications (
            organization_id,
            user_id,
            type,
            title,
            message,
            related_entity_type,
            related_entity_id
          ) VALUES (
            NEW.organization_id,
            marketer_user_id,
            'referral_updated',
            'Case Management Company Assigned',
            referral_name || ' has been assigned to ' || cm_company_name || '.',
            'referral',
            NEW.id
          );
        END IF;
      END IF;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS notify_on_cm_company_assignment_trigger ON referrals;

-- Create trigger for CM company assignment
CREATE TRIGGER notify_on_cm_company_assignment_trigger
  AFTER UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_cm_company_assignment();

-- =============================================================================
-- 2. NOTIFICATION: Client Intake Completed (Client Created from Referral)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_client_intake_completed()
RETURNS TRIGGER AS $$
DECLARE
  marketer_user_id UUID;
  client_name TEXT;
BEGIN
  -- Build client name
  client_name := COALESCE(
    NEW.first_name || ' ' || NEW.last_name,
    NEW.client_name,
    'Client #' || NEW.id
  );
  
  -- Get the marketer's linked user_id (if client has a marketer)
  IF NEW.marketer_id IS NOT NULL THEN
    SELECT user_id INTO marketer_user_id
    FROM marketers
    WHERE id = NEW.marketer_id
      AND user_id IS NOT NULL
      AND organization_id = NEW.organization_id;
    
    -- If marketer has a user account, send notification
    IF marketer_user_id IS NOT NULL THEN
      -- Verify the user is active
      IF EXISTS (SELECT 1 FROM users WHERE id = marketer_user_id AND is_active = true) THEN
        INSERT INTO notifications (
          organization_id,
          user_id,
          type,
          title,
          message,
          related_entity_type,
          related_entity_id
        ) VALUES (
          NEW.organization_id,
          marketer_user_id,
          'client_created',
          'Client Intake Completed',
          'Your referral ' || client_name || ' has completed client intake and is now active.',
          'client',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS notify_on_client_intake_completed_trigger ON clients;

-- Create trigger for client creation (intake completion)
CREATE TRIGGER notify_on_client_intake_completed_trigger
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_client_intake_completed();

-- =============================================================================
-- 3. ENHANCED: Phase Completion Notifications (Updated)
-- =============================================================================

-- Drop existing function to recreate it
DROP FUNCTION IF EXISTS notify_on_phase_completion() CASCADE;
DROP FUNCTION IF EXISTS notify_admins_on_phase_completion() CASCADE;

-- Enhanced function to notify admins AND marketer when a phase is completed
CREATE OR REPLACE FUNCTION notify_on_phase_completion()
RETURNS TRIGGER AS $$
DECLARE
  target_user RECORD;
  client_name TEXT;
  phase_name TEXT;
  phase_completed BOOLEAN;
  marketer_user_id UUID;
  notified_users UUID[];
BEGIN
  -- Build client name
  client_name := COALESCE(
    NEW.first_name || ' ' || NEW.last_name,
    NEW.client_name,
    'Client #' || NEW.id
  );

  phase_completed := false;
  notified_users := ARRAY[]::UUID[];

  -- Check if intake phase was just finalized
  IF NEW.intake_finalized = true AND (OLD.intake_finalized IS NULL OR OLD.intake_finalized = false) THEN
    phase_name := 'Intake Phase';
    phase_completed := true;
  -- Check if onboarding phase was just finalized
  ELSIF NEW.onboarding_finalized = true AND (OLD.onboarding_finalized IS NULL OR OLD.onboarding_finalized = false) THEN
    phase_name := 'Onboarding Phase';
    phase_completed := true;
  -- Check if service initiation phase was just finalized
  ELSIF NEW.service_initiation_finalized = true AND (OLD.service_initiation_finalized IS NULL OR OLD.service_initiation_finalized = false) THEN
    phase_name := 'Service Initiation Phase';
    phase_completed := true;
  END IF;

  -- If a phase was completed, notify relevant users
  IF phase_completed THEN
    
    -- First, notify all admins
    FOR target_user IN 
      SELECT id, name FROM users 
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
        NEW.organization_id,
        target_user.id,
        'phase_completed',
        phase_name || ' Completed',
        client_name || ' has just completed the ' || phase_name || '.',
        'client',
        NEW.id
      );
      
      -- Track that we notified this user
      notified_users := array_append(notified_users, target_user.id);
    END LOOP;

    -- Second, notify the marketer (if they have a user account and haven't been notified as admin)
    IF NEW.marketer_id IS NOT NULL THEN
      -- Get the marketer's linked user_id
      SELECT user_id INTO marketer_user_id
      FROM marketers
      WHERE id = NEW.marketer_id
        AND user_id IS NOT NULL
        AND organization_id = NEW.organization_id;
      
      -- If marketer has a user account and wasn't already notified as admin
      IF marketer_user_id IS NOT NULL AND NOT (marketer_user_id = ANY(notified_users)) THEN
        -- Verify the user is active
        IF EXISTS (SELECT 1 FROM users WHERE id = marketer_user_id AND is_active = true) THEN
          INSERT INTO notifications (
            organization_id,
            user_id,
            type,
            title,
            message,
            related_entity_type,
            related_entity_id
          ) VALUES (
            NEW.organization_id,
            marketer_user_id,
            'phase_completed',
            phase_name || ' Completed',
            client_name || ' (your referral) has just completed the ' || phase_name || '.',
            'client',
            NEW.id
          );
        END IF;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop both old and new trigger names to ensure clean slate
DROP TRIGGER IF EXISTS notify_admins_on_phase_completion_trigger ON clients;
DROP TRIGGER IF EXISTS notify_on_phase_completion_trigger ON clients;

-- Create the trigger with the updated function
CREATE TRIGGER notify_on_phase_completion_trigger
  AFTER UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_phase_completion();

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify all triggers were created
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN (
  'notify_on_cm_company_assignment_trigger',
  'notify_on_client_intake_completed_trigger',
  'notify_on_phase_completion_trigger'
)
ORDER BY event_object_table, trigger_name;

-- Check marketers with user accounts (for troubleshooting)
SELECT 
  m.id AS marketer_id,
  m.name AS marketer_name,
  m.user_id,
  u.name AS user_name,
  u.email AS user_email,
  u.is_active AS user_active
FROM marketers m
LEFT JOIN users u ON m.user_id = u.id
ORDER BY m.name;

