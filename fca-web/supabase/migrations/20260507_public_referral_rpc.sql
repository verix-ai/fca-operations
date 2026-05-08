-- 20260507_public_referral_rpc.sql
-- Anon-callable RPC: resolves a public referral slug to a marketer's safe public fields.
-- Direct anon SELECT on `marketers` is NOT granted; this function is the only path.

CREATE OR REPLACE FUNCTION public.get_marketer_by_slug(p_slug citext)
RETURNS TABLE (
  id              uuid,
  name            text,
  organization_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT m.id, m.name, m.organization_id
  FROM public.marketers m
  WHERE m.is_active = true
    AND (
      m.referral_slug = p_slug
      OR m.id = (
        SELECT a.marketer_id FROM public.marketer_slug_aliases a WHERE a.slug = p_slug
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_marketer_by_slug(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketer_by_slug(citext) TO anon, authenticated;
