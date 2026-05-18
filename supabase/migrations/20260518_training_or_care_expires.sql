-- Add expiration date for the client-level "Caregiver Training / Start of
-- Care" item so it can pair with the existing training_or_care_start_date
-- and stay consistent with every other compliance item (manual issue + expire).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS training_or_care_expires_at DATE DEFAULT NULL;

-- Backfill from the old derived rule: start date + 1 year. Re-runnable.
UPDATE clients
   SET training_or_care_expires_at = training_or_care_start_date + INTERVAL '1 year'
 WHERE training_or_care_start_date IS NOT NULL
   AND training_or_care_expires_at IS NULL;
