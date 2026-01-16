-- Migration: Fix client deletion cascade
-- Description: Changes client_id foreign key on client_caregivers to SET NULL on delete instead of CASCADE

-- Drop the existing constraint (assuming standard naming)
-- We use IF EXISTS to avoid errors if the name is different, though this is the Supabase default
ALTER TABLE client_caregivers
DROP CONSTRAINT IF EXISTS client_caregivers_client_id_fkey;

-- Add the corrected constraint
ALTER TABLE client_caregivers
ADD CONSTRAINT client_caregivers_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE SET NULL;
