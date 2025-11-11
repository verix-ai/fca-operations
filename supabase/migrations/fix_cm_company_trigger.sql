-- Fix: CM Company Assignment Notification Trigger
-- Date: 2025-11-07
-- Purpose: Fix the trigger to work without organization_id on referrals table

-- =============================================================================
-- FIXED: Case Management Company Assignment Notification
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_cm_company_assignment()
RETURNS TRIGGER AS $$
DECLARE
  marketer_user_id UUID;
  marketer_org_id UUID;
  referral_name TEXT;
  cm_company_name TEXT;
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists, just updating the function above
-- The trigger will automatically use the new function version

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'notify_on_cm_company_assignment_trigger';

