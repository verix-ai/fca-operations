# Prospects Call Center Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Subagent reminder:** Subagents do not see CLAUDE.md. When you commit on the user's behalf, never add a `Co-Authored-By: Claude` (or any reference to Claude / Anthropic / Claude Code) trailer to commit messages. Write messages as if authored solely by the user.

**Goal:** Convert the Prospects page into the FCA call center log — new workflow fields, an Activity modal for call-time logging, an immutable notes timeline with auto-logged events, an Archive tab, and filter improvements that work on desktop and mobile.

**Architecture:** Real columns on `referrals` replace the existing JSON-blob pattern for the new fields (and the marketer/CM company ones that are most often filtered). A new `referral_status_history` table mirrors `lead_status_history` for the immutable notes timeline. The entity layer's `update()` diffs old vs new and writes a `field_change` history row for every changed field, so call sites don't have to remember to log. The page is recomposed from focused components (`ProspectsTable`, `ProspectsCards`, `ActivityModal`, `ArchiveModal`, `CmCompanyCell`, `FiltersBar`, `MobileFiltersSheet`).

**Tech Stack:** React, Vite, Supabase (Postgres + RLS), TailwindCSS, vitest. UI primitives in `fca-web/src/components/ui/`. Pattern reference: `Lead.supabase.js` + `Leads.jsx` `NotesModal`.

**Spec:** `docs/superpowers/specs/2026-05-11-prospects-call-center-design.md`

---

## Pre-flight reading

Before starting, the implementing engineer should read:

- `docs/superpowers/specs/2026-05-11-prospects-call-center-design.md` — the design spec (single source of truth)
- `fca-web/src/entities/Lead.supabase.js` — the entity pattern we're mirroring
- `fca-web/src/Pages/Leads.jsx` — specifically the `NotesModal` component (lines 578-720) and the tab/archive pattern
- `supabase/migrations/20260505000001_create_leads.sql` — the migration pattern (RLS, indexes, history table)
- `fca-web/src/Pages/Prospects.jsx` — what's there today
- `fca-web/src/entities/Referral.supabase.js` — current entity, including the JSON-blob `parseReferralNotes` quirk

---

## Task 1: Database migration — add referrals columns, create history table, backfill

**Files:**
- Create: `supabase/migrations/20260511000001_prospects_call_center.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260511000001_prospects_call_center.sql`:

```sql
-- Prospects Call Center Log: real columns on referrals, history table, backfill from JSON.

-- ============================================================================
-- 1. Add columns to referrals
-- ============================================================================
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS cm_company TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS marketer_id UUID REFERENCES marketers(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS marketer_name TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS marketer_email TEXT;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS code TEXT
  CHECK (code IS NULL OR code IN ('301','303','660','661','Other','None Found'));

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS home_care_company TEXT NOT NULL DEFAULT 'FCA'
  CHECK (home_care_company IN ('FCA','Genesis','Gateway','Alice Place','Affordable'));

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS cm_call_status TEXT
  CHECK (cm_call_status IS NULL OR cm_call_status IN ('awaiting','need_resend','contacted'));

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS assessment_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS waiting_state_approval BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archive_reason TEXT
  CHECK (archive_reason IS NULL OR archive_reason IN ('passed_to_hcc','not_eligible','lost_contact','duplicate','other'));
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS archive_note TEXT;

-- ============================================================================
-- 2. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_referrals_archived_at ON referrals(archived_at);
CREATE INDEX IF NOT EXISTS idx_referrals_cm_company ON referrals(organization_id, cm_company);
CREATE INDEX IF NOT EXISTS idx_referrals_home_care_company ON referrals(organization_id, home_care_company);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);

-- ============================================================================
-- 3. Backfill from existing JSON blob in notes column
--    The `notes` column holds JSON-stringified extra fields. Pull cm_company,
--    marketer_id, marketer_name, marketer_email out into the real columns where
--    those columns are still NULL.
-- ============================================================================
UPDATE referrals SET
  cm_company = COALESCE(cm_company, NULLIF(notes::jsonb ->> 'cm_company', '')),
  marketer_id = COALESCE(marketer_id, (NULLIF(notes::jsonb ->> 'marketer_id', ''))::uuid),
  marketer_name = COALESCE(marketer_name, NULLIF(notes::jsonb ->> 'marketer_name', '')),
  marketer_email = COALESCE(marketer_email, NULLIF(notes::jsonb ->> 'marketer_email', ''))
WHERE notes IS NOT NULL
  AND notes <> ''
  AND notes ~ '^\s*\{';  -- only attempt JSON parse when it looks like a JSON object

-- ============================================================================
-- 4. referral_status_history: append-only audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS referral_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('note','field_change','archive','unarchive')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  changed_by UUID REFERENCES users(id),
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_status_history_ref
  ON referral_status_history(referral_id, changed_at DESC);

ALTER TABLE referral_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view referral history in their org" ON referral_status_history;
CREATE POLICY "Users can view referral history in their org" ON referral_status_history
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert referral history in their org" ON referral_status_history;
CREATE POLICY "Users can insert referral history in their org" ON referral_status_history
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- No UPDATE or DELETE policy: history is append-only.
```

- [ ] **Step 2: Apply migration locally**

Run from the project root:
```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
supabase db reset    # if the user is on a local stack
# OR if applying against the dev Supabase project:
supabase db push
```

Expected: migration applies cleanly. If `supabase` CLI is not configured, use the Supabase MCP `apply_migration` tool with the file's contents.

- [ ] **Step 3: Verify schema**

```bash
psql "$SUPABASE_DB_URL" -c "\d referrals" | grep -E "code|home_care_company|cm_call_status|assessment_complete|waiting_state_approval|archived_at|archive_reason"
psql "$SUPABASE_DB_URL" -c "\d referral_status_history"
```

Expected: all the new columns appear on `referrals`, and `referral_status_history` exists with the columns from the migration.

- [ ] **Step 4: Spot-check the backfill**

```bash
psql "$SUPABASE_DB_URL" -c "SELECT id, cm_company, marketer_name FROM referrals WHERE notes LIKE '%cm_company%' LIMIT 5;"
```

Expected: rows show the real `cm_company` / `marketer_name` columns populated from the JSON blob.

- [ ] **Step 5: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add supabase/migrations/20260511000001_prospects_call_center.sql
git commit -m "feat(db): prospects call center columns and history table"
```

---

## Task 2: ReferralHistory entity

**Files:**
- Create: `fca-web/src/entities/ReferralHistory.supabase.js`

- [ ] **Step 1: Create the entity**

Create `fca-web/src/entities/ReferralHistory.supabase.js`:

```js
import { supabase } from '@/lib/supabase'

async function getUserContext() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('users')
    .select('organization_id, name')
    .eq('id', user.id)
    .single()
  if (error) throw error
  if (!profile?.organization_id) throw new Error('User not assigned to an organization')

  return { userId: user.id, organizationId: profile.organization_id, name: profile.name }
}

/**
 * Append-only audit log for the Prospects page. Mirrors lead_status_history.
 * Three event types are written:
 *   - 'note'         — manual user note
 *   - 'field_change' — automatic, emitted from Referral.update() diffs
 *   - 'archive' / 'unarchive' — emitted from Referral.archive()/unarchive()
 */
export const ReferralHistory = {
  /** Full history for one referral, newest first. */
  async list(referralId) {
    const { data, error } = await supabase
      .from('referral_status_history')
      .select('*')
      .eq('referral_id', referralId)
      .order('changed_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  /** Write a manual note. */
  async addNote(referralId, note) {
    const trimmed = (note || '').trim()
    if (!trimmed) throw new Error('Note cannot be empty')
    const { userId, organizationId, name } = await getUserContext()

    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'note',
        note: trimmed,
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Write a field-change event. Used internally by Referral.update(). */
  async addFieldChange(referralId, { field, oldValue, newValue }) {
    const { userId, organizationId, name } = await getUserContext()
    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'field_change',
        field_name: field,
        old_value: oldValue === null || oldValue === undefined ? null : String(oldValue),
        new_value: newValue === null || newValue === undefined ? null : String(newValue),
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Write an archive event. Reason/note are inlined into the note text for display. */
  async addArchiveEvent(referralId, { reason, note }) {
    const { userId, organizationId, name } = await getUserContext()
    const summary = note?.trim()
      ? `Archived — Reason: ${reason}. Note: "${note.trim()}"`
      : `Archived — Reason: ${reason}`
    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'archive',
        note: summary,
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async addUnarchiveEvent(referralId) {
    const { userId, organizationId, name } = await getUserContext()
    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'unarchive',
        note: 'Unarchived',
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },
}

export default ReferralHistory
```

- [ ] **Step 2: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/entities/ReferralHistory.supabase.js
git commit -m "feat(entities): add ReferralHistory for prospects audit log"
```

---

## Task 3: Display labels module

**Files:**
- Create: `fca-web/src/lib/prospects-labels.js`
- Create: `fca-web/src/lib/__tests__/prospects-labels.test.js`

We centralize the display labels for codes, home care companies, CM call status, and archive reasons so the page, modals, and history entries all read from the same dictionary.

- [ ] **Step 1: Write the failing test**

Create `fca-web/src/lib/__tests__/prospects-labels.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  CODE_OPTIONS,
  HOME_CARE_COMPANY_OPTIONS,
  CM_CALL_STATUS_OPTIONS,
  ARCHIVE_REASON_OPTIONS,
  archiveReasonLabel,
  cmCallStatusLabel,
  fieldChangeLabel,
} from '../prospects-labels'

describe('prospects-labels', () => {
  it('exposes the agreed code values', () => {
    expect(CODE_OPTIONS.map(o => o.value)).toEqual(['301','303','660','661','Other','None Found'])
  })

  it('exposes the agreed home care companies with FCA first', () => {
    expect(HOME_CARE_COMPANY_OPTIONS[0].value).toBe('FCA')
    expect(HOME_CARE_COMPANY_OPTIONS.map(o => o.value)).toEqual(
      ['FCA','Genesis','Gateway','Alice Place','Affordable']
    )
  })

  it('exposes the three call statuses', () => {
    expect(CM_CALL_STATUS_OPTIONS.map(o => o.value)).toEqual(['awaiting','need_resend','contacted'])
  })

  it('maps archive reasons to human labels', () => {
    expect(archiveReasonLabel('passed_to_hcc')).toBe('Passed to another home care company')
    expect(archiveReasonLabel('not_eligible')).toBe('Not eligible')
    expect(archiveReasonLabel('lost_contact')).toBe('Lost contact')
    expect(archiveReasonLabel('duplicate')).toBe('Duplicate')
    expect(archiveReasonLabel('other')).toBe('Other')
    expect(archiveReasonLabel(null)).toBe('')
  })

  it('maps call statuses to human labels', () => {
    expect(cmCallStatusLabel('awaiting')).toBe('Awaiting CM company contact')
    expect(cmCallStatusLabel('need_resend')).toBe('No call yet — need to resend referral')
    expect(cmCallStatusLabel('contacted')).toBe('CM company has contacted client')
  })

  it('produces human-readable field-change phrasing', () => {
    expect(fieldChangeLabel('code', 'None Found', '303')).toBe('Code changed from None Found → 303')
    expect(fieldChangeLabel('home_care_company', 'FCA', 'Genesis')).toBe('Home Care Company changed from FCA → Genesis')
    expect(fieldChangeLabel('cm_company', null, 'Acme CM')).toBe('CM Company changed from (none) → Acme CM')
    expect(fieldChangeLabel('assessment_complete', 'false', 'true')).toBe('Assessment marked complete')
    expect(fieldChangeLabel('assessment_complete', 'true', 'false')).toBe('Assessment unmarked')
    expect(fieldChangeLabel('waiting_state_approval', 'false', 'true')).toBe('Marked waiting on state approval')
    expect(fieldChangeLabel('waiting_state_approval', 'true', 'false')).toBe('No longer waiting on state approval')
    expect(fieldChangeLabel('cm_call_status', 'awaiting', 'contacted'))
      .toBe('CM call status changed from Awaiting CM company contact → CM company has contacted client')
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run src/lib/__tests__/prospects-labels.test.js
```

Expected: FAIL — `Cannot find module '../prospects-labels'`.

- [ ] **Step 3: Create the implementation**

Create `fca-web/src/lib/prospects-labels.js`:

```js
export const CODE_OPTIONS = [
  { value: '301', label: '301' },
  { value: '303', label: '303' },
  { value: '660', label: '660' },
  { value: '661', label: '661' },
  { value: 'Other', label: 'Other' },
  { value: 'None Found', label: 'None Found' },
]

export const HOME_CARE_COMPANY_OPTIONS = [
  { value: 'FCA', label: 'FCA' },
  { value: 'Genesis', label: 'Genesis' },
  { value: 'Gateway', label: 'Gateway' },
  { value: 'Alice Place', label: 'Alice Place' },
  { value: 'Affordable', label: 'Affordable' },
]

export const CM_CALL_STATUS_OPTIONS = [
  { value: 'awaiting', label: 'Awaiting CM company contact' },
  { value: 'need_resend', label: 'No call yet — need to resend referral' },
  { value: 'contacted', label: 'CM company has contacted client' },
]

export const ARCHIVE_REASON_OPTIONS = [
  { value: 'passed_to_hcc', label: 'Passed to another home care company' },
  { value: 'not_eligible', label: 'Not eligible' },
  { value: 'lost_contact', label: 'Lost contact' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'other', label: 'Other' },
]

function lookup(options, value) {
  if (value === null || value === undefined || value === '') return ''
  const hit = options.find(o => o.value === value)
  return hit ? hit.label : String(value)
}

export const archiveReasonLabel = (v) => lookup(ARCHIVE_REASON_OPTIONS, v)
export const cmCallStatusLabel  = (v) => lookup(CM_CALL_STATUS_OPTIONS, v)

const FIELD_TITLES = {
  code: 'Code',
  home_care_company: 'Home Care Company',
  cm_company: 'CM Company',
  cm_call_status: 'CM call status',
}

const fmt = (v) => (v === null || v === undefined || v === '') ? '(none)' : v

/**
 * Build the human-readable phrasing for a field_change history entry.
 * Booleans use bespoke phrasing per the spec; other fields use a generic
 * "<Title> changed from <old> → <new>" pattern.
 */
export function fieldChangeLabel(field, oldValue, newValue) {
  if (field === 'assessment_complete') {
    return newValue === 'true' ? 'Assessment marked complete' : 'Assessment unmarked'
  }
  if (field === 'waiting_state_approval') {
    return newValue === 'true' ? 'Marked waiting on state approval' : 'No longer waiting on state approval'
  }
  const title = FIELD_TITLES[field] || field
  const oldLabel = field === 'cm_call_status' ? (cmCallStatusLabel(oldValue) || fmt(oldValue)) : fmt(oldValue)
  const newLabel = field === 'cm_call_status' ? (cmCallStatusLabel(newValue) || fmt(newValue)) : fmt(newValue)
  return `${title} changed from ${oldLabel} → ${newLabel}`
}
```

- [ ] **Step 4: Run the test, expect pass**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run src/lib/__tests__/prospects-labels.test.js
```

Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/lib/prospects-labels.js fca-web/src/lib/__tests__/prospects-labels.test.js
git commit -m "feat(prospects): centralize prospects labels and field-change phrasing"
```

---

## Task 4: Referral entity — refactor for real columns, diff logging, list filters, archive

**Files:**
- Modify: `fca-web/src/entities/Referral.supabase.js`
- Create: `fca-web/src/lib/__tests__/referral-diff.test.js`

We add `archive`, `unarchive`, and a richer `list({...})` to the entity, and we make `update()` emit field_change history rows for every changed tracked field. Existing JSON-blob fallback for un-migrated fields (caregiver_name, phone, county, requested_program) is preserved by `parseReferralNotes`, which already merges JSON into the object.

- [ ] **Step 1: Write the failing test for the diff helper**

Create `fca-web/src/lib/__tests__/referral-diff.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { diffTrackedFields, TRACKED_FIELDS } from '../referral-diff'

describe('referral-diff', () => {
  it('returns no diffs when nothing tracked changed', () => {
    const before = { code: '303', home_care_company: 'FCA', assessment_complete: false }
    const updates = { caregiver_name: 'Bob' } // not tracked
    expect(diffTrackedFields(before, updates)).toEqual([])
  })

  it('returns a diff entry for each changed tracked field', () => {
    const before = { code: null, home_care_company: 'FCA', cm_company: 'Acme', cm_call_status: 'awaiting' }
    const updates = { code: '303', home_care_company: 'Genesis', cm_company: 'Acme', cm_call_status: 'contacted' }
    const diffs = diffTrackedFields(before, updates)
    expect(diffs).toEqual([
      { field: 'code', oldValue: null, newValue: '303' },
      { field: 'home_care_company', oldValue: 'FCA', newValue: 'Genesis' },
      { field: 'cm_call_status', oldValue: 'awaiting', newValue: 'contacted' },
    ])
  })

  it('treats boolean changes as tracked', () => {
    const before = { assessment_complete: false, waiting_state_approval: false }
    const updates = { assessment_complete: true }
    expect(diffTrackedFields(before, updates)).toEqual([
      { field: 'assessment_complete', oldValue: false, newValue: true },
    ])
  })

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
})
```

- [ ] **Step 2: Run the test, expect failure**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run src/lib/__tests__/referral-diff.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the diff helper**

Create `fca-web/src/lib/referral-diff.js`:

```js
export const TRACKED_FIELDS = [
  'code',
  'home_care_company',
  'cm_company',
  'cm_call_status',
  'assessment_complete',
  'waiting_state_approval',
]

/**
 * Returns one diff entry per tracked field whose value changes from `before`
 * to `updates`. A field is "changed" when:
 *   - it is present in `updates`, AND
 *   - the new value !== the old value (loose null/undefined coerce to null first)
 */
export function diffTrackedFields(before, updates) {
  const norm = (v) => (v === undefined ? null : v)
  const out = []
  for (const field of TRACKED_FIELDS) {
    if (!(field in updates)) continue
    const oldValue = norm(before?.[field])
    const newValue = norm(updates[field])
    if (oldValue !== newValue) {
      out.push({ field, oldValue, newValue })
    }
  }
  return out
}
```

- [ ] **Step 4: Run the test, expect pass**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run src/lib/__tests__/referral-diff.test.js
```

Expected: PASS.

- [ ] **Step 5: Modify the Referral entity**

Open `fca-web/src/entities/Referral.supabase.js`. Make the following changes:

**5a.** Replace the top-of-file imports block with:

```js
import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'
import { diffTrackedFields, TRACKED_FIELDS } from '@/lib/referral-diff'
import ReferralHistory from '@/entities/ReferralHistory.supabase'

const referralService = new SupabaseService('referrals')
```

**5b.** Replace the `update` method (currently at lines 132-179) with this implementation that splits real columns from JSON-blob fields and logs changes to history:

```js
  /**
   * Update a referral. Splits the update payload into:
   *   - real columns (written directly)
   *   - extra fields (merged into the legacy notes JSON blob — kept for forward-compat
   *     until all consumers are migrated)
   * Then diffs tracked fields and writes a field_change row to referral_status_history
   * for each tracked field whose value changed.
   */
  async update(id, updates) {
    const existing = await this.get(id)

    // Schema-aware list of real columns we write to.
    const REAL_COLUMNS = new Set([
      'client_id','referred_by','referral_date','referral_source',
      'cm_company','marketer_id','marketer_name','marketer_email',
      'code','home_care_company','cm_call_status',
      'assessment_complete','waiting_state_approval',
      'archived_at','archived_by','archive_reason','archive_note',
    ])

    const {
      organization_id, created_at, updated_at, client, notes,
      id: _id,
      ...rest
    } = updates

    const updateData = {}
    const extraFields = {}
    for (const [k, v] of Object.entries(rest)) {
      if (REAL_COLUMNS.has(k)) updateData[k] = v
      else extraFields[k] = v
    }

    // Merge extra (non-column) fields into the legacy notes blob.
    if (Object.keys(extraFields).length > 0) {
      let existingNotes = {}
      if (existing.notes && typeof existing.notes === 'string') {
        try { existingNotes = JSON.parse(existing.notes) } catch { /* keep empty */ }
      }
      updateData.notes = JSON.stringify({ ...existingNotes, ...extraFields })
    }

    // Compute history diffs BEFORE writing — uses the existing record's tracked fields.
    const diffs = diffTrackedFields(existing, updateData)

    const result = await referralService.update(id, updateData)

    // Write history entries (best-effort: don't fail the update if history insert fails).
    for (const d of diffs) {
      try { await ReferralHistory.addFieldChange(id, d) } catch (e) { console.warn('history failed', e) }
    }

    return parseReferralNotes(result)
  },
```

**5c.** Replace the `list` method (currently at lines 52-56) with a filter-aware version:

```js
  /**
   * List referrals in the current user's organization.
   *
   * @param {Object} [opts]
   * @param {'active'|'archived'} [opts.view='active']
   * @param {string} [opts.cmCompany]
   * @param {string} [opts.homeCareCompany]
   * @param {string} [opts.marketer]   - matches marketer_name OR marketer_email
   * @param {string} [opts.county]     - JSON-blob field; filtered client-side after fetch
   * @param {string} [opts.search]     - search term; filtered client-side
   * @param {string} [opts.dateFrom]   - ISO date, inclusive
   * @param {string} [opts.dateTo]     - ISO date, inclusive
   */
  async list(opts = {}) {
    const { view = 'active', cmCompany, homeCareCompany, marketer, dateFrom, dateTo } = opts

    let query = supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })

    if (view === 'archived') query = query.not('archived_at', 'is', null)
    else query = query.is('archived_at', null)

    if (cmCompany) query = query.eq('cm_company', cmCompany)
    if (homeCareCompany) query = query.eq('home_care_company', homeCareCompany)
    if (marketer) {
      query = query.or(`marketer_name.eq.${marketer},marketer_email.eq.${marketer}`)
    }
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(parseReferralNotes)
  },
```

**5d.** Add archive/unarchive methods. Insert after the `update` method and before `remove`:

```js
  /** Soft-archive a referral with a reason + optional note. Writes a history event. */
  async archive(id, { reason, note }) {
    if (!reason) throw new Error('Archive reason is required')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('referrals')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: user.id,
        archive_reason: reason,
        archive_note: note?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    try { await ReferralHistory.addArchiveEvent(id, { reason, note }) } catch (e) { console.warn(e) }
    return parseReferralNotes(data)
  },

  async unarchive(id) {
    const { data, error } = await supabase
      .from('referrals')
      .update({ archived_at: null, archived_by: null })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    try { await ReferralHistory.addUnarchiveEvent(id) } catch (e) { console.warn(e) }
    return parseReferralNotes(data)
  },
```

**5e.** Add a re-export of `TRACKED_FIELDS` on the entity for callers that want the list:

```js
Referral.TRACKED_FIELDS = TRACKED_FIELDS
```

Place this line just above `export default Referral` at the bottom.

- [ ] **Step 6: Run all existing tests to verify no regressions**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run
```

Expected: PASS — the new diff test plus all existing tests stay green.

- [ ] **Step 7: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/lib/referral-diff.js fca-web/src/lib/__tests__/referral-diff.test.js fca-web/src/entities/Referral.supabase.js
git commit -m "feat(referral): real-column updates with history diff logging + archive"
```

---

## Task 5: CmCompanyCell — dropdown with primary phone underneath

**Files:**
- Create: `fca-web/src/components/prospects/CmCompanyCell.jsx`

A small reusable cell that renders the CM company dropdown and, when a company is selected, shows the primary contact phone underneath as a tappable `tel:` link.

- [ ] **Step 1: Create the component**

Create `fca-web/src/components/prospects/CmCompanyCell.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Phone } from 'lucide-react'

/**
 * Renders the CM Company dropdown plus, when set, the primary contact phone
 * underneath as a tappable tel: link. Falls back to read-only text if `disabled`.
 *
 * Props:
 *   value: string                         – currently selected CM company name
 *   companies: { id, name }[]             – options pulled by parent
 *   onChange: (newName: string) => void   – called when the user picks a new company
 *   disabled?: boolean                    – render read-only (archive tab)
 */
export default function CmCompanyCell({ value, companies, onChange, disabled }) {
  const [phone, setPhone] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadPhone() {
      if (!value) { setPhone(null); return }
      const company = companies.find(c => c.name === value)
      if (!company) { setPhone(null); return }
      const { data, error } = await supabase
        .from('cm_company_contacts')
        .select('phone')
        .eq('cm_company_id', company.id)
        .order('created_at', { ascending: true })
        .limit(1)
      if (cancelled) return
      if (error || !data || !data.length) { setPhone(null); return }
      setPhone(data[0].phone || null)
    }
    loadPhone()
    return () => { cancelled = true }
  }, [value, companies])

  if (disabled) {
    return (
      <div>
        <div className="text-heading-primary/80">{value || '-'}</div>
        {phone && (
          <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-heading-subdued hover:text-heading-primary">
            <Phone className="h-3 w-3" /> {phone}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-[10rem]">
      <select
        className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-2 py-1"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Select --</option>
        {companies.map(c => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
      {phone && (
        <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-heading-subdued hover:text-heading-primary">
          <Phone className="h-3 w-3" /> {phone}
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/components/prospects/CmCompanyCell.jsx
git commit -m "feat(prospects): CmCompanyCell with primary phone popup"
```

---

## Task 6: ArchiveModal — required reason + optional note

**Files:**
- Create: `fca-web/src/components/prospects/ArchiveModal.jsx`

- [ ] **Step 1: Create the modal**

Create `fca-web/src/components/prospects/ArchiveModal.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ARCHIVE_REASON_OPTIONS } from '@/lib/prospects-labels'

/**
 * Confirmation modal for archiving a prospect. The reason dropdown is required;
 * the note textarea is optional. Calls `onConfirm({ reason, note })` on submit.
 */
export default function ArchiveModal({ prospect, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleConfirm() {
    if (!reason || submitting) return
    try {
      setSubmitting(true)
      await onConfirm({ reason, note })
    } finally {
      setSubmitting(false)
    }
  }

  const name = prospect?.referral_name || 'this prospect'

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
          <div className="px-5 py-4 border-b border-white/5 flex items-start justify-between">
            <div className="text-heading-primary font-semibold">Archive {name}?</div>
            <button onClick={onClose} className="ml-3 p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">Reason <span className="text-red-400">*</span></label>
              <select
                className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">-- Select a reason --</option>
                {ARCHIVE_REASON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">Additional note (optional)</label>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Passed to Genesis on 5/11."
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!reason || submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Archiving…</> : 'Archive'}
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
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/components/prospects/ArchiveModal.jsx
git commit -m "feat(prospects): ArchiveModal with reason and optional note"
```

---

## Task 7: ActivityModal — workflow controls + immutable timeline

**Files:**
- Create: `fca-web/src/components/prospects/ActivityModal.jsx`

The call-center workspace. Mirrors the structure of Leads' `NotesModal` but adds the three workflow controls at the top above the notes pane.

- [ ] **Step 1: Create the modal**

Create `fca-web/src/components/prospects/ActivityModal.jsx`:

```jsx
import React, { useEffect, useState, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'
import Referral from '@/entities/Referral.supabase'
import ReferralHistory from '@/entities/ReferralHistory.supabase'
import {
  CM_CALL_STATUS_OPTIONS,
  fieldChangeLabel,
  archiveReasonLabel,
} from '@/lib/prospects-labels'
import { formatDateInTimezone } from '@/utils'

/**
 * The call-center workspace. Workflow controls update the prospect immediately
 * (and emit field_change history entries via Referral.update). Below them, an
 * append-only timeline of all events.
 *
 * Props:
 *   prospect            – the referral row
 *   readOnly?: boolean  – true in the Archive tab; disables all controls
 *   onChange: (updated) => void  – called when prospect fields change so the parent table can update
 *   onClose: () => void
 */
export default function ActivityModal({ prospect, readOnly, onChange, onClose }) {
  const { push: toast } = useToast()
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [local, setLocal] = useState(prospect)

  const refreshHistory = useCallback(async () => {
    try {
      const h = await ReferralHistory.list(prospect.id)
      setHistory(h)
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [prospect.id])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function applyField(field, value) {
    if (readOnly) return
    const prev = local[field]
    setLocal({ ...local, [field]: value })
    try {
      const updated = await Referral.update(prospect.id, { [field]: value })
      setLocal(updated)
      onChange?.(updated)
      await refreshHistory()
    } catch (err) {
      setLocal({ ...local, [field]: prev })
      toast({ title: 'Could not save change', description: err.message, variant: 'destructive' })
    }
  }

  async function addNote() {
    const value = draft.trim()
    if (!value) return
    try {
      setAdding(true)
      await ReferralHistory.addNote(prospect.id, value)
      setDraft('')
      await refreshHistory()
      toast({ title: 'Note added' })
    } catch (err) {
      toast({ title: 'Could not add note', description: err.message, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  function describeEvent(h) {
    if (h.event_type === 'note') return h.note
    if (h.event_type === 'archive') return h.note     // already formatted by ReferralHistory.addArchiveEvent
    if (h.event_type === 'unarchive') return 'Unarchived'
    if (h.event_type === 'field_change') return fieldChangeLabel(h.field_name, h.old_value, h.new_value)
    return h.note || ''
  }

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-6">
        <div className="w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[85vh] flex flex-col rounded-none sm:rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">

          {/* Title bar */}
          <div className="shrink-0 px-5 py-4 border-b border-white/5 flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-heading-primary font-semibold truncate">{local.referral_name || 'Prospect'}</div>
              <div className="text-xs text-heading-subdued mt-0.5">Activity & call log</div>
            </div>
            <button onClick={onClose} className="ml-3 p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Workflow controls */}
          <div className="shrink-0 px-5 py-4 border-b border-white/5 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">
                Did you receive a call from the CM company?
              </label>
              <select
                className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm disabled:opacity-50"
                value={local.cm_call_status || ''}
                disabled={readOnly}
                onChange={(e) => applyField('cm_call_status', e.target.value || null)}
              >
                <option value="">-- Not set --</option>
                {CM_CALL_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 text-sm text-heading-primary">
              <Checkbox
                checked={!!local.assessment_complete}
                disabled={readOnly}
                onCheckedChange={(checked) => applyField('assessment_complete', !!checked)}
              />
              Have you had your assessment?
            </label>

            <label className="flex items-center gap-3 text-sm text-heading-primary">
              <Checkbox
                checked={!!local.waiting_state_approval}
                disabled={readOnly}
                onCheckedChange={(checked) => applyField('waiting_state_approval', !!checked)}
              />
              Waiting on State Approval
            </label>
          </div>

          {/* Add Note (pinned) */}
          {!readOnly && (
            <div className="shrink-0 px-5 py-4 border-b border-white/5">
              <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">Add a Note</label>
              <Textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Call notes, conversation summary, follow-up items…"
              />
              <div className="mt-2 flex justify-end">
                <Button onClick={addNote} disabled={adding || !draft.trim()}>
                  {adding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding…</> : 'Add Note'}
                </Button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="shrink-0 px-5 pt-4 pb-2">
            <div className="text-xs uppercase tracking-[0.3em] text-heading-subdued">Timeline</div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
            {loadingHistory ? (
              <div className="text-sm text-heading-subdued">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-heading-subdued">No activity yet.</div>
            ) : (
              <ul className="space-y-2">
                {history.map(h => (
                  <li key={h.id} className="text-sm border-l-2 border-white/15 pl-3 py-1">
                    <div className="text-heading-primary whitespace-pre-wrap">{describeEvent(h)}</div>
                    <div className="text-xs text-heading-subdued mt-1">
                      {h.event_type === 'note' ? 'Note ' : ''}by {h.changed_by_name || 'Unknown user'} · {formatDateInTimezone(h.changed_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/components/prospects/ActivityModal.jsx
git commit -m "feat(prospects): ActivityModal with workflow controls and timeline"
```

---

## Task 8: FiltersBar (desktop) + MobileFiltersSheet

**Files:**
- Create: `fca-web/src/components/prospects/FiltersBar.jsx`
- Create: `fca-web/src/components/prospects/MobileFiltersSheet.jsx`

- [ ] **Step 1: Create `FiltersBar.jsx`**

Create `fca-web/src/components/prospects/FiltersBar.jsx`:

```jsx
import React from 'react'
import { Search, Filter as FilterIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { HOME_CARE_COMPANY_OPTIONS } from '@/lib/prospects-labels'

/**
 * The header strip above the Prospects table:
 *   - Desktop: search + 5 dropdowns in a 3-column grid.
 *   - Mobile:  search + a "Filters" button that opens MobileFiltersSheet.
 *
 * Props:
 *   filters: { search, marketer, county, cmCompany, homeCareCompany, dateFrom, dateTo }
 *   onChange: (next) => void
 *   marketers: string[]
 *   counties: string[]
 *   cmCompanies: { id, name }[]
 *   onOpenMobileFilters: () => void
 *   activeFilterCount: number   – shown on the mobile button
 */
export default function FiltersBar({
  filters, onChange,
  marketers, counties, cmCompanies,
  onOpenMobileFilters, activeFilterCount,
}) {
  const set = (k, v) => onChange({ ...filters, [k]: v })

  return (
    <div className="p-6 space-y-4">
      {/* Always visible: search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-heading-subdued w-4 h-4" />
          <Input
            value={filters.search || ''}
            onChange={e => set('search', e.target.value)}
            placeholder="Search prospects"
            className="pl-12 rounded-xl"
          />
        </div>
        {/* Mobile-only filters button */}
        <button
          type="button"
          onClick={onOpenMobileFilters}
          className="md:hidden inline-flex items-center gap-2 rounded-xl border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm text-heading-primary"
        >
          <FilterIcon className="h-4 w-4" /> Filters{activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-xs">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Desktop-only: 2 rows of 3 */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        <select className="rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
          value={filters.marketer || ''} onChange={e => set('marketer', e.target.value)}>
          <option value="">All marketers</option>
          {marketers.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
          value={filters.county || ''} onChange={e => set('county', e.target.value)}>
          <option value="">All counties</option>
          {counties.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
          value={filters.cmCompany || ''} onChange={e => set('cmCompany', e.target.value)}>
          <option value="">All CM companies</option>
          {cmCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select className="rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
          value={filters.homeCareCompany || ''} onChange={e => set('homeCareCompany', e.target.value)}>
          <option value="">All home care companies</option>
          {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex gap-2">
          <Input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} className="rounded-xl" />
          <Input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)} className="rounded-xl" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `MobileFiltersSheet.jsx`**

Create `fca-web/src/components/prospects/MobileFiltersSheet.jsx`:

```jsx
import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HOME_CARE_COMPANY_OPTIONS } from '@/lib/prospects-labels'

/** Bottom-sheet filter panel for mobile only. Shows the 5 non-search filters. */
export default function MobileFiltersSheet({ filters, onChange, marketers, counties, cmCompanies, onClose, onClearAll }) {
  const set = (k, v) => onChange({ ...filters, [k]: v })

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1000] md:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-hero-card border-t border-[rgba(147,165,197,0.25)] p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="text-heading-primary font-semibold">Filters</div>
          <button onClick={onClose} className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.marketer || ''} onChange={e => set('marketer', e.target.value)}>
            <option value="">All marketers</option>
            {marketers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.county || ''} onChange={e => set('county', e.target.value)}>
            <option value="">All counties</option>
            {counties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.cmCompany || ''} onChange={e => set('cmCompany', e.target.value)}>
            <option value="">All CM companies</option>
            {cmCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.homeCareCompany || ''} onChange={e => set('homeCareCompany', e.target.value)}>
            <option value="">All home care companies</option>
            {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} className="rounded-xl" />
            <Input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)} className="rounded-xl" />
          </div>
        </div>

        <div className="mt-5 flex justify-between">
          <button onClick={onClearAll} className="text-sm text-heading-subdued hover:text-heading-primary underline">Clear all</button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/components/prospects/FiltersBar.jsx fca-web/src/components/prospects/MobileFiltersSheet.jsx
git commit -m "feat(prospects): filters bar and mobile filters sheet"
```

---

## Task 9: ProspectsTable (desktop) and ProspectsCards (mobile)

**Files:**
- Create: `fca-web/src/components/prospects/ProspectsTable.jsx`
- Create: `fca-web/src/components/prospects/ProspectsCards.jsx`

The two view components used by the page. Both receive the same row data and the same callbacks; they only differ in layout.

- [ ] **Step 1: Create `ProspectsTable.jsx`**

Create `fca-web/src/components/prospects/ProspectsTable.jsx`:

```jsx
import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import CmCompanyCell from './CmCompanyCell'
import { CODE_OPTIONS, HOME_CARE_COMPANY_OPTIONS } from '@/lib/prospects-labels'
import { formatDateInTimezone } from '@/utils'

/**
 * Desktop table view. Inline dropdowns on Code / Home Care Company / CM Company.
 * In the Archive view, dropdowns become read-only text.
 *
 * Props:
 *   rows                            – referrals to render
 *   companies                       – CM companies list
 *   view: 'active' | 'archived'
 *   userRole                        – used to hide "Start Intake" from marketers
 *   onInlineEdit(id, field, value)
 *   onOpenProfile(id)
 *   onOpenActivity(row)
 *   onArchive(row)
 *   onUnarchive(row)
 *   onStartIntake(id)
 */
export default function ProspectsTable({
  rows, companies, view, userRole,
  onInlineEdit, onOpenProfile, onOpenActivity, onArchive, onUnarchive, onStartIntake,
}) {
  const archived = view === 'archived'

  return (
    <div className="hidden lg:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-white/5">
            <TableHead className="text-heading-subdued p-4">Client Name</TableHead>
            <TableHead className="text-heading-subdued p-4">Caregiver</TableHead>
            <TableHead className="text-heading-subdued p-4">Phone</TableHead>
            <TableHead className="text-heading-subdued p-4">County</TableHead>
            <TableHead className="text-heading-subdued p-4">Program</TableHead>
            <TableHead className="text-heading-subdued p-4">Code</TableHead>
            <TableHead className="text-heading-subdued p-4">Home Care Company</TableHead>
            <TableHead className="text-heading-subdued p-4">Case Management Company</TableHead>
            <TableHead className="text-heading-subdued p-4">Submitted</TableHead>
            <TableHead className="text-heading-subdued p-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={10} className="text-center text-heading-subdued py-10">No prospects found</TableCell></TableRow>
          ) : rows.map(r => (
            <TableRow key={r.id} className="border-b border-white/5 align-top">
              <TableCell className="p-4 text-heading-primary">{r.referral_name}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.caregiver_name}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.phone}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.county}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.requested_program}</TableCell>

              <TableCell className="p-4 text-heading-primary/80">
                {archived ? (
                  <span>{r.code || '-'}</span>
                ) : (
                  <select className="rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-2 py-1"
                    value={r.code || ''}
                    onChange={e => onInlineEdit(r.id, 'code', e.target.value || null)}>
                    <option value="">-- Select --</option>
                    {CODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </TableCell>

              <TableCell className="p-4 text-heading-primary/80">
                {archived ? (
                  <span>{r.home_care_company || 'FCA'}</span>
                ) : (
                  <select className="rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-2 py-1"
                    value={r.home_care_company || 'FCA'}
                    onChange={e => onInlineEdit(r.id, 'home_care_company', e.target.value)}>
                    {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </TableCell>

              <TableCell className="p-4 text-heading-primary/80">
                <CmCompanyCell
                  value={r.cm_company}
                  companies={companies}
                  disabled={archived}
                  onChange={v => onInlineEdit(r.id, 'cm_company', v || null)}
                />
              </TableCell>

              <TableCell className="p-4 text-heading-primary/60"><span>{formatDateInTimezone(r.created_at)}</span></TableCell>

              <TableCell className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {!archived && userRole !== 'marketer' && (
                    <Button variant="outline" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                      onClick={() => onStartIntake(r.id)}>Start Intake</Button>
                  )}
                  <Button variant="secondary" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                    onClick={() => onOpenProfile(r.id)}>Open Profile</Button>
                  <Button variant="secondary" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                    onClick={() => onOpenActivity(r)}>Activity</Button>
                  {archived ? (
                    <Button variant="outline" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                      onClick={() => onUnarchive(r)}>Unarchive</Button>
                  ) : (
                    <Button variant="outline" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                      onClick={() => onArchive(r)}>Archive</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Create `ProspectsCards.jsx`**

Create `fca-web/src/components/prospects/ProspectsCards.jsx`:

```jsx
import React from 'react'
import { Button } from '@/components/ui/button'
import CmCompanyCell from './CmCompanyCell'
import { CODE_OPTIONS, HOME_CARE_COMPANY_OPTIONS } from '@/lib/prospects-labels'
import { formatDateInTimezone } from '@/utils'

export default function ProspectsCards({
  rows, companies, view, userRole,
  onInlineEdit, onOpenProfile, onOpenActivity, onArchive, onUnarchive, onStartIntake,
}) {
  const archived = view === 'archived'

  if (rows.length === 0) {
    return <div className="text-center text-heading-subdued py-10 px-4">No prospects found</div>
  }

  return (
    <div className="lg:hidden divide-y divide-white/5">
      {rows.map(r => (
        <div key={r.id} className="p-4 space-y-3">
          <div className="text-heading-primary font-medium truncate">{r.referral_name}</div>
          <div className="text-sm text-heading-subdued">Caregiver: {r.caregiver_name}</div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><div className="text-heading-subdued text-xs">Phone</div><div className="text-heading-primary">{r.phone || '-'}</div></div>
            <div><div className="text-heading-subdued text-xs">County</div><div className="text-heading-primary">{r.county || '-'}</div></div>
            <div><div className="text-heading-subdued text-xs">Program</div><div className="text-heading-primary">{r.requested_program || '-'}</div></div>
            <div><div className="text-heading-subdued text-xs">Submitted</div><div className="text-heading-primary">{formatDateInTimezone(r.created_at)}</div></div>
          </div>

          {/* Code */}
          <div>
            <div className="text-heading-subdued text-xs mb-1">Code</div>
            {archived ? (
              <div className="text-heading-primary">{r.code || '-'}</div>
            ) : (
              <select className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
                value={r.code || ''} onChange={e => onInlineEdit(r.id, 'code', e.target.value || null)}>
                <option value="">-- Select --</option>
                {CODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          {/* Home Care Company */}
          <div>
            <div className="text-heading-subdued text-xs mb-1">Home Care Company</div>
            {archived ? (
              <div className="text-heading-primary">{r.home_care_company || 'FCA'}</div>
            ) : (
              <select className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
                value={r.home_care_company || 'FCA'} onChange={e => onInlineEdit(r.id, 'home_care_company', e.target.value)}>
                {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          {/* CM Company + phone */}
          <div>
            <div className="text-heading-subdued text-xs mb-1">Case Management Company</div>
            <CmCompanyCell
              value={r.cm_company}
              companies={companies}
              disabled={archived}
              onChange={v => onInlineEdit(r.id, 'cm_company', v || null)}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {!archived && userRole !== 'marketer' && (
              <Button variant="outline" borderRadius="1rem" className="flex-1 text-xs"
                onClick={() => onStartIntake(r.id)}>Start Intake</Button>
            )}
            <Button variant="secondary" borderRadius="1rem" className="flex-1 text-xs"
              onClick={() => onOpenProfile(r.id)}>Open Profile</Button>
            <Button variant="secondary" borderRadius="1rem" className="flex-1 text-xs"
              onClick={() => onOpenActivity(r)}>Activity</Button>
            {archived ? (
              <Button variant="outline" borderRadius="1rem" className="flex-1 text-xs"
                onClick={() => onUnarchive(r)}>Unarchive</Button>
            ) : (
              <Button variant="outline" borderRadius="1rem" className="flex-1 text-xs"
                onClick={() => onArchive(r)}>Archive</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/components/prospects/ProspectsTable.jsx fca-web/src/components/prospects/ProspectsCards.jsx
git commit -m "feat(prospects): table and cards view components"
```

---

## Task 10: Prospects page — tabs, state, wiring

**Files:**
- Modify: `fca-web/src/Pages/Prospects.jsx`

We rewrite the page to compose the new components. The page owns: the list of referrals, filter state, the active tab, currently-open modals.

- [ ] **Step 1: Rewrite Prospects.jsx**

Open `fca-web/src/Pages/Prospects.jsx` and replace its full contents with:

```jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Referral from '@/entities/Referral.supabase'
import CmCompany from '@/entities/CmCompany.supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNavigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useAuth } from '@/auth/AuthProvider.jsx'
import { useToast } from '@/components/ui/toast'

import FiltersBar from '@/components/prospects/FiltersBar'
import MobileFiltersSheet from '@/components/prospects/MobileFiltersSheet'
import ProspectsTable from '@/components/prospects/ProspectsTable'
import ProspectsCards from '@/components/prospects/ProspectsCards'
import ActivityModal from '@/components/prospects/ActivityModal'
import ArchiveModal from '@/components/prospects/ArchiveModal'

const EMPTY_FILTERS = {
  search: '', marketer: '', county: '',
  cmCompany: '', homeCareCompany: '',
  dateFrom: '', dateTo: '',
}

export default function Prospects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { push: toast } = useToast()

  const [view, setView] = useState('active')                 // 'active' | 'archived'
  const [referrals, setReferrals] = useState([])
  const [companies, setCompanies] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [activityRow, setActivityRow] = useState(null)
  const [archiveRow, setArchiveRow] = useState(null)
  const [unarchiveRow, setUnarchiveRow] = useState(null)

  const refreshList = useCallback(async () => {
    try {
      const list = await Referral.list({
        view,
        cmCompany: filters.cmCompany || undefined,
        homeCareCompany: filters.homeCareCompany || undefined,
        marketer: filters.marketer || undefined,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : undefined,
        dateTo: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).toISOString() : undefined,
      })
      setReferrals(list)
    } catch (err) {
      toast({ title: 'Could not load prospects', description: err.message, variant: 'destructive' })
      setReferrals([])
    }
  }, [view, filters.cmCompany, filters.homeCareCompany, filters.marketer, filters.dateFrom, filters.dateTo, toast])

  useEffect(() => {
    (async () => {
      try { setCompanies(await CmCompany.list()) } catch {}
    })()
  }, [])

  useEffect(() => { refreshList() }, [refreshList])

  // Derived options for the filter dropdowns
  const marketerOptions = useMemo(() => {
    const seen = new Set()
    referrals.forEach(r => {
      const k = (r.marketer_name || r.marketer_email || '').trim()
      if (k) seen.add(k)
    })
    return [...seen].sort((a,b) => a.localeCompare(b))
  }, [referrals])

  const countyOptions = useMemo(() => {
    const seen = new Set()
    referrals.forEach(r => { if (r.county) seen.add(r.county) })
    return [...seen].sort((a,b) => a.localeCompare(b))
  }, [referrals])

  // Client-side filters: search + county (county lives in the JSON blob and isn't
  // indexable yet, so it's a post-fetch filter).
  const rows = useMemo(() => {
    let list = referrals

    if (user?.role === 'marketer') {
      list = list.filter(r =>
        (r.marketer_name || '').trim() === (user.name || '').trim() ||
        (r.marketer_email || '').trim() === (user.email || '').trim()
      )
    }
    if (filters.county) {
      list = list.filter(r => String(r.county || '').toLowerCase() === filters.county.toLowerCase())
    }
    const q = (filters.search || '').trim().toLowerCase()
    if (q) {
      list = list.filter(r =>
        [r.referral_name, r.caregiver_name, r.phone, r.address, r.county]
          .map(v => String(v || '').toLowerCase())
          .some(v => v.includes(q))
      )
    }
    return list
  }, [referrals, user, filters.search, filters.county])

  const activeFilterCount = useMemo(() => {
    const keys = ['marketer','county','cmCompany','homeCareCompany','dateFrom','dateTo']
    return keys.filter(k => !!filters[k]).length
  }, [filters])

  async function handleInlineEdit(id, field, value) {
    const prev = referrals.find(r => r.id === id)
    setReferrals(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
    try {
      const updated = await Referral.update(id, { [field]: value })
      setReferrals(rs => rs.map(r => r.id === id ? { ...r, ...updated } : r))
    } catch (err) {
      setReferrals(rs => rs.map(r => r.id === id ? prev : r))
      toast({ title: 'Could not save change', description: err.message, variant: 'destructive' })
    }
  }

  async function handleArchiveConfirm({ reason, note }) {
    if (!archiveRow) return
    try {
      await Referral.archive(archiveRow.id, { reason, note })
      toast({ title: 'Prospect archived' })
      setArchiveRow(null)
      refreshList()
    } catch (err) {
      toast({ title: 'Could not archive', description: err.message, variant: 'destructive' })
    }
  }

  async function handleUnarchive() {
    if (!unarchiveRow) return
    try {
      await Referral.unarchive(unarchiveRow.id)
      toast({ title: 'Prospect restored' })
      setUnarchiveRow(null)
      refreshList()
    } catch (err) {
      toast({ title: 'Could not unarchive', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Referrals"
        title="Prospects"
        description="View and work the prospects you have referred."
      />

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archive</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border rounded-2xl surface-main">
        <CardHeader className="p-6 border-b border-white/5">
          <CardTitle className="text-heading-primary">Search</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            marketers={marketerOptions}
            counties={countyOptions}
            cmCompanies={companies}
            onOpenMobileFilters={() => setMobileFiltersOpen(true)}
            activeFilterCount={activeFilterCount}
          />
        </CardContent>
      </Card>

      <Card className="border rounded-2xl surface-main">
        <CardHeader className="p-6 border-b border-white/5">
          <CardTitle className="text-heading-primary">{view === 'archived' ? 'Archived Prospects' : 'Your Prospects'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ProspectsTable
            rows={rows}
            companies={companies}
            view={view}
            userRole={user?.role}
            onInlineEdit={handleInlineEdit}
            onOpenProfile={(id) => navigate(`/prospects/${id}`)}
            onOpenActivity={(row) => setActivityRow(row)}
            onArchive={(row) => setArchiveRow(row)}
            onUnarchive={(row) => setUnarchiveRow(row)}
            onStartIntake={(id) => navigate(`${createPageUrl('ClientIntake')}?ref=${id}`)}
          />
          <ProspectsCards
            rows={rows}
            companies={companies}
            view={view}
            userRole={user?.role}
            onInlineEdit={handleInlineEdit}
            onOpenProfile={(id) => navigate(`/prospects/${id}`)}
            onOpenActivity={(row) => setActivityRow(row)}
            onArchive={(row) => setArchiveRow(row)}
            onUnarchive={(row) => setUnarchiveRow(row)}
            onStartIntake={(id) => navigate(`${createPageUrl('ClientIntake')}?ref=${id}`)}
          />
        </CardContent>
      </Card>

      {mobileFiltersOpen && (
        <MobileFiltersSheet
          filters={filters}
          onChange={setFilters}
          marketers={marketerOptions}
          counties={countyOptions}
          cmCompanies={companies}
          onClose={() => setMobileFiltersOpen(false)}
          onClearAll={() => setFilters(EMPTY_FILTERS)}
        />
      )}

      {activityRow && (
        <ActivityModal
          prospect={activityRow}
          readOnly={view === 'archived'}
          onChange={(updated) => {
            setActivityRow(updated)
            setReferrals(rs => rs.map(r => r.id === updated.id ? { ...r, ...updated } : r))
          }}
          onClose={() => setActivityRow(null)}
        />
      )}

      {archiveRow && (
        <ArchiveModal
          prospect={archiveRow}
          onClose={() => setArchiveRow(null)}
          onConfirm={handleArchiveConfirm}
        />
      )}

      {unarchiveRow && (
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUnarchiveRow(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card p-5">
              <div className="text-heading-primary font-semibold mb-2">Restore {unarchiveRow.referral_name}?</div>
              <div className="text-sm text-heading-subdued mb-4">This will move the prospect back to the Active tab.</div>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-2 text-sm rounded border border-[rgba(147,165,197,0.25)]" onClick={() => setUnarchiveRow(null)}>Cancel</button>
                <button className="px-3 py-2 text-sm rounded bg-white/10 hover:bg-white/15 text-heading-primary" onClick={handleUnarchive}>Unarchive</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the dev server and verify the page loads**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npm run dev
```

Open the Prospects page in a browser. Expected: page renders without errors, tabs visible, filters visible (desktop), table renders with the new columns.

- [ ] **Step 3: Run the build to catch type/import regressions**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Run the test suite**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app/fca-web
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/jalexander/Documents/VERIX-CODE/friendly-care-agency/app
git add fca-web/src/Pages/Prospects.jsx
git commit -m "feat(prospects): rewire page with tabs, filters, activity, and archive"
```

---

## Task 11: Manual QA pass

Run through this checklist in a browser against a non-prod environment. Check off each item; if anything fails, file a follow-up commit.

- [ ] **Active tab renders** with Search row + 5 desktop filters + the table.
- [ ] **Tabs switch** between Active and Archive; URL doesn't change but rows update.
- [ ] **Code dropdown** inline-edits and the timeline shows *"Code changed from … → 303"*.
- [ ] **Home Care Company** defaults to FCA on new prospects; inline-editing logs to timeline.
- [ ] **CM Company** dropdown is unchanged behavior. After selecting a company that has a `cm_company_contacts` row, **the primary phone shows under the dropdown** on both desktop and mobile, as a `tel:` link.
- [ ] **CM Company with no contact**: nothing renders under the dropdown (no error).
- [ ] **Activity modal opens** centered on desktop, full-screen on mobile. Closing returns the list to the same scroll position and page.
- [ ] **Workflow controls in Activity modal** update the prospect and append events to the timeline.
- [ ] **Add a Note** writes a manual note and shows it at the top of the timeline.
- [ ] **Archive button** opens the confirmation modal. Cannot archive without selecting a reason.
- [ ] After archive: prospect leaves Active tab, appears in Archive tab; toast shows *"Prospect archived"*; timeline includes the archive event with the reason + optional note quoted.
- [ ] **Archive tab**: dropdowns and checkboxes are read-only. Add Note is disabled. Buttons show `Open Profile`, `Activity`, `Unarchive`.
- [ ] **Unarchive** returns the prospect to Active and logs an Unarchive event.
- [ ] **Filters – desktop**: marketer/county/CM company/home care company/date range each constrain the list correctly.
- [ ] **Filters – mobile**: `Filters · N` button shows count. Bottom sheet opens with the 5 filters. `Clear all` empties them.
- [ ] **Date range** filters on `created_at` and includes the end date (selecting "today–today" should include rows created today).
- [ ] **"Client Name"** appears as the column header on desktop and the card heading label on mobile. The page eyebrow ("Referrals") and page title ("Prospects") are unchanged.
- [ ] **Permissions**: a marketer-role user only sees their own prospects (existing behavior); they can archive/unarchive their own prospects.
- [ ] **Start Intake**: clicking on an Active prospect goes to `ClientIntake?ref=:id`. The intake form does NOT pre-populate Code, Home Care Company, CM call status, or the assessment/state-approval checkboxes.
- [ ] **Existing referrals**: a prospect created before this migration shows Code blank, Home Care Company `FCA`, and the assessment/state-approval checkboxes unchecked.

---

## Self-review checklist (run after writing the plan)

1. **Spec coverage:**
   - Schema changes → Task 1
   - `referral_status_history` table → Task 1
   - ReferralHistory entity → Task 2
   - Centralized labels + fieldChangeLabel → Task 3
   - Referral.update diff logging + archive/unarchive + list filters → Task 4
   - CmCompanyCell with primary phone popup → Task 5
   - ArchiveModal → Task 6
   - ActivityModal (workflow controls + timeline + Add Note + disabled archive view) → Task 7
   - FiltersBar + MobileFiltersSheet → Task 8
   - ProspectsTable + ProspectsCards → Task 9
   - Page wiring (tabs, label rename, modal management) → Task 10
   - Manual QA covering all spec items → Task 11

2. **Placeholder scan:** No TBDs, no "implement appropriate error handling," all code shown.

3. **Type consistency:** `Referral.update`, `Referral.archive(id, {reason, note})`, `ReferralHistory.addFieldChange(id, {field, oldValue, newValue})` — call sites in Tasks 4/7/10 match. `fieldChangeLabel(field, oldValue, newValue)` signature consistent across Task 3 and Task 7. Filter prop shape (`filters` object with the same key set) consistent across FiltersBar, MobileFiltersSheet, and the page.
