-- 20260507_public_programs_rpc.sql
-- Anon-callable RPC that returns the active program list for a given organization.
-- Used by the public referral form to populate the "Service/Program Requested" dropdown.

CREATE OR REPLACE FUNCTION public.get_programs_for_org(p_org_id uuid)
RETURNS TABLE (name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT p.name
  FROM public.programs p
  WHERE p.organization_id = p_org_id
  ORDER BY p.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_programs_for_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_programs_for_org(uuid) TO anon, authenticated;
