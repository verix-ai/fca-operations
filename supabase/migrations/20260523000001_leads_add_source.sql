-- Add `source` channel tag + Facebook idempotency key to leads.
-- Existing rows backfill to 'website' (the only channel before this migration).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website'
    CHECK (source IN ('website', 'facebook', 'manual')),
  ADD COLUMN IF NOT EXISTS facebook_leadgen_id TEXT;

-- Prevents duplicate inserts when Facebook retries a webhook delivery.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_fb_leadgen_id
  ON leads (facebook_leadgen_id)
  WHERE facebook_leadgen_id IS NOT NULL;

-- Keeps the source filter on the Leads page fast as volume grows.
CREATE INDEX IF NOT EXISTS idx_leads_org_source
  ON leads (organization_id, source);
