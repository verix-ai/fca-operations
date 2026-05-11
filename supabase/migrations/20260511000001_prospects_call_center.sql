-- Prospects Call Center Log: real columns on referrals, history table, backfill from JSON.

-- ============================================================================
-- 1. Add columns to referrals
-- ============================================================================
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS cm_company TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS marketer_id UUID REFERENCES marketers(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS marketer_name TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS marketer_email TEXT;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS code TEXT
  CHECK (code IS NULL OR code IN ('301','303','660','661','Other','None Found'));

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS home_care_company TEXT NOT NULL DEFAULT 'FCA'
  CHECK (home_care_company IN ('FCA','Genesis','Gateway','Alice Place','Affordable'));

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS cm_call_status TEXT
  CHECK (cm_call_status IS NULL OR cm_call_status IN ('awaiting','need_resend','contacted'));

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS assessment_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS waiting_state_approval BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archive_reason TEXT
  CHECK (archive_reason IS NULL OR archive_reason IN ('passed_to_hcc','not_eligible','lost_contact','duplicate','other'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archive_note TEXT;

-- ============================================================================
-- 2. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_referrals_archived_at ON referrals(organization_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_referrals_cm_company ON referrals(organization_id, cm_company);
CREATE INDEX IF NOT EXISTS idx_referrals_home_care_company ON referrals(organization_id, home_care_company);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_marketer_id ON referrals(marketer_id) WHERE marketer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_archived_by ON referrals(archived_by) WHERE archived_by IS NOT NULL;

-- ============================================================================
-- 3. Backfill from existing JSON blob in notes column
--    The `notes` column holds JSON-stringified extra fields. Pull cm_company,
--    marketer_id, marketer_name, marketer_email, home_care_company out into the
--    real columns where those columns are still NULL.
--    Per-row exception handling: if a row's notes can't be parsed, or
--    marketer_id is not a valid uuid, we log a notice and skip it rather than
--    aborting the migration.
-- ============================================================================
DO $$
DECLARE r RECORD; j JSONB; mid_text TEXT; mid UUID;
BEGIN
  FOR r IN
    SELECT id, notes FROM referrals
    WHERE notes IS NOT NULL AND notes <> '' AND notes ~ '^\s*\{'
  LOOP
    BEGIN
      j := r.notes::jsonb;
      mid_text := NULLIF(j->>'marketer_id', '');
      BEGIN
        mid := mid_text::uuid;
      EXCEPTION WHEN OTHERS THEN
        mid := NULL;
      END;
      UPDATE referrals SET
        cm_company        = COALESCE(cm_company,        NULLIF(j->>'cm_company', '')),
        marketer_id       = COALESCE(marketer_id,       mid),
        marketer_name     = COALESCE(marketer_name,     NULLIF(j->>'marketer_name', '')),
        marketer_email    = COALESCE(marketer_email,    NULLIF(j->>'marketer_email', '')),
        home_care_company = COALESCE(NULLIF(j->>'home_care_company', ''), home_care_company)
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping referral % with unparseable notes', r.id;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 4. referral_status_history: append-only audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS referral_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('note','field_change','archive','unarchive')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  changed_by UUID REFERENCES users(id),
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_status_history_ref
  ON referral_status_history(referral_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_status_history_org ON referral_status_history(organization_id, changed_at DESC);

ALTER TABLE referral_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view referral history in their org" ON referral_status_history;
CREATE POLICY "Users can view referral history in their org" ON referral_status_history
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert referral history in their org" ON referral_status_history;
CREATE POLICY "Users can insert referral history in their org" ON referral_status_history
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- No UPDATE or DELETE policy: history is append-only.
