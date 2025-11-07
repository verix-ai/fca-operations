# Invite Flow Setup Guide

## Overview
This guide documents the complete invite flow setup and the critical Supabase settings required for the system to work correctly.

## Expected Flow

1. **Admin Invites User**
   - Admin goes to Settings page
   - Enters email and selects role (admin/marketer)
   - System creates invite record and sends email

2. **User Receives Email**
   - Professional email with "Accept Invitation" button
   - Link format: `https://your-domain.com/signup?invite={TOKEN}`

3. **User Clicks Invite Link**
   - Taken to Signup page with invite token
   - Email is pre-filled from invite
   - Invite is verified (valid, not expired, not used)

4. **User Creates Account**
   - Fills in name and password
   - Submits form
   - Account is created in Supabase Auth
   - User profile is created in `public.users` table
   - Invite is marked as used

5. **User Redirected to Login**
   - Success message displayed: "Account created successfully! Please sign in with your credentials."
   - User can immediately login with their new password

6. **User Logs In**
   - Enters credentials on login page
   - Redirected to dashboard with full access

## Critical Supabase Settings

### ⚠️ IMPORTANT: Disable Email Confirmation

**Why:** The invite link click already serves as email verification. Requiring a second email confirmation creates a poor user experience.

**How to Configure:**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Settings**
4. Find **Email Auth** section
5. **DISABLE** the following setting:
   - ✅ **"Enable email confirmations"** should be **OFF/DISABLED**

### Alternative: Auto-Confirm via Database Trigger

If you need email confirmations enabled for other reasons, you can auto-confirm invited users with a database trigger:

```sql
-- Create a function to auto-confirm invited users
CREATE OR REPLACE FUNCTION auto_confirm_invited_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's a valid invite for this email
  IF EXISTS (
    SELECT 1 FROM public.invites 
    WHERE email = NEW.email 
    AND used = false 
    AND expires_at > NOW()
  ) THEN
    -- Auto-confirm the user
    NEW.email_confirmed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (requires Supabase admin access)
-- Note: This trigger operates on auth.users which is in the auth schema
-- You may need to run this via Supabase Support or using service role key
```

## Database Schema Requirements

### Invites Table
Ensure your `invites` table has these columns:
- `id` (uuid, primary key)
- `organization_id` (uuid, foreign key to organizations)
- `email` (text)
- `role` (text: 'admin' or 'marketer')
- `token` (uuid, unique)
- `expires_at` (timestamp)
- `used` (boolean, default false)
- `used_at` (timestamp, nullable)
- `invited_by` (uuid, foreign key to users)
- `created_at` (timestamp)

### Users Table
Ensure your `users` table has these columns:
- `id` (uuid, primary key, matches auth.users.id)
- `organization_id` (uuid, foreign key to organizations)
- `email` (text, unique)
- `name` (text)
- `role` (text: 'admin', 'marketer', or 'viewer')
- `is_active` (boolean, default true)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Row Level Security (RLS) Policies

### Invites Table

#### Select Policy (Admins can view)
```sql
CREATE POLICY "Admins can view invites"
ON invites FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
```

#### Insert Policy (Admins can create)
```sql
CREATE POLICY "Admins can create invites"
ON invites FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
```

#### Update Policy (Admins can update)
```sql
CREATE POLICY "Admins can update invites"
ON invites FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
```

#### Delete Policy (Admins can delete)
```sql
CREATE POLICY "Admins can delete invites"
ON invites FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
```

#### Special Policy (Anyone can verify invite tokens)
```sql
CREATE POLICY "Anyone can verify invite tokens"
ON invites FOR SELECT
TO anon, authenticated
USING (true);
```

**Note:** This last policy allows unauthenticated users to verify invite tokens on the signup page.

### Users Table

#### Insert Policy (Allow profile creation during signup)
```sql
CREATE POLICY "Allow user profile creation during signup"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only create their own profile
  id = auth.uid()
  AND
  -- Must have a valid invite for this email and organization
  EXISTS (
    SELECT 1 FROM invites 
    WHERE invites.email = users.email 
    AND invites.organization_id = users.organization_id
    AND invites.used = true
  )
);
```

## Email Provider Configuration

### Required Environment Variables

Set these in Supabase Edge Functions:

```bash
# Choose one email provider: resend (recommended), sendgrid, or mailgun
supabase secrets set EMAIL_PROVIDER=resend

# Resend (Recommended)
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
supabase secrets set EMAIL_FROM=noreply@yourdomain.com

# SendGrid (Alternative)
supabase secrets set SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
supabase secrets set EMAIL_FROM=noreply@yourdomain.com

# Mailgun (Alternative)
supabase secrets set MAILGUN_API_KEY=xxxxxxxxxxxxx
supabase secrets set MAILGUN_DOMAIN=yourdomain.com
supabase secrets set EMAIL_FROM=noreply@yourdomain.com
```

### Verify Edge Function Deployment

```bash
# Deploy the edge function
supabase functions deploy send-invite-email

# Test it
curl -i --location --request POST \
  'https://your-project.supabase.co/functions/v1/send-invite-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "test@example.com",
    "inviteUrl": "https://yourapp.com/signup?invite=test-token",
    "inviteRole": "marketer",
    "organizationName": "Test Org",
    "inviterName": "Admin User"
  }'
```

## Frontend Environment Variables

Ensure these are set in your `.env.local` file:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Testing Checklist

Before manual testing, verify:

- [ ] Supabase email confirmations are DISABLED
- [ ] Edge function is deployed and configured
- [ ] Email provider API keys are set
- [ ] RLS policies are in place
- [ ] Database schema is correct
- [ ] Frontend environment variables are set

## Common Issues and Solutions

### Issue: "Email confirmation required"
**Solution:** Disable email confirmations in Supabase Auth settings

### Issue: "Permission denied" when creating user profile
**Solution:** Check RLS policies on users table, ensure invite verification policy exists

### Issue: Invite email not sending
**Solution:** 
- Check edge function logs in Supabase dashboard
- Verify email provider API keys are set correctly
- Check email provider dashboard for delivery status

### Issue: User can't login after signup
**Solution:** 
- Verify email confirmation is disabled
- Check that user profile was created in public.users table
- Ensure user's `is_active` field is true

## Code Changes Applied

### 1. Signup.jsx
**Changed:** Redirect destination after successful signup
- **Before:** `navigate('/dashboard')`
- **After:** `navigate('/login', { state: { message: 'Account created successfully! Please sign in with your credentials.' } })`

### 2. AuthProvider.jsx (signUp function)
**Changed:** Added emailRedirectTo option
- **Purpose:** Ensures proper callback handling if email confirmation is enabled
- **Note:** This is a safety measure; email confirmation should still be disabled

### 3. Login.jsx
**Changed:** Added success message display
- **Added:** `successMessage` state to show signup success message
- **Added:** Green alert banner for success messages

## Support

If you encounter issues during testing:
1. Check Supabase Auth logs
2. Check Edge Function logs
3. Check browser console for errors
4. Verify database state (invites table, users table)

