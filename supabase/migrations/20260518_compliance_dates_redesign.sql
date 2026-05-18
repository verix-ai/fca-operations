-- Compliance dates redesign: store issued AND expires explicitly for every
-- compliance item (no more derived "issued + N years" math). Adds fingerprint
-- as a new tracked compliance item.

-- ---------------------------------------------------------------------------
-- client_caregivers: add paired issue/expire columns + fingerprint dates
-- ---------------------------------------------------------------------------
ALTER TABLE client_caregivers
  ADD COLUMN IF NOT EXISTS drivers_license_issued_at      DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tb_test_expires_at             DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cpr_expires_at                 DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS caregiver_training_expires_at  DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS caregiver_fingerprinted_at     DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fingerprint_expires_at         DATE DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- clients: mirror the paired issue/expire columns (no fingerprint at client
-- level — alerts only track fingerprint per caregiver).
-- ---------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS drivers_license_issued_at  DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tb_test_expires_at         DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cpr_expires_at             DATE DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- Backfill new *_expires_at columns from existing issue dates using the old
-- derived math, so existing alerts continue to fire unchanged on day 1.
--   TB Test          issued + 1 year
--   CPR / First Aid  issued + 2 years
--   Training         date    + 1 year
-- Only fills rows where the new column is still NULL, so this is safe to
-- re-run.
-- ---------------------------------------------------------------------------
UPDATE client_caregivers
   SET tb_test_expires_at = tb_test_issued_at + INTERVAL '1 year'
 WHERE tb_test_issued_at IS NOT NULL
   AND tb_test_expires_at IS NULL;

UPDATE client_caregivers
   SET cpr_expires_at = cpr_issued_at + INTERVAL '2 years'
 WHERE cpr_issued_at IS NOT NULL
   AND cpr_expires_at IS NULL;

UPDATE client_caregivers
   SET caregiver_training_expires_at = caregiver_training_date + INTERVAL '1 year'
 WHERE caregiver_training_date IS NOT NULL
   AND caregiver_training_expires_at IS NULL;

UPDATE clients
   SET tb_test_expires_at = tb_test_issued_at + INTERVAL '1 year'
 WHERE tb_test_issued_at IS NOT NULL
   AND tb_test_expires_at IS NULL;

UPDATE clients
   SET cpr_expires_at = cpr_issued_at + INTERVAL '2 years'
 WHERE cpr_issued_at IS NOT NULL
   AND cpr_expires_at IS NULL;
