import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const sql = `
-- Add client_id column to messages table for client-specific team messages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE messages ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
        RAISE NOTICE 'Added client_id column to messages table';
    ELSE
        RAISE NOTICE 'client_id column already exists in messages table';
    END IF;
END $$;
`

async function runMigration() {
  console.log('Running migration to add client_id to messages table...')
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
  
  if (error) {
    // Try direct query if RPC doesn't exist
    console.log('RPC not available, trying alternative approach...')
    
    // Check if column exists
    const { data: columns, error: checkError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'messages')
      .eq('column_name', 'client_id')
    
    if (checkError) {
      console.error('Error checking column:', checkError.message)
      console.log('\nPlease run the following SQL manually in your Supabase SQL Editor:')
      console.log('https://supabase.com/dashboard/project/fupcxuwfonuajbblwlfd/sql/new')
      console.log('\n' + sql)
      return
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ client_id column already exists in messages table')
    } else {
      console.log('\nPlease run the following SQL manually in your Supabase SQL Editor:')
      console.log('https://supabase.com/dashboard/project/fupcxuwfonuajbblwlfd/sql/new')
      console.log('\n' + sql)
    }
    return
  }
  
  console.log('✅ Migration completed successfully!')
}

runMigration()
