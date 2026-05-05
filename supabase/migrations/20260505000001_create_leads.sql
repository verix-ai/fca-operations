-- Leads feature: public website check-eligibility form submissions
-- Includes: ga_zip_counties lookup, leads table, lead_status_history audit log, status-change trigger

-- ============================================================================
-- Status enum
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'didnt_answer', 'signed_up', 'doesnt_qualify');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ga_zip_counties: ZIP → County lookup (seeded separately)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ga_zip_counties (
  zip TEXT PRIMARY KEY,
  county TEXT NOT NULL
);

ALTER TABLE ga_zip_counties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ga_zip_counties" ON ga_zip_counties;
CREATE POLICY "Authenticated users can read ga_zip_counties"
  ON ga_zip_counties FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- leads: main table for incoming check-eligibility submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Form fields
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  zip TEXT,

  -- Derived from zip via ga_zip_counties lookup at insert time
  county TEXT,
  state TEXT NOT NULL DEFAULT 'GA' CHECK (state IN ('GA', 'OUT_OF_STATE')),

  -- Workflow
  status lead_status NOT NULL DEFAULT 'new',
  notes TEXT NOT NULL DEFAULT '',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_status_change_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,

  -- Soft-delete (archive)
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_org_archived_status ON leads(organization_id, archived_at, status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(organization_id, state);
CREATE INDEX IF NOT EXISTS idx_leads_county ON leads(organization_id, county);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view leads in their organization" ON leads;
CREATE POLICY "Users can view leads in their organization" ON leads
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create leads in their organization" ON leads;
CREATE POLICY "Users can create leads in their organization" ON leads
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update leads in their organization" ON leads;
CREATE POLICY "Users can update leads in their organization" ON leads
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- (No DELETE policy: leads are archived, never hard-deleted from the UI.
--  The edge function uses the service role to insert, bypassing RLS.)

-- ============================================================================
-- lead_status_history: append-only audit trail of status changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status lead_status,
  to_status lead_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON lead_status_history(lead_id, changed_at DESC);

ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view status history in their org" ON lead_status_history;
CREATE POLICY "Users can view status history in their org" ON lead_status_history
  FOR SELECT USING (
    lead_id IN (
      SELECT id FROM leads WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert status history in their org" ON lead_status_history;
CREATE POLICY "Users can insert status history in their org" ON lead_status_history
  FOR INSERT WITH CHECK (
    lead_id IN (
      SELECT id FROM leads WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- Trigger: auto-log status changes + maintain last_status_change_at / last_contacted_at
-- ============================================================================
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name INTO v_user_name FROM users WHERE id = auth.uid();

    INSERT INTO lead_status_history (lead_id, from_status, to_status, changed_by, changed_by_name)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), v_user_name);

    NEW.last_status_change_at = now();

    IF NEW.status = 'contacted' THEN
      NEW.last_contacted_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS leads_status_change_trigger ON leads;
CREATE TRIGGER leads_status_change_trigger
  BEFORE UPDATE OF status ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_status_change();
