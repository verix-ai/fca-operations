# Database Migrations

This directory contains SQL migration files for the FCA database.

## How to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Log in to your Supabase project at https://supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the migration file (e.g., `add_client_intake_fields.sql`)
5. Copy the entire SQL content
6. Paste it into the SQL Editor
7. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

```bash
# Navigate to project root
cd /Users/jalexander/Documents/10. Python Projects/FCA

# Apply the migration
supabase db push
```

## Current Migrations

### `add_client_intake_fields.sql`
- **Date**: 2025-11-07
- **Purpose**: Adds intake form fields to clients table
- **Fields Added**:
  - `company` (TEXT) - Company name (e.g., FCA)
  - `program` (TEXT) - Program name (e.g., PSS, PCA)
  - `caregiver_name` (TEXT) - Primary caregiver name
  - `client_phone` (TEXT) - Client phone number
  - `caregiver_phone` (TEXT) - Caregiver phone number
  - `caregiver_relationship` (TEXT) - Caregiver relationship to client
  - `frequency` (TEXT) - Service frequency (e.g., 8hrs/5days)
  - `director_of_marketing` (TEXT) - Marketing director name
  - `notes` (TEXT) - Additional notes

## Migration History

Keep track of applied migrations:

- [ ] `add_client_intake_fields.sql` - Pending
