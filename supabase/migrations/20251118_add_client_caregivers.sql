-- ===================================================================
-- Caregiver roster per client
-- Allows tracking multiple caregivers with active/inactive states
-- ===================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.client_caregivers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  phone text,
  email text,
  lives_in_home boolean DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_single_active_caregiver
ON public.client_caregivers (client_id)
WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.set_updated_at_client_caregivers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_client_caregivers ON public.client_caregivers;
CREATE TRIGGER set_updated_at_client_caregivers
BEFORE UPDATE ON public.client_caregivers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_client_caregivers();

ALTER TABLE public.client_caregivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_caregivers_select ON public.client_caregivers;
CREATE POLICY client_caregivers_select
ON public.client_caregivers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_id
      AND c.organization_id = public.current_user_organization()
  )
);

DROP POLICY IF EXISTS client_caregivers_insert ON public.client_caregivers;
CREATE POLICY client_caregivers_insert
ON public.client_caregivers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_id
      AND c.organization_id = public.current_user_organization()
  )
);

DROP POLICY IF EXISTS client_caregivers_update ON public.client_caregivers;
CREATE POLICY client_caregivers_update
ON public.client_caregivers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_id
      AND c.organization_id = public.current_user_organization()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_id
      AND c.organization_id = public.current_user_organization()
  )
);

DROP POLICY IF EXISTS client_caregivers_delete ON public.client_caregivers;
CREATE POLICY client_caregivers_delete
ON public.client_caregivers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_id
      AND c.organization_id = public.current_user_organization()
  )
);

DROP POLICY IF EXISTS client_caregivers_service_role ON public.client_caregivers;
CREATE POLICY client_caregivers_service_role
ON public.client_caregivers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Backfill existing caregivers so history starts populated
INSERT INTO public.client_caregivers (
  client_id,
  full_name,
  relationship,
  phone,
  email,
  lives_in_home,
  status,
  started_at
)
SELECT
  id AS client_id,
  caregiver_name AS full_name,
  caregiver_relationship AS relationship,
  caregiver_phone AS phone,
  email,
  COALESCE(caregiver_lives_in_home, false) AS lives_in_home,
  'active' AS status,
  COALESCE(intake_date, NOW()) AS started_at
FROM public.clients
WHERE caregiver_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_caregivers cc
    WHERE cc.client_id = clients.id
      AND cc.status = 'active'
  );

COMMIT;


