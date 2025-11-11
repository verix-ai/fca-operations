-- Migration: Add all referral fields to clients table
-- Date: 2025-11-10
-- Purpose: Preserve all referral information when creating clients

-- Add all missing referral fields to clients table
ALTER TABLE clients 
  -- Demographics
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS medicaid_or_ssn TEXT,
  
  -- Address information
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'GA',
  ADD COLUMN IF NOT EXISTS zip TEXT,
  
  -- Caregiver details
  ADD COLUMN IF NOT EXISTS caregiver_lives_in_home BOOLEAN,
  
  -- Medical information
  ADD COLUMN IF NOT EXISTS physician TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis TEXT,
  
  -- Services and benefits
  ADD COLUMN IF NOT EXISTS services_needed JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS receives_benefits TEXT,
  ADD COLUMN IF NOT EXISTS benefits_pay_date TEXT,
  
  -- Referral source information
  ADD COLUMN IF NOT EXISTS heard_about_us TEXT,
  ADD COLUMN IF NOT EXISTS additional_info TEXT,
  ADD COLUMN IF NOT EXISTS referral_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN clients.sex IS 'Client sex/gender';
COMMENT ON COLUMN clients.date_of_birth IS 'Client date of birth';
COMMENT ON COLUMN clients.medicaid_or_ssn IS 'Medicaid ID or SSN';
COMMENT ON COLUMN clients.address_line1 IS 'Street address line 1';
COMMENT ON COLUMN clients.address_line2 IS 'Street address line 2 (apt, unit, etc)';
COMMENT ON COLUMN clients.city IS 'City';
COMMENT ON COLUMN clients.state IS 'State (default: GA)';
COMMENT ON COLUMN clients.zip IS 'ZIP code';
COMMENT ON COLUMN clients.caregiver_lives_in_home IS 'Does caregiver live with client?';
COMMENT ON COLUMN clients.physician IS 'Primary care physician name';
COMMENT ON COLUMN clients.diagnosis IS 'Medical diagnosis';
COMMENT ON COLUMN clients.services_needed IS 'JSON object of requested services';
COMMENT ON COLUMN clients.receives_benefits IS 'Does client receive benefits? (Yes/No/Unknown)';
COMMENT ON COLUMN clients.benefits_pay_date IS 'Date benefits are received';
COMMENT ON COLUMN clients.heard_about_us IS 'How client heard about services';
COMMENT ON COLUMN clients.additional_info IS 'Additional information from referral';
COMMENT ON COLUMN clients.referral_date IS 'Date client was originally referred';

-- Verification query
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name IN (
    'sex', 'date_of_birth', 'medicaid_or_ssn', 
    'address_line1', 'address_line2', 'city', 'state', 'zip',
    'caregiver_lives_in_home', 'physician', 'diagnosis',
    'services_needed', 'receives_benefits', 'benefits_pay_date',
    'heard_about_us', 'additional_info', 'referral_date'
  )
ORDER BY column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ REFERRAL FIELDS ADDED TO CLIENTS!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Added columns:';
  RAISE NOTICE '  ✅ Demographics: sex, date_of_birth, medicaid_or_ssn';
  RAISE NOTICE '  ✅ Address: address_line1, address_line2, city, state, zip';
  RAISE NOTICE '  ✅ Caregiver: caregiver_lives_in_home';
  RAISE NOTICE '  ✅ Medical: physician, diagnosis';
  RAISE NOTICE '  ✅ Services: services_needed, receives_benefits, benefits_pay_date';
  RAISE NOTICE '  ✅ Source: heard_about_us, additional_info, referral_date';
  RAISE NOTICE '';
  RAISE NOTICE 'All referral data will now be preserved when creating clients!';
  RAISE NOTICE '';
END $$;

