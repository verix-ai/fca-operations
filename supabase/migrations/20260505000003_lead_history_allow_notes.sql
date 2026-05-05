-- Allow note-only entries in lead_status_history.
-- A row is now valid if it represents EITHER a status change (to_status NOT NULL)
-- OR a free-form note (note has content). Both can be set together.

ALTER TABLE lead_status_history
  ALTER COLUMN to_status DROP NOT NULL;

ALTER TABLE lead_status_history
  DROP CONSTRAINT IF EXISTS lead_status_history_payload_required;

ALTER TABLE lead_status_history
  ADD CONSTRAINT lead_status_history_payload_required
  CHECK (
    to_status IS NOT NULL
    OR (note IS NOT NULL AND length(trim(note)) > 0)
  );
