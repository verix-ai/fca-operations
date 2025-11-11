# Deployment Checklist - Client Profile Enhancement

**Date:** November 10, 2025  
**Critical:** Run ALL migrations in order!

---

## 🚨 IMPORTANT: Database Migrations Required

You MUST run these migrations in your Supabase SQL Editor **IN THIS ORDER**:

### 1. ✅ Invites Fix (if not already run)
**File:** `supabase/migrations/fix_invites_insert_policy.sql`
- Fixes invite creation errors (406 & 403)
- Adds missing RLS policies for INSERT and DELETE

### 2. ✅ Basic Intake Fields (if not already run)
**File:** `supabase/migrations/add_client_intake_fields.sql`
- Adds: `client_name`, `company`, `program`, `caregiver_name`, `client_phone`, `caregiver_phone`, `caregiver_relationship`, `frequency`, `location`, `intake_date`, `director_of_marketing`, `notes`

### 3. ✅ Phase Tracking Fields (if not already run)  
**File:** `add-phase-tracking-fields.sql`
- Adds all phase checkpoint boolean fields
- Adds `training_or_care_start_date`

### 4. ⭐ **NEW: Referral Fields** (MUST RUN)
**File:** `supabase/migrations/add_referral_fields_to_clients.sql`
- Adds 17 new columns for complete referral data preservation
- **THIS IS CRITICAL FOR SHOWING ALL DATA**

---

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New query**
5. For EACH migration file:
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)
   - Verify success message
6. Repeat for all 4 migrations

### Option 2: Supabase CLI

```bash
cd "/Users/jalexander/Documents/10. Python Projects/FCA"
supabase db push
```

---

## What's Been Fixed

### ✅ Code Changes (Already Applied)

1. **ClientIntake.jsx** - Now transfers ALL referral data to client
2. **ClientEditForm.jsx** - Shows ALL fields in organized sections:
   - Client Information (8 fields)
   - Demographics (3 fields)
   - Contact Information (2 fields)
   - Address (5 fields)
   - Caregiver Details (3 fields)
   - Medical Information (2 fields)
   - Benefits Information (2 fields)
   - Referral Information (3 fields)
   - Additional Information (notes)

3. **ClientOverview.jsx** - Fixed marketer permissions (read-only)
4. **Invite.supabase.js** - Fixed 406 error with `.maybeSingle()`

### 🔍 Debug Logging Added

Console logs added to help diagnose the program issue:
- Shows intake form data before processing
- Shows referral prefill data
- Shows final client data being saved

**Check browser console** when creating a client to see what's actually being submitted!

---

## Testing After Deployment

### 1. Verify Migrations Ran Successfully

Run this query in Supabase SQL Editor:

```sql
-- Check all new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name IN (
    -- Intake fields
    'client_name', 'company', 'program', 'location', 'intake_date',
    'director_of_marketing', 'notes', 'frequency', 'caregiver_name',
    'caregiver_relationship', 'client_phone', 'caregiver_phone',
    -- New referral fields
    'sex', 'date_of_birth', 'medicaid_or_ssn',
    'address_line1', 'address_line2', 'city', 'state', 'zip',
    'caregiver_lives_in_home', 'physician', 'diagnosis',
    'services_needed', 'receives_benefits', 'benefits_pay_date',
    'heard_about_us', 'additional_info', 'referral_date'
  )
ORDER BY column_name;
```

Expected: **30 rows** returned

### 2. Test Full Flow

1. **Create a Referral** (as marketer or admin)
   - Fill in ALL fields in referral form
   - Note the program selected
   - Save referral

2. **Convert to Client**
   - Go to Prospects
   - Click "Start Intake" on the referral
   - Fill in the intake form
   - **Verify program is pre-filled** from referral
   - **Check browser console** for the 3 debug logs
   - Submit

3. **View Client Profile**
   - Navigate to the new client
   - Go to "Edit Details" tab
   - **ALL sections should show data** from referral and intake
   - Verify program is displayed
   - Check all other fields

4. **Edit Client**
   - Click "Edit" button
   - All fields should be editable
   - Make a change and save
   - Verify it persists

### 3. Test Permissions

**As Marketer:**
- View client profile ✅
- Phase checkboxes should be **disabled** (read-only) ✅
- Edit Details tab should be **hidden** ✅

**As Admin:**
- View client profile ✅
- Phase checkboxes should be **editable** ✅
- Edit Details tab should be **visible** ✅

### 4. Test Invites

- Create an invite
- Should NOT get 406 or 403 errors
- Invite should be created successfully

---

## Troubleshooting

### Problem: Program still showing "-"

**Check:**
1. ✅ Did migration `add_client_intake_fields.sql` run? (adds `program` column)
2. ✅ Open browser console when creating client - what does it log?
3. ✅ Check the intake form - is program being selected?
4. ✅ After creating client, run this query:
   ```sql
   SELECT id, client_name, program FROM clients ORDER BY created_at DESC LIMIT 5;
   ```
   Does the program column have data?

### Problem: Other fields showing "-"

**Check:**
1. ✅ Did migration `add_referral_fields_to_clients.sql` run?
2. ✅ Was this client created BEFORE or AFTER running the migration?
   - Clients created before: Will have empty fields (expected)
   - Clients created after: Should have full data

### Problem: Can't run migrations

**Error: "relation already exists"**
- This is OK! It means that column was already added
- The migration uses `ADD COLUMN IF NOT EXISTS` so it won't fail

**Error: Permission denied**
- Make sure you're logged into the correct Supabase project
- Verify you have admin access

---

## Summary of Database Schema Changes

### Before
```
clients table: ~22 columns
- Basic info only
- Most referral data LOST
```

### After (with ALL migrations)
```
clients table: ~52 columns
- Complete client information
- Complete referral data preserved
- Complete intake data
- All phase tracking fields
```

---

## Support

If issues persist:

1. **Check console logs** - Debug output will show what's being submitted
2. **Verify migrations** - Run the verification query above
3. **Check existing vs new** - Existing clients won't have new data (expected)
4. **Create fresh client** - Test with a brand new referral → intake → client flow

---

## ✅ Success Criteria

After deployment, you should be able to:

- [x] See ALL 30+ fields in client Edit Details view
- [x] Create referral with full data
- [x] Convert to client without data loss
- [x] See program populated from intake form
- [x] Edit all fields
- [x] Marketers have read-only access to phases
- [x] Create invites without errors

**Status: Ready to test once migrations are run!** 🚀

