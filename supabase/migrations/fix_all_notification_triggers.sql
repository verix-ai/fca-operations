-- Fix: All Notification Triggers to Handle Errors Gracefully
-- Date: 2025-11-07
-- Purpose: Prevent notification errors from blocking database updates

-- =============================================================================
-- 1. FIXED: CM Company Assignment Notification (Error-Safe)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_cm_company_assignment()
RETURNS TRIGGER AS $$
DECLARE
  marketer_user_id UUID;
  marketer_org_id UUID;
  referral_name TEXT;
  cm_company_name TEXT;
BEGIN
  -- Wrap everything in exception handler so errors don't block the update
  BEGIN
    -- Check if cm_company was just assigned (NULL to value or value changed)
    IF NEW.cm_company IS NOT NULL AND (OLD.cm_company IS NULL OR OLD.cm_company != NEW.cm_company) THEN
      
      -- Get referral name
      referral_name := COALESCE(NEW.referral_name, 'Referral #' || NEW.id);
      cm_company_name := NEW.cm_company;
      
      -- Get the marketer's linked user_id and organization_id
      IF NEW.marketer_id IS NOT NULL THEN
        SELECT user_id, organization_id INTO marketer_user_id, marketer_org_id
        FROM marketers
        WHERE id = NEW.marketer_id
          AND user_id IS NOT NULL;
        
        -- If marketer has a user account, send notification
        IF marketer_user_id IS NOT NULL AND marketer_org_id IS NOT NULL THEN
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
              marketer_org_id,
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
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't block the update
      RAISE WARNING 'CM company notification failed: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. FIXED: Client Intake Completion Notification (Error-Safe)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_client_intake_completed()
RETURNS TRIGGER AS $$
DECLARE
  marketer_user_id UUID;
  marketer_org_id UUID;
  client_name TEXT;
BEGIN
  -- Wrap in exception handler
  BEGIN
    -- Build client name
    client_name := COALESCE(
      NEW.first_name || ' ' || NEW.last_name,
      NEW.client_name,
      'Client #' || NEW.id
    );
    
    -- Get the marketer's linked user_id (if client has a marketer)
    IF NEW.marketer_id IS NOT NULL THEN
      SELECT user_id, organization_id INTO marketer_user_id, marketer_org_id
      FROM marketers
      WHERE id = NEW.marketer_id
        AND user_id IS NOT NULL;
      
      -- If marketer has a user account, send notification
      IF marketer_user_id IS NOT NULL AND marketer_org_id IS NOT NULL THEN
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
            marketer_org_id,
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
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Client intake notification failed: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. FIXED: Phase Completion Notification (Error-Safe)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_phase_completion()
RETURNS TRIGGER AS $$
DECLARE
  target_user RECORD;
  client_name TEXT;
  phase_name TEXT;
  phase_completed BOOLEAN;
  marketer_user_id UUID;
  marketer_org_id UUID;
  notified_users UUID[];
BEGIN
  -- Wrap in exception handler
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
        SELECT id, name, organization_id FROM users 
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
        -- Get the marketer's linked user_id and organization_id
        SELECT user_id, organization_id INTO marketer_user_id, marketer_org_id
        FROM marketers
        WHERE id = NEW.marketer_id
          AND user_id IS NOT NULL;
        
        -- If marketer has a user account and wasn't already notified as admin
        IF marketer_user_id IS NOT NULL AND marketer_org_id IS NOT NULL AND NOT (marketer_user_id = ANY(notified_users)) THEN
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
              marketer_org_id,
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
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Phase completion notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

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

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ All notification triggers fixed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '- Added error handling so notifications never block updates';
  RAISE NOTICE '- Fixed organization_id lookup from marketers table';
  RAISE NOTICE '- Updates will now succeed even if notification fails';
  RAISE NOTICE '';
END $$;

