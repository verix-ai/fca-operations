# Prospects — "Referral sent" checkbox + green row tint

**Date:** 2026-05-12
**Status:** Approved design, ready for implementation plan
**Source:** Follow-up request after initial Prospects Call Center go-live (2026-05-11).

## Goal

Add a 4th workflow checkbox in the Activity modal — "Referral sent" — and tint the prospect's row green wherever it appears once that flag is true. Mirrors the green-row pattern Leads already uses for `signed_up`.

## Scope

Touches:

- `supabase/migrations/` — one new migration adding `referrals.referral_sent`.
- `fca-web/src/lib/referral-diff.js` — add `'referral_sent'` to `TRACKED_FIELDS`.
- `fca-web/src/lib/prospects-labels.js` — add bespoke boolean phrasing in `fieldChangeLabel`.
- `fca-web/src/entities/Referral.supabase.js` — add `'referral_sent'` to the `REAL_COLUMNS` set inside `update()`.
- `fca-web/src/components/prospects/ActivityModal.jsx` — add the 4th checkbox.
- `fca-web/src/components/prospects/ProspectsTable.jsx` — green tint on `<TableRow>` when `referral_sent`.
- `fca-web/src/components/prospects/ProspectsCards.jsx` — green tint on the card root when `referral_sent`.

Out of scope:

- No filter for "referral sent" status.
- No archive interaction; `referral_sent` value is preserved across archive/unarchive.

## Database change

New column on `referrals`:

| Column | Type | Default | Notes |
|---|---|---|---|
| `referral_sent` | boolean | `false` (NOT NULL) | Set true once the referral has been sent to the CM company / HCC. Auto-logged to `referral_status_history` via `Referral.update` diff path. |

No index needed (low cardinality; never used as a server-side filter).

Migration applies cleanly via `ADD COLUMN IF NOT EXISTS`.

## UI changes

### Activity modal — new checkbox

Placed at the bottom of the workflow controls section, after "Waiting on State Approval":

```
Have you had your assessment?         [✓]
Waiting on State Approval             [ ]
Referral sent                          [ ]
```

Same `applyField('referral_sent', checked)` wiring as the other two. Disabled in `readOnly` mode (Archive tab). No icon, no tooltip, no required-asterisk treatment.

### Row tint

When `r.referral_sent === true`, append `bg-emerald-500/[0.08]` to:

- `<TableRow>` in `ProspectsTable.jsx`
- The per-card `<div>` root in `ProspectsCards.jsx`

This applies on **both** Active and Archive tabs (visual state, not a tab indicator). Matches the Leads `signed_up` row tint exactly.

## History timeline

The change is auto-logged via the existing `field_change` mechanism. Phrasing comes from `fieldChangeLabel`:

- `referral_sent: false → true` → **"Referral marked sent"**
- `referral_sent: true → false` → **"Referral marked not sent"**

Follows the existing pattern used by `assessment_complete` and `waiting_state_approval`.

## Entity layer

Add `'referral_sent'` to two places in `Referral.supabase.js` `update()`:

1. The `REAL_COLUMNS` set (so writes go to the real column, not the JSON blob).
2. Indirectly via `TRACKED_FIELDS` import (so diff logging picks it up).

`Referral.archive` / `unarchive` are untouched — `referral_sent` is preserved across both transitions (historical state).

## Defaults

New rows: `false`. Existing rows: `false` (column NOT NULL DEFAULT FALSE during migration).

## Testing

Extend `fca-web/src/lib/__tests__/prospects-labels.test.js` with two new assertions for the bespoke `referral_sent` phrasing. Extend `referral-diff.test.js` to include `referral_sent` in the canonical `TRACKED_FIELDS` list assertion.

No new tests for migration / entity / components (consistent with prior task's scope of testing).

## Risk

Minimal. Single additive column + one boolean check + one CSS class application. Migration is idempotent and small (a single ALTER TABLE on a ~10-row table). Rollback = DROP COLUMN.

## Self-review notes

- No placeholders or TBDs.
- Scope is one-plan-sized — ~7 small files.
- Boolean phrasing in spec matches what would land in code.
- No contradiction with the original 2026-05-11 spec; this is purely additive.
