-- Quick Migration Script
-- Copy this entire script and run it in Supabase SQL Editor

-- Migration: Add intake form fields to clients table
-- Date: 2025-11-07
-- Purpose: Support all fields collected by IntakeForm component

-- Add intake-related fields to clients table
ALTER TABLE clients 
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS program TEXT,
  ADD COLUMN IF NOT EXISTS caregiver_name TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS caregiver_phone TEXT,
  ADD COLUMN IF NOT EXISTS caregiver_relationship TEXT,
  ADD COLUMN IF NOT EXISTS frequency TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS intake_date DATE,
  ADD COLUMN IF NOT EXISTS director_of_marketing TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN clients.client_name IS 'Full client name for display';
COMMENT ON COLUMN clients.company IS 'Company name (e.g., FCA)';
COMMENT ON COLUMN clients.program IS 'Program name as text (e.g., PSS, PCA, Companion Care)';
COMMENT ON COLUMN clients.caregiver_name IS 'Name of the primary caregiver';
COMMENT ON COLUMN clients.client_phone IS 'Client phone number';
COMMENT ON COLUMN clients.caregiver_phone IS 'Caregiver phone number';
COMMENT ON COLUMN clients.caregiver_relationship IS 'Relationship between caregiver and client';
COMMENT ON COLUMN clients.frequency IS 'Service frequency (e.g., 8hrs/5days)';
COMMENT ON COLUMN clients.location IS 'Location/county name for display';
COMMENT ON COLUMN clients.intake_date IS 'Date when client intake was completed';
COMMENT ON COLUMN clients.director_of_marketing IS 'Director of marketing name';
COMMENT ON COLUMN clients.notes IS 'Additional notes and information';

-- Verify the migration
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name IN (
    'client_name',
    'company',
    'program',
    'caregiver_name',
    'client_phone',
    'caregiver_phone',
    'caregiver_relationship',
    'frequency',
    'location',
    'intake_date',
    'director_of_marketing',
    'notes'
  )
ORDER BY column_name;

