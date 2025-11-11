-- Check if program column exists in clients table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name = 'program';
