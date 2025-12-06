-- Add date columns to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS cpr_issued_at DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tb_test_issued_at DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS drivers_license_expires_at DATE DEFAULT NULL;
