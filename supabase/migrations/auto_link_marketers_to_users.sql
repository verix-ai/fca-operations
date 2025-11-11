-- Auto-Link Marketers to User Accounts
-- Date: 2025-11-07
-- Purpose: Automatically link marketers to their user accounts by matching email

-- This script will:
-- 1. Find all marketers without a user_id
-- 2. Match them to users by email
-- 3. Automatically link them

-- =============================================================================
-- AUTO-LINK MARKETERS TO USERS BY EMAIL
-- =============================================================================

DO $$
DECLARE
  marketer_record RECORD;
  user_record RECORD;
  linked_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔍 Searching for marketers without user accounts...';
  
  -- Loop through all marketers without a user_id
  FOR marketer_record IN 
    SELECT id, name, email, user_id, organization_id
    FROM marketers
    WHERE user_id IS NULL
    AND email IS NOT NULL
  LOOP
    RAISE NOTICE '   Found marketer: % (%) - No user_id', marketer_record.name, marketer_record.email;
    
    -- Try to find a matching user by email in the same organization
    SELECT id, email, name, role, is_active
    INTO user_record
    FROM users
    WHERE email = marketer_record.email
    AND organization_id = marketer_record.organization_id
    AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      -- Link the marketer to the user
      UPDATE marketers
      SET user_id = user_record.id
      WHERE id = marketer_record.id;
      
      linked_count := linked_count + 1;
      RAISE NOTICE '   ✅ Linked marketer "%" to user "%" (%)', 
        marketer_record.name, user_record.name, user_record.email;
    ELSE
      RAISE NOTICE '   ❌ No matching user found for marketer "%" (%)', 
        marketer_record.name, marketer_record.email;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Auto-linking complete! Linked % marketer(s) to user accounts.', linked_count;
END $$;

-- =============================================================================
-- VERIFICATION: Show all marketers and their user account status
-- =============================================================================

SELECT 
  m.id AS marketer_id,
  m.name AS marketer_name,
  m.email AS marketer_email,
  m.user_id,
  u.name AS user_name,
  u.email AS user_email,
  u.role AS user_role,
  u.is_active AS user_active,
  CASE 
    WHEN m.user_id IS NULL THEN '❌ NOT LINKED'
    WHEN u.is_active = false THEN '⚠️ LINKED BUT INACTIVE'
    ELSE '✅ LINKED & ACTIVE'
  END AS status
FROM marketers m
LEFT JOIN users u ON m.user_id = u.id
ORDER BY m.name;

-- =============================================================================
-- SUMMARY
-- =============================================================================

-- Count total marketers
SELECT 
  COUNT(*) as total_marketers,
  COUNT(user_id) as linked_marketers,
  COUNT(*) - COUNT(user_id) as unlinked_marketers
FROM marketers;

