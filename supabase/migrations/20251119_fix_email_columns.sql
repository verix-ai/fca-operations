-- Rename email to caregiver_email and add new email column for client
BEGIN;

-- Rename existing email column (which holds caregiver emails) to caregiver_email
ALTER TABLE public.clients 
RENAME COLUMN email TO caregiver_email;

-- Add new email column for client email
ALTER TABLE public.clients 
ADD COLUMN email text;

COMMIT;

