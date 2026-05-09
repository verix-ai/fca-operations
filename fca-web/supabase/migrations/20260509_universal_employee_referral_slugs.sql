-- 20260509_universal_employee_referral_slugs.sql
-- Move referral slugs from marketers (per-role) to users (every office-role employee).
-- Spec: docs/superpowers/specs/2026-05-09-universal-employee-referral-slugs-design.md
--
-- Single transaction. If any step fails, the whole migration rolls back and
-- the original schema (marketers.referral_slug + marketer_slug_aliases) stays
-- intact.

BEGIN;

-- =========================================================================
-- A. Pre-flight assertions
-- =========================================================================

-- Sanity: every marketer must have a slug today (NOT NULL is already enforced,
-- but an explicit assertion catches drift if that constraint was relaxed).
DO $$
DECLARE
  v_null_count int;
BEGIN
  SELECT COUNT(*) INTO v_null_count FROM public.marketers WHERE referral_slug IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % marketer(s) have NULL referral_slug', v_null_count;
  END IF;
END $$;

-- Sanity: every marketer must be linked to a user row. The data copy in
-- Section D depends on this; without it, D.2's count assertion would fail
-- with a misleading error message.
DO $$
DECLARE
  v_orphan_count int;
BEGIN
  SELECT COUNT(*) INTO v_orphan_count FROM public.marketers WHERE user_id IS NULL;
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % marketer(s) have NULL user_id (Section D copy would silently skip these)', v_orphan_count;
  END IF;
END $$;

-- citext is already enabled by the 20260507 migration, but be defensive.
CREATE EXTENSION IF NOT EXISTS citext;

-- =========================================================================
-- B. Create new structures
-- =========================================================================

-- B.1 Office-role allowlist helper.
-- Single source of truth for which roles auto-get a referral slug.
-- Keep in sync with src/lib/officeRole.js.
CREATE OR REPLACE FUNCTION public.is_office_role(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_role IN ('admin', 'marketer');
$$;

-- B.2 referral_slug column on users (nullable; field roles don't get slugs).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_slug citext;

-- B.3 Format CHECK (same shape as marketers.referral_slug today).
DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_referral_slug_format
    CHECK (referral_slug IS NULL OR referral_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- B.4 Partial unique index where slug is set.
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_slug_unique
  ON public.users (referral_slug)
  WHERE referral_slug IS NOT NULL;

-- B.5 user_slug_aliases — preserves old slugs after rename so printed QRs keep working.
CREATE TABLE IF NOT EXISTS public.user_slug_aliases (
  slug       citext PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_slug_aliases_user_id_idx
  ON public.user_slug_aliases (user_id);

DO $$ BEGIN
  ALTER TABLE public.user_slug_aliases
    ADD CONSTRAINT user_slug_aliases_format
    CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- C. Trigger functions for users + user_slug_aliases
-- =========================================================================

-- C.1 Block reserved slugs on insert/update of either users.referral_slug or user_slug_aliases.slug.
CREATE OR REPLACE FUNCTION public.tg_block_reserved_slug_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug citext;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    v_slug := NEW.referral_slug;
  ELSE
    v_slug := NEW.slug;
  END IF;

  IF v_slug IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_slugs WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'Slug "%" is reserved', v_slug
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- C.2 Cross-table uniqueness: a slug must not appear in users.referral_slug AND user_slug_aliases simultaneously.
CREATE OR REPLACE FUNCTION public.tg_enforce_user_slug_cross_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug citext;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    v_slug := NEW.referral_slug;
    IF v_slug IS NULL THEN RETURN NEW; END IF;
    IF EXISTS (
      SELECT 1 FROM public.user_slug_aliases a
      WHERE a.slug = v_slug AND a.user_id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Slug "%" is already taken (alias of another user)', v_slug
        USING ERRCODE = 'unique_violation';
    END IF;
  ELSE
    v_slug := NEW.slug;
    IF EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.referral_slug = v_slug AND u.id <> NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Slug "%" is already taken (active slug of another user)', v_slug
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- C.3 On UPDATE of users.referral_slug, push the OLD slug to aliases.
CREATE OR REPLACE FUNCTION public.tg_archive_user_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.referral_slug IS NOT NULL
     AND NEW.referral_slug IS DISTINCT FROM OLD.referral_slug THEN
    INSERT INTO public.user_slug_aliases (slug, user_id)
    VALUES (OLD.referral_slug, OLD.id)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- C.4 On INSERT of an office-role user with no slug, generate one.
CREATE OR REPLACE FUNCTION public.tg_assign_user_slug_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug text;
  candidate citext;
  attempt int;
BEGIN
  -- Only office roles get an auto-assigned slug.
  IF NOT public.is_office_role(NEW.role) THEN
    RETURN NEW;
  END IF;

  -- Caller may have explicitly set a slug; respect it.
  IF NEW.referral_slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- lower() FIRST so the regex doesn't strip uppercase letters
  -- (Postgres regex is case-sensitive).
  base_slug := regexp_replace(
    lower(split_part(coalesce(NEW.name, NEW.role), ' ', 1)),
    '[^a-z0-9]+', '', 'g'
  );
  IF base_slug IS NULL OR length(base_slug) < 2 THEN
    base_slug := NEW.role;  -- fallback: 'admin', 'marketer', etc.
  END IF;
  -- Trim to 25 chars so '-NNNN' suffix fits in 30-char CHECK.
  base_slug := substr(base_slug, 1, 25);

  candidate := base_slug::citext;
  attempt := 1;

  WHILE EXISTS (SELECT 1 FROM public.users WHERE referral_slug = candidate)
     OR EXISTS (SELECT 1 FROM public.user_slug_aliases WHERE slug = candidate)
     OR EXISTS (SELECT 1 FROM public.reserved_slugs WHERE slug = candidate)
  LOOP
    attempt := attempt + 1;
    candidate := (base_slug || '-' || attempt)::citext;
    IF attempt > 9999 THEN
      RAISE EXCEPTION 'Could not generate unique referral_slug for user % (%)', NEW.id, NEW.name;
    END IF;
  END LOOP;

  NEW.referral_slug := candidate;
  RETURN NEW;
END;
$$;

-- =========================================================================
-- D. Copy existing slug data
-- =========================================================================

-- D.1 Copy each marketer's current slug onto their linked user row.
UPDATE public.users u
SET referral_slug = m.referral_slug
FROM public.marketers m
WHERE u.id = m.user_id
  AND m.referral_slug IS NOT NULL
  AND u.referral_slug IS NULL;

-- D.2 Assert: every marketer's slug now lives on their user.
-- This must hold BEFORE Step E backfills admins (which adds more rows to users.referral_slug).
DO $$
DECLARE
  v_marketer_count int;
  v_user_count int;
BEGIN
  SELECT COUNT(*) INTO v_marketer_count FROM public.marketers WHERE referral_slug IS NOT NULL;
  SELECT COUNT(*) INTO v_user_count FROM public.users WHERE referral_slug IS NOT NULL;
  IF v_user_count <> v_marketer_count THEN
    RAISE EXCEPTION 'Slug copy failed: marketers have % slugs but users have % (expected equal at this point)',
      v_marketer_count, v_user_count;
  END IF;
END $$;

-- D.3 Copy alias rows, translating marketer_id → user_id.
INSERT INTO public.user_slug_aliases (slug, user_id, created_at)
SELECT a.slug, m.user_id, a.created_at
FROM public.marketer_slug_aliases a
JOIN public.marketers m ON m.id = a.marketer_id
WHERE m.user_id IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

-- D.4 Assert: alias counts match (any rows skipped due to NULL user_id are a data integrity issue we want to surface).
DO $$
DECLARE
  v_old_count int;
  v_new_count int;
  v_orphan_count int;
BEGIN
  SELECT COUNT(*) INTO v_old_count FROM public.marketer_slug_aliases;
  SELECT COUNT(*) INTO v_new_count FROM public.user_slug_aliases;
  SELECT COUNT(*) INTO v_orphan_count
    FROM public.marketer_slug_aliases a
    JOIN public.marketers m ON m.id = a.marketer_id
    WHERE m.user_id IS NULL;
  IF v_new_count + v_orphan_count <> v_old_count THEN
    RAISE EXCEPTION 'Alias copy failed: old=% new=% orphan=% (new+orphan must equal old)',
      v_old_count, v_new_count, v_orphan_count;
  END IF;
  IF v_orphan_count > 0 THEN
    RAISE WARNING 'Skipped % alias row(s) whose marketer has no user_id', v_orphan_count;
  END IF;
END $$;

-- =========================================================================
-- E. Backfill office users without a slug (admins, mostly)
-- =========================================================================

DO $$
DECLARE
  u record;
  base_slug text;
  candidate citext;
  attempt int;
BEGIN
  FOR u IN
    SELECT id, name, role
    FROM public.users
    WHERE referral_slug IS NULL
      AND public.is_office_role(role) = true
    ORDER BY created_at NULLS LAST, id
  LOOP
    base_slug := regexp_replace(
      lower(split_part(coalesce(u.name, u.role), ' ', 1)),
      '[^a-z0-9]+', '', 'g'
    );
    IF base_slug IS NULL OR length(base_slug) < 2 THEN
      base_slug := u.role;
    END IF;
    base_slug := substr(base_slug, 1, 25);

    candidate := base_slug::citext;
    attempt := 1;

    WHILE EXISTS (SELECT 1 FROM public.users WHERE referral_slug = candidate)
       OR EXISTS (SELECT 1 FROM public.user_slug_aliases WHERE slug = candidate)
       OR EXISTS (SELECT 1 FROM public.reserved_slugs WHERE slug = candidate)
    LOOP
      attempt := attempt + 1;
      candidate := (base_slug || '-' || attempt)::citext;
      IF attempt > 9999 THEN
        RAISE EXCEPTION 'Could not generate unique slug for user % (%)', u.id, u.name;
      END IF;
    END LOOP;

    UPDATE public.users SET referral_slug = candidate WHERE id = u.id;
  END LOOP;
END $$;

-- =========================================================================
-- F. Hook up triggers on users + user_slug_aliases
-- =========================================================================

DROP TRIGGER IF EXISTS users_block_reserved_slug ON public.users;
CREATE TRIGGER users_block_reserved_slug
  BEFORE INSERT OR UPDATE OF referral_slug ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_reserved_slug_users();

DROP TRIGGER IF EXISTS users_cross_unique_slug ON public.users;
CREATE TRIGGER users_cross_unique_slug
  BEFORE INSERT OR UPDATE OF referral_slug ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_user_slug_cross_unique();

DROP TRIGGER IF EXISTS users_archive_slug ON public.users;
CREATE TRIGGER users_archive_slug
  AFTER UPDATE OF referral_slug ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_archive_user_slug();

DROP TRIGGER IF EXISTS users_assign_slug ON public.users;
CREATE TRIGGER users_assign_slug
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_assign_user_slug_on_insert();

DROP TRIGGER IF EXISTS user_aliases_block_reserved_slug ON public.user_slug_aliases;
CREATE TRIGGER user_aliases_block_reserved_slug
  BEFORE INSERT OR UPDATE OF slug ON public.user_slug_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_reserved_slug_users();

DROP TRIGGER IF EXISTS user_aliases_cross_unique_slug ON public.user_slug_aliases;
CREATE TRIGGER user_aliases_cross_unique_slug
  BEFORE INSERT OR UPDATE OF slug ON public.user_slug_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_user_slug_cross_unique();

-- =========================================================================
-- G. RLS on user_slug_aliases (mirror the existing marketer_slug_aliases policy)
-- =========================================================================

ALTER TABLE public.user_slug_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_slug_aliases_org_select ON public.user_slug_aliases;
CREATE POLICY user_slug_aliases_org_select
  ON public.user_slug_aliases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users target
      JOIN public.users me ON me.organization_id = target.organization_id
      WHERE target.id = user_slug_aliases.user_id
        AND me.id = auth.uid()
    )
  );

-- =========================================================================
-- H. Replace auto_create_marketer_record so it no longer touches slugs.
-- The user-level trigger (tg_assign_user_slug_on_insert) handled the slug
-- before this AFTER trigger fires.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.auto_create_marketer_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role <> 'marketer' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM marketers WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO marketers (
    organization_id, user_id, name, email, is_active
  ) VALUES (
    NEW.organization_id, NEW.id, NEW.name, NEW.email, NEW.is_active
  );

  RETURN NEW;
END;
$function$;

-- =========================================================================
-- I. Drop the marketer-side slug system
-- =========================================================================

-- I.1 Drop triggers that reference the old functions/tables.
DROP TRIGGER IF EXISTS marketers_block_reserved_slug ON public.marketers;
DROP TRIGGER IF EXISTS marketers_cross_unique_slug ON public.marketers;
DROP TRIGGER IF EXISTS marketers_archive_slug ON public.marketers;
DROP TRIGGER IF EXISTS aliases_block_reserved_slug ON public.marketer_slug_aliases;
DROP TRIGGER IF EXISTS aliases_cross_unique_slug ON public.marketer_slug_aliases;

-- I.2 Drop the old trigger functions (no longer referenced).
DROP FUNCTION IF EXISTS public.tg_block_reserved_slug();
DROP FUNCTION IF EXISTS public.tg_enforce_slug_cross_unique();
DROP FUNCTION IF EXISTS public.tg_archive_marketer_slug();

-- I.3 Drop the alias table.
DROP TABLE IF EXISTS public.marketer_slug_aliases;

-- I.4 Drop the slug column from marketers (data already copied in Section D).
-- Drop the format CHECK first, then the unique index, then the column.
ALTER TABLE public.marketers DROP CONSTRAINT IF EXISTS marketers_referral_slug_format;
DROP INDEX IF EXISTS public.marketers_referral_slug_unique;
ALTER TABLE public.marketers DROP COLUMN IF EXISTS referral_slug;

-- =========================================================================
-- J. Public RPC: new get_user_by_slug + backwards-compat shim for old name
-- =========================================================================

-- J.1 The new RPC. Resolves slug → office user (active, office-role only).
CREATE OR REPLACE FUNCTION public.get_user_by_slug(p_slug citext)
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
  SELECT u.id, u.name, u.organization_id
  FROM public.users u
  WHERE u.is_active = true
    AND public.is_office_role(u.role) = true
    AND (
      u.referral_slug = p_slug
      OR u.id = (
        SELECT a.user_id FROM public.user_slug_aliases a WHERE a.slug = p_slug
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_by_slug(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_by_slug(citext) TO anon, authenticated;

-- J.2 Backwards-compat shim: keep get_marketer_by_slug callable so the existing
-- public landing page (external site) continues to work until it's updated.
-- Returns the same shape the external caller already expects.
-- TODO: drop this shim once the external public site calls get_user_by_slug.
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
  SELECT * FROM public.get_user_by_slug(p_slug);
$$;

REVOKE ALL ON FUNCTION public.get_marketer_by_slug(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketer_by_slug(citext) TO anon, authenticated;

-- =========================================================================
-- K. Post-migration sanity checks
-- =========================================================================

-- K.1 Every active office user has a slug.
DO $$
DECLARE
  v_missing int;
BEGIN
  SELECT COUNT(*) INTO v_missing
    FROM public.users
    WHERE is_active = true
      AND public.is_office_role(role) = true
      AND referral_slug IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Post-migration check failed: % active office user(s) missing referral_slug', v_missing;
  END IF;
END $$;

-- K.2 Old structures truly gone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketers' AND column_name = 'referral_slug'
  ) THEN
    RAISE EXCEPTION 'marketers.referral_slug should have been dropped';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'marketer_slug_aliases'
  ) THEN
    RAISE EXCEPTION 'marketer_slug_aliases should have been dropped';
  END IF;
END $$;

COMMIT;
