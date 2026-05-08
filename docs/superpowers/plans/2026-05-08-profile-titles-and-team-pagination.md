# Profile Titles + Team Members Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit message rule:** This repo's `CLAUDE.md` requires that no commit message reference Claude or include any "Co-Authored-By: Claude" trailer. Write commits as if authored solely by the user.

**Goal:** Add a free-text `title` field to user records (e.g., "Chief Marketing Officer"), display it inline under each user's name in the Settings → Team Members table, allow admins to edit any user's title inline, and paginate the Team Members table with a default page size of 7 and a persisted user-selectable size.

**Architecture:** Single migration adds a nullable `title text` column (length-capped to 100) to `public.users`. The existing `users` RLS policies handle authorization (own-row + admin-in-org). A new `User.updateTitle(userId, title)` method wraps the update. The Profile page gets a Title input that flows through the existing `updateProfile()` plumbing in `AuthProvider`. The Settings Team Members table (which is already admin-gated) renders title under the name and supports click-to-edit inline. Pagination is client-side: a small pure helper module under `src/lib/pagination.js` handles clamping and persisted page-size reads; the table component slices the user list using these helpers.

**Tech Stack:** React 19, Vite, Tailwind, Supabase (Postgres + RLS), Vitest + React Testing Library.

**Spec reference:** [`docs/superpowers/specs/2026-05-08-profile-titles-and-team-pagination-design.md`](../specs/2026-05-08-profile-titles-and-team-pagination-design.md)

---

## File Map

**Create:**
- `supabase/migrations/20260508_users_add_title.sql` — DB migration
- `fca-web/src/lib/pagination.js` — pure helpers (`clampPage`, `readPersistedPageSize`, `writePersistedPageSize`, `getWindow`)
- `fca-web/src/lib/__tests__/pagination.test.js` — unit tests for the helpers above

**Modify:**
- `fca-web/src/entities/User.supabase.js` — add `updateTitle(userId, title)` method
- `fca-web/src/Pages/Profile.jsx` — add Title input to `ProfileInfoSection`
- `fca-web/src/Pages/Settings.jsx` — render title under name in Team Members; inline-edit; pagination footer

---

## Task 1: DB migration adds `title` column

**Files:**
- Create: `supabase/migrations/20260508_users_add_title.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260508_users_add_title.sql` with this exact content:

```sql
-- Add nullable free-text title column to users (e.g., "Chief Marketing Officer").
-- Capped at 100 chars to keep table renders sane.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_title_length_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_title_length_check
  CHECK (title IS NULL OR char_length(title) <= 100);

COMMENT ON COLUMN public.users.title IS 'Free-text job title shown alongside the user''s name (e.g., "Chief Marketing Officer"). Max 100 chars.';
```

- [ ] **Step 2: Verify there are no column-allowlist UPDATE policies on `users` that would exclude `title`**

Run: `grep -rn "UPDATE\|update" supabase/migrations/ | grep -i "users\b" | head -40`

Look at every `CREATE POLICY ... FOR UPDATE ... ON public.users` (and any prior `ALTER POLICY`). Postgres RLS policies do not have explicit column allowlists in their policy body — column-level grants are a separate mechanism. The relevant check is whether `GRANT UPDATE (col_a, col_b, ...) ON public.users` exists anywhere (column-level grant).

Run: `grep -rn "GRANT.*UPDATE.*users" supabase/migrations/`

Expected: no column-list `GRANT UPDATE` statements on `public.users`. If any are found, this task gets an additional sub-step to add `title` to the grant. (Per the existing schema in this repo there are none — this is a defensive check.)

- [ ] **Step 3: Apply the migration**

If the project uses a remote Supabase instance and the user has the Supabase MCP tool connected, the implementer should ask before applying directly to remote. Otherwise, run locally:

Run: `supabase db reset` (only if a local Supabase stack is in use) or apply via `supabase db push` against the configured project after explicit user approval.

If no local stack is configured and the user has not authorized a remote push, leave the migration committed but unapplied and call this out in the final summary.

- [ ] **Step 4: Smoke-test the column exists**

If applied locally, run the following SQL via `supabase db query` or psql:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'title';
```

Expected: one row, `data_type = text`, `is_nullable = YES`.

Also test the constraint:

```sql
-- Pick any user id, then:
UPDATE public.users SET title = repeat('x', 101) WHERE id = '<some-uuid>';
```

Expected: error `new row for relation "users" violates check constraint "users_title_length_check"`.

Then revert: `UPDATE public.users SET title = NULL WHERE id = '<some-uuid>';`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260508_users_add_title.sql
git commit -m "feat(db): add nullable title column to users (max 100 chars)"
```

---

## Task 2: Pagination helper module + tests

**Files:**
- Create: `fca-web/src/lib/pagination.js`
- Test: `fca-web/src/lib/__tests__/pagination.test.js`

- [ ] **Step 1: Write failing tests**

Create `fca-web/src/lib/__tests__/pagination.test.js` with this exact content:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clampPage,
  getWindow,
  readPersistedPageSize,
  writePersistedPageSize,
  ALLOWED_PAGE_SIZES,
} from '../pagination';

describe('clampPage', () => {
  it('returns 1 when total is 0', () => {
    expect(clampPage(5, 0, 10)).toBe(1);
  });
  it('returns the current page when it is within range', () => {
    expect(clampPage(2, 25, 10)).toBe(2);
  });
  it('clamps down to last valid page when current is too high', () => {
    expect(clampPage(5, 25, 10)).toBe(3); // 25 / 10 = 3 pages
  });
  it('clamps up to 1 when current is below 1', () => {
    expect(clampPage(0, 25, 10)).toBe(1);
    expect(clampPage(-3, 25, 10)).toBe(1);
  });
  it('handles total exactly divisible by pageSize', () => {
    expect(clampPage(5, 30, 10)).toBe(3);
  });
});

describe('getWindow', () => {
  it('returns the start/end indices for a given page', () => {
    expect(getWindow(1, 7)).toEqual({ start: 0, end: 7 });
    expect(getWindow(2, 7)).toEqual({ start: 7, end: 14 });
    expect(getWindow(3, 10)).toEqual({ start: 20, end: 30 });
  });
});

describe('readPersistedPageSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it('returns the fallback when storage is empty', () => {
    expect(readPersistedPageSize('k', 7)).toBe(7);
  });
  it('returns the stored value when it is in the allowed list', () => {
    localStorage.setItem('k', '20');
    expect(readPersistedPageSize('k', 7)).toBe(20);
  });
  it('returns the fallback when the stored value is not in the allowed list', () => {
    localStorage.setItem('k', '13');
    expect(readPersistedPageSize('k', 7)).toBe(7);
  });
  it('returns the fallback when the stored value is non-numeric garbage', () => {
    localStorage.setItem('k', 'banana');
    expect(readPersistedPageSize('k', 7)).toBe(7);
  });
});

describe('writePersistedPageSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it('writes allowed sizes to storage as strings', () => {
    writePersistedPageSize('k', 20);
    expect(localStorage.getItem('k')).toBe('20');
  });
  it('does not write disallowed sizes', () => {
    writePersistedPageSize('k', 13);
    expect(localStorage.getItem('k')).toBeNull();
  });
});

describe('ALLOWED_PAGE_SIZES', () => {
  it('is exactly [5, 10, 20, 50]', () => {
    expect(ALLOWED_PAGE_SIZES).toEqual([5, 10, 20, 50]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd fca-web && npx vitest run src/lib/__tests__/pagination.test.js`

Expected: all tests FAIL with module-not-found error for `../pagination`.

- [ ] **Step 3: Write the helper module**

Create `fca-web/src/lib/pagination.js` with this exact content:

```js
export const ALLOWED_PAGE_SIZES = [5, 10, 20, 50];

export function clampPage(page, total, pageSize) {
  if (total <= 0) return 1;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (page < 1) return 1;
  if (page > lastPage) return lastPage;
  return page;
}

export function getWindow(page, pageSize) {
  const start = (page - 1) * pageSize;
  return { start, end: start + pageSize };
}

export function readPersistedPageSize(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return ALLOWED_PAGE_SIZES.includes(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function writePersistedPageSize(key, size) {
  if (!ALLOWED_PAGE_SIZES.includes(size)) return;
  try {
    localStorage.setItem(key, String(size));
  } catch {
    /* localStorage may be unavailable (private mode, SSR) — silently ignore */
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd fca-web && npx vitest run src/lib/__tests__/pagination.test.js`

Expected: all tests PASS (16 assertions across 5 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/lib/pagination.js fca-web/src/lib/__tests__/pagination.test.js
git commit -m "feat(lib): add pagination helpers with localStorage persistence"
```

---

## Task 3: `User.updateTitle` API method

**Files:**
- Modify: `fca-web/src/entities/User.supabase.js`

- [ ] **Step 1: Locate the `User` export**

Run: `grep -n "^export const User\|changeRole\|deactivate" fca-web/src/entities/User.supabase.js | head -20`

You should find an `export const User = { ... }` object containing methods like `list`, `changeRole`, `deactivate`. The new method goes alongside them, ideally right after `changeRole` for thematic grouping.

- [ ] **Step 2: Add `updateTitle` method**

Open `fca-web/src/entities/User.supabase.js`. Find the `changeRole` method (search for `async changeRole`). Immediately after the closing `},` of `changeRole`, insert this method:

```js
  /**
   * Update a user's title (free-text). Pass null/empty to clear.
   * RLS handles authorization (self-edit + admin-in-org).
   * @param {string} userId
   * @param {string|null} title
   * @returns {Promise<object>} updated user row
   */
  async updateTitle(userId, title) {
    const trimmed = (title ?? '').trim()
    const next = trimmed.length === 0 ? null : trimmed
    if (next != null && next.length > 100) {
      throw new Error('Title must be 100 characters or fewer.')
    }
    const { data, error } = await supabase
      .from('users')
      .update({ title: next })
      .eq('id', userId)
      .select()
      .single()
    if (error) {
      console.error('❌ User.updateTitle error:', error)
      throw error
    }
    return data
  },
```

- [ ] **Step 3: Sanity-check imports**

`supabase` is already imported at the top of `User.supabase.js` (line 1: `import { supabase } from '@/lib/supabase'`). No new imports needed.

- [ ] **Step 4: Lint check**

Run: `cd fca-web && npx eslint src/entities/User.supabase.js`

Expected: no errors. If existing pre-existing warnings appear, leave them alone — only fix anything introduced by this task.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/entities/User.supabase.js
git commit -m "feat(api): add User.updateTitle for self and admin-in-org edits"
```

---

## Task 4: Title input on the Profile page

**Files:**
- Modify: `fca-web/src/Pages/Profile.jsx`

- [ ] **Step 1: Add `title` state and dirty-check**

Open `fca-web/src/Pages/Profile.jsx`. Find the line `const [name, setName] = useState(user?.name || '')` (around line 42).

Immediately below it, add:

```jsx
  const [title, setTitle] = useState(user?.title || '')
```

- [ ] **Step 2: Update `hasChanges` to include title**

Find the line `const hasChanges = name !== (user?.name || '') || avatarUrl !== (user?.avatar_url || '')` (around line 50).

Replace it with:

```jsx
  const hasChanges =
    name !== (user?.name || '') ||
    avatarUrl !== (user?.avatar_url || '') ||
    title !== (user?.title || '')
```

- [ ] **Step 3: Include title in the save payload**

Find the `handleSave` function. Locate the `updateProfile({ ... })` call (around line 150). Replace its argument with:

```jsx
      const { error: updateError } = await updateProfile({
        name: name.trim(),
        avatar_url: avatarUrl || null,
        title: title.trim() || null
      })
```

- [ ] **Step 4: Update card subtitle**

Find the `<p>` inside `<CardHeader>` that reads `Update your profile photo and display name` (around line 171). Replace its text with:

```
Update your profile photo, display name, and title.
```

- [ ] **Step 5: Add the Title input below Display Name**

Find the `{/* Name Field */}` block (around line 237-246):

```jsx
        {/* Name Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-heading-primary">Display Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-xl"
          />
        </div>
```

Immediately after the closing `</div>` of that block (and before the `{/* Email (read-only for now) */}` comment), insert:

```jsx
        {/* Title Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-heading-primary">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Chief Marketing Officer"
            maxLength={100}
            className="rounded-xl"
          />
          <p className="text-xs text-heading-subdued">Shown next to your name on the team list.</p>
        </div>
```

- [ ] **Step 6: Manual verification**

Run: `cd fca-web && npm run dev`

Open the app, navigate to Profile, and verify:
- Title input renders below Display Name with the placeholder.
- Typing into Title enables the Save Changes button.
- Saving with a non-empty title persists across reload (refresh the Profile page; the value should still be there).
- Saving with the field cleared persists `null` (refresh; field empty).
- Length is capped at 100 by `maxLength`.

If `npm run dev` is already running, the change should hot-reload. If you can't run a browser, state this explicitly in the final summary rather than claiming success.

- [ ] **Step 7: Commit**

```bash
git add fca-web/src/Pages/Profile.jsx
git commit -m "feat(profile): add free-text Title field for self-edit"
```

---

## Task 5: Render title under name in Team Members table

**Files:**
- Modify: `fca-web/src/Pages/Settings.jsx`

Note: `EmployeeManagementSection` is already gated behind `isAdmin` at the call site (`Settings.jsx:34`), so within this component every viewer is an admin. The "show only for admins" guard from the spec is satisfied implicitly — no role check is needed inside the component.

- [ ] **Step 1: Add the title display under name (read-only first, edit comes in Task 6)**

Open `fca-web/src/Pages/Settings.jsx`. Find the Name `<TableCell>` (around lines 386-396):

```jsx
                    <TableCell className="p-3 sm:p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-heading-primary font-medium text-sm sm:text-base">{u.name || 'Unnamed'}</span>
                          {u.id === currentUser?.id && (
                            <span className="text-xs text-heading-subdued">(You)</span>
                          )}
                        </div>
                        <span className="text-xs text-heading-subdued md:hidden">{u.email}</span>
                      </div>
                    </TableCell>
```

Replace it with this version, which renders `u.title` as a small subdued line directly under the name when present:

```jsx
                    <TableCell className="p-3 sm:p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-heading-primary font-medium text-sm sm:text-base">{u.name || 'Unnamed'}</span>
                          {u.id === currentUser?.id && (
                            <span className="text-xs text-heading-subdued">(You)</span>
                          )}
                        </div>
                        {u.title ? (
                          <span className="text-xs text-heading-subdued">{u.title}</span>
                        ) : null}
                        <span className="text-xs text-heading-subdued md:hidden">{u.email}</span>
                      </div>
                    </TableCell>
```

- [ ] **Step 2: Manual verification**

Run: `cd fca-web && npm run dev` (if not already running). Navigate to Settings → Team Members.

Verify:
- Users with a title (set via Profile page in Task 4) show the title as a small subdued line below their name.
- Users without a title show no title line — the existing layout is unchanged for them.

- [ ] **Step 3: Commit**

```bash
git add fca-web/src/Pages/Settings.jsx
git commit -m "feat(settings): show user title under name in team members table"
```

---

## Task 6: Inline title editing for admins

**Files:**
- Modify: `fca-web/src/Pages/Settings.jsx`

- [ ] **Step 1: Add edit-mode state and handler near the top of `EmployeeManagementSection`**

Open `fca-web/src/Pages/Settings.jsx`. Find the existing `useState` declarations near the top of `EmployeeManagementSection` (around lines 53-63). After the line `const { user: currentUser } = useAuth()`, add:

```jsx
  // Inline title editing: which user row is being edited, plus its draft value.
  const [editingTitleUserId, setEditingTitleUserId] = useState(null)
  const [titleDraft, setTitleDraft] = useState('')
```

- [ ] **Step 2: Add the title-save handler**

Find the existing handlers (e.g. `handleChangeRole`, `handleToggleActive`, `handleDelete`). After `handleDelete` and before `getRoleBadgeColor`, add:

```jsx
  const handleSaveTitle = async (userId, originalTitle) => {
    const next = titleDraft.trim()
    const normalized = next.length === 0 ? null : next
    const original = originalTitle ?? null
    setEditingTitleUserId(null)

    if (normalized === original) {
      // No-op — exit edit mode.
      return
    }

    // Optimistic update.
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, title: normalized } : u))

    try {
      await User.updateTitle(userId, normalized)
    } catch (err) {
      console.error('Error updating title:', err)
      setError(err.message || 'Failed to update title.')
      // Revert on failure.
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, title: original } : u))
    }
  }

  const handleStartEditTitle = (user) => {
    setEditingTitleUserId(user.id)
    setTitleDraft(user.title || '')
  }

  const handleCancelEditTitle = () => {
    setEditingTitleUserId(null)
    setTitleDraft('')
  }
```

- [ ] **Step 3: Replace the read-only title span with click-to-edit UI**

Find the title span added in Task 5:

```jsx
                        {u.title ? (
                          <span className="text-xs text-heading-subdued">{u.title}</span>
                        ) : null}
```

Replace it with:

```jsx
                        {editingTitleUserId === u.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={titleDraft}
                            onChange={(e) => setTitleDraft(e.target.value)}
                            onBlur={() => handleSaveTitle(u.id, u.title)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveTitle(u.id, u.title)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                handleCancelEditTitle()
                              }
                            }}
                            maxLength={100}
                            placeholder="e.g., Chief Marketing Officer"
                            className="text-xs bg-transparent border-b border-[rgba(147,165,197,0.4)] focus:outline-none focus:border-[rgba(147,165,197,0.9)] px-0 py-0.5 w-full max-w-[280px]"
                          />
                        ) : u.title ? (
                          <button
                            type="button"
                            onClick={() => handleStartEditTitle(u)}
                            className="text-xs text-heading-subdued text-left hover:text-heading-primary transition-colors w-fit"
                            title="Click to edit title"
                          >
                            {u.title}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditTitle(u)}
                            className="text-xs text-heading-subdued/60 italic text-left hover:text-heading-subdued transition-colors w-fit"
                            title="Click to add title"
                          >
                            Add title
                          </button>
                        )}
```

- [ ] **Step 4: Manual verification**

Run: `cd fca-web && npm run dev` (if not already running). Navigate to Settings → Team Members.

Verify:
- Clicking an existing title on any row replaces it with a small input, autofocused.
- Typing → pressing Enter saves; the input collapses back to text showing the new title; refresh confirms persistence.
- Typing → pressing Escape cancels; the original title remains.
- Typing → blurring the input saves (same as Enter).
- A row with no title shows "Add title" italicized; clicking it opens the input.
- Clearing the input and Enter/blur stores `null` (the row reverts to "Add title").
- Triggering an error (e.g., temporarily kill the network) shows the error banner and reverts the optimistic update.
- The maxLength prevents typing past 100 characters.

If you cannot exercise the UI, state so explicitly in the final summary instead of claiming success.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/Pages/Settings.jsx
git commit -m "feat(settings): inline-edit user titles from team members table"
```

---

## Task 7: Pagination state and footer

**Files:**
- Modify: `fca-web/src/Pages/Settings.jsx`

- [ ] **Step 1: Import the helpers**

Near the top of `fca-web/src/Pages/Settings.jsx`, find the imports. Add this line alongside the other `@/lib` imports (or wherever fits the existing pattern):

```jsx
import {
  ALLOWED_PAGE_SIZES,
  clampPage,
  getWindow,
  readPersistedPageSize,
  writePersistedPageSize,
} from '@/lib/pagination'
```

Also import `ChevronLeft` and `ChevronRight` from `lucide-react` if they aren't already imported. Run `grep -n "from 'lucide-react'" fca-web/src/Pages/Settings.jsx` to find the existing icon import line and add `ChevronLeft, ChevronRight` to the destructured list.

- [ ] **Step 2: Add a constant for the storage key**

Just below the `EmployeeManagementSection` function declaration (right after `function EmployeeManagementSection() {`), add:

```jsx
  const PAGE_SIZE_STORAGE_KEY = 'fca.settings.teamMembers.pageSize'
  const DEFAULT_PAGE_SIZE = 7
```

Note: 7 is intentionally not in `ALLOWED_PAGE_SIZES`. It's the *default*. The selector only offers 5/10/20/50 — once a user explicitly chooses, they leave the default and persistence kicks in.

- [ ] **Step 3: Add pagination state**

Below the new title-editing state added in Task 6, add:

```jsx
  const [pageSize, setPageSize] = useState(() =>
    readPersistedPageSize(PAGE_SIZE_STORAGE_KEY, DEFAULT_PAGE_SIZE)
  )
  const [page, setPage] = useState(1)
```

- [ ] **Step 4: Clamp page when users list shrinks**

After the existing `useEffect(() => { load() }, [])` line, add:

```jsx
  useEffect(() => {
    setPage(prev => clampPage(prev, users.length, pageSize))
  }, [users.length, pageSize])
```

- [ ] **Step 5: Compute the visible slice**

Just before the `return (` of `EmployeeManagementSection`, add:

```jsx
  const total = users.length
  const { start, end } = getWindow(page, pageSize)
  const visibleUsers = users.slice(start, end)
  const showFooter = total > 5
  const showNav = total > pageSize
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const displayStart = total === 0 ? 0 : start + 1
  const displayEnd = Math.min(end, total)

  const handleChangePageSize = (next) => {
    setPageSize(next)
    writePersistedPageSize(PAGE_SIZE_STORAGE_KEY, next)
    setPage(1)
  }
```

- [ ] **Step 6: Render `visibleUsers` instead of `users` in the table body**

Find `{users.map(u => (` (this is the `<TableBody>` render — around line 384). Change `users.map` to `visibleUsers.map`. Leave the rest of the row identical.

- [ ] **Step 7: Add the pagination footer row**

Find the end of the table block — there is a `<div className="overflow-x-auto">` wrapping `<Table>...</Table>`. The footer should render *outside* that wrapper (so it can't get clipped on narrow screens) but still inside `<CardContent>`.

Immediately after the closing `</div>` of the `overflow-x-auto` wrapper, add:

```jsx
            {showFooter && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-[rgba(147,165,197,0.2)]">
                <span className="text-xs text-heading-subdued">
                  Showing {displayStart}–{displayEnd} of {total}
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-heading-subdued">
                    Rows per page
                    <select
                      value={pageSize}
                      onChange={(e) => handleChangePageSize(Number(e.target.value))}
                      className="bg-transparent border border-[rgba(147,165,197,0.3)] rounded-md px-2 py-1 text-xs text-heading-primary"
                    >
                      {ALLOWED_PAGE_SIZES.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                  {showNav && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        borderRadius="0.5rem"
                        className="h-7 w-7 p-0"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-heading-subdued px-1">
                        Page {page} of {lastPage}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        borderRadius="0.5rem"
                        className="h-7 w-7 p-0"
                        onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                        disabled={page >= lastPage}
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
```

- [ ] **Step 8: Manual verification**

Run: `cd fca-web && npm run dev` (if not already running). Navigate to Settings → Team Members.

Verify (substitute "many" with however many test users exist; if fewer than 8 exist, create extra test invites or temporarily test with a smaller default to exercise the pagination):

- With ≤5 users: footer is hidden entirely.
- With 6-7 users: footer shows but Prev/Next is hidden (single page at default 7).
- With >7 users: footer shows count "Showing 1–7 of N" and Prev/Next; Prev disabled on page 1; Next moves to page 2 and shows "Showing 8–N of N" (or appropriate range).
- Changing the size selector to 10 → resets to page 1, persists across reload (refresh the browser; selector still shows 10).
- Changing to a value not in [5,10,20,50] is impossible (the select offers only those).
- Deleting a user on the last page (e.g., set size 5, navigate to last page with 1 leftover, delete that user) → page clamps down, no blank table.
- The pending-invites card below the team table is unchanged.

If the UI cannot be exercised, state so explicitly in the final summary.

- [ ] **Step 9: Commit**

```bash
git add fca-web/src/Pages/Settings.jsx
git commit -m "feat(settings): paginate team members table (default 7, persisted size selector)"
```

---

## Task 8: Final cross-cutting verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd fca-web && npm run test:run`

Expected: PASS, including the new `pagination.test.js`.

- [ ] **Step 2: Lint check**

Run: `cd fca-web && npx eslint src/Pages/Profile.jsx src/Pages/Settings.jsx src/entities/User.supabase.js src/lib/pagination.js`

Expected: no new errors. Pre-existing warnings unrelated to this work may remain — note them in the final summary but don't fix.

- [ ] **Step 3: Build check**

Run: `cd fca-web && npm run build`

Expected: succeeds. If it fails, fix any new issues introduced by this work before declaring done.

- [ ] **Step 4: End-to-end smoke (manual)**

If a browser is available, walk through the full flow:
1. Profile page: set, change, and clear own title; reload between each step to confirm persistence.
2. Team Members table: confirm titles render under names. As an admin, click another user's title, edit it, save (Enter/blur), reload, confirm persistence.
3. Pagination: change page size, reload, confirm persistence; navigate pages; delete a user on the last page, confirm clamp.

Report which steps were exercised and which (if any) could not be tested in the environment.

- [ ] **Step 5: No commit**

This task makes no code changes. Only commit if any fixes were needed during verification (in which case those fixes get their own focused commits).

---

## Notes for the implementing agent

- **Commit messages:** This repo's `CLAUDE.md` requires no Claude/Anthropic references in commits and no `Co-Authored-By: Claude` trailer. Write commits as if authored solely by the user.
- **Existing log noise:** `EmployeeManagementSection` and `User.supabase.js` contain verbose `console.log` statements as part of the existing style — match that pattern for any new logs you add (or omit logs entirely).
- **No new tests for UI:** The codebase tests pure helpers and lib utilities (e.g., `slug.test.js`). It does not test React components. Don't introduce a component-testing harness for this work; verification of component behavior is manual.
- **Verification-before-completion:** Don't claim a task is done unless you've run the explicit "Run / Expected" check in that step. If the environment can't run a particular check (no local Supabase, no browser), say so plainly.
