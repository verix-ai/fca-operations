-- Adds a `referral_sent` boolean to referrals for the call-center workflow.
-- Set true once the referral has been sent to the CM company / HCC. Used to
-- tint the prospect row green in the UI and to auto-log a field_change event
-- to referral_status_history.

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS referral_sent BOOLEAN NOT NULL DEFAULT FALSE;
