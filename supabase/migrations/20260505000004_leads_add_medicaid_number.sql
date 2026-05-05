-- Add GA Medicaid number to leads (optional free-form text).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS medicaid_number TEXT;
