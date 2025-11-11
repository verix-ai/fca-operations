# Notification System Fixes

## Summary of Changes

This document outlines the fixes applied to resolve notification issues where:
1. Admin notifications were not showing badge/alert in the sidebar
2. Marketers were not receiving notifications when their clients completed phases
3. No notification sound was playing for new notifications

## Changes Made

### 1. Created NotificationNavItem Component
**File**: `fca-web/src/components/layout/NotificationNavItem.jsx`

A new custom navigation component that:
- Shows an unread notification badge on the Notifications menu item
- Subscribes to real-time notification updates via Supabase
- Plays a pleasant double-beep sound when new notifications arrive
- Supports three variants: `detail` (expanded sidebar), `rail` (collapsed sidebar), and `mobile`
- Polls for new notifications every 15 seconds as a backup to real-time subscriptions

### 2. Updated Layout to Use NotificationNavItem
**File**: `fca-web/src/Layout.jsx`

Modified the Layout component to:
- Import and integrate the `NotificationNavItem` component
- Mark the notifications menu item as `isCustom: true`
- Render `NotificationNavItem` instead of a regular NavLink for all three navigation variants (NavigationRail, DetailSidebar, MobileNavigation)

### 3. Database Migration for Marketer Notifications
**File**: `supabase/migrations/update_phase_notification_trigger.sql`

Updated the database trigger to:
- Notify ALL admins when a phase is completed
- Identify the marketer associated with the client (via `marketer_id` and `marketers.user_id`)
- Send a personalized notification to the marketer: "{Client Name} (your referral) has just completed the {Phase Name}."
- Ensure marketers who are also admins only receive one notification
- Only send notifications to active users

## How to Apply the Changes

### Step 1: Apply Database Migration

The database migration must be applied to update the notification trigger. You have two options:

#### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Open the file: `/Users/jalexander/Documents/10. Python Projects/FCA/supabase/migrations/update_phase_notification_trigger.sql`
4. Copy the entire contents
5. Paste into the SQL Editor and click "Run"
6. Verify the trigger was created by running:
   ```sql
   SELECT trigger_name, event_object_table, action_statement
   FROM information_schema.triggers
   WHERE trigger_name = 'notify_on_phase_completion_trigger';
   ```

#### Option B: Using Supabase CLI
```bash
cd "/Users/jalexander/Documents/10. Python Projects/FCA"
supabase db push
```

### Step 2: Verify Marketer Setup

For marketers to receive notifications, they MUST have a linked user account. You can verify this in the Supabase dashboard:

```sql
-- Check clients with marketers
SELECT 
  c.id AS client_id,
  c.first_name || ' ' || c.last_name AS client_name,
  m.id AS marketer_id,
  m.name AS marketer_name,
  m.user_id AS marketer_user_id,
  u.name AS user_name,
  u.email AS user_email,
  u.role AS user_role,
  u.is_active AS user_active
FROM clients c
LEFT JOIN marketers m ON c.marketer_id = m.id
LEFT JOIN users u ON m.user_id = u.id
WHERE c.marketer_id IS NOT NULL
ORDER BY c.created_at DESC
LIMIT 20;
```

Look for:
- ✅ Marketer has a `user_id` (not NULL)
- ✅ User account exists and is linked
- ✅ User `is_active = true`
- ❌ If `user_id` is NULL, the marketer CANNOT receive notifications

### Step 3: Link Marketers to User Accounts

If a marketer does NOT have a `user_id`, they cannot receive notifications. To fix this:

1. **Option A**: Create a user account for the marketer
   - Go to Settings → Users
   - Create a new user with role "marketer"
   - Link the user to the marketer record

2. **Option B**: Update existing marketer record via SQL
   ```sql
   -- Find the user
   SELECT id, name, email, role FROM users WHERE email = 'marketer@example.com';
   
   -- Update the marketer record
   UPDATE marketers 
   SET user_id = '<user_id_from_above>'
   WHERE id = '<marketer_id>';
   ```

### Step 4: Test the Notifications

1. **Test the Badge Display**:
   - Open the app in your browser
   - Look at the Notifications menu item in the sidebar
   - You should see a red badge with the unread count if there are any unread notifications

2. **Test Phase Completion Notifications**:
   - Go to a client's detail page
   - Complete a phase (e.g., mark "Intake Phase" as finalized)
   - Expected behavior:
     - Admin(s) receive notification: "{Client Name} has just completed the {Phase Name}."
     - Marketer receives notification: "{Client Name} (your referral) has just completed the {Phase Name}."
     - Red badge appears on Notifications menu item
     - Two-tone beep sound plays
   
3. **Test Real-time Updates**:
   - Open the app in two browser windows
   - Log in as different users
   - Complete a phase in one window
   - The other window should immediately:
     - Update the unread badge count
     - Play the notification sound

## Troubleshooting

### Issue: Marketer not receiving notifications

**Possible causes**:
1. Marketer doesn't have a `user_id` linked → Run `verify-phase-trigger.js` to check
2. Marketer's user account is `is_active = false` → Update user to active
3. Client doesn't have a `marketer_id` set → Assign a marketer to the client
4. Database trigger wasn't applied → Re-run the migration SQL

### Issue: No badge showing on Notifications menu

**Possible causes**:
1. NotificationNavItem not rendering → Check browser console for errors
2. Real-time subscription failed → Check Supabase connection
3. RLS policies blocking access → Verify RLS policies on `notifications` table

### Issue: No sound playing

**Possible causes**:
1. Browser autoplay policy blocked the sound → User needs to interact with the page first
2. Web Audio API not supported → Check browser compatibility
3. JavaScript error → Check browser console

## Technical Details

### Notification Sound Implementation
The notification sound uses the Web Audio API to generate a pleasant double-beep:
- First tone: 800Hz sine wave, 0.3 second duration
- Second tone: 1000Hz sine wave, 0.2 second duration, 100ms delay
- Volume: 30% for first tone, 20% for second tone

### Real-time Subscription
The component subscribes to Supabase real-time changes on the `notifications` table:
```javascript
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, callback)
  .subscribe()
```

### Polling Backup
As a backup to real-time subscriptions, the component polls for new notifications every 15 seconds.

## Files Modified

- ✅ `fca-web/src/components/layout/NotificationNavItem.jsx` (NEW)
- ✅ `fca-web/src/Layout.jsx` (MODIFIED)
- ✅ `fca-web/src/Pages/ClientDetail.jsx` (MODIFIED - fixed to use URL params)
- ✅ `supabase/migrations/update_phase_notification_trigger.sql` (EXISTING)

## Next Steps

After applying these changes:
1. **Apply the database migration** (see Step 1 above)
2. **Verify marketer setup** using the SQL query (see Step 2 above)
3. **Link any marketers** without user accounts (see Step 3 above)
4. **Test the notifications** (see Step 4 above)
5. **Verify the badge and sound** are working

---

**Date**: November 7, 2025  
**Status**: Ready for testing

