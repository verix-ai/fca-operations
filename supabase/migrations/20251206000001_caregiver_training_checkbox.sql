-- Add caregiver_training_completed column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS caregiver_training_completed BOOLEAN DEFAULT FALSE;
