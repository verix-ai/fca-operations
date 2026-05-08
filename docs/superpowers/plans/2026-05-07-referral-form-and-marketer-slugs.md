# Referral Form & Marketer Slug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the customer-website Referral Form (`web/`) to the staff app's data model so referrals submitted from the public form land in the same `referrals` table the staff app already uses, with the referring marketer attached for commission attribution. Marketers identify themselves via a custom URL slug (e.g. `friendlycareagency.org/ref/jane`) which they can set on their Profile in the staff app along with a downloadable QR code.

**Architecture:**
1. **Database (Supabase):** New `referral_slug` column on `marketers` (citext, unique, regex-checked), `marketer_slug_aliases` table (so old QR codes keep working when a marketer changes their slug), `reserved_slugs` table, slug-validation/alias-write trigger. New `get_marketer_by_slug(slug)` RPC (anon-callable, returns only safe public fields) and `submit-referral` Edge Function (anon-callable, server-resolves marketer, validates honeypot, applies per-IP rate limit, inserts into `referrals` with the same JSON-in-`notes` shape the staff app uses).
2. **Staff app (`fca-web`):** New "Referral Link" section on `Pages/Profile.jsx`, gated to `role === 'marketer'`. Lets the marketer set their slug (with live validation + auto-suggest from first name), see their public URL, and download a QR code PNG. DB trigger automatically writes the previous slug into `marketer_slug_aliases` on change, so old QRs keep resolving.
3. **Customer site (`web/`):** The existing 4-step `ReferralFormPage.tsx` is already built UI-wise. Wire it to (a) resolve `:slug` → marketer via the RPC and 404 on miss, (b) submit through the Edge Function instead of `console.log`, (c) add a hidden honeypot field, (d) reconcile field shapes with the staff app's existing `referrals.notes` JSON contract.

**Tech Stack:**
- Supabase Postgres (citext, RLS, SECURITY DEFINER functions, triggers)
- Supabase Edge Functions (Deno, Hono-style or std http)
- Staff app: React 18 + Vite + Tailwind + lucide-react + Vitest (already configured)
- Customer site: React 19 + Vite + Tailwind + react-router-dom v7 + lucide-react (Vitest will be added)
- QR: `qrcode` npm library (no React peer dep, can render to canvas/PNG without bloat)

**Branch / Commit Hygiene:**
- Work on a feature branch `feat/marketer-slugs-and-public-referral`.
- Commit after each task per the steps below.
- **Never add `Co-Authored-By: Claude` (or any Claude/Anthropic reference) trailers — write commit messages as if authored solely by the user.** This applies to every commit in this plan.

---

## File Structure

### New files

| Path | Purpose |
|---|---|
| `fca-web/supabase/migrations/20260507_marketer_referral_slugs.sql` | All schema changes for slugs (column, aliases table, reserved table, triggers, backfill) |
| `fca-web/supabase/migrations/20260507_public_referral_rpc.sql` | `get_marketer_by_slug` RPC + grants |
| `fca-web/supabase/functions/submit-referral/index.ts` | Edge Function for public referral submissions |
| `fca-web/supabase/functions/submit-referral/_shared/cors.ts` | CORS helper (or reuse existing if any) |
| `fca-web/src/components/profile/ReferralLinkSection.jsx` | Slug + QR UI for marketer Profile |
| `fca-web/src/components/profile/SlugInput.jsx` | Slug text input with live validation/uniqueness check |
| `fca-web/src/components/profile/QrCodePreview.jsx` | QR canvas + download button |
| `fca-web/src/lib/slug.js` | `slugify`, `isValidSlug`, `RESERVED_SLUGS`, `SLUG_REGEX` (shared between client and validation) |
| `fca-web/src/lib/__tests__/slug.test.js` | Vitest unit tests for slug utility |
| `web/lib/supabase.ts` | Supabase client (anon) for the public site |
| `web/lib/referralSubmit.ts` | Calls `submit-referral` Edge Function and maps form state → payload |
| `web/lib/marketerLookup.ts` | Calls `get_marketer_by_slug` RPC |
| `web/components/ReferralFormPage.404.tsx` | 404 sub-component used when slug is invalid |
| `web/.env.example` | Documents `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |

### Modified files

| Path | Change |
|---|---|
| `fca-web/src/entities/Marketer.supabase.js` | Add `getMine()`, `updateSlug(id, slug)`, `isSlugAvailable(slug, excludeId)` helpers |
| `fca-web/src/Pages/Profile.jsx` | Render `<ReferralLinkSection user={user} />` after `NotificationPreferencesSection` (gated to marketers) |
| `fca-web/package.json` | Add `qrcode` dependency |
| `web/package.json` | Add `@supabase/supabase-js`, `qrcode` (not needed on web), `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `zod` |
| `web/App.tsx` | Rename route `/rf/:employeeSlug` → `/ref/:slug`; add redirect from `/rf/*` → `/ref/*` for backward compat |
| `web/components/ReferralFormPage.tsx` | Replace `useParams.employeeSlug` plumbing with `:slug`; call `marketerLookup` on mount; show 404 component on miss; replace `console.log` submit with `referralSubmit`; add honeypot; reconcile field shapes; show marketer name from DB (not URL slug) |
| `web/vercel.json` | Add SPA fallback rewrite if not present (so `/ref/:slug` works on direct visits) |
| `web/vite.config.ts` | Add Vitest config block |

---

## Reconciliation Notes (read before Phase 3)

The existing `ReferralFormPage.tsx` field shape diverges from the staff `MarketerIntake.jsx` JSON shape in several places. The plan converges on the staff shape, since that's what already lives in `referrals.notes` and what `ReferralProfile.jsx` and `Prospects.jsx` already read.

| Web form (current) | Staff form (canonical) | Resolution |
|---|---|---|
| `marketerName` (from URL slug) | `marketer_id`, `marketer_name`, `marketer_email` | Drop `marketerName`; resolve all three from DB by slug |
| `serviceProgramRequested` w/ options `['CCSP','GAPP','ICWP','SFC','SOURCE','Not Sure']` | `requested_program` w/ options from `programs` DB table | Pull options at runtime from `programs` via Edge Function (or pass through anon read of the table); store as `requested_program` |
| `referralName` | `referral_name` | Rename on submit |
| `sex` w/ options `['Male','Female']` | `sex` w/ options `['Female','Male','Prefer not to say']` | Add `Prefer not to say` to web form |
| `referralDOB` | `referral_dob` | Rename on submit |
| `gaMedicaidOrSSN` | `medicaid_or_ssn` | Rename on submit |
| `phone` | `phone` | Same |
| `caregiverName` / `caregiverPhone` / `caregiverRelationship` | `caregiver_name` / `caregiver_phone` / `caregiver_relationship` | Rename on submit |
| `caregiverRelationship` options (16 hardcoded, ordering differs) | `CAREGIVER_RELATIONSHIPS` constant (16 items) | Web form already matches; one ordering nit to fix |
| `streetAddress`, `aptSuite`, `city`, `zipCode`, `county`, `state` | `address_line1`, `address_line2`, `city`, `zip`, `county`, `state` | Rename on submit |
| `caregiverLivesInHome` | `caregiver_lives_in_home` | Rename on submit |
| `receivesBenefits` | `receives_benefits` | Rename on submit |
| `benefitsReceivedOn` | `benefits_pay_date` | Rename on submit |
| `physicianNameLocation` | `physician` | Rename on submit |
| `memberDiagnosis` | `diagnosis` | Rename on submit |
| `servicesRequested` (object of booleans) | `services_needed` (array of strings) | Translate booleans → array on submit |
| `hearAboutUs` | `heard_about_us` | Rename on submit (also goes into top-level `referral_source` column) |
| `otherSource` | merged into `heard_about_us` as `Other: <text>` per existing convention | Translate on submit |
| `additionalInfo` | `additional_info` | Rename on submit |

The `referralSubmit.ts` lib will own this translation, so `ReferralFormPage.tsx` keeps its current state shape and only the edge of the submit pipeline does the rename.

---

## Phase 0 — Branch + Confirm Worktree State

### Task 0: Set up branch

**Files:** none

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git checkout -b feat/marketer-slugs-and-public-referral
```

- [ ] **Step 2: Verify clean working tree (modulo the untracked PDFs that exist already)**

Run: `git status`
Expected: branch `feat/marketer-slugs-and-public-referral`; no staged or unstaged changes; untracked PDFs and `MrFriendly_Avatar.png` are fine.

- [ ] **Step 3: Verify the parallel `web/` repo location and current state**

Run: `ls /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/web/components/ReferralFormPage.tsx && cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/web && git status -s | head -20`
Expected: file exists; the `web/` repo's git status is whatever it is — just observe so you know the baseline.

---

## Phase 1 — Database Layer

### Task 1: Migration — slug column, aliases, reserved table, validation

**Files:**
- Create: `fca-web/supabase/migrations/20260507_marketer_referral_slugs.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration locally and verify**

Run:
```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
supabase db push
```
Expected: migration applied with no errors.

If the project uses `mcp__claude_ai_Supabase__apply_migration` instead of the CLI, apply via that tool with the same SQL. Confirm with the user which path to use before running.

- [ ] **Step 3: Smoke-test the constraints with SQL**

Run via `supabase db query` (or the Supabase SQL editor):
```sql
-- Should fail: reserved
INSERT INTO marketer_slug_aliases (slug, marketer_id)
VALUES ('admin', (SELECT id FROM marketers LIMIT 1));

-- Should fail: format
INSERT INTO marketer_slug_aliases (slug, marketer_id)
VALUES ('-bad', (SELECT id FROM marketers LIMIT 1));

-- Should fail: format (uppercase)
INSERT INTO marketer_slug_aliases (slug, marketer_id)
VALUES ('Jane', (SELECT id FROM marketers LIMIT 1));
```
Expected: all three error with check_violation or similar.

- [ ] **Step 4: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/supabase/migrations/20260507_marketer_referral_slugs.sql
git commit -m "feat(db): add marketer referral_slug, aliases, reserved-slugs and validation triggers"
```

---

### Task 2: Backfill slugs for existing marketers

**Files:**
- Modify (append to): `fca-web/supabase/migrations/20260507_marketer_referral_slugs.sql`

This stays in the same migration file so the schema lands atomic with usable data.

- [ ] **Step 1: Append a backfill block to the migration**

Add at the end of the file from Task 1:

```sql
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
```

- [ ] **Step 2: Re-apply (or apply continuation) and verify backfill**

Run: `supabase db push` (or re-apply via the MCP tool).

Then run:
```sql
SELECT id, name, referral_slug FROM marketers ORDER BY name;
SELECT count(*) FILTER (WHERE referral_slug IS NULL) AS nulls FROM marketers;
```
Expected: every marketer has a non-null slug; `nulls` is 0.

- [ ] **Step 3: Commit**

```bash
git add fca-web/supabase/migrations/20260507_marketer_referral_slugs.sql
git commit -m "feat(db): backfill marketer referral_slugs and enforce NOT NULL"
```

---

### Task 3: `get_marketer_by_slug` RPC

**Files:**
- Create: `fca-web/supabase/migrations/20260507_public_referral_rpc.sql`

- [ ] **Step 1: Write the RPC migration**

```sql
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
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push` (or MCP equivalent).

- [ ] **Step 3: Smoke test from anon role**

```sql
-- Substitute a real slug from your backfill
SELECT * FROM public.get_marketer_by_slug('jane');

-- Should return zero rows for unknown slug (NOT an error)
SELECT * FROM public.get_marketer_by_slug('does-not-exist-xyz');
```
Expected: real slug returns one row with `id`, `name`, `organization_id`; bogus slug returns 0 rows.

- [ ] **Step 4: Commit**

```bash
git add fca-web/supabase/migrations/20260507_public_referral_rpc.sql
git commit -m "feat(db): add get_marketer_by_slug RPC for public referral page"
```

---

### Task 4: Edge Function — `submit-referral`

**Files:**
- Create: `fca-web/supabase/functions/submit-referral/index.ts`
- Create: `fca-web/supabase/functions/submit-referral/_shared/cors.ts`

- [ ] **Step 1: Write the CORS helper**

```ts
// fca-web/supabase/functions/submit-referral/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

- [ ] **Step 2: Write the Edge Function**

```ts
// fca-web/supabase/functions/submit-referral/index.ts
// Public endpoint for friendlycareagency.org/ref/<slug> referral submissions.
// - Resolves marketer by slug (current or alias) via service-role client
// - Validates honeypot, applies per-IP rate limit
// - Inserts into `referrals` matching the staff form's JSON-in-`notes` shape
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RATE_LIMIT_MAX = 5;          // submissions
const RATE_LIMIT_WINDOW_SEC = 3600; // per hour, per IP

// In-memory rate limiter (sufficient for low-volume public form; resets on cold start).
// If volume grows, swap to a `submission_rate_limits` table with upsert + window query.
const ipHits = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - RATE_LIMIT_WINDOW_SEC;
  const arr = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return true;
}

type ServicesNeeded =
  | 'Ambulating/Transferring'
  | 'Bathing'
  | 'Dressing'
  | 'Feeding'
  | 'Hygiene/Grooming'
  | 'Basic Housekeeping'
  | 'Errand Assistance'
  | 'Emergency Response/Alert System or Device'
  | 'Do you require supplies to accommodate your individual needs?';

interface IncomingPayload {
  // Routing
  slug: string;

  // Anti-spam
  hp?: string; // honeypot — must be empty string

  // Person being referred
  referral_name: string;
  sex: 'Female' | 'Male' | 'Prefer not to say';
  referral_dob: string;       // YYYY-MM-DD
  medicaid_or_ssn: string;    // formatted ###-##-####
  phone: string;              // formatted (###) ###-####

  // Caregiver
  caregiver_name: string;
  caregiver_relationship: string;
  caregiver_phone: string;
  caregiver_lives_in_home: 'Yes' | 'No';

  // Address
  address_line1: string;
  address_line2?: string;
  city: string;
  zip: string;
  county?: string;
  state: string;

  // Care
  requested_program: string;
  physician: string;
  diagnosis: string;
  services_needed: ServicesNeeded[];

  // Benefits
  receives_benefits: 'Yes' | 'No';
  benefits_pay_date?: '1st' | '3rd';

  // Source
  heard_about_us: string;     // already-merged "Other: <text>" if applicable
  additional_info?: string;
}

function validate(p: IncomingPayload): string | null {
  const required = [
    'slug', 'referral_name', 'sex', 'referral_dob', 'medicaid_or_ssn', 'phone',
    'caregiver_name', 'caregiver_relationship', 'caregiver_phone', 'caregiver_lives_in_home',
    'address_line1', 'city', 'zip', 'state',
    'requested_program', 'physician', 'diagnosis',
    'receives_benefits', 'heard_about_us'
  ] as const;
  for (const k of required) {
    const v = (p as Record<string, unknown>)[k];
    if (typeof v !== 'string' || v.trim() === '') return `Missing required field: ${k}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.referral_dob)) return 'Invalid referral_dob';
  if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(p.phone)) return 'Invalid phone format';
  if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(p.caregiver_phone)) return 'Invalid caregiver_phone format';
  if (!/^\d{3}-\d{2}-\d{4}$/.test(p.medicaid_or_ssn)) return 'Invalid medicaid_or_ssn format';
  if (!Array.isArray(p.services_needed)) return 'services_needed must be an array';
  if (p.receives_benefits === 'Yes' && !p.benefits_pay_date) return 'benefits_pay_date required when receives_benefits is Yes';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too many submissions. Please try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: IncomingPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Honeypot: bots fill all fields, real users never see/touch this
  if (payload.hp && payload.hp.trim() !== '') {
    // Pretend success so bots don't learn they were caught
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const validationError = validate(payload);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve marketer (authoritative server-side lookup; client cannot spoof)
  const { data: marketers, error: marketerErr } = await supabase
    .from('marketers')
    .select('id, name, email, organization_id, is_active')
    .or(`referral_slug.eq.${payload.slug},id.eq.${'00000000-0000-0000-0000-000000000000'}`)
    .limit(1);

  // The above .or() trick handles the citext direct match. For the alias path we do a second query.
  let marketer = (marketers ?? []).find((m) => m.is_active) ?? null;
  if (!marketer) {
    const { data: aliasRows } = await supabase
      .from('marketer_slug_aliases')
      .select('marketer_id')
      .eq('slug', payload.slug)
      .limit(1);
    const aliasMarketerId = aliasRows?.[0]?.marketer_id;
    if (aliasMarketerId) {
      const { data: m2 } = await supabase
        .from('marketers')
        .select('id, name, email, organization_id, is_active')
        .eq('id', aliasMarketerId)
        .limit(1)
        .maybeSingle();
      if (m2?.is_active) marketer = m2;
    }
  }

  if (!marketer || marketerErr) {
    return new Response(JSON.stringify({ error: 'Unknown referral link' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build the JSON-in-notes payload to match the staff app's existing shape
  const { slug: _slug, hp: _hp, heard_about_us, ...rest } = payload;

  const notesPayload = {
    ...rest,
    heard_about_us,
    state: payload.state,
    marketer_id: marketer.id,
    marketer_name: marketer.name,
    marketer_email: marketer.email ?? null,
    submission_source: 'public_website',
  };

  const { error: insertErr } = await supabase.from('referrals').insert({
    organization_id: marketer.organization_id,
    client_id: null,
    referred_by: marketer.name,
    referral_date: new Date().toISOString().slice(0, 10),
    referral_source: heard_about_us,
    notes: JSON.stringify(notesPayload),
  });

  if (insertErr) {
    console.error('referral insert failed', insertErr);
    return new Response(JSON.stringify({ error: 'Could not save referral' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, marketer_name: marketer.name }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 3: Deploy the function**

Run:
```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
supabase functions deploy submit-referral --no-verify-jwt
```
Expected: deployment success, function URL printed.

(Note: `--no-verify-jwt` because the public website is unauthenticated. Anon-key calls are still allowed by default; the function does its own auth via the service-role key for the DB write.)

- [ ] **Step 4: Smoke-test the deployed function**

Run (replace `<URL>` with deployed URL and `<SLUG>` with a real backfilled slug):
```bash
curl -i -X POST "<URL>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "<SLUG>",
    "referral_name": "Test Person",
    "sex": "Female",
    "referral_dob": "1955-03-12",
    "medicaid_or_ssn": "123-45-6789",
    "phone": "(404) 555-0100",
    "caregiver_name": "Test Caregiver",
    "caregiver_relationship": "Daughter",
    "caregiver_phone": "(404) 555-0101",
    "caregiver_lives_in_home": "Yes",
    "address_line1": "1 Peachtree St",
    "city": "Atlanta",
    "zip": "30303",
    "state": "GA",
    "requested_program": "PCA",
    "physician": "Dr. Smith, Grady",
    "diagnosis": "Hypertension",
    "services_needed": ["Bathing", "Dressing"],
    "receives_benefits": "No",
    "heard_about_us": "Family or Friend"
  }'
```
Expected: HTTP 200, body `{"ok":true,"marketer_name":"<Name>"}`. A row appears in `referrals` with the expected `notes` JSON.

Test 404:
```bash
curl -i -X POST "<URL>" -H "Content-Type: application/json" -d '{"slug":"does-not-exist","referral_name":"x","sex":"Female","referral_dob":"2000-01-01","medicaid_or_ssn":"111-22-3333","phone":"(404) 555-0000","caregiver_name":"x","caregiver_relationship":"Friend","caregiver_phone":"(404) 555-0001","caregiver_lives_in_home":"No","address_line1":"x","city":"x","zip":"30303","state":"GA","requested_program":"PCA","physician":"x","diagnosis":"x","services_needed":[],"receives_benefits":"No","heard_about_us":"Word of Mouth"}'
```
Expected: HTTP 404 `{"error":"Unknown referral link"}`.

Test honeypot:
```bash
# Same as good payload but add "hp":"i am a bot"
# Expected: HTTP 200 ok:true, but NO row inserted into referrals.
```

Test rate limit: Run the good payload 6 times in a row. Expected: 6th returns 429.

- [ ] **Step 5: Commit**

```bash
git add fca-web/supabase/functions/submit-referral
git commit -m "feat(edge): add submit-referral Edge Function with honeypot and per-IP rate limit"
```

---

## Phase 2 — Staff App: Slug + QR on Profile

### Task 5: Slug utility module + tests

**Files:**
- Create: `fca-web/src/lib/slug.js`
- Create: `fca-web/src/lib/__tests__/slug.test.js`

- [ ] **Step 1: Write the failing test**

```js
// fca-web/src/lib/__tests__/slug.test.js
import { describe, it, expect } from 'vitest';
import { slugify, isValidSlug, RESERVED_SLUGS, SLUG_REGEX } from '../slug';

describe('slugify', () => {
  it('lowercases and strips non-alnum from a single name', () => {
    expect(slugify('Jane')).toBe('jane');
    expect(slugify('Marcus H.')).toBe('marcus');
  });
  it('keeps internal hyphens when given hyphenated input', () => {
    expect(slugify('Mary-Ann')).toBe('mary-ann');
  });
  it('trims to 30 chars', () => {
    expect(slugify('a'.repeat(50))).toHaveLength(30);
  });
  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});

describe('isValidSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidSlug('jane')).toBe(true);
    expect(isValidSlug('marcus-h')).toBe(true);
    expect(isValidSlug('a1')).toBe(true);
    expect(isValidSlug('a'.repeat(30))).toBe(true);
  });
  it('rejects too short / too long', () => {
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('a'.repeat(31))).toBe(false);
  });
  it('rejects leading/trailing hyphens', () => {
    expect(isValidSlug('-jane')).toBe(false);
    expect(isValidSlug('jane-')).toBe(false);
  });
  it('rejects uppercase / special chars', () => {
    expect(isValidSlug('Jane')).toBe(false);
    expect(isValidSlug('jane.doe')).toBe(false);
    expect(isValidSlug('jane_doe')).toBe(false);
    expect(isValidSlug('jane doe')).toBe(false);
  });
  it('rejects reserved slugs', () => {
    expect(isValidSlug('admin')).toBe(false);
    expect(isValidSlug('login')).toBe(false);
    expect(isValidSlug('ref')).toBe(false);
  });
});

describe('SLUG_REGEX', () => {
  it('matches the DB CHECK regex', () => {
    expect(SLUG_REGEX.source).toBe('^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$');
  });
});

describe('RESERVED_SLUGS', () => {
  it('contains the core reserved words', () => {
    expect(RESERVED_SLUGS).toContain('admin');
    expect(RESERVED_SLUGS).toContain('ref');
  });
});
```

- [ ] **Step 2: Run the test (should fail — module not yet created)**

Run: `cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web && npm run test:run -- slug`
Expected: FAIL with module-not-found / undefined errors for `slugify`, `isValidSlug`, etc.

- [ ] **Step 3: Implement the module**

```js
// fca-web/src/lib/slug.js
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

// Keep in sync with the DB `reserved_slugs` table seed.
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'login', 'signup', 'signin', 'logout',
  'ref', 'referral', 'referrals', 'dashboard', 'support', 'help',
  'about', 'about-us', 'contact', 'contact-us', 'terms', 'privacy', 'privacy-policy',
  'home', 'index', 'www', 'mail', 'email', 'staff', 'client', 'clients',
  'prospect', 'prospects', 'caregiver', 'caregivers', 'marketer', 'marketers',
  'faq', 'rf', 'settings', 'profile', 'null', 'undefined',
]);

/**
 * Lowercase and reduce a name to a slug-safe form.
 * Returns a candidate that may still need uniqueness/reserved checks.
 */
export function slugify(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .trim()
    // Allow internal hyphens; collapse runs of whitespace to nothing
    .replace(/\s+/g, '')
    // Strip any char that isn't [a-z0-9-]
    .replace(/[^a-z0-9-]/g, '')
    // Strip leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export function isValidSlug(slug) {
  if (typeof slug !== 'string') return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return false;
  return true;
}
```

- [ ] **Step 4: Run tests (should pass)**

Run: `npm run test:run -- slug`
Expected: PASS, all assertions green.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/lib/slug.js fca-web/src/lib/__tests__/slug.test.js
git commit -m "feat(slug): add slug utility (slugify, isValidSlug, RESERVED_SLUGS)"
```

---

### Task 6: Extend `Marketer` entity with slug helpers

**Files:**
- Modify: `fca-web/src/entities/Marketer.supabase.js`

- [ ] **Step 1: Add helpers**

Append to the `Marketer` object before the final `}`:

```js
  /**
   * Get the marketer record linked to the currently logged-in user.
   * Returns null if the user is not linked to a marketer.
   */
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

  /**
   * Update the referral_slug on a marketer.
   * The DB trigger automatically pushes the previous slug into marketer_slug_aliases.
   */
  async updateSlug(id, slug) {
    return marketerService.update(id, { referral_slug: slug })
  },

  /**
   * Check if a slug is available (not used by any marketer or alias).
   * `excludeId` lets you exclude the current marketer from the check (so they can re-save the same slug).
   */
  async isSlugAvailable(slug, excludeId = null) {
    const lower = String(slug).toLowerCase()

    // Check active slugs
    let q = supabase.from('marketers').select('id').eq('referral_slug', lower).limit(1)
    if (excludeId) q = q.neq('id', excludeId)
    const { data: m, error: mErr } = await q
    if (mErr) throw mErr
    if ((m ?? []).length > 0) return false

    // Check aliases (any alias counts as taken, even our own — but the trigger will keep aliases unique to us)
    let q2 = supabase.from('marketer_slug_aliases').select('marketer_id').eq('slug', lower).limit(1)
    const { data: a, error: aErr } = await q2
    if (aErr) throw aErr
    if ((a ?? []).length > 0) {
      // If the only alias hit belongs to the same marketer, that's actually fine (they're reverting)
      if (excludeId && a[0].marketer_id === excludeId) return true
      return false
    }
    return true
  },
```

- [ ] **Step 2: Smoke check (no automated test — entity wraps DB)**

Run: `cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web && npm run dev` and in browser dev console while logged in:
```js
const { Marketer } = await import('/src/entities/Marketer.supabase.js')
await Marketer.getMine()
await Marketer.isSlugAvailable('zzz-not-real')  // true
```
Expected: `getMine()` returns either a marketer row or `null`; `isSlugAvailable` returns `true` for a clearly-unused slug.

Stop the dev server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add fca-web/src/entities/Marketer.supabase.js
git commit -m "feat(marketer): add getMine, updateSlug, isSlugAvailable helpers"
```

---

### Task 7: Add `qrcode` dependency

**Files:**
- Modify: `fca-web/package.json`, `fca-web/package-lock.json`

- [ ] **Step 1: Install**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npm install qrcode
```

- [ ] **Step 2: Verify install**

Run: `node -e "console.log(require('qrcode').toDataURL ? 'ok' : 'missing')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add fca-web/package.json fca-web/package-lock.json
git commit -m "chore(deps): add qrcode for marketer referral QR generation"
```

---

### Task 8: `SlugInput` component

**Files:**
- Create: `fca-web/src/components/profile/SlugInput.jsx`

- [ ] **Step 1: Write the component**

```jsx
// fca-web/src/components/profile/SlugInput.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Check, AlertCircle, Loader2 } from 'lucide-react'
import { isValidSlug, slugify, RESERVED_SLUGS } from '@/lib/slug'
import { Marketer } from '@/entities/Marketer.supabase'

const PUBLIC_BASE = 'friendlycareagency.org/ref/'

export default function SlugInput({ marketerId, currentSlug, onChange, onValidityChange }) {
  const [value, setValue] = useState(currentSlug || '')
  const [status, setStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [reason, setReason] = useState('')
  const debounceRef = useRef(null)

  const formatHint = useMemo(() => {
    if (!value) return ''
    if (value !== value.toLowerCase()) return 'Use lowercase only'
    if (value.length < 2) return 'At least 2 characters'
    if (value.length > 30) return 'Max 30 characters'
    if (/^-|-$/.test(value)) return 'Cannot start or end with a hyphen'
    if (!/^[a-z0-9-]+$/.test(value)) return 'Only letters, numbers, and hyphens'
    if (RESERVED_SLUGS.has(value)) return `"${value}" is reserved`
    return ''
  }, [value])

  useEffect(() => {
    onChange?.(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value) {
      setStatus('idle'); setReason(''); onValidityChange?.(false)
      return
    }
    if (!isValidSlug(value)) {
      setStatus('invalid'); setReason(formatHint); onValidityChange?.(false)
      return
    }
    if (value === currentSlug) {
      setStatus('available'); setReason('Current slug'); onValidityChange?.(true)
      return
    }

    setStatus('checking'); setReason('')
    debounceRef.current = setTimeout(async () => {
      try {
        const ok = await Marketer.isSlugAvailable(value, marketerId)
        if (ok) {
          setStatus('available'); setReason('Available'); onValidityChange?.(true)
        } else {
          setStatus('taken'); setReason('Already taken'); onValidityChange?.(false)
        }
      } catch (err) {
        setStatus('invalid'); setReason('Could not check availability'); onValidityChange?.(false)
      }
    }, 350)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [value, currentSlug, marketerId, formatHint, onChange, onValidityChange])

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Your referral link</label>
      <div className="flex items-stretch rounded-lg overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-300">
        <span className="px-3 inline-flex items-center bg-slate-50 text-slate-500 text-sm select-none">
          {PUBLIC_BASE}
        </span>
        <Input
          value={value}
          onChange={(e) => setValue(slugify(e.target.value))}
          maxLength={30}
          placeholder="jane"
          className="flex-1 border-0 focus-visible:ring-0 rounded-none"
          aria-describedby="slug-status"
        />
        <span id="slug-status" className="px-3 inline-flex items-center text-sm w-28 justify-end">
          {status === 'checking' && <><Loader2 className="w-4 h-4 animate-spin mr-1" /> checking</>}
          {status === 'available' && <><Check className="w-4 h-4 text-emerald-600 mr-1" /> {reason || 'available'}</>}
          {(status === 'taken' || status === 'invalid') && (
            <><AlertCircle className="w-4 h-4 text-rose-600 mr-1" /> {reason || 'invalid'}</>
          )}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        2–30 lowercase letters, numbers, and hyphens. This is the link clients use to refer through you.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Visual smoke test**

Add a temporary route or use the next task's wiring to render this — easiest: skip dedicated test and verify via Task 11's manual run.

- [ ] **Step 3: Commit**

```bash
git add fca-web/src/components/profile/SlugInput.jsx
git commit -m "feat(profile): add SlugInput with live validation and availability check"
```

---

### Task 9: `QrCodePreview` component

**Files:**
- Create: `fca-web/src/components/profile/QrCodePreview.jsx`

- [ ] **Step 1: Write the component**

```jsx
// fca-web/src/components/profile/QrCodePreview.jsx
import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Download, Copy, Check } from 'lucide-react'

const PUBLIC_BASE = 'https://friendlycareagency.org/ref/'

export default function QrCodePreview({ slug }) {
  const canvasRef = useRef(null)
  const [pngDataUrl, setPngDataUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const url = slug ? `${PUBLIC_BASE}${slug}` : ''

  useEffect(() => {
    if (!slug || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 240,
    }).catch(() => {/* ignore */})
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 1024,
    }).then(setPngDataUrl).catch(() => setPngDataUrl(''))
  }, [slug, url])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — silently ignore */ }
  }

  if (!slug) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 text-center">
        Save a slug to generate your QR code.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <canvas ref={canvasRef} className="rounded-lg border border-slate-200 bg-white" aria-label="QR code for your referral link" />
        <div className="flex-1 space-y-2">
          <div className="text-sm">
            <div className="text-slate-500 mb-1">Your public link:</div>
            <div className="font-mono text-emerald-700 break-all">{url}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button type="button" variant="outline" asChild disabled={!pngDataUrl}>
              <a href={pngDataUrl || '#'} download={`fca-referral-qr-${slug}.png`} aria-disabled={!pngDataUrl}>
                <Download className="w-4 h-4 mr-1" /> Download QR
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add fca-web/src/components/profile/QrCodePreview.jsx
git commit -m "feat(profile): add QrCodePreview with download and copy-link actions"
```

---

### Task 10: `ReferralLinkSection` (composes Slug + QR)

**Files:**
- Create: `fca-web/src/components/profile/ReferralLinkSection.jsx`

- [ ] **Step 1: Write the component**

```jsx
// fca-web/src/components/profile/ReferralLinkSection.jsx
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Link2, AlertCircle, Check } from 'lucide-react'
import SlugInput from './SlugInput.jsx'
import QrCodePreview from './QrCodePreview.jsx'
import { Marketer } from '@/entities/Marketer.supabase'
import { slugify } from '@/lib/slug'

export default function ReferralLinkSection({ user }) {
  const [marketer, setMarketer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState('')
  const [valid, setValid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await Marketer.getMine()
        if (cancelled) return
        if (!m) {
          setError('No marketer record linked to your account. Ask an admin to link one.')
          setLoading(false)
          return
        }
        setMarketer(m)
        // If no slug yet, auto-suggest from first name
        if (!m.referral_slug) {
          setSlug(slugify((m.name || user?.name || '').split(' ')[0]))
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
    if (!marketer || !valid || saving) return
    setSaving(true); setError(null); setSuccess(null)
    try {
      const updated = await Marketer.updateSlug(marketer.id, slug)
      setMarketer(updated)
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
              marketerId={marketer.id}
              currentSlug={marketer.referral_slug || ''}
              onChange={setSlug}
              onValidityChange={setValid}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={!valid || saving || slug === marketer.referral_slug}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
              {success && <span className="text-sm text-emerald-700 inline-flex items-center"><Check className="w-4 h-4 mr-1" /> {success}</span>}
            </div>
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">QR Code</h4>
              <QrCodePreview slug={marketer.referral_slug} />
              {slug && slug !== marketer.referral_slug && (
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

- [ ] **Step 2: Commit**

```bash
git add fca-web/src/components/profile/ReferralLinkSection.jsx
git commit -m "feat(profile): add ReferralLinkSection composing slug input and QR preview"
```

---

### Task 11: Wire `ReferralLinkSection` into Profile page (gated to marketers)

**Files:**
- Modify: `fca-web/src/Pages/Profile.jsx`

- [ ] **Step 1: Add the import and conditional render**

Edit `fca-web/src/Pages/Profile.jsx`. At the top of the file, after the existing imports add:

```jsx
import ReferralLinkSection from '@/components/profile/ReferralLinkSection.jsx'
```

In the `Profile` component's return JSX, locate the line `<NotificationPreferencesSection user={user} updateProfile={updateProfile} />` and add the new section immediately after it:

```jsx
      <NotificationPreferencesSection user={user} updateProfile={updateProfile} />

      {/* Marketer-only: referral slug + QR */}
      {user?.role === 'marketer' && <ReferralLinkSection user={user} />}
```

- [ ] **Step 2: Manual smoke test (the only one in this task)**

Run: `cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web && npm run dev`

In browser:
1. Log in as a user with `role = 'marketer'` (or temporarily set your test user's role to `'marketer'` in the DB).
2. Navigate to the Profile page.
3. **Verify** the "Referral Link" section appears.
4. **Verify** the slug field is prefilled (with auto-suggestion from first name if blank, or with the existing slug).
5. Type `admin` — verify it shows "is reserved" inline and Save is disabled.
6. Type something invalid like `Jane` (capital) — verify it shows "Use lowercase only".
7. Type a fresh valid slug like `test-slug-99` — verify "Available" appears after debounce, Save enables.
8. Click Save — verify success state, the QR code appears (240×240) with the public URL `https://friendlycareagency.org/ref/test-slug-99` and Copy/Download buttons.
9. Click Download QR — verify a PNG downloads.
10. Click Copy link — verify a checkmark appears (and pasting somewhere yields the URL).
11. Log in as an admin (role = 'admin') — verify the section does NOT appear.
12. Stop dev server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add fca-web/src/Pages/Profile.jsx
git commit -m "feat(profile): show ReferralLinkSection on marketer profiles"
```

---

## Phase 3 — Customer Site: Wire ReferralFormPage to Real Data

### Task 12: Add Supabase client + dependencies + env vars

**Files:**
- Modify: `web/package.json`, `web/package-lock.json`
- Create: `web/lib/supabase.ts`, `web/.env.example`

- [ ] **Step 1: Install**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/web
npm install @supabase/supabase-js
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom zod
```

- [ ] **Step 2: Create the Supabase client**

```ts
// web/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev so misconfig is obvious; in prod Vite throws on missing env at build time anyway.
  // eslint-disable-next-line no-console
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url ?? '', anonKey ?? '');
```

- [ ] **Step 3: Document env vars**

```
# web/.env.example
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

- [ ] **Step 4: Add the same vars to `web/.env.local` (do NOT commit) and to the Vercel project env**

Manual step. Get values from `fca-web/src/lib/supabase.js` (or wherever the staff app reads them) and copy. **Do not commit `.env.local`.**

- [ ] **Step 5: Verify dev still builds**

Run: `npm run dev` and confirm the home page loads. Stop the server.

- [ ] **Step 6: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/web
git add package.json package-lock.json lib/supabase.ts .env.example
git commit -m "chore: add supabase-js client and env scaffolding"
```

---

### Task 13: `marketerLookup` and `referralSubmit` libs

**Files:**
- Create: `web/lib/marketerLookup.ts`, `web/lib/referralSubmit.ts`

- [ ] **Step 1: marketerLookup**

```ts
// web/lib/marketerLookup.ts
import { supabase } from './supabase';

export interface ResolvedMarketer {
  id: string;
  name: string;
  organization_id: string;
}

export async function getMarketerBySlug(slug: string): Promise<ResolvedMarketer | null> {
  const { data, error } = await supabase.rpc('get_marketer_by_slug', { p_slug: slug });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('get_marketer_by_slug failed', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
```

- [ ] **Step 2: referralSubmit (handles field translation + submit)**

```ts
// web/lib/referralSubmit.ts
// Translates the existing ReferralFormPage state shape into the Edge Function payload
// (which mirrors the staff app's referrals.notes JSON contract) and posts it.

const SUBMIT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-referral`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SERVICE_LABELS: Record<string, string> = {
  ambulatingTransferring: 'Ambulating/Transferring',
  bathing: 'Bathing',
  dressing: 'Dressing',
  feeding: 'Feeding',
  hygieneGrooming: 'Hygiene/Grooming',
  basicHousekeeping: 'Basic Housekeeping',
  errandAssistance: 'Errand Assistance',
  emergencyResponse: 'Emergency Response/Alert System or Device',
  suppliesRequired: 'Do you require supplies to accommodate your individual needs?',
};

export interface FormState {
  serviceProgramRequested: string;
  referralName: string;
  sex: 'Female' | 'Male' | 'Prefer not to say' | '';
  referralDOB: string;
  gaMedicaidOrSSN: string;
  phone: string;
  caregiverName: string;
  caregiverRelationship: string;
  caregiverPhone: string;
  streetAddress: string;
  aptSuite: string;
  city: string;
  zipCode: string;
  county: string;
  state: string;
  caregiverLivesInHome: 'Yes' | 'No' | '';
  receivesBenefits: 'Yes' | 'No' | '';
  benefitsReceivedOn: '1st' | '3rd' | '';
  physicianNameLocation: string;
  memberDiagnosis: string;
  servicesRequested: Record<keyof typeof SERVICE_LABELS, boolean>;
  hearAboutUs: string;
  otherSource: string;
  additionalInfo: string;
}

export async function submitReferral(slug: string, form: FormState, honeypot: string) {
  const services_needed = (Object.keys(form.servicesRequested) as (keyof typeof SERVICE_LABELS)[])
    .filter((k) => form.servicesRequested[k])
    .map((k) => SERVICE_LABELS[k]);

  const heard =
    form.hearAboutUs === 'Other (specify)' && form.otherSource
      ? `Other: ${form.otherSource}`
      : form.hearAboutUs;

  const payload = {
    slug,
    hp: honeypot, // honeypot — must be empty
    referral_name: form.referralName,
    sex: form.sex,
    referral_dob: form.referralDOB,
    medicaid_or_ssn: form.gaMedicaidOrSSN,
    phone: form.phone,
    caregiver_name: form.caregiverName,
    caregiver_relationship: form.caregiverRelationship,
    caregiver_phone: form.caregiverPhone,
    caregiver_lives_in_home: form.caregiverLivesInHome,
    address_line1: form.streetAddress,
    address_line2: form.aptSuite || undefined,
    city: form.city,
    zip: form.zipCode,
    county: form.county || undefined,
    state: form.state,
    requested_program: form.serviceProgramRequested,
    physician: form.physicianNameLocation,
    diagnosis: form.memberDiagnosis,
    services_needed,
    receives_benefits: form.receivesBenefits,
    benefits_pay_date: form.receivesBenefits === 'Yes' ? form.benefitsReceivedOn : undefined,
    heard_about_us: heard,
    additional_info: form.additionalInfo || undefined,
  };

  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Submission failed (${res.status})`);
  }
  return json as { ok: true; marketer_name: string };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/marketerLookup.ts lib/referralSubmit.ts
git commit -m "feat: add marketerLookup RPC wrapper and referralSubmit translator"
```

---

### Task 14: Rename route `/rf/:employeeSlug` → `/ref/:slug` (with redirect)

**Files:**
- Modify: `web/App.tsx`

- [ ] **Step 1: Edit `App.tsx`**

Replace:
```tsx
          <Route path="/rf" element={<ReferralFormPage />} />
          <Route path="/rf/:employeeSlug" element={<ReferralFormPage />} />
```

With:
```tsx
          <Route path="/ref/:slug" element={<ReferralFormPage />} />
          {/* Backward compat for any printed materials with /rf/<slug> */}
          <Route path="/rf/:slug" element={<RefRedirect />} />
          <Route path="/rf" element={<RefRedirect />} />
```

At the bottom of `App.tsx` before `export default App;`, add:

```tsx
import { Navigate, useParams } from 'react-router-dom';

const RefRedirect: React.FC = () => {
  const { slug } = useParams();
  return <Navigate to={slug ? `/ref/${slug}` : '/'} replace />;
};
```

(Keep the existing `useLocation` import; just add `Navigate, useParams` to it.)

- [ ] **Step 2: Confirm build still works**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(routing): use /ref/:slug for referrals; redirect legacy /rf/* paths"
```

---

### Task 15: Wire `ReferralFormPage` to real marketer lookup + submission

**Files:**
- Modify: `web/components/ReferralFormPage.tsx`

This is the largest single edit. Walk through it carefully.

- [ ] **Step 1: Update imports**

At the top of `ReferralFormPage.tsx` add (and update the existing imports):

```tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Send, ArrowRight, ArrowLeft, CheckCircle2, Building, User, HeartPulse, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { getMarketerBySlug, ResolvedMarketer } from '../lib/marketerLookup';
import { submitReferral } from '../lib/referralSubmit';
```

- [ ] **Step 2: Replace `useParams` and add marketer lookup**

Replace the existing line `const { employeeSlug } = useParams();` and the existing `marketerName` field in `formData` initial state and the corresponding input.

```tsx
  const { slug } = useParams();

  // Marketer resolution
  const [marketer, setMarketer] = useState<ResolvedMarketer | null>(null);
  const [marketerLoading, setMarketerLoading] = useState(true);
  const [marketerNotFound, setMarketerNotFound] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Honeypot — never visible, never touched by humans
  const [hp, setHp] = useState('');

  useEffect(() => {
    if (!slug) {
      setMarketerNotFound(true);
      setMarketerLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const m = await getMarketerBySlug(slug);
      if (cancelled) return;
      if (!m) setMarketerNotFound(true);
      else setMarketer(m);
      setMarketerLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);
```

Remove `marketerName: employeeSlug ? employeeSlug.replace(/-/g, ' ') : ''` from the `formData` initial state (the marketer is now sourced from `marketer`, not the form).

In `renderStep1`, replace the `<InputWrapper label="Marketer Name">…</InputWrapper>` block with a read-only display:

```tsx
            <InputWrapper label="Referred by">
                <div className="w-full h-14 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 flex items-center font-bold text-navy">
                    {marketer?.name ?? '—'}
                </div>
            </InputWrapper>
```

- [ ] **Step 3: Update sex dropdown**

In `renderStep1`, change the `sex` `BaseSelect` options from `['Male', 'Female']` to `['Female', 'Male', 'Prefer not to say']`.

- [ ] **Step 4: Replace `handleSubmit` with real submission**

Replace the existing `handleSubmit`:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !slug || !marketer) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitReferral(slug, formData, hp);
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
```

Update the form `onSubmit` handler to call this on the final step (it already does, just ensure the async signature flows):

```tsx
                            <form onSubmit={(e) => { if (currentStep === 4) handleSubmit(e); else { e.preventDefault(); handleNext(); } }}>
```

- [ ] **Step 5: Add the loading and 404 branches**

Inside the outer container, before the `{isSubmitted ? … : …}` block, add:

```tsx
                    {marketerLoading ? (
                        <div className="text-center py-20 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                            Loading…
                        </div>
                    ) : marketerNotFound ? (
                        <div className="text-center py-20 px-4">
                            <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-8">
                                <AlertTriangle size={48} />
                            </div>
                            <h2 className="text-4xl font-black text-navy mb-4">Referral link not found</h2>
                            <p className="text-xl text-slate-500 max-w-lg mx-auto mb-10">
                                We couldn't find that referral link. Please check the link from your marketer or
                                <Link to="/contact-us" className="text-mint underline ml-1">contact us</Link>.
                            </p>
                        </div>
                    ) : isSubmitted ? (
                        // … existing success block …
                    ) : (
                        // … existing form block …
                    )}
```

(Refactor the existing ternary to add the two leading branches; do not duplicate the form/success blocks.)

- [ ] **Step 6: Add the honeypot field**

Inside the `<form>` tag, near the top (the position is irrelevant since it's hidden), add:

```tsx
                                {/* Honeypot — humans never see this; bots fill every field */}
                                <input
                                    type="text"
                                    name="website_url"
                                    value={hp}
                                    onChange={(e) => setHp(e.target.value)}
                                    tabIndex={-1}
                                    autoComplete="off"
                                    aria-hidden="true"
                                    style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
                                />
```

- [ ] **Step 7: Show submit error inline near the Submit button**

Above the action-buttons div in the final step, conditionally render:

```tsx
                                {submitError && (
                                    <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-medium">
                                        {submitError}
                                    </div>
                                )}
```

And update the submit button to show a spinner when `isSubmitting`:

```tsx
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="px-10 py-4 bg-mint text-navy rounded-full font-black uppercase tracking-[0.2em] text-sm hover:bg-navy hover:text-white transition-all flex items-center gap-3 shadow-lg shadow-mint/30 disabled:opacity-60"
                                        >
                                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                            <span>{isSubmitting ? 'Submitting…' : 'Submit Referral'}</span>
                                        </button>
```

- [ ] **Step 8: Commit**

```bash
git add components/ReferralFormPage.tsx
git commit -m "feat(referral): resolve marketer by slug, real submit, honeypot, loading and 404 states"
```

---

### Task 16: Reconcile `serviceProgramRequested` options with the staff `programs` source

**Files:**
- Modify: `web/components/ReferralFormPage.tsx`

The current options `['CCSP','GAPP','ICWP','SFC','SOURCE','Not Sure']` may not match what the agency actually offers. The staff form pulls from a `programs` table (PSS, PCA, Companion Care, Respite Care).

- [ ] **Step 1: Confirm with user which list is correct**

This is a **decision point**, not a code change. Before continuing, ask the user:

> "The website form currently lists `CCSP, GAPP, ICWP, SFC, SOURCE, Not Sure` as Service/Program options, but the staff app pulls from a `programs` table that lists `PSS, PCA, Companion Care, Respite Care`. Which list is correct for the public form? Or should I fetch the live list from the `programs` table at page load?"

- [ ] **Step 2: Apply the chosen option**

If the user says "use the programs table": add a fetch in `ReferralFormPage.tsx` that calls `supabase.from('programs').select('name').order('name')` and renders those as options. (Requires anon SELECT on `programs`; verify or add an RLS policy.)

If the user says "use a hardcoded list": replace the array literal in the `BaseSelect` with the agreed list.

- [ ] **Step 3: Commit**

```bash
git add components/ReferralFormPage.tsx
git commit -m "feat(referral): align program options with agency offerings"
```

---

### Task 17: Vercel SPA fallback (so direct visits to `/ref/:slug` work)

**Files:**
- Modify: `web/vercel.json`

- [ ] **Step 1: Inspect current vercel.json**

```bash
cat /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/web/vercel.json
```

- [ ] **Step 2: Ensure SPA fallback exists**

If the file does not contain a `rewrites` block routing all paths to `index.html`, add one. Example final shape (merge with whatever's already there):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

If it already has rewrites that achieve the same, leave it alone.

- [ ] **Step 3: Commit (if changed)**

```bash
git add vercel.json
git commit -m "chore(vercel): ensure SPA fallback so /ref/:slug works on direct visits"
```

---

### Task 18: End-to-end manual test

**Files:** none

- [ ] **Step 1: Pick a real marketer slug**

```sql
SELECT name, referral_slug FROM marketers WHERE is_active = true LIMIT 5;
```

Pick one (e.g. `jane`).

- [ ] **Step 2: Run the customer site**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/web
npm run dev
```

- [ ] **Step 3: Visit `http://localhost:5173/ref/jane`**

Verify:
- The page resolves and shows "Referred by **<Marketer's real name>**"
- Step 1 progress indicator is highlighted
- All 4 steps render with the correct fields and styling
- Phone and SSN auto-format as you type
- "Receives benefits" `Yes` reveals the 1st/3rd radios
- "Other (specify)" reveals the otherSource input
- Required-field validation prevents Next/Submit with empty required fields

- [ ] **Step 4: Visit `http://localhost:5173/ref/does-not-exist`**

Verify: 404-style "Referral link not found" page renders.

- [ ] **Step 5: Visit `http://localhost:5173/rf/jane`**

Verify: redirects to `/ref/jane`.

- [ ] **Step 6: Submit a real test referral**

Fill out a complete valid form and submit. Verify:
- Spinner shows on Submit button
- Success page renders with "Submission Successful!"
- A new row exists in `referrals` (check via SQL):

```sql
SELECT id, referred_by, referral_source, notes, created_at
FROM referrals
ORDER BY created_at DESC
LIMIT 1;
```

The `notes` JSON should contain `marketer_id`, `marketer_name`, `marketer_email`, all the form fields, and `submission_source: 'public_website'`.

- [ ] **Step 7: Verify it appears in the staff app's Prospects view**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npm run dev
```

Open the Prospects page in the staff app. The new referral should appear, attributed to the correct marketer.

- [ ] **Step 8: Test alias path — change the marketer's slug, then re-visit the old URL**

In the staff app, go to Profile, change the slug from `jane` → `jane-2`, save. Then visit `http://localhost:5173/ref/jane` — verify it still resolves (alias). Then visit `http://localhost:5173/ref/jane-2` — verify it resolves to the same marketer.

- [ ] **Step 9: Test honeypot**

Open dev tools, find the hidden `website_url` input, type `bot` into it, submit. Verify: the success page renders (we lie to bots), but **no row** appears in `referrals`.

- [ ] **Step 10: Test rate limit**

Submit 6 valid referrals back-to-back from the same browser/IP. The 6th should display the "Too many submissions" error.

- [ ] **Step 11: Stop both dev servers, no commit needed for manual tests**

---

### Task 19: Clean up & open a PR

**Files:** none

- [ ] **Step 1: Make sure all work is committed**

Run: `git status` in both repos. Commit any stragglers.

- [ ] **Step 2: Push the branch**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git push -u origin feat/marketer-slugs-and-public-referral
```

(Same for the `web/` repo if it has its own remote.)

- [ ] **Step 3: Open PR**

Use `gh pr create` with a summary covering:
- Marketer slugs (column, aliases, reserved table, validation)
- `get_marketer_by_slug` RPC + `submit-referral` Edge Function
- Profile UI: SlugInput, QrCodePreview, ReferralLinkSection
- Customer site: route rename, marketer lookup, honeypot, rate limit, real submission

Include a manual test checklist mirroring Task 18.

**IMPORTANT:** Do not include any `Co-Authored-By: Claude` trailer or any reference to Claude/Anthropic in the commit messages or PR body.

---

## Self-Review Checklist (run before declaring plan complete)

- ✅ Spec coverage: every requirement from the conversation is mapped to a task
  - Slug field on marketer profile → Task 8/10/11
  - Auto-suggest from first name → Task 10 (initial state)
  - QR generation + download → Task 9
  - Old QRs keep working → Task 1 (alias trigger) + Task 18 (verified)
  - Reserved slugs → Task 1 + Task 5
  - 404 on bad slug → Task 4 (RPC) + Task 15 (UI) + Task 18 (verified)
  - Honeypot + simple rate limit → Task 4 (function) + Task 15 (UI) + Task 18 (verified)
  - Multi-step form (3–4 steps) → already in place; preserved through Task 15
  - Brand-aligned aesthetics → already in place; preserved
  - Marketer attached for commission → Task 4 (server-side resolved by slug; never trusts client)
  - JSON-in-`notes` shape parity with staff form → Task 4 + Task 13
  - Submission lands in Prospects → Task 18 verifies
- ✅ No placeholders or "TBD"
- ✅ Type/name consistency: `referral_slug` (DB column) vs `slug` (RPC param + URL param) — intentional and consistent
- ✅ All file paths absolute and correct
- ✅ Commit messages free of Claude/Anthropic references

---

## Out of scope (explicitly deferred)

- Photo of marketer on the public form (current plan shows name only)
- A "house referrals" path (no marketer) — by user direction, bad slugs always 404
- Persistent rate-limit table (current is in-memory, fine for low volume; revisit if abuse appears)
- Email notification to the marketer when a referral submits (future enhancement)
- Analytics / click-through tracking on `/ref/:slug` visits (future)
- Splitting this plan into separate Phase-1 / Phase-2 / Phase-3 PRs (could be done if the user wants to ship in stages — current plan ships as one branch)
