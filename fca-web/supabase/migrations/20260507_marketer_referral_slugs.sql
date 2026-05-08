-- 20260507_marketer_referral_slugs.sql
-- Marketer referral slugs for friendlycareagency.org/ref/<slug> public referrals

-- 1. Enable citext (idempotent; usually already on)
CREATE EXTENSION IF NOT EXISTS citext;

-- 2. Add referral_slug column (nullable for now; backfill in Task 4 then NOT NULL in Task 5)
ALTER TABLE public.marketers
  ADD COLUMN IF NOT EXISTS referral_slug citext;

CREATE UNIQUE INDEX IF NOT EXISTS marketers_referral_slug_unique
  ON public.marketers (referral_slug)
  WHERE referral_slug IS NOT NULL;

-- 3. Aliases table — old slugs continue to resolve after a marketer renames
CREATE TABLE IF NOT EXISTS public.marketer_slug_aliases (
  slug         citext PRIMARY KEY,
  marketer_id  uuid NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketer_slug_aliases_marketer_id_idx
  ON public.marketer_slug_aliases (marketer_id);

-- 4. Reserved slugs table — protects routes/branding
CREATE TABLE IF NOT EXISTS public.reserved_slugs (
  slug citext PRIMARY KEY
);

INSERT INTO public.reserved_slugs (slug) VALUES
  ('admin'), ('api'), ('app'), ('auth'), ('login'), ('signup'),
  ('signin'), ('logout'), ('ref'), ('referral'), ('referrals'),
  ('dashboard'), ('support'), ('help'), ('about'), ('about-us'),
  ('contact'), ('contact-us'), ('terms'), ('privacy'), ('privacy-policy'),
  ('home'), ('index'), ('www'), ('mail'), ('email'),
  ('staff'), ('client'), ('clients'), ('prospect'), ('prospects'),
  ('caregiver'), ('caregivers'), ('marketer'), ('marketers'),
  ('faq'), ('rf'), ('settings'), ('profile'), ('null'), ('undefined')
ON CONFLICT (slug) DO NOTHING;

-- 5. Format CHECK on both slug fields
-- Lowercase letters/digits/hyphens; no leading/trailing hyphen; 2–30 chars
DO $$ BEGIN
  ALTER TABLE public.marketers
    ADD CONSTRAINT marketers_referral_slug_format
    CHECK (referral_slug IS NULL OR referral_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.marketer_slug_aliases
    ADD CONSTRAINT marketer_slug_aliases_format
    CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Trigger functions
-- 6a. Block reserved slugs on either table
CREATE OR REPLACE FUNCTION public.tg_block_reserved_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug citext;
BEGIN
  IF TG_TABLE_NAME = 'marketers' THEN
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

-- 6b. Cross-table uniqueness: a slug must not appear in marketers AND aliases simultaneously
CREATE OR REPLACE FUNCTION public.tg_enforce_slug_cross_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug citext;
BEGIN
  IF TG_TABLE_NAME = 'marketers' THEN
    v_slug := NEW.referral_slug;
    IF v_slug IS NULL THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.marketer_slug_aliases a WHERE a.slug = v_slug AND a.marketer_id <> NEW.id) THEN
      RAISE EXCEPTION 'Slug "%" is already taken (alias of another marketer)', v_slug
        USING ERRCODE = 'unique_violation';
    END IF;
  ELSE
    v_slug := NEW.slug;
    IF EXISTS (SELECT 1 FROM public.marketers m WHERE m.referral_slug = v_slug AND m.id <> NEW.marketer_id) THEN
      RAISE EXCEPTION 'Slug "%" is already taken (active slug of another marketer)', v_slug
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6c. On UPDATE of marketers.referral_slug, push the OLD slug to aliases (preserves old QR codes)
CREATE OR REPLACE FUNCTION public.tg_archive_marketer_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.referral_slug IS NOT NULL
     AND NEW.referral_slug IS DISTINCT FROM OLD.referral_slug THEN
    INSERT INTO public.marketer_slug_aliases (slug, marketer_id)
    VALUES (OLD.referral_slug, OLD.id)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Hook up triggers
DROP TRIGGER IF EXISTS marketers_block_reserved_slug ON public.marketers;
CREATE TRIGGER marketers_block_reserved_slug
  BEFORE INSERT OR UPDATE OF referral_slug ON public.marketers
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_reserved_slug();

DROP TRIGGER IF EXISTS marketers_cross_unique_slug ON public.marketers;
CREATE TRIGGER marketers_cross_unique_slug
  BEFORE INSERT OR UPDATE OF referral_slug ON public.marketers
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_slug_cross_unique();

DROP TRIGGER IF EXISTS marketers_archive_slug ON public.marketers;
CREATE TRIGGER marketers_archive_slug
  AFTER UPDATE OF referral_slug ON public.marketers
  FOR EACH ROW EXECUTE FUNCTION public.tg_archive_marketer_slug();

DROP TRIGGER IF EXISTS aliases_block_reserved_slug ON public.marketer_slug_aliases;
CREATE TRIGGER aliases_block_reserved_slug
  BEFORE INSERT OR UPDATE OF slug ON public.marketer_slug_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_reserved_slug();

DROP TRIGGER IF EXISTS aliases_cross_unique_slug ON public.marketer_slug_aliases;
CREATE TRIGGER aliases_cross_unique_slug
  BEFORE INSERT OR UPDATE OF slug ON public.marketer_slug_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_slug_cross_unique();

-- 8. RLS on the new tables (deny by default; only RPC functions read them)
ALTER TABLE public.marketer_slug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserved_slugs ENABLE ROW LEVEL SECURITY;

-- Authenticated users in the same org can see their own marketer's aliases (for diagnostics)
DROP POLICY IF EXISTS marketer_slug_aliases_org_select ON public.marketer_slug_aliases;
CREATE POLICY marketer_slug_aliases_org_select
  ON public.marketer_slug_aliases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketers m
      JOIN public.users u ON u.organization_id = m.organization_id
      WHERE m.id = marketer_slug_aliases.marketer_id
        AND u.id = auth.uid()
    )
  );

-- Reserved slugs readable to authenticated users (so the slug input can warn locally)
DROP POLICY IF EXISTS reserved_slugs_select ON public.reserved_slugs;
CREATE POLICY reserved_slugs_select
  ON public.reserved_slugs FOR SELECT
  TO authenticated
  USING (true);

-- 9. Backfill referral_slug for existing marketers
-- Strategy: lowercase first word of name, strip non [a-z0-9-], collision-suffix with -2, -3, ...
DO $$
DECLARE
  m record;
  base_slug text;
  candidate citext;
  attempt int;
BEGIN
  FOR m IN
    SELECT id, name FROM public.marketers
    WHERE referral_slug IS NULL
    ORDER BY created_at NULLS LAST, id
  LOOP
    base_slug := lower(regexp_replace(split_part(coalesce(m.name, 'marketer'), ' ', 1), '[^a-z0-9]+', '', 'g'));
    IF base_slug IS NULL OR length(base_slug) < 2 THEN
      base_slug := 'marketer';
    END IF;
    -- Trim to 28 chars to leave room for "-NN" suffix
    base_slug := substr(base_slug, 1, 28);

    candidate := base_slug::citext;
    attempt := 1;

    -- Loop until candidate is free in BOTH marketers.referral_slug AND marketer_slug_aliases AND not reserved
    WHILE EXISTS (SELECT 1 FROM public.marketers WHERE referral_slug = candidate)
       OR EXISTS (SELECT 1 FROM public.marketer_slug_aliases WHERE slug = candidate)
       OR EXISTS (SELECT 1 FROM public.reserved_slugs WHERE slug = candidate)
    LOOP
      attempt := attempt + 1;
      candidate := (base_slug || '-' || attempt)::citext;
      IF attempt > 9999 THEN
        RAISE EXCEPTION 'Could not generate unique slug for marketer % (%)', m.id, m.name;
      END IF;
    END LOOP;

    UPDATE public.marketers SET referral_slug = candidate WHERE id = m.id;
  END LOOP;
END $$;

-- 10. Lock down: NOT NULL going forward
ALTER TABLE public.marketers
  ALTER COLUMN referral_slug SET NOT NULL;
