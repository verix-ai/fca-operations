-- ===================================================================
-- Communication Services Subscriptions & Usage Tracking
-- Enables subscription-based Email (Resend) and SMS (Twilio) services
-- ===================================================================

BEGIN;

-- ===================================================================
-- Add subscription columns to organizations
-- ===================================================================

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS email_subscription jsonb DEFAULT '{
  "tier": null,
  "status": "inactive",
  "stripe_subscription_id": null,
  "current_period_start": null,
  "current_period_end": null
}'::jsonb;

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS sms_subscription jsonb DEFAULT '{
  "tier": null,
  "status": "inactive", 
  "stripe_subscription_id": null,
  "current_period_start": null,
  "current_period_end": null
}'::jsonb;

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- ===================================================================
-- Communication usage tracking (monthly quotas)
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.communication_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  email_count int DEFAULT 0,
  email_limit int DEFAULT 0,
  sms_count int DEFAULT 0,
  sms_limit int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, period_start)
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_communication_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_communication_usage ON public.communication_usage;
CREATE TRIGGER set_updated_at_communication_usage
BEFORE UPDATE ON public.communication_usage
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_communication_usage();

-- ===================================================================
-- Communication log (message history)
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.communication_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_type text NOT NULL CHECK (recipient_type IN ('client', 'caregiver')),
  recipient_id uuid,
  recipient_name text,
  recipient_address text NOT NULL,
  subject text,
  content text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by organization and date
CREATE INDEX IF NOT EXISTS idx_communication_log_org_date 
ON public.communication_log(organization_id, created_at DESC);

-- Index for querying by recipient
CREATE INDEX IF NOT EXISTS idx_communication_log_recipient 
ON public.communication_log(recipient_type, recipient_id);

-- ===================================================================
-- Tier limits lookup (for reference in Edge Functions)
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.communication_tiers (
  id text PRIMARY KEY,
  service text NOT NULL CHECK (service IN ('email', 'sms')),
  name text NOT NULL,
  monthly_limit int NOT NULL,
  price_cents int NOT NULL,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert Email tiers (100% markup pricing)
INSERT INTO public.communication_tiers (id, service, name, monthly_limit, price_cents) VALUES
  ('email_starter', 'email', 'Starter', 5000, 900),
  ('email_professional', 'email', 'Professional', 25000, 3000),
  ('email_business', 'email', 'Business', 50000, 4000),
  ('email_enterprise', 'email', 'Enterprise', 100000, 18000)
ON CONFLICT (id) DO UPDATE SET
  monthly_limit = EXCLUDED.monthly_limit,
  price_cents = EXCLUDED.price_cents;

-- Insert SMS tiers (100% markup pricing)  
INSERT INTO public.communication_tiers (id, service, name, monthly_limit, price_cents) VALUES
  ('sms_starter', 'sms', 'Starter', 250, 600),
  ('sms_professional', 'sms', 'Professional', 1000, 2200),
  ('sms_business', 'sms', 'Business', 2500, 5600),
  ('sms_enterprise', 'sms', 'Enterprise', 5000, 11000)
ON CONFLICT (id) DO UPDATE SET
  monthly_limit = EXCLUDED.monthly_limit,
  price_cents = EXCLUDED.price_cents;

-- ===================================================================
-- Row Level Security
-- ===================================================================

ALTER TABLE public.communication_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_tiers ENABLE ROW LEVEL SECURITY;

-- communication_usage policies
DROP POLICY IF EXISTS communication_usage_select ON public.communication_usage;
CREATE POLICY communication_usage_select ON public.communication_usage
FOR SELECT TO authenticated
USING (organization_id = public.current_user_organization());

DROP POLICY IF EXISTS communication_usage_insert ON public.communication_usage;
CREATE POLICY communication_usage_insert ON public.communication_usage
FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_user_organization());

DROP POLICY IF EXISTS communication_usage_update ON public.communication_usage;
CREATE POLICY communication_usage_update ON public.communication_usage
FOR UPDATE TO authenticated
USING (organization_id = public.current_user_organization());

-- Service role full access for Edge Functions
DROP POLICY IF EXISTS communication_usage_service ON public.communication_usage;
CREATE POLICY communication_usage_service ON public.communication_usage
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- communication_log policies
DROP POLICY IF EXISTS communication_log_select ON public.communication_log;
CREATE POLICY communication_log_select ON public.communication_log
FOR SELECT TO authenticated
USING (organization_id = public.current_user_organization());

DROP POLICY IF EXISTS communication_log_insert ON public.communication_log;
CREATE POLICY communication_log_insert ON public.communication_log
FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_user_organization());

DROP POLICY IF EXISTS communication_log_service ON public.communication_log;
CREATE POLICY communication_log_service ON public.communication_log
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- communication_tiers - read-only for all authenticated users
DROP POLICY IF EXISTS communication_tiers_select ON public.communication_tiers;
CREATE POLICY communication_tiers_select ON public.communication_tiers
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS communication_tiers_service ON public.communication_tiers;
CREATE POLICY communication_tiers_service ON public.communication_tiers
FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
