# Phase Completion Notification - Enhanced Version

**Date:** November 7, 2025  
**Update:** Now notifies both admins AND the referring marketer

---

## What Changed

### Before:
- ✅ Admins notified when phase completed
- ❌ Marketer not notified

### After:
- ✅ Admins notified when phase completed
- ✅ **Marketer notified** (if they have a user account)
- ✅ No duplicate notifications (if marketer is also admin)

---

## Notification Recipients

When a client completes a phase:

### 1. **All Active Admins** receive:
```
Title: "Intake Phase Completed"
Message: "John Doe has just completed the Intake Phase."
```

### 2. **The Referring Marketer** receives:
```
Title: "Intake Phase Completed"
Message: "John Doe (your referral) has just completed the Intake Phase."
```

**Note:** The marketer message includes "(your referral)" to personalize it!

---

## How It Works

### Smart Logic:
1. Detects which phase was finalized (intake, onboarding, or service initiation)
2. Sends notification to all active admins
3. Looks up the client's marketer via `marketer_id`
4. Checks if marketer has a linked user account (`user_id` in marketers table)
5. If yes, sends personalized notification to marketer
6. **Prevents duplicates** if marketer is also an admin

### Phase Detection:
- **Intake Phase:** Triggered when `intake_finalized` changes from `false` → `true`
- **Onboarding Phase:** Triggered when `onboarding_finalized` changes from `false` → `true`
- **Service Initiation Phase:** Triggered when `service_initiation_finalized` changes from `false` → `true`

---

## How to Apply the Update

### Option 1: Supabase Dashboard (Recommended)

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the contents of: `supabase/migrations/update_phase_notification_trigger.sql`
5. Paste and click **Run**

### Option 2: Command Line

```bash
cd /Users/jalexander/Documents/10. Python Projects/FCA

# Using psql
psql "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/update_phase_notification_trigger.sql
```

---

## Testing the Notification

### Test Scenario:

1. **Log in as admin**
2. **Open a client** who is in the Intake phase
3. **Note the marketer** assigned to this client
4. **Complete all Intake checkboxes**:
   - ✅ Initial Assessment required
   - ✅ Clinical Dates Entered
   - ✅ Re-Assessment Date Entered
   - ✅ Initial Assessment Completed
   - ✅ Client Documents Populated
5. **Click "Submit"** to finalize the phase
6. **Check notifications**:
   - All admins should see: "John Doe has just completed the Intake Phase."
   - The marketer should see: "John Doe (your referral) has just completed the Intake Phase."

---

## Technical Details

### Database Function: `notify_on_phase_completion()`

**Key Features:**
- Uses `DECLARE` block for local variables
- Builds personalized client name from available fields
- Tracks notified users to prevent duplicates
- Queries `marketers` table for `user_id` link
- Validates user is active before sending

**Performance:**
- Efficient: Only runs on UPDATE operations
- Smart: Only processes when finalization fields change
- Safe: Uses array tracking to prevent duplicate notifications

---

## What Gets Stored

Each notification includes:

| Field | Value |
|-------|-------|
| `type` | `'phase_completed'` |
| `title` | `'Intake Phase Completed'` |
| `message` | `'John Doe has just completed the Intake Phase.'` |
| `related_entity_type` | `'client'` |
| `related_entity_id` | Client's UUID |
| `user_id` | Admin or Marketer's user ID |

---

## Troubleshooting

### "Marketer not receiving notification"

**Check:**
1. Does the marketer have a user account?
   ```sql
   SELECT m.name, m.user_id, u.email, u.is_active
   FROM marketers m
   LEFT JOIN users u ON m.user_id = u.id
   WHERE m.id = '[marketer-id]';
   ```

2. Is the `user_id` field populated in the marketers table?
   - If `NULL`, the marketer doesn't have a linked user account
   - They need to be invited and create an account

3. Is the user active?
   ```sql
   SELECT is_active FROM users WHERE id = '[user-id]';
   ```

### "Getting duplicate notifications"

This shouldn't happen due to the duplicate prevention logic, but if it does:
- Check if the trigger fired multiple times
- Verify the `notified_users` array is working correctly

---

## Future Enhancements

Potential improvements:
1. **Email notifications** when phase completed
2. **Slack/Teams integration** for team alerts
3. **Custom notification preferences** per user
4. **Summary digest** of all phase completions
5. **Celebration animations** in the UI 🎉

---

**Status:** ✅ Ready to apply and test!

