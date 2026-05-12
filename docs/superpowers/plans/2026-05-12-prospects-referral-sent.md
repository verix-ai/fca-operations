# Prospects "Referral sent" Checkbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Subagent reminder:** Subagents do not see CLAUDE.md. When you commit on the user's behalf, never add a `Co-Authored-By: Claude` (or any reference to Claude / Anthropic / Claude Code) trailer to commit messages. Write messages as if authored solely by the user.

**Goal:** Add a 4th workflow checkbox ("Referral sent") in the Activity modal and tint the prospect row green wherever it appears once that flag is true. Mirrors the green-row pattern Leads uses for `signed_up`.

**Architecture:** Single boolean column `referral_sent` on `referrals`, wired into the existing `TRACKED_FIELDS` diff path so the change auto-logs to `referral_status_history`. Activity modal gains a 4th checkbox using the same `applyField` plumbing as the other two. Table and Cards apply `bg-emerald-500/[0.08]` to the row root when the flag is true.

**Tech Stack:** React, Vite, Supabase (Postgres + RLS), TailwindCSS, vitest.

**Spec:** `docs/superpowers/specs/2026-05-12-prospects-referral-sent-design.md`

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260512000001_referrals_referral_sent.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260512000001_referrals_referral_sent.sql`:

```sql
-- Adds a `referral_sent` boolean to referrals for the call-center workflow.
-- Set true once the referral has been sent to the CM company / HCC. Used to
-- tint the prospect row green in the UI and to auto-log a field_change event
-- to referral_status_history.

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS referral_sent BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2: Apply the migration to `fca-dev`**

The dev DB password is supplied at runtime; do NOT hardcode or check it into the repo. Use the `SUPABASE_DB_PASSWORD` env var pattern. From a shell with the password already exported (or inline via `PGPASSWORD=...`):

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
PGPASSWORD="$PGPASSWORD" psql --set ON_ERROR_STOP=on "postgresql://postgres.fupcxuwfonuajbblwlfd@aws-1-us-east-2.pooler.supabase.com:5432/postgres" -f supabase/migrations/20260512000001_referrals_referral_sent.sql
```

Expected output: `ALTER TABLE`.

If the controller running this plan does NOT have the DB password available, skip Step 2 and report DONE_WITH_CONCERNS — the migration file is committed and can be applied separately.

- [ ] **Step 3: Verify the column landed**

```bash
PGPASSWORD="$PGPASSWORD" psql "postgresql://postgres.fupcxuwfonuajbblwlfd@aws-1-us-east-2.pooler.supabase.com:5432/postgres" -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='referrals' AND column_name='referral_sent';"
```

Expected: one row showing `referral_sent | boolean | NO | false`.

- [ ] **Step 4: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add supabase/migrations/20260512000001_referrals_referral_sent.sql
git commit -m "feat(db): add referral_sent column to referrals"
```

---

## Task 2: Add `referral_sent` to tracked fields + labels (TDD)

**Files:**
- Modify: `fca-web/src/lib/__tests__/referral-diff.test.js`
- Modify: `fca-web/src/lib/referral-diff.js`
- Modify: `fca-web/src/lib/__tests__/prospects-labels.test.js`
- Modify: `fca-web/src/lib/prospects-labels.js`

- [ ] **Step 1: Update the failing `referral-diff` test**

Edit `fca-web/src/lib/__tests__/referral-diff.test.js`. Find the test:

```js
  it('exports the canonical list of tracked fields', () => {
    expect(TRACKED_FIELDS).toEqual([
      'code',
      'home_care_company',
      'cm_company',
      'cm_call_status',
      'assessment_complete',
      'waiting_state_approval',
    ])
  })
```

Replace it with:

```js
  it('exports the canonical list of tracked fields', () => {
    expect(TRACKED_FIELDS).toEqual([
      'code',
      'home_care_company',
      'cm_company',
      'cm_call_status',
      'assessment_complete',
      'waiting_state_approval',
      'referral_sent',
    ])
  })
```

- [ ] **Step 2: Append two new test cases to `prospects-labels.test.js`**

Edit `fca-web/src/lib/__tests__/prospects-labels.test.js`. Inside the existing `describe('prospects-labels', () => { ... })` block, find the `produces human-readable field-change phrasing` test, and ADD two new assertions inside it (right before the test's closing `})`):

```js
    expect(fieldChangeLabel('referral_sent', 'false', 'true')).toBe('Referral marked sent')
    expect(fieldChangeLabel('referral_sent', 'true', 'false')).toBe('Referral marked not sent')
```

- [ ] **Step 3: Run both tests, expect failures**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run src/lib/__tests__/referral-diff.test.js src/lib/__tests__/prospects-labels.test.js
```

Expected: both files fail. `referral-diff` fails on the TRACKED_FIELDS array comparison; `prospects-labels` fails on the new `referral_sent` assertions.

- [ ] **Step 4: Add `referral_sent` to TRACKED_FIELDS**

Edit `fca-web/src/lib/referral-diff.js`. Find:

```js
export const TRACKED_FIELDS = [
  'code',
  'home_care_company',
  'cm_company',
  'cm_call_status',
  'assessment_complete',
  'waiting_state_approval',
]
```

Replace with:

```js
export const TRACKED_FIELDS = [
  'code',
  'home_care_company',
  'cm_company',
  'cm_call_status',
  'assessment_complete',
  'waiting_state_approval',
  'referral_sent',
]
```

- [ ] **Step 5: Add `referral_sent` phrasing to `fieldChangeLabel`**

Edit `fca-web/src/lib/prospects-labels.js`. Find the `fieldChangeLabel` function. Locate this block:

```js
  if (field === 'waiting_state_approval') {
    return newValue === 'true' ? 'Marked waiting on state approval' : 'No longer waiting on state approval'
  }
```

Add the following block immediately after it (before the `const title =` line):

```js
  if (field === 'referral_sent') {
    return newValue === 'true' ? 'Referral marked sent' : 'Referral marked not sent'
  }
```

- [ ] **Step 6: Run all tests, expect pass**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run
```

Expected: all tests pass, including the 4 referral-diff tests (one updated) and 6 prospects-labels tests (one updated).

- [ ] **Step 7: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/lib/referral-diff.js fca-web/src/lib/__tests__/referral-diff.test.js fca-web/src/lib/prospects-labels.js fca-web/src/lib/__tests__/prospects-labels.test.js
git commit -m "feat(prospects): track referral_sent and label its field-change events"
```

---

## Task 3: Entity layer — add `referral_sent` to REAL_COLUMNS

**Files:**
- Modify: `fca-web/src/entities/Referral.supabase.js`

- [ ] **Step 1: Add `referral_sent` to the REAL_COLUMNS set**

Edit `fca-web/src/entities/Referral.supabase.js`. Inside the `update()` method, find:

```js
    const REAL_COLUMNS = new Set([
      'client_id','referred_by','referral_date','referral_source',
      'cm_company','marketer_id','marketer_name','marketer_email',
      'code','home_care_company','cm_call_status',
      'assessment_complete','waiting_state_approval',
      'archived_at','archived_by','archive_reason','archive_note',
    ])
```

Replace with:

```js
    const REAL_COLUMNS = new Set([
      'client_id','referred_by','referral_date','referral_source',
      'cm_company','marketer_id','marketer_name','marketer_email',
      'code','home_care_company','cm_call_status',
      'assessment_complete','waiting_state_approval','referral_sent',
      'archived_at','archived_by','archive_reason','archive_note',
    ])
```

- [ ] **Step 2: Run the test suite to confirm no regressions**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run
```

Expected: 72/72 pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/entities/Referral.supabase.js
git commit -m "feat(referral): include referral_sent in entity update payload"
```

---

## Task 4: ActivityModal — add the checkbox

**Files:**
- Modify: `fca-web/src/components/prospects/ActivityModal.jsx`

- [ ] **Step 1: Add the checkbox**

Edit `fca-web/src/components/prospects/ActivityModal.jsx`. Find the "Waiting on State Approval" checkbox label block:

```jsx
            <label className="flex items-center gap-3 text-sm text-heading-primary">
              <Checkbox
                checked={!!local.waiting_state_approval}
                disabled={readOnly}
                onCheckedChange={(checked) => applyField('waiting_state_approval', !!checked)}
              />
              Waiting on State Approval
            </label>
```

Immediately after that label's closing `</label>` tag (inside the same `space-y-4` workflow controls div), add:

```jsx
            <label className="flex items-center gap-3 text-sm text-heading-primary">
              <Checkbox
                checked={!!local.referral_sent}
                disabled={readOnly}
                onCheckedChange={(checked) => applyField('referral_sent', !!checked)}
              />
              Referral sent
            </label>
```

- [ ] **Step 2: Build and test**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npm run build && npx vitest run
```

Expected: build succeeds, 72/72 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/components/prospects/ActivityModal.jsx
git commit -m "feat(prospects): add 'Referral sent' checkbox to ActivityModal"
```

---

## Task 5: Green row tint in table and cards

**Files:**
- Modify: `fca-web/src/components/prospects/ProspectsTable.jsx`
- Modify: `fca-web/src/components/prospects/ProspectsCards.jsx`

- [ ] **Step 1: Tint the desktop table row**

Edit `fca-web/src/components/prospects/ProspectsTable.jsx`. Find the `<TableRow>` inside the `rows.map(r => ...)` block:

```jsx
            <TableRow key={r.id} className="border-b border-white/5 align-top">
```

Replace with:

```jsx
            <TableRow key={r.id} className={`border-b border-white/5 align-top ${r.referral_sent ? 'bg-emerald-500/[0.08]' : ''}`}>
```

- [ ] **Step 2: Tint the mobile card**

Edit `fca-web/src/components/prospects/ProspectsCards.jsx`. Find the per-row card div inside the `rows.map(r => ...)` block:

```jsx
        <div key={r.id} className="p-4 space-y-3">
```

Replace with:

```jsx
        <div key={r.id} className={`p-4 space-y-3 ${r.referral_sent ? 'bg-emerald-500/[0.08]' : ''}`}>
```

- [ ] **Step 3: Build and test**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npm run build && npx vitest run
```

Expected: build succeeds, 72/72 tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/components/prospects/ProspectsTable.jsx fca-web/src/components/prospects/ProspectsCards.jsx
git commit -m "feat(prospects): tint row green when referral_sent is true"
```

---

## Task 6: Manual QA pass

- [ ] Open the Prospects page in a dev browser.
- [ ] Open Activity on a prospect. The 4th checkbox **"Referral sent"** appears below "Waiting on State Approval".
- [ ] Check it. Timeline shows a new entry: **"Referral marked sent"**.
- [ ] Close the modal. The prospect's row in the table is now tinted green.
- [ ] On mobile (resize browser to <`lg` breakpoint), the same prospect's card is also tinted green.
- [ ] Uncheck the box. Timeline shows **"Referral marked not sent"**. Row tint disappears.
- [ ] Switch to Archive tab on a referral that's `referral_sent = true`. Row is still green (visual state preserved, per spec).
- [ ] Archive a `referral_sent = true` prospect. Archive succeeds; row still appears green in the Archive tab.

---

## Self-review (run after writing the plan)

**1. Spec coverage:**
- DB column → Task 1
- `TRACKED_FIELDS` membership → Task 2
- `fieldChangeLabel` boolean phrasing → Task 2
- Entity REAL_COLUMNS membership → Task 3
- Activity modal checkbox → Task 4
- Desktop row tint → Task 5
- Mobile card tint → Task 5
- Manual QA → Task 6

All spec items have tasks.

**2. Placeholder scan:** No TBDs, no "implement appropriate handling", every code change shown in full.

**3. Type consistency:** `referral_sent` (snake_case) used consistently everywhere — column name, TRACKED_FIELDS entry, REAL_COLUMNS entry, JSX prop reads `r.referral_sent`. Boolean string `'true'`/`'false'` comparisons in `fieldChangeLabel` match the pattern set by `assessment_complete` and `waiting_state_approval` (history rows store stringified values).
