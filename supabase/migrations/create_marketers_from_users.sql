-- Create Marketer Records from User Accounts
-- Date: 2025-11-07
-- Purpose: Automatically create marketers table entries for users with role="marketer"

-- This script will:
-- 1. Find all users with role="marketer"
-- 2. Create corresponding entries in the marketers table
-- 3. Link them together via user_id

-- =============================================================================
-- CREATE MARKETERS FROM USER ACCOUNTS
-- =============================================================================

DO $$
DECLARE
  user_record RECORD;
  created_count INTEGER := 0;
  existing_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔍 Searching for users with role="marketer"...';
  
  -- Loop through all users with role="marketer"
  FOR user_record IN 
    SELECT id, email, name, organization_id, is_active
    FROM users
    WHERE role = 'marketer'
    AND is_active = true
  LOOP
    RAISE NOTICE '   Found user: % (%) - ID: %', user_record.name, user_record.email, user_record.id;
    
    -- Check if a marketer record already exists for this user
    IF EXISTS (SELECT 1 FROM marketers WHERE user_id = user_record.id) THEN
      existing_count := existing_count + 1;
      RAISE NOTICE '   ⚠️  Marketer record already exists for this user';
    ELSE
      -- Create a new marketer record
      INSERT INTO marketers (
        organization_id,
        user_id,
        name,
        email,
        is_active
      ) VALUES (
        user_record.organization_id,
        user_record.id,
        user_record.name,
        user_record.email,
        user_record.is_active
      );
      
      created_count := created_count + 1;
      RAISE NOTICE '   ✅ Created marketer record for "%"', user_record.name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Complete! Created % new marketer(s), % already existed.', created_count, existing_count;
END $$;

-- =============================================================================
-- VERIFICATION: Show all marketers with their linked user accounts
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

-- Show users with role="marketer" and their marketer records
SELECT 
  u.id AS user_id,
  u.name AS user_name,
  u.email AS user_email,
  u.role,
  m.id AS marketer_id,
  CASE 
    WHEN m.id IS NULL THEN '❌ NO MARKETER RECORD'
    ELSE '✅ HAS MARKETER RECORD'
  END AS marketer_status
FROM users u
LEFT JOIN marketers m ON m.user_id = u.id
WHERE u.role = 'marketer'
ORDER BY u.name;

