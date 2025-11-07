# Phase 3 Setup Guide: Database Schema & Migration

## 🎯 Goal
Deploy the database schema to Supabase and configure your environment.

## ⏱️ Estimated Time: 30-45 minutes

---

## Step 1: Access Your Supabase Dashboard

1. Go to https://app.supabase.com
2. Sign in to your account
3. Select your FCA project (or create a new one if you haven't yet)

---

## Step 2: Run Database Migrations

### Run Schema Migration (01_schema.sql)

1. In Supabase Dashboard, click **SQL Editor** in left sidebar
2. Click **New Query**
3. Open `/supabase/migrations/01_schema.sql` from your project
4. Copy the entire contents
5. Paste into the Supabase SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. ✅ You should see "Success. No rows returned"

**What this does:**
- Creates all tables (organizations, users, clients, etc.)
- Sets up indexes for performance
- Creates triggers for automatic `updated_at` timestamps

### Run RLS Policies (02_rls_policies.sql)

1. In SQL Editor, click **New Query** again
2. Open `/supabase/migrations/02_rls_policies.sql`
3. Copy and paste contents
4. Click **Run**
5. ✅ You should see "Success. No rows returned"

**What this does:**
- Enables Row Level Security on all tables
- Creates policies for multi-tenant data isolation
- Ensures users can only see their organization's data

### Run Seed Data (03_seed_data.sql)

1. In SQL Editor, click **New Query** again
2. Open `/supabase/migrations/03_seed_data.sql`
3. Copy and paste contents
4. Click **Run**
5. ✅ You should see "Success" with 1 row inserted for organizations

**What this does:**
- Creates default development organization
- Adds sample programs (EDWP, PCA, PACE)
- Adds sample CM companies

---

## Step 3: Verify Installation

Run this verification query in SQL Editor:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled (rowsecurity should be 't' for all)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check seed data
SELECT * FROM organizations;
SELECT * FROM programs;
SELECT * FROM cm_companies;
```

Expected results:
- ✅ 10 tables listed (organizations, users, clients, etc.)
- ✅ All tables have `rowsecurity = t`
- ✅ 1 organization, 3 programs, 3 cm_companies

---

## Step 4: Configure Environment Variables

### Get Your Supabase Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (the long string under "Project API keys")

### Create .env.local File

1. In your project, go to `/fca-web/` directory
2. Create a new file called `.env.local`
3. Add your credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Save the file

**⚠️ Important:** 
- Never commit `.env.local` to Git (already in .gitignore)
- Use `.env.example` as a template for team members

---

## Step 5: Configure Authentication Providers

### Enable Email Authentication (Already enabled by default)

1. Go to **Authentication** → **Providers**
2. Verify **Email** is enabled ✅

### Configure OAuth Providers (Optional but Recommended)

#### Google OAuth

1. Go to **Authentication** → **Providers**
2. Click on **Google**
3. Toggle to **Enable**
4. You'll need to set up Google OAuth:
   - Go to https://console.cloud.google.com
   - Create a project (or select existing)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret
   - Paste into Supabase
5. Click **Save**

#### GitHub OAuth (Optional)

1. In Supabase, click **GitHub** under Providers
2. Toggle to **Enable**
3. You'll need to set up GitHub OAuth:
   - Go to https://github.com/settings/developers
   - Create new OAuth App
   - Authorization callback URL: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret
   - Paste into Supabase
4. Click **Save**

### Configure Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:5173` (for development)
3. Add **Redirect URLs**:
   - `http://localhost:5173/auth/callback`
   - (Add production URLs later)

---

## Step 6: Create Your First Admin User

Since signups are invite-only, you need to create your first admin manually.

### Method 1: Using SQL (Recommended for first admin)

1. First, sign up through Supabase Auth UI:
   - In Supabase Dashboard, go to **Authentication** → **Users**
   - Click **Add User** → **Create new user**
   - Enter email and password
   - Click **Create user**
   - Note the User ID (UUID)

2. Create user profile with admin role:

```sql
-- Replace USER_ID with the UUID from step 1
-- Replace email and name with your info
INSERT INTO users (id, organization_id, email, name, role, is_active)
VALUES (
  'YOUR_USER_ID_HERE',
  '00000000-0000-0000-0000-000000000001',  -- Dev org from seed data
  'your-email@example.com',
  'Your Name',
  'admin',
  true
);
```

### Method 2: Using Your App

1. Temporarily modify signup to allow first user:
   - Open `/fca-web/src/Pages/Signup.jsx`
   - Comment out the invite requirement check temporarily
   - Sign up normally
   - Run SQL to change role to 'admin'
   - Uncomment the invite check

---

## Step 7: Test Your Setup

### Start Development Server

```bash
cd fca-web
npm run dev
```

### Test Authentication

1. Go to http://localhost:5173
2. Try logging in with your admin user
3. You should be redirected to the dashboard
4. ✅ Success if no errors appear

### Test Database Queries

1. Try creating a test client through the UI
2. Check Supabase Dashboard → **Table Editor** → **clients**
3. ✅ You should see your test client with correct `organization_id`

### Test Multi-Tenant Isolation

1. Create an invite for a second test user
2. Sign up with the invite
3. Verify they can't see any data (no clients, different org)

---

## Troubleshooting

### "Missing Supabase environment variables"

**Problem:** App won't start, shows environment error  
**Solution:** 
- Check that `.env.local` exists in `/fca-web/` directory
- Verify variable names start with `VITE_`
- Restart dev server after creating `.env.local`

### "User not assigned to an organization"

**Problem:** Can't create clients, see this error  
**Solution:**
- Run this to check your user profile:
```sql
SELECT * FROM users WHERE email = 'your-email@example.com';
```
- If no row exists, run the INSERT query from Step 6
- If organization_id is NULL, update it:
```sql
UPDATE users 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE email = 'your-email@example.com';
```

### "permission denied for table"

**Problem:** RLS blocking your queries  
**Solution:**
- Verify RLS policies were created:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```
- Re-run `02_rls_policies.sql` if no policies exist
- Make sure your user has a profile in `users` table

### Can't sign in after signup

**Problem:** Authentication works but app shows errors  
**Solution:**
- Check browser console for errors
- Verify user profile exists in `users` table
- Check that `organization_id` is set correctly

### OAuth redirect not working

**Problem:** After clicking Google/GitHub, nothing happens  
**Solution:**
- Verify redirect URL is correct in OAuth provider settings
- Check Supabase logs: **Dashboard** → **Logs** → **Auth**
- Make sure Site URL is set in Supabase Authentication settings

---

## ✅ Checklist: Phase 3 Complete

- [ ] All tables created in Supabase
- [ ] RLS policies enabled and working
- [ ] Seed data inserted
- [ ] Environment variables configured (`.env.local`)
- [ ] First admin user created
- [ ] Can log in successfully
- [ ] Can create and view clients
- [ ] Multi-tenant isolation working
- [ ] OAuth providers configured (optional)

---

## 🎉 Next Steps

Once Phase 3 is complete, you can move on to:

**Phase 5: Multi-Tenant Features**
- Create Team Management page
- Build invite system UI
- Add Organization Settings page

**Or start using the app right away!**
- Create clients
- Manage programs
- Track phases
- Add notes

---

## Need Help?

Common issues and solutions:
1. Check the `/supabase/migrations/README.md` for detailed troubleshooting
2. Review Supabase logs in Dashboard → Logs
3. Test SQL queries directly in SQL Editor to debug RLS issues
4. Check browser console for JavaScript errors





