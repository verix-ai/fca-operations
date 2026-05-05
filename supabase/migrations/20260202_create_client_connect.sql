-- Client Connect table for managing prospective clients
CREATE TABLE IF NOT EXISTS client_connect (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Client Info
  client_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Caregiver Info
  caregiver_name TEXT,
  relationship TEXT,
  
  -- Program & Other
  program TEXT,
  company TEXT,
  pay_rate TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id),
  
  -- Approval
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  
  -- Link to created records after approval
  client_id UUID REFERENCES clients(id),
  caregiver_id UUID REFERENCES client_caregivers(id),
  
  -- Notification tracking (prevents duplicate stale notifications)
  stale_notified_at TIMESTAMPTZ
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_client_connect_org_status ON client_connect(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_client_connect_created_at ON client_connect(created_at);

-- Enable RLS
ALTER TABLE client_connect ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Select: users can see client_connect entries in their organization
CREATE POLICY "Users can view client_connect in their organization" ON client_connect
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Insert: users can create client_connect entries in their organization
CREATE POLICY "Users can create client_connect in their organization" ON client_connect
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Update: users can update client_connect entries in their organization
CREATE POLICY "Users can update client_connect in their organization" ON client_connect
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Delete: users can delete client_connect entries in their organization
CREATE POLICY "Users can delete client_connect in their organization" ON client_connect
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
