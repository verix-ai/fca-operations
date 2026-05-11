# Prospects — Call Center Log Redesign

**Date:** 2026-05-11
**Status:** Approved design, ready for implementation plan
**Source:** Requirements from FCA meeting

## Goal

Convert the Prospects page from a passive "who did we refer" list into the operational call center log for FCA. Operators receive inbound/outbound calls about prospective clients, capture workflow state (assessment status, state approval, CM company contact status), log every action in an immutable audit timeline, and archive prospects who are passed to other home care companies (HCCs) so the history is preserved for future reference.

## Scope

Touches:

- `fca-web/src/Pages/Prospects.jsx` — main list page
- `fca-web/src/Pages/ReferralProfile.jsx` — unchanged (continues to show original referral form submission)
- `fca-web/src/entities/Referral.supabase.js` — schema + new methods
- New: `fca-web/src/components/prospects/ActivityModal.jsx` — call center workspace
- New: `fca-web/src/components/prospects/ArchiveModal.jsx` — confirmation w/ reason
- New: `fca-web/src/components/prospects/MobileFiltersSheet.jsx` — mobile filter drawer
- New: `fca-web/src/entities/ReferralHistory.supabase.js` — entity for the new history table
- New Supabase migration: add columns to `referrals`, backfill from JSON blob, create `referral_status_history` table with RLS

Out of scope:

- Changes to the `clients` table or the intake flow. None of the new workflow fields (code, home_care_company, cm_call_status, assessment_complete, waiting_state_approval, archive_*) propagate to client records on intake conversion.
- Changes to the referral submission form / lead form.
- Removing the legacy JSON-blob `notes` column. The migration backfills from it but does not drop it (too risky on existing data).

## Database changes

### `referrals` table — add columns

| Column | Type | Default | Notes |
|---|---|---|---|
| `cm_company` | text | null | Migrated from JSON blob |
| `marketer_id` | uuid | null | Migrated from JSON blob; FK to `marketers.id` when present |
| `marketer_name` | text | null | Migrated from JSON blob |
| `marketer_email` | text | null | Migrated from JSON blob |
| `code` | text | null | One of: `301`, `303`, `660`, `661`, `Other`, `None Found` |
| `home_care_company` | text | `'FCA'` | One of: `FCA`, `Genesis`, `Gateway`, `Alice Place`, `Affordable` |
| `cm_call_status` | text | null | One of: `awaiting`, `need_resend`, `contacted`. Set to `awaiting` when a CM company is assigned. |
| `assessment_complete` | boolean | `false` | |
| `waiting_state_approval` | boolean | `false` | |
| `archived_at` | timestamptz | null | null = active |
| `archived_by` | uuid | null | FK to `users.id` |
| `archive_reason` | text | null | One of: `passed_to_hcc`, `not_eligible`, `lost_contact`, `duplicate`, `other` |
| `archive_note` | text | null | Optional free text supplied at archive time |

Add indexes:

- `idx_referrals_archived_at` on `archived_at` (for tab filtering)
- `idx_referrals_cm_company` on `cm_company`
- `idx_referrals_home_care_company` on `home_care_company`
- `idx_referrals_created_at` on `created_at` (if not already present, for date range filter)

**Migration order:**

1. `ALTER TABLE` to add the new columns with defaults.
2. Backfill from existing JSON: parse `notes`, extract `cm_company`, `marketer_id`, `marketer_name`, `marketer_email`, write into the new columns.
3. Create indexes.
4. Leave the `notes` column in place. New writes go to real columns. `Referral.list/get` still falls through to JSON parsing for any field not present as a real column (forward-compatible).

### New table — `referral_status_history`

Mirrors `lead_status_history`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `referral_id` | uuid | FK to `referrals.id` ON DELETE CASCADE |
| `organization_id` | uuid | FK, RLS scope |
| `event_type` | text | `note`, `field_change`, `archive`, `unarchive` |
| `field_name` | text | nullable; populated for `field_change` |
| `old_value` | text | nullable |
| `new_value` | text | nullable |
| `note` | text | nullable; populated for `note`, `archive` |
| `changed_by` | uuid | FK to `users.id` |
| `changed_by_name` | text | denormalized for display |
| `changed_at` | timestamptz | default `now()` |

RLS: same policies as `lead_status_history` — authenticated users in the same organization can read; writes only allowed via the entity layer (no client-side updates/deletes; rows are immutable).

## Page structure

### Tabs

At the top of the Prospects page, mirroring Leads:

- **Active** (default) — `archived_at IS NULL`
- **Archive** — `archived_at IS NOT NULL`

Both tabs share filters and columns. Inline editing is disabled in Archive (rows are read-only).

### Filters (responsive hybrid)

Six filters total:

1. Search (text)
2. Marketer (dropdown, derived from data)
3. County (dropdown, derived from data)
4. CM Company (dropdown, from `cm_companies`)
5. Home Care Company (dropdown, fixed enum)
6. Date Range (filters on `created_at`)

**Desktop (≥md):** all six visible. Two rows of three.

**Mobile (<md):** Search bar visible always; single `Filters · N` button next to it (badge shows count of active filters), opens a bottom sheet containing the other five. Bottom sheet has a `Clear all` link.

### Columns (table view, desktop)

| # | Column | Source | Editable inline? |
|---|---|---|---|
| 1 | Client Name *(label only — DB column stays `referral_name`)* | `referral_name` | no |
| 2 | Caregiver | `caregiver_name` (JSON for now) | no |
| 3 | Phone | `phone` (JSON for now) | no |
| 4 | County | `county` (JSON for now) | no |
| 5 | Program | `requested_program` (JSON for now) | no |
| 6 | **Code** *(new)* | `code` | yes — dropdown |
| 7 | **Home Care Company** *(new)* | `home_care_company` | yes — dropdown |
| 8 | CM Company | `cm_company` | yes — dropdown; primary phone shown beneath |
| 9 | Submitted | `created_at` | no |
| 10 | Actions | — | — |

Inline dropdowns write optimistically and update via `Referral.update`, which auto-emits `field_change` entries to `referral_status_history`.

In the **Archive tab**, columns 6/7/8 render as plain text (read-only).

**Mobile card view:** existing card layout, extended to show Code, Home Care Company, and the CM Company contact number beneath the CM Company dropdown. Card actions match desktop actions.

### Actions column

Active tab buttons:

- `Start Intake` (existing, non-marketers only) — `/ClientIntake?ref=:id`
- `Open Profile` (existing) — `/prospects/:id` — original referral submission data
- `Activity` *(new)* — opens the Activity modal
- `Archive` *(new)* — opens the Archive confirmation modal

Archive tab buttons:

- `Open Profile`
- `Activity` (read-only contents)
- `Unarchive`

## Activity modal

The call center workspace. Opens centered over the list as an overlay — the underlying list preserves its scroll position, pagination, and filter state.

**Sizing:**

- Desktop: centered modal, ~640px wide, max-height with internal scroll on the timeline.
- Mobile: full-screen sheet.

**Contents (top to bottom):**

1. Title bar: prospect's name + close button (`X`).
2. **Workflow controls** (live inputs):
   - "Did you receive a call from the CM company?" — dropdown:
     - `Awaiting CM company contact` (default after CM company assigned)
     - `No call yet — need to resend referral`
     - `CM company has contacted client`
   - "Have you had your assessment?" — checkbox.
   - "Waiting on State Approval" — checkbox.
   - Each change writes immediately, emits a `field_change` event into the timeline.
3. Divider.
4. **Add a Note** textarea + `Add Note` button (pinned, doesn't scroll).
5. **Notes timeline** — chronological list, newest first, of every entry (manual notes + system events mixed). Immutable. Each entry shows author, timestamp, and content.

In the **Archive tab**, workflow controls are disabled; `Add Note` is disabled; timeline is read-only.

## Notes timeline & auto-logged events

Manual note display:

> "Called back, line was busy. Will try tomorrow."
> — Jane Smith · May 11, 2026 2:14 PM

System event display:

> *Code changed from None Found → 303*
> — Jane Smith · May 11, 2026 2:16 PM

Events captured:

| Trigger | Logged as |
|---|---|
| `code` changed | `Code changed from <old> → <new>` |
| `home_care_company` changed | `Home Care Company changed from <old> → <new>` |
| `cm_company` changed | `CM Company changed from <old> → <new>` |
| `cm_call_status` changed | `CM call status changed from <old> → <new>` |
| `assessment_complete` toggled to true | `Assessment marked complete` |
| `assessment_complete` toggled to false | `Assessment unmarked` |
| `waiting_state_approval` toggled to true | `Marked waiting on state approval` |
| `waiting_state_approval` toggled to false | `No longer waiting on state approval` |
| Archived | `Archived — Reason: <reason label>. Note: "<note>"` |
| Unarchived | `Unarchived` |

**Implementation:** `Referral.update()` diffs incoming changes against the existing record before write, then writes `field_change` rows (one per changed field) to `referral_status_history`. Manual notes use a dedicated `Referral.addNote(id, text)` method. Archive/unarchive use dedicated methods that write their event row inline with the state change.

## Archive flow

### Archiving

1. User clicks `Archive` on a row (or inside the Activity modal). Available in the Active tab only.
2. Archive confirmation modal opens:
   - Title: *"Archive [Client Name]?"*
   - **Required:** Reason dropdown — `Passed to another home care company` / `Not eligible` / `Lost contact` / `Duplicate` / `Other`.
   - **Optional:** Additional note textarea.
   - Buttons: `Cancel` / `Archive`.
3. On confirm:
   - Set `archived_at = now()`, `archived_by = user.id`, `archive_reason`, `archive_note`.
   - Write an `archive` event to `referral_status_history` with the reason label and note inlined.
   - Close modal. Row disappears from Active tab. Toast: *"Prospect archived."*

### Unarchiving

1. User clicks `Unarchive` in the Archive tab.
2. Simple confirmation modal — no reason required.
3. On confirm:
   - Set `archived_at = null`, `archived_by = null`.
   - Keep `archive_reason` and `archive_note` on the record (historical).
   - Write an `unarchive` event to `referral_status_history`.
   - Row moves back to Active tab. Toast: *"Prospect restored."*

### Permissions

Everyone with prospect access (all current roles that see the Prospects page) can archive and unarchive.

## CM Company contact number popup

- Shown directly under the CM Company dropdown on both desktop (under the inline cell) and mobile (under the card dropdown).
- Source: `cm_company_contacts` joined on the selected `cm_company` (matched by name → company id).
- "Primary" = first contact for that company (ordered by `created_at` ascending). No `is_primary` flag is being added in this work.
- Format: small line — `📞 (555) 123-4567` rendered as a tappable `tel:` link.
- If no contact exists for that CM company: render nothing.
- Updates live when the CM company selection changes.

## Defaults for new prospect rows

- `code` — null (UI shows `-- Select --`)
- `home_care_company` — `FCA` (set on insert by the lead form's create flow)
- `cm_call_status` — null until a CM company is assigned; flips to `awaiting` when one is assigned
- `assessment_complete` — `false`
- `waiting_state_approval` — `false`
- `archived_at` — null

## UI label change

In the front-facing UI on the Prospects page (and Activity modal), the column header and any visible label currently reading **"Referral Name"** changes to **"Client Name"**. The DB column `referral_name` is unchanged. Affected spots:

- Desktop table header
- Mobile card heading label (none today, but verify)
- Activity modal title bar uses the same value

The page header ("Prospects") and the eyebrow ("Referrals") stay as-is — those refer to the bucket, not the person.

## Component breakdown

| Component | Purpose | Notes |
|---|---|---|
| `Pages/Prospects.jsx` | Top-level page; tabs, filters, table | Refactor for new state shape |
| `components/prospects/FiltersBar.jsx` | Desktop filter row(s) | Pulled out for clarity |
| `components/prospects/MobileFiltersSheet.jsx` | Mobile bottom sheet | Reuses existing sheet primitive if present, else `Dialog` |
| `components/prospects/ProspectsTable.jsx` | Desktop table | Pulled out for clarity; receives `mode: 'active' \| 'archived'` |
| `components/prospects/ProspectsCards.jsx` | Mobile card list | Same mode prop |
| `components/prospects/ActivityModal.jsx` | Call center workspace | Workflow controls + timeline + add note |
| `components/prospects/ArchiveModal.jsx` | Archive confirmation | Reason dropdown + optional note |
| `components/prospects/CmCompanyCell.jsx` | Reusable cell with dropdown + phone | Used by both table and card |
| `entities/Referral.supabase.js` | Add `update` diffing, `addNote`, `archive`, `unarchive` | Existing surface preserved |
| `entities/ReferralHistory.supabase.js` | New — `list(referralId)`, internal write helpers | Mirrors `Lead.supabase.js` history methods |

## Error handling

- Inline dropdown edit fails → revert local state, toast: *"Could not save change."*
- Add note fails → keep textarea content, toast.
- Archive fails → keep modal open, toast.
- Activity modal load fails → show inline error inside the modal, keep modal open.

## Testing

Boundaries to cover:

- Migration: backfill correctness for `cm_company`, `marketer_*` from JSON.
- `Referral.update` diff logic: only changed fields produce history events.
- Archive: cannot archive an already-archived row; cannot unarchive an active row.
- Tab filtering: archived rows never appear in Active, and vice versa.
- Permissions: archive/unarchive available to all current roles with prospect access.
- CM Company contact lookup: gracefully renders nothing when no contact exists.
- Date range filter uses `created_at` and inclusive bounds.

## Open items deferred to implementation plan

- Exact migration SQL (column adds, backfill query, index DDL, RLS for new table).
- Whether to extract a generic `RecordHistory` component shared between Leads and Prospects, or duplicate the existing one. Default: duplicate now, extract later if a third surface appears.
