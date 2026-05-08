-- 20260508_fix_auto_create_marketer_referral_slug.sql
-- BUG-002: New marketer invites fail to create a public.users row.
--
-- Root cause: auto_create_marketer_record() inserts into public.marketers
-- without a referral_slug. After 20260507_marketer_referral_slugs.sql made
-- marketers.referral_slug NOT NULL, the insert fails. The error propagates
-- back into handle_new_user(), which catches it via its outer EXCEPTION
-- handler and rolls back the public.users INSERT — leaving an auth.users
-- row with no profile. Login then force-logs the user out via
-- AuthProvider.handleProfileLoadFailure (PGRST116).
--
-- Fix: generate a unique referral_slug in auto_create_marketer_record()
-- using the same algorithm as the 20260507 backfill. Then backfill the
-- existing orphan (info@verix.ai).

BEGIN;

-- 1. Replace auto_create_marketer_record so it supplies a referral_slug.
CREATE OR REPLACE FUNCTION public.auto_create_marketer_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_slug text;
  candidate citext;
  attempt int;
BEGIN
  IF NEW.role <> 'marketer' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM marketers WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Build base slug from first word of name (lowercase, alnum only, max 25 chars).
  -- Mirrors the backfill logic in 20260507_marketer_referral_slugs.sql.
  base_slug := regexp_replace(
    lower(split_part(coalesce(NEW.name, 'marketer'), ' ', 1)),
    '[^a-z0-9]+', '', 'g'
  );
  IF base_slug IS NULL OR length(base_slug) < 2 THEN
    base_slug := 'marketer';
  END IF;
  base_slug := substr(base_slug, 1, 25);

  candidate := base_slug::citext;
  attempt := 1;

  WHILE EXISTS (SELECT 1 FROM marketers WHERE referral_slug = candidate)
     OR EXISTS (SELECT 1 FROM marketer_slug_aliases WHERE slug = candidate)
     OR EXISTS (SELECT 1 FROM reserved_slugs WHERE slug = candidate)
  LOOP
    attempt := attempt + 1;
    candidate := (base_slug || '-' || attempt)::citext;
    IF attempt > 9999 THEN
      RAISE EXCEPTION 'Could not generate unique referral_slug for user % (%)', NEW.id, NEW.name;
    END IF;
  END LOOP;

  INSERT INTO marketers (
    organization_id, user_id, name, email, is_active, referral_slug
  ) VALUES (
    NEW.organization_id, NEW.id, NEW.name, NEW.email, NEW.is_active, candidate
  );

  RETURN NEW;
END;
$function$;

-- 2. Backfill the orphan auth user(s): any auth.users with a used invite but
--    no public.users row. This re-fires handle_new_user-style logic by inserting
--    the public.users row directly; the (now fixed) auto_create_marketer
--    trigger will create the matching marketers row with a generated slug.
INSERT INTO public.users (id, organization_id, email, name, role, is_active)
SELECT
  au.id,
  i.organization_id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name',
           au.raw_user_meta_data->>'full_name',
           split_part(au.email, '@', 1)),
  i.role,
  true
FROM auth.users au
JOIN LATERAL (
  SELECT organization_id, role
  FROM public.invites
  WHERE lower(email) = lower(au.email)
  ORDER BY created_at DESC
  LIMIT 1
) i ON true
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
  AND au.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;
