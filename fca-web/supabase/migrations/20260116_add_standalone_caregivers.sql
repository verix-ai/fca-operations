-- Migration: Add standalone caregiver support
-- Date: 2026-01-16
-- Description: Makes client_id nullable and adds onboarding fields to client_caregivers table

-- ============================================
-- STEP 1: Make client_id nullable (allows "floater" caregivers)
-- ============================================
ALTER TABLE client_caregivers ALTER COLUMN client_id DROP NOT NULL;

-- ============================================
-- STEP 2: Add onboarding fields to client_caregivers
-- ============================================
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS viventium_onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS caregiver_fingerprinted BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS background_results_uploaded BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS ssn_or_birth_certificate_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS pca_cert_including_2_of_3 BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS drivers_license_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS drivers_license_expires_at DATE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS tb_test_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS tb_test_issued_at DATE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS cpr_first_aid_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS cpr_issued_at DATE;
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS onboarding_finalized BOOLEAN DEFAULT FALSE;

-- ============================================
-- STEP 3: Add organization_id to support standalone caregivers
-- ============================================
ALTER TABLE client_caregivers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ============================================
-- STEP 4: Migrate existing onboarding data from clients to their caregivers
-- ============================================
UPDATE client_caregivers cc
SET 
  viventium_onboarding_completed = c.viventium_onboarding_completed,
  caregiver_fingerprinted = c.caregiver_fingerprinted,
  background_results_uploaded = c.background_results_uploaded,
  ssn_or_birth_certificate_submitted = c.ssn_or_birth_certificate_submitted,
  pca_cert_including_2_of_3 = c.pca_cert_including_2_of_3,
  drivers_license_submitted = c.drivers_license_submitted,
  drivers_license_expires_at = c.drivers_license_expires_at,
  tb_test_completed = c.tb_test_completed,
  tb_test_issued_at = c.tb_test_issued_at,
  cpr_first_aid_completed = c.cpr_first_aid_completed,
  cpr_issued_at = c.cpr_issued_at,
  onboarding_finalized = c.onboarding_finalized,
  organization_id = c.organization_id
FROM clients c
WHERE cc.client_id = c.id
  AND cc.status = 'active';

-- ============================================
-- STEP 5: Update RLS policies to allow standalone caregivers
-- ============================================

-- Allow users to see caregivers in their organization (replaces client-based access)
DROP POLICY IF EXISTS "Users can view caregivers in their organization" ON client_caregivers;
CREATE POLICY "Users can view caregivers in their organization" ON client_caregivers
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    OR client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Allow users to insert caregivers (with or without client_id)
DROP POLICY IF EXISTS "Users can create caregivers in their organization" ON client_caregivers;
CREATE POLICY "Users can create caregivers in their organization" ON client_caregivers
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    OR client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Allow users to update caregivers
DROP POLICY IF EXISTS "Users can update caregivers in their organization" ON client_caregivers;
CREATE POLICY "Users can update caregivers in their organization" ON client_caregivers
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    OR client_id IN (
      SELECT id FROM clients WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ============================================
-- DONE! Verify with:
-- SELECT column_name, is_nullable FROM information_schema.columns 
-- WHERE table_name = 'client_caregivers' ORDER BY ordinal_position;
-- ============================================
