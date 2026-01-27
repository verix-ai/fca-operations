-- Add client_id column to messages table for client-specific team messages
-- This allows messages to be associated with a specific client

-- Add the client_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE messages ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
        
        -- Create index for faster lookups by client
        CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
        
        RAISE NOTICE 'Added client_id column to messages table';
    ELSE
        RAISE NOTICE 'client_id column already exists in messages table';
    END IF;
END $$;
