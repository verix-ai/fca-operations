# Universal Employee Referral Slugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the referral slug + alias system from the `marketers` table to `users`, so every office-staff role (admins, marketers, future office roles) automatically gets a unique URL slug + QR code, while every existing slug and historical alias continues to resolve.

**Architecture:** A single Supabase migration moves `referral_slug` to `users`, creates `user_slug_aliases`, copies all marketer slug data over, backfills admins with auto-generated slugs, replaces the public RPC, then drops the old marketer slug column/table/triggers — all in one transaction. The `submit-referral` edge function is updated to attribute referrals to whichever office user owns the slug. Frontend ungates the Profile page's "Referral Link" section so it renders for any office role, generalizes the admin Settings "Referral Links" page, and moves slug methods from the `Marketer` entity to the `User` entity. Caregiver/field roles deliberately do not get slugs.

**Tech Stack:** PostgreSQL (Supabase), Deno (edge function), React + Vite, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-09-universal-employee-referral-slugs-design.md](../specs/2026-05-09-universal-employee-referral-slugs-design.md)

**Commit message convention:** This repo's owner does NOT use `Co-Authored-By: Claude` trailers. Do NOT add Anthropic/Claude trailers to any commit message in this plan.

---

## Pre-work

### Setup

- [ ] **Step 0.1: Confirm working directory and branch**

```bash
pwd  # expected: /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git status
git checkout -b feat/universal-employee-referral-slugs
```

- [ ] **Step 0.2: Run the existing test suite to confirm clean baseline**

```bash
cd fca-web && npm test -- --run
```

Expected: all current tests pass. Note any pre-existing failures so we don't blame them on this plan.

---

## Task 1: Add `isOfficeRole` lib helper (frontend)

A small client-side mirror of the SQL `is_office_role()` function. Used to gate UI rendering of the Referral Link section in Profile.

**Files:**
- Create: `fca-web/src/lib/officeRole.js`
- Create: `fca-web/src/lib/__tests__/officeRole.test.js`

- [ ] **Step 1.1: Write the failing test**

Create `fca-web/src/lib/__tests__/officeRole.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { isOfficeRole, OFFICE_ROLES } from '../officeRole';

describe('isOfficeRole', () => {
  it('returns true for admin and marketer', () => {
    expect(isOfficeRole('admin')).toBe(true);
    expect(isOfficeRole('marketer')).toBe(true);
  });
  it('returns false for caregiver / field roles / unknown', () => {
    expect(isOfficeRole('caregiver')).toBe(false);
    expect(isOfficeRole('client')).toBe(false);
    expect(isOfficeRole('')).toBe(false);
    expect(isOfficeRole(null)).toBe(false);
    expect(isOfficeRole(undefined)).toBe(false);
  });
});

describe('OFFICE_ROLES', () => {
  it('exposes the role allowlist for UI iteration', () => {
    expect(OFFICE_ROLES).toEqual(['admin', 'marketer']);
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

```bash
cd fca-web && npm test -- --run src/lib/__tests__/officeRole.test.js
```

Expected: FAIL — `Cannot find module '../officeRole'`.

- [ ] **Step 1.3: Implement the helper**

Create `fca-web/src/lib/officeRole.js`:

```javascript
// Mirrors the SQL function `public.is_office_role(text)`.
// Keep this list in sync with the SQL helper. New office roles are
// added in BOTH places.
export const OFFICE_ROLES = ['admin', 'marketer'];

export function isOfficeRole(role) {
  if (typeof role !== 'string' || role.length === 0) return false;
  return OFFICE_ROLES.includes(role);
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

```bash
cd fca-web && npm test -- --run src/lib/__tests__/officeRole.test.js
```

Expected: PASS, all 4 tests green.

- [ ] **Step 1.5: Commit**

```bash
git add fca-web/src/lib/officeRole.js fca-web/src/lib/__tests__/officeRole.test.js
git commit -m "feat(lib): add isOfficeRole helper mirroring SQL is_office_role"
```

---

## Task 2: SQL migration — universal employee referral slugs

This is the big one. Single transaction. Migration filename uses the existing `YYYYMMDD_*.sql` convention.

**Files:**
- Create: `fca-web/supabase/migrations/20260509_universal_employee_referral_slugs.sql`

- [ ] **Step 2.1: Create the migration file with Section A (pre-flight + new structures)**

Create `fca-web/supabase/migrations/20260509_universal_employee_referral_slugs.sql`:

```sql
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
```

- [ ] **Step 2.2: Append Section C (trigger functions for new tables)**

Append to the same migration file:

```sql
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
```

- [ ] **Step 2.3: Append Section D (copy data from marketers → users)**

Append:

```sql
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
```

- [ ] **Step 2.4: Append Section E (backfill office users without slugs)**

Append:

```sql
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
```

- [ ] **Step 2.5: Append Section F (hook up triggers on new structures)**

Append:

```sql
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
```

- [ ] **Step 2.6: Append Section G (RLS on user_slug_aliases)**

Append:

```sql
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
```

- [ ] **Step 2.7: Append Section H (replace `auto_create_marketer_record` to drop slug logic)**

Append:

```sql
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
```

- [ ] **Step 2.8: Append Section I (drop old marketer slug structures)**

Append:

```sql
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
```

- [ ] **Step 2.9: Append Section J (add new RPC and backwards-compat shim for old name)**

The public `/ref/<slug>` landing page that calls `get_marketer_by_slug` lives in a SEPARATE website (the public friendlycareagency.org site, not in this repo). Dropping the function would break that site. Strategy: create the new `get_user_by_slug` RPC, then REPLACE `get_marketer_by_slug` with a thin shim that delegates to it. The shim returns the same `(id, name, organization_id)` shape, so the external caller keeps working unchanged. The shim can be removed in a future migration after the public site has been updated.

Append:

```sql
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
```

- [ ] **Step 2.10: Append Section K (post-migration final assertions)**

Append:

```sql
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
```

- [ ] **Step 2.11: Apply the migration to a Supabase branch and verify it succeeds end-to-end**

Use the Supabase MCP `apply_migration` tool against a branch (NOT production):

```
Use mcp__claude_ai_Supabase__list_branches to find or create a development branch.
Use mcp__claude_ai_Supabase__apply_migration with the SQL from this migration file applied against the branch.
```

Expected: migration succeeds; `RAISE WARNING` for orphan aliases is acceptable; any `RAISE EXCEPTION` means the migration aborted and the file needs fixing.

If the branch's seed data is empty/light, also run the queries in Step 2.12 first to confirm structural correctness even without data to copy.

- [ ] **Step 2.12: Run structural verification queries on the branch**

Use `mcp__claude_ai_Supabase__execute_sql` to run each:

```sql
-- Should return rows for: is_office_role, get_user_by_slug
SELECT proname FROM pg_proc WHERE proname IN ('is_office_role', 'get_user_by_slug', 'get_marketer_by_slug');
-- Expected: is_office_role, get_user_by_slug, AND get_marketer_by_slug all present
-- (the old name is kept as a backwards-compat shim that delegates to the new RPC).

-- Should return zero rows (column gone).
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'marketers' AND column_name = 'referral_slug';

-- Should return zero rows (table gone).
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'marketer_slug_aliases';

-- Should return >= 1 (depends on seed).
SELECT COUNT(*) FROM public.users WHERE referral_slug IS NOT NULL;
```

- [ ] **Step 2.13: Commit the migration file**

```bash
git add fca-web/supabase/migrations/20260509_universal_employee_referral_slugs.sql
git commit -m "feat(db): move referral slugs from marketers to users (universal employee slugs)"
```

---

## Task 3: Add slug methods to the `User` entity

The Profile page's Referral Link section needs `User.getMySlug()` / `User.updateMySlug()` / `User.isSlugAvailable()` instead of the marketer-shaped equivalents.

**Files:**
- Modify: `fca-web/src/entities/User.supabase.js`

- [ ] **Step 3.1: Read the existing User entity to confirm its imports**

```bash
cat fca-web/src/entities/User.supabase.js | head -10
```

Expected: imports `supabase` from `@/lib/supabase` and `SupabaseService` from `@/services/supabaseService`.

- [ ] **Step 3.2: Add `getMySlug`, `updateMySlug`, and `isSlugAvailable` methods**

Edit `fca-web/src/entities/User.supabase.js`. Find the closing brace of the `User` object (the line `}` immediately before `export default User`). Insert these methods just before that closing brace, with a leading comma after the last existing method (`getByRole`):

```javascript
  /**
   * Get the currently logged-in user's referral_slug + identity.
   * Returns null if not authenticated. Returns { id, role, referral_slug }.
   */
  async getMySlug() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null
    const { data, error } = await supabase
      .from('users')
      .select('id, role, referral_slug')
      .eq('id', session.user.id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  /**
   * Update the current user's referral_slug.
   * The DB trigger automatically pushes the previous slug into user_slug_aliases.
   */
  async updateMySlug(slug) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('users')
      .update({ referral_slug: slug })
      .eq('id', session.user.id)
      .select('id, role, referral_slug')
      .single()
    if (error) throw error
    return data
  },

  /**
   * Check if a slug is available (not used by any user or alias).
   * `excludeUserId` lets you exclude the current user from the check
   * so they can re-save their existing slug.
   */
  async isSlugAvailable(slug, excludeUserId = null) {
    const lower = String(slug).toLowerCase()

    let q = supabase.from('users').select('id').eq('referral_slug', lower).limit(1)
    if (excludeUserId) q = q.neq('id', excludeUserId)
    const { data: u, error: uErr } = await q
    if (uErr) throw uErr
    if ((u ?? []).length > 0) return false

    const { data: a, error: aErr } = await supabase
      .from('user_slug_aliases')
      .select('user_id')
      .eq('slug', lower)
      .limit(1)
    if (aErr) throw aErr
    if ((a ?? []).length > 0) {
      // If the only alias hit belongs to the same user, that's actually fine (reverting).
      if (excludeUserId && a[0].user_id === excludeUserId) return true
      return false
    }
    return true
  },
```

- [ ] **Step 3.3: Verify the file still parses by running tests**

```bash
cd fca-web && npm test -- --run
```

Expected: existing tests still pass; no new failures from a syntax error.

- [ ] **Step 3.4: Commit**

```bash
git add fca-web/src/entities/User.supabase.js
git commit -m "feat(api): add User.getMySlug/updateMySlug/isSlugAvailable for universal slugs"
```

---

## Task 4: Generalize `SlugInput` to use the User entity

`SlugInput` currently calls `Marketer.isSlugAvailable(value, marketerId)`. Switch it to `User.isSlugAvailable(value, userId)` and rename the prop.

**Files:**
- Modify: `fca-web/src/components/profile/SlugInput.jsx`

- [ ] **Step 4.1: Edit `SlugInput.jsx` — swap import and prop name**

In `fca-web/src/components/profile/SlugInput.jsx`:

Replace:
```javascript
import { Marketer } from '@/entities/Marketer.supabase'
```
with:
```javascript
import { User } from '@/entities/User.supabase'
```

Replace the function signature line:
```javascript
export default function SlugInput({ marketerId, currentSlug, onChange, onValidityChange }) {
```
with:
```javascript
export default function SlugInput({ userId, currentSlug, onChange, onValidityChange }) {
```

Replace the availability call:
```javascript
        const ok = await Marketer.isSlugAvailable(value, marketerId)
```
with:
```javascript
        const ok = await User.isSlugAvailable(value, userId)
```

Update the effect dependency array on the `useEffect` that wraps the availability check:
```javascript
  }, [value, currentSlug, marketerId, formatHint, onChange, onValidityChange])
```
to:
```javascript
  }, [value, currentSlug, userId, formatHint, onChange, onValidityChange])
```

- [ ] **Step 4.2: Verify nothing else in the file references the old prop**

```bash
grep -n "marketerId\|Marketer\." fca-web/src/components/profile/SlugInput.jsx
```

Expected: no matches.

- [ ] **Step 4.3: Run tests**

```bash
cd fca-web && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 4.4: Commit**

```bash
git add fca-web/src/components/profile/SlugInput.jsx
git commit -m "refactor(profile): SlugInput takes userId and uses User entity"
```

---

## Task 5: Update `ReferralLinkSection` to use the User entity

The component currently loads a `Marketer` via `Marketer.getMine()` and saves with `Marketer.updateSlug(marketer.id, slug)`. Switch it to use `User.getMySlug()` / `User.updateMySlug(slug)`.

**Files:**
- Modify: `fca-web/src/components/profile/ReferralLinkSection.jsx`

- [ ] **Step 5.1: Rewrite the component**

Overwrite `fca-web/src/components/profile/ReferralLinkSection.jsx` with:

```jsx
import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Link2, AlertCircle, Check } from 'lucide-react'
import SlugInput from './SlugInput.jsx'
import QrCodePreview from './QrCodePreview.jsx'
import { User } from '@/entities/User.supabase'
import { slugify } from '@/lib/slug'

export default function ReferralLinkSection({ user }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState('')
  const [valid, setValid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleSlugChange = useCallback((next) => setSlug(next), [])
  const handleValidityChange = useCallback((v) => setValid(v), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await User.getMySlug()
        if (cancelled) return
        if (!m) {
          setError('Could not load your profile.')
          setLoading(false)
          return
        }
        setMe(m)
        if (!m.referral_slug) {
          setSlug(slugify((user?.name || '').split(' ')[0]))
        } else {
          setSlug(m.referral_slug)
        }
        setLoading(false)
      } catch (err) {
        if (!cancelled) { setError(err.message || 'Failed to load'); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const handleSave = async () => {
    if (!me || !valid || saving) return
    setSaving(true); setError(null); setSuccess(null)
    try {
      const updated = await User.updateMySlug(slug)
      setMe(updated)
      setSuccess('Saved!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" /> Referral Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
          </div>
        ) : (
          <>
            <SlugInput
              userId={me.id}
              currentSlug={me.referral_slug || ''}
              onChange={handleSlugChange}
              onValidityChange={handleValidityChange}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={!valid || saving || slug === me.referral_slug}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
              {success && <span className="text-sm text-emerald-700 inline-flex items-center"><Check className="w-4 h-4 mr-1" /> {success}</span>}
            </div>
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">QR Code</h4>
              <QrCodePreview slug={me.referral_slug} />
              {slug && slug !== me.referral_slug && (
                <p className="text-xs text-slate-500 mt-2">
                  Save your changes to update the QR code.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5.2: Run tests**

```bash
cd fca-web && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 5.3: Commit**

```bash
git add fca-web/src/components/profile/ReferralLinkSection.jsx
git commit -m "refactor(profile): ReferralLinkSection uses User entity for any office role"
```

---

## Task 6: Ungate the Profile page so all office users see the section

**Files:**
- Modify: `fca-web/src/Pages/Profile.jsx`

- [ ] **Step 6.1: Add the import for the new helper**

In `fca-web/src/Pages/Profile.jsx`, find the existing imports section (around lines 1-11). Add this import after the other lib imports:

Replace:
```javascript
import ReferralLinkSection from '@/components/profile/ReferralLinkSection.jsx'
```
with:
```javascript
import ReferralLinkSection from '@/components/profile/ReferralLinkSection.jsx'
import { isOfficeRole } from '@/lib/officeRole'
```

- [ ] **Step 6.2: Replace the role gate**

Replace:
```jsx
      {/* Marketer-only: referral slug + QR */}
      {user?.role === 'marketer' && <ReferralLinkSection user={user} />}
```
with:
```jsx
      {/* Office roles: referral slug + QR */}
      {isOfficeRole(user?.role) && <ReferralLinkSection user={user} />}
```

- [ ] **Step 6.3: Run tests**

```bash
cd fca-web && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 6.4: Commit**

```bash
git add fca-web/src/Pages/Profile.jsx
git commit -m "feat(profile): show Referral Link section for all office roles"
```

---

## Task 7: Update the `submit-referral` edge function

Resolves slug → user (instead of slug → marketer) and includes generic `referrer_*` keys in the `notes` JSON, while preserving backward-compat `marketer_*` keys when the resolved user is a marketer.

**Files:**
- Modify: `fca-web/supabase/functions/submit-referral/index.ts`

- [ ] **Step 7.1: Replace the slug-resolution block (lines ~170-202)**

In `fca-web/supabase/functions/submit-referral/index.ts`, find the block starting with `// Direct slug match` (around line 170) and ending with the `if (!marketer || m1Err) {` 404 response (around line 202). Replace that entire block with:

```typescript
  // Direct slug match on users
  const { data: u1, error: u1Err } = await supabase
    .from('users')
    .select('id, name, email, role, organization_id, is_active')
    .eq('referral_slug', payload.slug)
    .maybeSingle();

  const OFFICE_ROLES = ['admin', 'marketer'];
  const isOfficeRole = (role: string | null | undefined) =>
    typeof role === 'string' && OFFICE_ROLES.includes(role);

  let referrer = (u1?.is_active && isOfficeRole(u1.role)) ? u1 : null;

  // Alias fallback
  if (!referrer) {
    const { data: alias } = await supabase
      .from('user_slug_aliases')
      .select('user_id')
      .eq('slug', payload.slug)
      .maybeSingle();
    if (alias?.user_id) {
      const { data: u2 } = await supabase
        .from('users')
        .select('id, name, email, role, organization_id, is_active')
        .eq('id', alias.user_id)
        .maybeSingle();
      if (u2?.is_active && isOfficeRole(u2.role)) referrer = u2;
    }
  }

  if (!referrer || u1Err) {
    return new Response(JSON.stringify({ error: 'Unknown referral link' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
```

- [ ] **Step 7.2: Replace the notes-payload + insert block (lines ~204-230)**

Find the block starting with `// Build the JSON-in-notes payload to match the staff app's existing shape` and ending with the `if (insertErr) {` line. Replace with:

```typescript
  // Build the JSON-in-notes payload. Generic referrer_* keys are the new shape;
  // marketer_* keys are kept for backward-compat with existing dashboards when the
  // resolved user happens to be a marketer.
  const { slug: _slug, hp: _hp, ...rest } = payload;

  const notesPayload: Record<string, unknown> = {
    ...rest,
    referrer_user_id: referrer.id,
    referrer_name: referrer.name,
    referrer_email: referrer.email ?? null,
    referrer_role: referrer.role,
    submission_source: 'public_website',
  };

  if (referrer.role === 'marketer') {
    // Look up the marketers row so existing reports keyed off marketer_id keep working.
    const { data: m } = await supabase
      .from('marketers')
      .select('id, name, email')
      .eq('user_id', referrer.id)
      .maybeSingle();
    if (m) {
      notesPayload.marketer_id = m.id;
      notesPayload.marketer_name = m.name;
      notesPayload.marketer_email = m.email ?? null;
    }
  }

  const { error: insertErr } = await supabase.from('referrals').insert({
    organization_id: referrer.organization_id,
    client_id: null,
    referred_by: referrer.name,
    referral_date: new Date().toISOString().slice(0, 10),
    referral_source: payload.heard_about_us,
    notes: JSON.stringify(notesPayload),
  });
```

- [ ] **Step 7.3: Update the success response to use `referrer_name` (matches the new shape)**

Find:
```typescript
  return new Response(JSON.stringify({ ok: true, marketer_name: marketer.name }), {
```
Replace with:
```typescript
  return new Response(JSON.stringify({ ok: true, referrer_name: referrer.name }), {
```

- [ ] **Step 7.4: Search for any remaining `marketer` references in the function file that should have been updated**

```bash
grep -n "marketer" fca-web/supabase/functions/submit-referral/index.ts
```

Expected matches (these are CORRECT and should stay):
- The `if (referrer.role === 'marketer')` branch
- The `from('marketers')` lookup inside that branch
- The `notesPayload.marketer_id/name/email` lines
- Comments mentioning "marketer" for context

Any other matches need to be reviewed and updated.

- [ ] **Step 7.5: Deploy the updated edge function to the Supabase branch**

Use the Supabase MCP `deploy_edge_function` against the SAME branch where Task 2's migration was applied:

```
mcp__claude_ai_Supabase__deploy_edge_function with name="submit-referral" and the file contents.
```

Expected: deploy succeeds.

- [ ] **Step 7.6: Smoke-test the edge function on the branch**

Use `mcp__claude_ai_Supabase__execute_sql` to find a user's slug:

```sql
SELECT id, name, role, referral_slug FROM public.users WHERE referral_slug IS NOT NULL LIMIT 1;
```

Then `curl` the deployed function with that slug and a minimal valid payload. Expected: 200 with `{ ok: true, referrer_name: "<name>" }` and a new row in `referrals` whose `notes` JSON contains `referrer_user_id`, `referrer_name`, `referrer_role`.

- [ ] **Step 7.7: Commit**

```bash
git add fca-web/supabase/functions/submit-referral/index.ts
git commit -m "feat(api): submit-referral resolves slug to any office user"
```

---

## Task 8: Document the external public-site follow-up

The public `/ref/<slug>` landing page that calls `get_marketer_by_slug` lives in a SEPARATE website (the public friendlycareagency.org marketing site), not in `fca-web/src`. The migration's Section J keeps `get_marketer_by_slug` working as a shim, so this PR does NOT break the external site. A follow-up is still required to migrate the external caller to the new name.

**Files:**
- Modify: `TRACKER.md` (the repo-root tracker for go-live items)

- [ ] **Step 8.1: Confirm there are no in-repo callers of the RPC**

```bash
grep -rn "get_marketer_by_slug\|get_user_by_slug" fca-web/src
```

Expected: zero matches in `fca-web/src`. The RPC is consumed only by the external public site and the edge function (which queries tables directly, not via the RPC). If any matches show up, those need to be updated to use the new name now and this task expanded.

- [ ] **Step 8.2: Add a follow-up entry to TRACKER.md**

Open `TRACKER.md` at the repo root. Add an entry under whatever "follow-ups" / "tech debt" / similar section is most appropriate. If no such section exists, create one at the bottom called `## Follow-ups`. Add this exact entry:

```markdown
- **Update external public site to call `get_user_by_slug`.** The 20260509 migration kept `get_marketer_by_slug` as a backwards-compat shim. Once the public friendlycareagency.org site has been updated to call `get_user_by_slug` (same args, same return shape), drop the shim in a follow-up migration.
```

- [ ] **Step 8.3: Commit**

```bash
git add TRACKER.md
git commit -m "docs(tracker): track external-site RPC rename follow-up"
```

---

## Task 9: Generalize the admin Settings "Referral Links" page to list all office users

Currently lists marketers only. Switch it to list every office user with a slug, grouped by role. Same per-row QR + bulk ZIP behavior.

**Files:**
- Modify: `fca-web/src/components/settings/ReferralLinksSection.jsx`

- [ ] **Step 9.1: Replace the imports + data load + grouping**

In `fca-web/src/components/settings/ReferralLinksSection.jsx`:

Replace:
```javascript
import Marketer from '@/entities/Marketer.supabase'
```
with:
```javascript
import User from '@/entities/User.supabase'
import { OFFICE_ROLES } from '@/lib/officeRole'
```

Find the `useEffect` that loads marketers (around lines 111-128):
```javascript
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const all = await Marketer.getActive()
        if (cancelled) return
        // Only marketers that have a slug (all of them should after backfill, but be defensive)
        setMarketers((all || []).filter(m => m.referral_slug))
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load marketers')
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])
```

Replace with:
```javascript
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const all = await User.list()
        if (cancelled) return
        // Active office users with a slug.
        const office = (all || []).filter(
          u => u.is_active && OFFICE_ROLES.includes(u.role) && u.referral_slug
        )
        // Sort: role asc, then name asc — Admins above Marketers, alphabetical within.
        office.sort((a, b) =>
          a.role.localeCompare(b.role) || (a.name || '').localeCompare(b.name || '')
        )
        setMarketers(office)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load users')
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])
```

- [ ] **Step 9.2: Update the table column header and row component**

Replace the table header (find `<TableHead>Marketer</TableHead>`):
```jsx
                      <TableHead>Marketer</TableHead>
                      <TableHead>Public link</TableHead>
                      <TableHead className="w-28">QR</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
```
with:
```jsx
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Public link</TableHead>
                      <TableHead className="w-28">QR</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
```

Find the `MarketerRow` component definition (around lines 60-98) and rename it to `UserRow`, adding a Role cell. Replace the entire `MarketerRow` function (the `function MarketerRow({ marketer, onCopy, copiedSlug }) { ... }` block, lines ~60-98) with:

```jsx
function UserRow({ user, onCopy, copiedSlug }) {
  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const blob = await generateQrPngBlob(user.referral_slug)
      downloadBlob(blob, `fca-referral-qr-${user.referral_slug}.png`)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell className="capitalize text-sm text-slate-600">{user.role}</TableCell>
      <TableCell>
        <span className="font-mono text-sm">
          <span className="text-slate-400">{PUBLIC_BASE}</span>
          <span className="text-emerald-700 font-semibold">{user.referral_slug}</span>
        </span>
      </TableCell>
      <TableCell><QrThumbnail slug={user.referral_slug} /></TableCell>
      <TableCell>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onCopy(user.referral_slug)}>
            {copiedSlug === user.referral_slug
              ? <><Check className="w-4 h-4 mr-1" /> Copied</>
              : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> …</>
              : <><Download className="w-4 h-4 mr-1" /> QR</>}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
```

- [ ] **Step 9.3: Update the row render call inside the table body**

Replace:
```jsx
                    {items.map((m) => (
                      <MarketerRow
                        key={m.id}
                        marketer={m}
                        onCopy={handleCopy}
                        copiedSlug={copiedSlug}
                      />
                    ))}
```
with:
```jsx
                    {items.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        onCopy={handleCopy}
                        copiedSlug={copiedSlug}
                      />
                    ))}
```

- [ ] **Step 9.4: Update user-facing strings: header description, search placeholder, count noun, empty state, ZIP filename**

Find the search input placeholder:
```jsx
                  placeholder="Search marketers or slugs…"
```
Replace with:
```jsx
                  placeholder="Search by name or slug…"
```

Find the count line:
```jsx
              <span className="text-sm text-slate-500">
                {total} {total === 1 ? 'marketer' : 'marketers'}
              </span>
```
Replace with:
```jsx
              <span className="text-sm text-slate-500">
                {total} {total === 1 ? 'user' : 'users'}
              </span>
```

Find the empty-state line:
```jsx
                No active marketers with a referral slug.
```
Replace with:
```jsx
                No active office users with a referral slug.
```

Find the ZIP filename:
```jsx
      downloadBlob(zipBlob, `fca-marketer-qr-codes-${today}.zip`)
```
Replace with:
```jsx
      downloadBlob(zipBlob, `fca-employee-qr-codes-${today}.zip`)
```

Find the loading message:
```jsx
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading marketers…
```
Replace with:
```jsx
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading users…
```

- [ ] **Step 9.5: Run tests**

```bash
cd fca-web && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add fca-web/src/components/settings/ReferralLinksSection.jsx
git commit -m "feat(settings): admin Referral Links lists all office users with slugs"
```

---

## Task 10: Remove deprecated slug methods from the `Marketer` entity

The `Marketer` entity still has `updateSlug` and `isSlugAvailable`, which point at columns/tables that no longer exist after the migration. Remove them so callers fail fast (we already updated all known callers in Tasks 4-5-9).

**Files:**
- Modify: `fca-web/src/entities/Marketer.supabase.js`

- [ ] **Step 10.1: Confirm no remaining callers of the deprecated methods**

```bash
grep -rn "Marketer.updateSlug\|Marketer.isSlugAvailable" fca-web/src
```

Expected: zero matches. If anything matches, fix it before continuing.

- [ ] **Step 10.2: Remove `updateSlug` and `isSlugAvailable` from the Marketer entity**

In `fca-web/src/entities/Marketer.supabase.js`, delete lines 184-217 (the JSDoc + body of `updateSlug` and `isSlugAvailable`). Also remove the trailing comma on `getMine` if it becomes the last property.

After the change, the file should end like:

```javascript
  async getMine() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('marketers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    return data
  },
}

export default Marketer
```

- [ ] **Step 10.3: Run tests**

```bash
cd fca-web && npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 10.4: Commit**

```bash
git add fca-web/src/entities/Marketer.supabase.js
git commit -m "chore(api): remove deprecated Marketer.updateSlug and isSlugAvailable"
```

---

## Task 11: Update the JS reserved-slug list comment (cleanup)

The lib comment on `RESERVED_SLUGS` references the old migration date. Update it to point at the new migration.

**Files:**
- Modify: `fca-web/src/lib/slug.js`

- [ ] **Step 11.1: Update the comment**

Find:
```javascript
// Keep in sync with the DB `reserved_slugs` table seed (Task 1 migration).
```
Replace with:
```javascript
// Keep in sync with the DB `reserved_slugs` table seed (20260507 migration; reused by 20260509).
```

- [ ] **Step 11.2: Commit**

```bash
git add fca-web/src/lib/slug.js
git commit -m "docs(lib): update reserved-slug source-of-truth comment"
```

---

## Task 12: Build, run, and manual smoke test on a Supabase branch

Final integration test before opening the PR. This is the section the engineer must NOT skip.

- [ ] **Step 12.1: Build the frontend**

```bash
cd fca-web && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 12.2: Start the dev server pointed at the Supabase branch**

Confirm `fca-web/.env` (or equivalent) points the Supabase URL/anon-key at the BRANCH from Task 2.11, not production. Then:

```bash
cd fca-web && npm run dev
```

Expected: dev server boots, app loads at the printed URL.

- [ ] **Step 12.3: Manual smoke test — existing marketer**

In the running app:
1. Log in as an existing marketer (one that had a slug pre-migration).
2. Open Profile.
3. Confirm the "Referral Link" card shows the SAME slug they had before. QR code renders.
4. Copy link, hit it in an incognito browser, fill out the public form, submit.
5. Confirm submission succeeds and the referral appears in the staff Prospects list, attributed to that marketer.

- [ ] **Step 12.4: Manual smoke test — existing admin**

1. Log in as an admin (admins did NOT have slugs pre-migration).
2. Open Profile.
3. Confirm the "Referral Link" card now appears with an auto-generated slug (likely the admin's first name).
4. Rename the slug → save → confirm success.
5. In a Supabase SQL console, confirm the OLD slug now exists in `user_slug_aliases`:
   ```sql
   SELECT * FROM public.user_slug_aliases ORDER BY created_at DESC LIMIT 5;
   ```
6. Hit the OLD-slug URL in incognito → confirm it still resolves to the same admin.

- [ ] **Step 12.5: Manual smoke test — admin Settings → Referral Links**

1. As an admin, open Settings → Referral Links.
2. Confirm the table lists ALL office users (admins + marketers), with a Role column.
3. Per-row QR download works.
4. "Download all (ZIP)" works; ZIP contains one PNG per office user; filename is `fca-employee-qr-codes-YYYY-MM-DD.zip`.

- [ ] **Step 12.6: Manual smoke test — invite a new admin**

1. As an admin, invite a new admin email.
2. Accept the invite from a separate session.
3. On first login, open Profile → confirm a slug is already populated.
4. Submit a public referral via that admin's slug → confirm it appears in the referral list.

- [ ] **Step 12.7: If anything fails, STOP and report the failure**

Do NOT mark the plan complete. Report the specific step number, the expected behavior, what actually happened, and any console / network / Supabase log output.

- [ ] **Step 12.8: All smoke tests passing → ready for PR**

Don't open the PR yet — that's a separate user-confirmed step. Just confirm to the user that all 6 smoke tests pass on the Supabase branch and the implementation is ready for their review.

---

## Done

After Task 12 completes successfully, the branch is ready for merge to `main`. The user explicitly authorizes the PR + production migration apply as a separate step (per the global CLAUDE.md guidance about destructive / shared-state actions).
