-- Update: Notify both admins AND marketer when phase is completed
-- Date: 2025-11-07
-- Purpose: Include marketer notifications for phase completions

-- Drop existing function to recreate it
DROP FUNCTION IF EXISTS notify_admins_on_phase_completion() CASCADE;

-- Updated function to notify admins AND marketer when a phase is completed
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

-- Verify the trigger was created
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'notify_on_phase_completion_trigger';

