# Fix Marketer Notifications - Quick Setup Guide

## Issues Being Fixed

1. ❌ **Marketer not notified when CM company assigned** → ✅ FIXED
2. ❌ **Marketer not notified when client intake completed** → ✅ FIXED  
3. ❌ **Marketer not notified when phase completed** → ✅ FIXED

## Step 1: Apply the Database Migration

### Go to Supabase Dashboard → SQL Editor

Copy and paste this entire file:
```
/Users/jalexander/Documents/10. Python Projects/FCA/supabase/migrations/add_comprehensive_marketer_notifications.sql
```

Click **"Run"** to execute the migration.

## Step 2: Verify Marketers Have User Accounts

The migration includes a verification query at the end that will show you all marketers and whether they have linked user accounts.

**Look for the output table showing:**
- `marketer_id`
- `marketer_name`
- `user_id` ← **This MUST NOT be NULL**
- `user_name`
- `user_email`
- `user_active` ← **This MUST be true**

### If a Marketer Has NO `user_id`:

You need to link the marketer to a user account. Run this in Supabase SQL Editor:

```sql
-- Example: Link marketer "Zim Zimmerman" to their user account

-- First, find the user
SELECT id, name, email, role, is_active 
FROM users 
WHERE email = 'zim@example.com';  -- Replace with actual email

-- Then update the marketer record
UPDATE marketers 
SET user_id = '<user_id_from_above>'  -- Replace with actual UUID
WHERE name = 'Zim Zimmerman';  -- Or use: WHERE id = '<marketer_id>'
```

## Step 3: Test the Notifications

### Test 1: CM Company Assignment
1. Go to **Prospects** page
2. Find a referral from the marketer
3. Assign a **Case Management Company** from the dropdown
4. **Expected**: Marketer receives notification: "{Referral Name} has been assigned to {CM Company}."

### Test 2: Client Intake Completed  
1. Go to **Prospects** page
2. Click **"Start Intake"** on a referral from the marketer
3. Complete the intake form and submit
4. **Expected**: Marketer receives notification: "Your referral {Client Name} has completed client intake and is now active."

### Test 3: Phase Completion
1. Go to a **Client Detail** page (for a client referred by the marketer)
2. Complete/finalize a phase (e.g., mark "Intake Phase" as finalized)
3. **Expected**: 
   - Admin receives notification: "{Client Name} has just completed the {Phase Name}."
   - Marketer receives notification: "{Client Name} (your referral) has just completed the {Phase Name}."
   - Notification sound plays (double-beep)
   - Red badge appears on Notifications menu

## What the Migration Adds

### 1. CM Company Assignment Trigger
- **Table**: `referrals`
- **Event**: When `cm_company` is updated
- **Notifies**: Marketer who created the referral
- **Type**: `referral_updated`

### 2. Client Intake Completion Trigger
- **Table**: `clients`  
- **Event**: When a new client is created (INSERT)
- **Notifies**: Marketer linked to the client
- **Type**: `client_created`

### 3. Phase Completion Trigger (Enhanced)
- **Table**: `clients`
- **Event**: When phase finalized fields are updated
- **Notifies**: All admins + Marketer
- **Type**: `phase_completed`

## Troubleshooting

### Marketer Still Not Getting Notifications?

Run this query to check the specific marketer:

```sql
SELECT 
  c.id AS client_id,
  c.first_name || ' ' || c.last_name AS client_name,
  c.marketer_id,
  m.name AS marketer_name,
  m.user_id AS marketer_user_id,
  u.name AS user_name,
  u.email AS user_email,
  u.role AS user_role,
  u.is_active AS user_active
FROM clients c
LEFT JOIN marketers m ON c.marketer_id = m.id
LEFT JOIN users u ON m.user_id = u.id
WHERE m.name = 'Zim Zimmerman'  -- Replace with actual marketer name
LIMIT 5;
```

**Check**:
- ✅ `marketer_user_id` is NOT NULL
- ✅ `user_active` is true
- ✅ `user_email` matches the marketer's login email

### If Still No Notifications:

Check the notifications table directly:

```sql
SELECT 
  n.id,
  n.type,
  n.title,
  n.message,
  n.created_at,
  n.is_read,
  u.name AS user_name,
  u.email AS user_email
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
WHERE n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;
```

This shows all notifications created in the last hour.

---

**Date**: November 7, 2025  
**Status**: Ready to apply

