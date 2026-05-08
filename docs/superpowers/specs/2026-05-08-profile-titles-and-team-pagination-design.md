# Profile Titles + Team Members Pagination

**Date:** 2026-05-08
**Status:** Approved (pending implementation plan)

## Summary

Two related changes to the Settings → Team Members area:

1. Give every user a free-text **title** field (e.g., "Chief Marketing Officer") on their profile, displayed inline under their name in the Team Members table. Admins can edit any user's title; everyone can edit their own.
2. Paginate the Team Members table with a default page size of **7** rows and a user-selectable page size persisted to localStorage.

The Team Members list is currently growing without bound and the role badge alone doesn't capture what someone actually does at the company. The title field gives leadership room to label themselves accurately while keeping the existing `role` enum stable for permissions.

## Data model

Add a `title` column to `public.users` (the table the app reads/writes user records from — this app does not use a separate `profiles` table):

- Type: `text`, nullable.
- Length cap: DB-side `check (title is null or char_length(title) <= 100)`.
- Trimmed/normalized to `null` when blank on write (handled at the application layer).
- New migration: `supabase/migrations/<timestamp>_users_add_title.sql`.

RLS: existing `users` policies already permit users to update their own row and admins to update any row in their organization. The migration must verify no policy uses a column allowlist that would exclude `title`; if any does, extend it. No new policies are introduced.

## Profile page (self-edit)

In [`fca-web/src/Pages/Profile.jsx`](../../fca-web/src/Pages/Profile.jsx), inside the existing "Personal Information" card, add a `Title` text input below `Name`:

- Local `title` state initialized from `user?.title || ''`.
- `hasChanges` includes `title !== (user?.title || '')`.
- `handleSave` includes `title: title.trim() || null` in its update payload.
- Placeholder: `e.g., Chief Marketing Officer`.
- Helper text: `Shown next to your name on the team list.`
- Card subtitle updates to: `Update your profile photo, display name, and title.`
- `maxLength={100}` on the input.

## Team Members table (display)

In [`fca-web/src/Pages/Settings.jsx`](../../fca-web/src/Pages/Settings.jsx) `EmployeeManagementSection`, modify the Name cell:

- Under the user's name (and the existing "(You)" tag), render the title as a small subdued line: `text-xs text-heading-subdued`, above the mobile-only email line.
- If `u.title` is set → render the title text.
- If `u.title` is empty:
  - Non-admins viewing → render nothing.
  - Admins viewing → render a faint placeholder span ("Add title") styled as a subtle clickable affordance, which opens the inline editor.

## Inline title editing (admins only)

- The title text (or admin-only "Add title" placeholder) is clickable for admins → row enters edit mode for the title field.
- Edit mode replaces the text with an `<input>` bound to row-local state, autofocused, `maxLength={100}`.
- Save triggers: pressing Enter, or input blur (when the value differs from the current title).
- Cancel triggers: pressing Escape.
- Save calls a new `User.updateTitle(userId, title)` method.
- Optimistic update: the row's title updates immediately in local state; on error, the value reverts and the existing `setError` banner shows the message.
- Self-edit while in the table is allowed (admins editing their own row), but the canonical place to self-edit remains the Profile page.

### `User.updateTitle`

Add to `fca-web/src/entities/User.supabase.js`:

```js
async updateTitle(userId, title) {
  const trimmed = (title || '').trim() || null
  const { data, error } = await supabase
    .from('users')
    .update({ title: trimmed })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
```

RLS handles admin-vs-self authorization; no separate code path needed.

## Pagination

In `EmployeeManagementSection`:

- Add state:
  - `pageSize` — default `7`, persisted under `localStorage` key `fca.settings.teamMembers.pageSize`. On read, validate the value is one of `[5, 10, 20, 50]`; otherwise fall back to `7`.
  - `page` — default `1`, not persisted (resets each mount).
- Compute `paginatedUsers = users.slice((page - 1) * pageSize, page * pageSize)` and render that instead of `users` in the `TableBody`.
- When `pageSize` changes → reset `page` to 1 and write the new value to localStorage.
- When `users` length changes such that `page` would be out of range (e.g. after deletion) → clamp `page` to the last valid page.
- Footer row below the table (within the same Card):
  - Left: `Showing {start}–{end} of {total}`.
  - Right: page-size `<select>` with options `[5, 10, 20, 50]`, plus Previous / Next buttons (disabled at first/last page).
  - Footer visibility: show the entire footer whenever `users.length > 5` (the smallest selectable page size — at this point the selector becomes useful). Hide the footer entirely when `users.length <= 5`. Within the footer, the Previous / Next buttons render only when `users.length > pageSize` (i.e., more than one page); otherwise just the count text and the size selector are shown.
- The pending invites section below the table is unaffected (separate list, separate concern).

## Testing & verification

Manual checks:

- Set, change, and clear own title from the Profile page; reload and confirm persistence.
- View Team Members table; confirm titles render under names and that empty titles render nothing for non-admins.
- As admin: click another user's title → inline-edit → Enter saves, Escape cancels, blur saves; clearing the field stores `null`.
- Non-admin: title text is not interactive.
- Pagination: defaults to 7 rows, page size selector persists across reload, changing size resets to page 1, deleting users on the last page clamps to a valid page, footer hides when ≤7 users.

Repo checks:

- `npm run lint` / `npm run typecheck` (or whichever the project uses) pass.
- New migration applies cleanly (`supabase db reset` locally if available).

## Out of scope

- Surfacing `title` anywhere besides the Profile page and Team Members table (e.g., referral pages, message UI). Additive later.
- Audit log of who changed whose title.
- Length-limit UI feedback beyond `maxLength={100}` on the input.
- Server-side pagination (the user list is small; client-side slicing is sufficient).
- Title on the public referral form or any external-facing surface.
