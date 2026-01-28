-- Add notification_preferences JSONB column to users table
-- This stores per-user notification settings

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "in_app": {
    "referral_created": true,
    "phase_completed": true,
    "message_received": true,
    "client_updated": true,
    "general": true
  },
  "email": {
    "enabled": false,
    "digest": "none"
  }
}'::jsonb;

-- Add a comment describing the column
COMMENT ON COLUMN public.users.notification_preferences IS 'JSON object storing user notification preferences for in-app and email notifications';

-- Create an index for querying notification preferences (useful for batch email digests)
CREATE INDEX IF NOT EXISTS idx_users_notification_preferences 
ON public.users USING gin (notification_preferences);
