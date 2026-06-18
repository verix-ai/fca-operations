-- Tracks the most recent time the call center phoned the client. The Prospects
-- board uses this to show a "called this week" badge and a "not called this week"
-- filter, where "this week" is the calendar week starting Monday. Storing a
-- timestamp (rather than a boolean) means the indicator auto-resets every Monday
-- with no manual upkeep.
--
-- A call is logged explicitly via Referral.logCall(), which stamps this column
-- and writes a dedicated 'call' event to referral_status_history.

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ;

-- Allow a dedicated 'call' event in the activity timeline.
ALTER TABLE referral_status_history
  DROP CONSTRAINT IF EXISTS referral_status_history_event_type_check;
ALTER TABLE referral_status_history
  ADD CONSTRAINT referral_status_history_event_type_check
  CHECK (event_type IN ('note','field_change','archive','unarchive','call'));
