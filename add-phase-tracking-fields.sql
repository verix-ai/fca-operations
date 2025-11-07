-- Migration: Add phase tracking fields to clients table
-- Date: 2025-11-07
-- Purpose: Support all phase checkpoint tracking fields

-- Add Intake Phase tracking fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS initial_assessment_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS clinical_dates_entered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reassessment_date_entered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_assessment_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_documents_populated BOOLEAN DEFAULT false;

-- Add Onboarding Phase tracking fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS viventium_onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS caregiver_fingerprinted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS background_results_uploaded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS drivers_license_submitted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ssn_or_birth_certificate_submitted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tb_test_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpr_first_aid_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pca_cert_including_2_of_3 BOOLEAN DEFAULT false;

-- Add Service Initiation Phase tracking fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS edwp_created_and_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edwp_transmittal_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_ccd BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_created_and_extended_until_aed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_or_care_start_date DATE;

-- Add comments for documentation
-- Intake Phase
COMMENT ON COLUMN clients.initial_assessment_required IS 'Initial Assessment required?';
COMMENT ON COLUMN clients.clinical_dates_entered IS 'Clinical Dates Entered?';
COMMENT ON COLUMN clients.reassessment_date_entered IS 'Re-Assessment Date Entered?';
COMMENT ON COLUMN clients.initial_assessment_completed IS 'Initial Assessment Completed?';
COMMENT ON COLUMN clients.client_documents_populated IS 'Client Documents Populated?';

-- Onboarding Phase
COMMENT ON COLUMN clients.viventium_onboarding_completed IS 'Viventium Onboarding Complete?';
COMMENT ON COLUMN clients.caregiver_fingerprinted IS 'Caregiver has been Finger Printed?';
COMMENT ON COLUMN clients.background_results_uploaded IS 'Background Results Received & Uploaded?';
COMMENT ON COLUMN clients.drivers_license_submitted IS 'Drivers License Submitted?';
COMMENT ON COLUMN clients.ssn_or_birth_certificate_submitted IS 'Social Security and/or Birth Certificate Submitted?';
COMMENT ON COLUMN clients.tb_test_completed IS 'Completed TB Test?';
COMMENT ON COLUMN clients.cpr_first_aid_completed IS 'Completed CPR/First Aid?';
COMMENT ON COLUMN clients.pca_cert_including_2_of_3 IS 'PCA Cert including 2 of 3';

-- Service Initiation Phase
COMMENT ON COLUMN clients.edwp_created_and_sent IS 'Start Of EDWP Created & Sent to Case Manager?';
COMMENT ON COLUMN clients.edwp_transmittal_completed IS 'EDWP Transmittal completed?';
COMMENT ON COLUMN clients.manager_ccd IS 'Was Manager CC''d?';
COMMENT ON COLUMN clients.schedule_created_and_extended_until_aed IS 'Was Schedule Created & Extended until AED?';
COMMENT ON COLUMN clients.training_or_care_start_date IS 'Date of Training / Start Of Care Date';

-- Verify the migration
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name IN (
    -- Intake fields
    'initial_assessment_required',
    'clinical_dates_entered',
    'reassessment_date_entered',
    'initial_assessment_completed',
    'client_documents_populated',
    -- Onboarding fields
    'viventium_onboarding_completed',
    'caregiver_fingerprinted',
    'background_results_uploaded',
    'drivers_license_submitted',
    'ssn_or_birth_certificate_submitted',
    'tb_test_completed',
    'cpr_first_aid_completed',
    'pca_cert_including_2_of_3',
    -- Service Initiation fields
    'edwp_created_and_sent',
    'edwp_transmittal_completed',
    'manager_ccd',
    'schedule_created_and_extended_until_aed',
    'training_or_care_start_date'
  )
ORDER BY column_name;

