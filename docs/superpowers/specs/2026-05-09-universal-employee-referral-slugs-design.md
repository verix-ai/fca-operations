# Universal Employee Referral Slugs — Design

**Date:** 2026-05-09
**Status:** Approved (design phase)
**Author:** jalexander

## Problem

Today, only users with `role = 'marketer'` get a unique referral URL slug and matching QR code (e.g., `friendlycareagency.org/ref/sarah`). Admins do not. Future office-staff roles (schedulers, billers, nurses, directors, etc.) won't either, unless we hard-code them one at a time.

We want every office-staff employee — admins, marketers, and any future office role — to automatically get their own slug + QR code, with the existing public referral form working identically regardless of who owns the slug. Field roles (caregivers) explicitly do **not** get slugs.

Critically: every existing marketer slug and historical alias must continue to resolve. Printed business cards and saved QR codes cannot break.

## Scope

### In scope
- Move the slug + alias system from `marketers` to `users`.
- Auto-assign slugs to every new user whose role is in an "office role" allowlist (`admin`, `marketer` initially).
- Backfill existing admins (and any other current office user) with a slug during migration.
- Generalize the public referral RPC and the `submit-referral` edge function to attribute by user, not marketer.
- Expand the Profile page's "Referral Link" section to render for every office user, not just marketers.
- Generalize the admin Settings "Referral Links" page to list every office user with a slug.

### Out of scope
- Slugs for caregiver/field roles.
- Changes to the `referrals` table schema (the row shape stays identical; only the JSON-in-`notes` payload gains generic `referrer_*` keys).
- Changes to the marketer-specific UX (My Clients view, marketer-only filtering, marketer dashboards) — none of this is touched.
- New referral analytics or reporting features.
- Email/SMS notification changes.

## Architecture

### Data model

**On `users`:**
- New column `referral_slug citext`, **nullable**.
- Format CHECK identical to today: `^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$` (2–30 chars, lowercase alphanum + hyphens, no leading/trailing hyphen).
- Partial unique index where `referral_slug IS NOT NULL`.
- Stays nullable forever — field roles (caregivers, etc.) deliberately don't have slugs. Auto-assign trigger guarantees office users always get one.

**New table `user_slug_aliases`:** generic counterpart of today's `marketer_slug_aliases`.
- `slug citext PRIMARY KEY`
- `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `created_at timestamptz NOT NULL DEFAULT now()`
- Same format CHECK as `users.referral_slug`.
- Same RLS pattern as today (org-scoped read for diagnostics; no public read).

**Reused as-is:**
- `reserved_slugs` table and its full word list (admin, api, ref, marketer, caregiver, etc.).
- The reserved-word, cross-table-uniqueness, and archive-on-rename trigger _logic_ — only the table targets change.

**New helper:**
```sql
CREATE FUNCTION public.is_office_role(p_role text) RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$ SELECT p_role IN ('admin', 'marketer') $$;
```
Single source of truth for the office-role allowlist. New office roles are added by editing this function.

### Trigger flow

| Trigger | Table | Timing | Purpose |
|---------|-------|--------|---------|
| `tg_assign_user_slug_on_insert` | users | BEFORE INSERT | If `is_office_role(NEW.role)`, generate a unique slug from first name with `-N` collision suffix. Sets `NEW.referral_slug`. |
| `tg_block_reserved_slug_users` | users | BEFORE INSERT/UPDATE OF referral_slug | Reject if slug is in `reserved_slugs`. |
| `tg_enforce_user_slug_cross_unique` | users | BEFORE INSERT/UPDATE OF referral_slug | Reject if slug exists as another user's alias. |
| `tg_archive_user_slug` | users | AFTER UPDATE OF referral_slug | Push old slug into `user_slug_aliases`. |
| Mirror reserved + cross-unique triggers | user_slug_aliases | BEFORE INSERT/UPDATE OF slug | Same logic, reverse direction. |

`auto_create_marketer_record` is updated to no longer touch slugs. It still runs on `role = 'marketer'` to create the `marketers` row, but the slug for that user is already assigned by the user-level trigger that ran first.

### Public RPC

`get_marketer_by_slug(citext)` is replaced with a thin backwards-compat shim that delegates to the new `get_user_by_slug`. (The public landing page that calls it lives in a separate external website; the shim prevents downtime there at deploy time and is removed in a future migration once that caller has been updated.) The new function:

```sql
CREATE FUNCTION public.get_user_by_slug(p_slug citext)
RETURNS TABLE (id uuid, name text, organization_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.name, u.organization_id
  FROM public.users u
  WHERE u.is_active = true
    AND public.is_office_role(u.role)
    AND (
      u.referral_slug = p_slug
      OR u.id = (SELECT a.user_id FROM public.user_slug_aliases a WHERE a.slug = p_slug)
    )
  LIMIT 1;
$$;
```

Granted to `anon, authenticated`. Direct `SELECT` on `users` from anon stays revoked; this RPC is the only public path to a slug → user resolution.

## Components Affected

### Database
- New migration file `<DATE>_universal_employee_referral_slugs.sql` (single-transaction).
- Updated `auto_create_marketer_record()` (removes its slug-generation logic).

### Edge function — `submit-referral/index.ts`
- Slug resolution switches from `marketers` (+ `marketer_slug_aliases`) to `users` (+ `user_slug_aliases`).
- Active-and-office-role gate matches the RPC.
- `referrals` row insert keeps its existing column shape (`organization_id`, `client_id: null`, `referred_by`, `referral_date`, `referral_source`, `notes`).
- `notes` JSON gains generic keys: `referrer_user_id`, `referrer_name`, `referrer_email`, `referrer_role`. For backward compatibility with any dashboards/reports that read marketer-specific keys, we **also** populate `marketer_id`, `marketer_name`, `marketer_email` when the resolved user is a marketer.

### Frontend
- `src/Pages/Profile.jsx` — drop the `user?.role === 'marketer'` gate around `<ReferralLinkSection />`. Render whenever `is_office_role(user?.role)` is true (a small client-side helper mirroring the SQL function).
- `src/components/profile/ReferralLinkSection.jsx` — replace `Marketer.getMine()` and `Marketer.updateSlug()` with new `User` entity methods (`User.getMySlug()`, `User.updateMySlug(slug)`). Component logic is otherwise unchanged.
- `src/components/profile/SlugInput.jsx`, `QrCodePreview.jsx` — accept a `userId` prop instead of `marketerId`; the API surface beyond that is unchanged.
- `src/entities/User.supabase.js` — add `getMySlug()` and `updateMySlug(slug)`.
- `src/entities/Marketer.supabase.js` — remove slug-related methods. `Marketer.getMine()` and any non-slug functionality stays.
- `src/components/settings/ReferralLinksSection.jsx` (admin Settings) — list every office user (not only marketers), grouped by role. Per-row QR download and bulk ZIP-all behavior unchanged.
- `src/Pages/ReferralProfile.jsx` is the staff-facing edit page, NOT the public landing. The actual public `/ref/<slug>` landing page lives in a separate external site outside this repo and is not modified by this change — the backwards-compat shim ensures it keeps working.

### Reserved-slug list
No changes required.

### Marketer-specific behavior (intentionally untouched)
- `marketers` table itself, all FK relationships, all marketer-specific RLS.
- "My Clients" filtering and marketer-only read-only fields on Client/Caregiver detail pages.
- Marketer dashboard, sidebar nav rules, role-gated routes.

## Data Flow

### Office user signup
`auth.users` insert → `handle_new_user` inserts into `public.users` → `tg_assign_user_slug_on_insert` (BEFORE) generates slug for office roles → if `role = 'marketer'`, `auto_create_marketer_record` (AFTER) creates the `marketers` row, no slug logic.

### User renames slug
`UPDATE users SET referral_slug = $new` → reserved + cross-unique BEFORE triggers validate → `tg_archive_user_slug` AFTER triggers writes the OLD slug to `user_slug_aliases`.

### Public referral submission
`/ref/<slug>` page calls `get_user_by_slug` for display → user submits form → POST `submit-referral` edge function → service-role client resolves slug → user (active + office-role only) → INSERTs into `referrals` with the resolved user's identity in both the row and the JSON `notes` payload.

### Existing customer scans an old printed QR code
Slug not found in `users.referral_slug` → falls back to `user_slug_aliases` (carried over from `marketer_slug_aliases` during migration) → resolves to same user → submission proceeds normally.

## Migration Plan

Single transaction. Order is load-bearing.

**Step 0 — Pre-flight:** assert `marketers.referral_slug` has zero NULLs.

**Step 1 — Create new structures (no data movement):**
- `ALTER TABLE users ADD COLUMN referral_slug citext` (nullable) with format CHECK.
- Partial unique index on `users.referral_slug WHERE referral_slug IS NOT NULL`.
- `CREATE TABLE user_slug_aliases` with format CHECK and FK.
- `CREATE FUNCTION is_office_role(text)`.
- Create the four user-level trigger functions (`tg_block_reserved_slug_users`, `tg_enforce_user_slug_cross_unique`, `tg_archive_user_slug`, `tg_assign_user_slug_on_insert`).

**Step 2 — Copy existing data:**
- `UPDATE users u SET referral_slug = m.referral_slug FROM marketers m WHERE u.id = m.user_id`.
- `INSERT INTO user_slug_aliases (slug, user_id, created_at) SELECT a.slug, m.user_id, a.created_at FROM marketer_slug_aliases a JOIN marketers m ON m.id = a.marketer_id`.
- Assert (run BEFORE Step 3): `(SELECT COUNT(*) FROM marketers WHERE referral_slug IS NOT NULL) = (SELECT COUNT(*) FROM users WHERE referral_slug IS NOT NULL)`. Step 3 will then add slugs for non-marketer office users, so this equality only holds at this exact point in the migration.
- Assert: `(SELECT COUNT(*) FROM marketer_slug_aliases) = (SELECT COUNT(*) FROM user_slug_aliases)`.

**Step 3 — Backfill office users without slugs (admins, mostly):**
- For each `users` row where `is_office_role(role)` AND `referral_slug IS NULL`, run the same first-name + collision-suffix algorithm used in the original 20260507 backfill.

**Step 4 — Hook up triggers to new structures:**
- `BEFORE INSERT OR UPDATE OF referral_slug ON users` → reserved + cross-unique.
- `AFTER UPDATE OF referral_slug ON users` → archive.
- `BEFORE INSERT ON users` → assign-slug-on-insert.
- Mirror reserved + cross-unique triggers on `user_slug_aliases`.

**Step 5 — Drop old structures:**
- Drop marketer-side slug triggers and trigger functions.
- Drop `marketer_slug_aliases` table.
- Drop `marketers.referral_slug` column.
- Replace `auto_create_marketer_record()` with the slugless version.

**Step 6 — Public RPC (new + backwards-compat shim):**
- Create `get_user_by_slug` per the architecture section. Grant to `anon, authenticated`.
- Replace `get_marketer_by_slug` with a thin shim that delegates to `get_user_by_slug` (same return shape). The public `/ref/<slug>` landing page lives in a separate external site (the public friendlycareagency.org marketing site, not `fca-web`); keeping the shim avoids breaking that site at deploy time. The shim is removed in a follow-up migration once the external site has been updated to call the new name.

**Step 7 — Lock down:** keep `users.referral_slug` nullable. Done.

`COMMIT;`

### Same-release deploys
Bundled in the same PR/release as the SQL migration:
- Updated `submit-referral` edge function.
- Frontend changes (Profile gate, entity refactor, admin Settings page, public landing RPC name).

### Rollback strategy
- SQL failure during migration → entire transaction rolls back; original schema intact.
- Runtime issue post-deploy → revert edge function and frontend; database stays on new schema (the dropped column cannot be trivially restored). Mitigations: full test pass on a Supabase branch first, manual smoke test on staging before production.

### Risk summary
- Data preservation: low — copy is a simple JOIN, asserted by row counts.
- Schema invariant: low — single transaction.
- Live-traffic risk: very low — public form is the only external surface, served by an edge function deployed in the same release.

## Testing Approach

### Pre-merge — Supabase branch + Vitest

**Migration tests** (against a branch with seed data covering: marketers with current slugs, marketers with renames + aliases, max-length slug, hyphenated slug, admins without slugs):
- Every pre-existing marketer's `users.referral_slug` matches their previous `marketers.referral_slug`.
- Every pre-existing alias row exists in `user_slug_aliases` with translated `user_id`.
- Every admin now has a unique, format-valid slug.
- `marketers.referral_slug` and `marketer_slug_aliases` no longer exist.
- `get_user_by_slug` is callable as `anon`. `get_marketer_by_slug` still callable as a shim that returns the same rows as `get_user_by_slug`.

**Trigger tests:**
- Insert a new admin → slug auto-generated.
- Insert a new marketer → slug auto-generated AND `marketers` row created.
- Insert a new caregiver-role user (when role exists) → `referral_slug` stays NULL.
- UPDATE slug → old slug archived in `user_slug_aliases`.
- Set slug to reserved word → rejected.
- Set slug to another user's current or aliased slug → rejected.

**RPC + edge function tests:**
- `get_user_by_slug` with current slug → resolves.
- With aliased slug → resolves to same user.
- With inactive user's slug → empty.
- With caregiver-role user's slug (if any) → empty.
- Submit referral via admin's slug → row inserted, `notes.referrer_role = 'admin'`.
- Submit via marketer's slug → today's behavior + new generic keys, plus backward-compat `marketer_*` keys.
- Submit via aliased slug → resolves correctly.

**Frontend tests:**
- Existing `slug.test.js` re-runs unchanged.
- New `User` entity slug method tests.
- `ReferralLinkSection` renders for an admin user.

### Post-merge — manual smoke on staging before prod
1. Existing marketer login → same slug, QR resolves, public submission works.
2. Old printed QR (renamed marketer) → still resolves via alias.
3. Admin login → new Referral Link section shows auto-generated slug; rename → save; old slug becomes alias.
4. Public submission via admin's slug → referral appears in admin's list, attributed to admin.
5. Admin Settings → Referral Links → all office users listed; QR download + bulk ZIP work.
6. New admin invite → first login shows slug already populated.

### Explicitly NOT testing (no behavior change)
- Marketer permissions, "My Clients" view, marketer dashboards.
- Caregiver/Client/Referral CRUD flows.
- Auth, RLS on existing tables.

## Open Questions
None at design time. Migration assertions and the same-release edge-function deploy together cover the "zero broken slugs" guarantee.
