-- Create the new contacts table
CREATE TABLE IF NOT EXISTS cm_company_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  cm_company_id uuid REFERENCES cm_companies(id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  fax text
);

-- Migrate existing data (only if contacts table is empty to avoid dupes on re-runs)
INSERT INTO cm_company_contacts (cm_company_id, name, email, phone, fax)
SELECT id, contact_name, contact_email, contact_phone, contact_fax
FROM cm_companies
WHERE (contact_name IS NOT NULL OR contact_email IS NOT NULL OR contact_phone IS NOT NULL OR contact_fax IS NOT NULL)
AND NOT EXISTS (SELECT 1 FROM cm_company_contacts WHERE cm_company_contacts.cm_company_id = cm_companies.id);

-- Optional: You could drop the old columns, but safe to keep them for now as deprecated
-- ALTER TABLE cm_companies DROP COLUMN contact_name, DROP COLUMN contact_email, ...
