# Automatic Marketer Setup - How It Works

## Overview

After applying the automation migration, **all future marketers will automatically be set up to receive notifications**. No manual linking required! 🎉

## What Happens Automatically

### Scenario 1: New Marketer User Created
```
Admin creates new user → Role set to "marketer" → ✅ Marketer record auto-created & linked
```

**Example:**
1. Admin invites new user: `sarah@example.com`
2. Sets role to `"marketer"` in the invite
3. User signs up and accepts invite
4. **AUTOMATIC**: Marketer record created in `marketers` table with `user_id` linked
5. ✅ Sarah can now receive all notifications!

### Scenario 2: Existing User Role Changed
```
User exists with different role → Admin changes role to "marketer" → ✅ Marketer record auto-created
```

**Example:**
1. User `john@example.com` exists with role `"staff"`
2. Admin changes John's role to `"marketer"` in Settings
3. **AUTOMATIC**: Marketer record created and linked
4. ✅ John can now receive all notifications!

### Scenario 3: Marketer Info Updated
```
Marketer user updates profile → ✅ Marketer record auto-synced
```

**Example:**
1. Zim changes his email from `zim@old.com` to `zim@new.com`
2. **AUTOMATIC**: Marketer record updated to match
3. ✅ All referrals still linked, notifications still work!

## How to Apply This Automation

### Run This Migration in Supabase:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy this file:
   ```
   /Users/jalexander/Documents/10. Python Projects/FCA/supabase/migrations/auto_create_marketer_on_user_creation.sql
   ```
3. Paste and click **"Run"**

### You'll See:
```
✅ AUTO-MARKETER SETUP COMPLETE!

Future behavior:
1. New user with role="marketer" → Marketer record auto-created
2. Existing user role changed to "marketer" → Marketer record auto-created
3. Marketer user info updated → Marketer record auto-synced

All future marketers will automatically receive notifications! 🎉
```

## What Gets Auto-Created

When a marketer user is created, the system automatically creates a matching entry in the `marketers` table:

```sql
INSERT INTO marketers (
  organization_id,  -- Same as user's organization
  user_id,          -- Links to user account (KEY!)
  name,             -- Same as user's name
  email,            -- Same as user's email
  is_active         -- Same as user's is_active
);
```

## How Notifications Work

Once a marketer record is linked to a user account, they automatically receive notifications for:

1. **Referral Events:**
   - ✅ When a CM company is assigned to their referral
   - ✅ When their referral completes client intake

2. **Client Events:**
   - ✅ When their client completes a phase (Intake, Onboarding, Service Initiation)
   - ✅ Real-time badge updates
   - ✅ Notification sounds

## Technical Details

### Database Triggers Created

1. **`auto_create_marketer_on_insert`**
   - Runs when new user is created
   - If role = "marketer", creates marketer record

2. **`auto_create_marketer_on_update`**
   - Runs when user is updated
   - If role changes to "marketer", creates marketer record

3. **`sync_marketer_on_user_update`**
   - Runs when marketer user is updated
   - Keeps marketer record in sync with user info

## Complete Setup Order

If you're setting up from scratch, run migrations in this order:

1. ✅ `create_marketers_from_users.sql` - Creates marketer records for existing users
2. ✅ `add_comprehensive_marketer_notifications.sql` - Adds notification triggers
3. ✅ `auto_create_marketer_on_user_creation.sql` - Automates future marketers

## Testing the Automation

### Test 1: Create New Marketer User

1. Go to Settings → Invite New User
2. Email: `test.marketer@example.com`
3. Role: `marketer`
4. Send invite and have them sign up

**Expected Result:**
- ✅ User account created in `users` table
- ✅ Marketer record auto-created in `marketers` table
- ✅ `user_id` automatically linked
- ✅ They can receive notifications immediately

### Test 2: Change Existing User to Marketer

1. Find a user with role `"staff"` or `"admin"`
2. Change their role to `"marketer"`

**Expected Result:**
- ✅ Marketer record auto-created
- ✅ Linked to their user account
- ✅ They can now receive marketer notifications

### Test 3: Verify in Database

Run this query to see all marketers:

```sql
SELECT 
  u.name AS user_name,
  u.role,
  m.name AS marketer_name,
  m.user_id,
  CASE 
    WHEN m.user_id IS NOT NULL THEN '✅ AUTO-LINKED'
    ELSE '❌ NOT LINKED'
  END AS status
FROM users u
LEFT JOIN marketers m ON m.user_id = u.id
WHERE u.role = 'marketer'
ORDER BY u.name;
```

## Troubleshooting

### Issue: New marketer not receiving notifications

**Check:**
1. Verify the trigger is installed:
   ```sql
   SELECT trigger_name 
   FROM information_schema.triggers 
   WHERE trigger_name LIKE '%marketer%';
   ```

2. Check if marketer record was created:
   ```sql
   SELECT * FROM marketers WHERE email = 'newmarketer@example.com';
   ```

3. Check if user_id is linked:
   ```sql
   SELECT m.*, u.name, u.email 
   FROM marketers m 
   JOIN users u ON m.user_id = u.id 
   WHERE u.email = 'newmarketer@example.com';
   ```

### Issue: Marketer record exists but user_id is NULL

This shouldn't happen with the automation, but if it does:

```sql
-- Manually link them
UPDATE marketers 
SET user_id = (SELECT id FROM users WHERE email = 'marketer@example.com')
WHERE email = 'marketer@example.com';
```

## Benefits

✅ **Zero manual work** - Marketers auto-configured
✅ **No forgotten steps** - Happens automatically
✅ **Always in sync** - User info updates → Marketer info updates
✅ **Scalable** - Works for 10 or 10,000 marketers
✅ **Bulletproof** - Database-level automation can't be skipped

---

**Date**: November 7, 2025  
**Status**: Ready to deploy

