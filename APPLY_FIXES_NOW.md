# Fix Notification Issues - Quick Guide

**Date:** November 7, 2025

---

## ✅ Issue 1: "Client not found" - FIXED

The routing issue has been fixed in the code. The notification now properly navigates to `/client/{id}`.

---

## 🔧 Issue 2: Marketer not getting notified - NEEDS SQL UPDATE

### Quick Fix Steps:

1. **Open Supabase Dashboard**
2. Go to **SQL Editor** → **New Query**
3. **Copy and paste this SQL:**

```sql
-- Update: Notify both admins AND marketer when phase is completed
-- Drop existing function to recreate it
DROP FUNCTION IF EXISTS notify_admins_on_phase_completion() CASCADE;

-- Updated function to notify admins AND marketer
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
  client_name := COALESCE(
    NEW.first_name || ' ' || NEW.last_name,
    NEW.client_name,
    'Client #' || NEW.id
  );

  phase_completed := false;
  notified_users := ARRAY[]::UUID[];

  IF NEW.intake_finalized = true AND (OLD.intake_finalized IS NULL OR OLD.intake_finalized = false) THEN
    phase_name := 'Intake Phase';
    phase_completed := true;
  ELSIF NEW.onboarding_finalized = true AND (OLD.onboarding_finalized IS NULL OR OLD.onboarding_finalized = false) THEN
    phase_name := 'Onboarding Phase';
    phase_completed := true;
  ELSIF NEW.service_initiation_finalized = true AND (OLD.service_initiation_finalized IS NULL OR OLD.service_initiation_finalized = false) THEN
    phase_name := 'Service Initiation Phase';
    phase_completed := true;
  END IF;

  IF phase_completed THEN
    
    -- Notify all admins
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
      
      notified_users := array_append(notified_users, target_user.id);
    END LOOP;

    -- Notify the marketer
    IF NEW.marketer_id IS NOT NULL THEN
      SELECT user_id INTO marketer_user_id
      FROM marketers
      WHERE id = NEW.marketer_id
        AND user_id IS NOT NULL
        AND organization_id = NEW.organization_id;
      
      IF marketer_user_id IS NOT NULL AND NOT (marketer_user_id = ANY(notified_users)) THEN
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS notify_admins_on_phase_completion_trigger ON clients;
CREATE TRIGGER notify_on_phase_completion_trigger
  AFTER UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_phase_completion();
```

4. **Click "Run"** ✅

---

## 🧪 Test After Applying

1. **Check marketer's user_id is set:**
   ```sql
   SELECT m.name, m.user_id, u.email
   FROM marketers m
   LEFT JOIN users u ON m.user_id = u.id
   WHERE m.organization_id = '[your-org-id]';
   ```

2. **Complete a phase** for a client with an assigned marketer
3. **Check notifications:**
   - Admin should see: "Jonny Blaze has just completed the Intake Phase."
   - Marketer should see: "Jonny Blaze (your referral) has just completed the Intake Phase."

---

## ⚠️ Common Issue: Marketer has no user_id

If the marketer still doesn't get notified, they likely don't have a `user_id` linked.

**To fix:**
1. Marketer needs to be **invited** as a user
2. They need to **accept invite** and create account
3. Their user account gets linked to the marketer record

**Check with:**
```sql
SELECT * FROM marketers WHERE name = 'Marketer Name';
-- If user_id is NULL, they need to be invited as a user
```

---

## 📋 Summary

- ✅ **Issue 1 Fixed:** Client navigation works (code updated)
- 🔧 **Issue 2 Fix:** Apply SQL above to enable marketer notifications
- 🧪 **Test:** Complete a phase and verify both admin and marketer get notified

---

**Both issues should be resolved after applying the SQL update!** 🎉

