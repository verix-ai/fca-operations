-- Add profile_image_url column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Add profile_image_url column to client_caregivers table
ALTER TABLE client_caregivers
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Create storage bucket for profile images if it doesn't exist
-- Note: Storage bucket creation is typically done via Supabase dashboard or CLI
-- This is just a placeholder comment for documentation

-- Storage Policy Notes:
-- The 'profile-images' bucket should be created with the following policies:
-- 1. SELECT: authenticated users can read all files
-- 2. INSERT: authenticated users can upload to paths matching their organization's clients/caregivers
-- 3. UPDATE: authenticated users can update files for their organization
-- 4. DELETE: authenticated users can delete files for their organization

COMMENT ON COLUMN clients.profile_image_url IS 'URL/path to the client profile image in storage';
COMMENT ON COLUMN client_caregivers.profile_image_url IS 'URL/path to the caregiver profile image in storage';
