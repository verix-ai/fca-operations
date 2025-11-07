# Database Validation Scripts

This directory contains scripts for validating and inspecting the Supabase database.

## Scripts

### `validate-schema.js`

Validates that all required tables and columns exist in the database.

**Location:** The validation script is located in `fca-web/validate-schema.js`

**Usage:**
```bash
cd fca-web
node validate-schema.js
```

**Why in fca-web?** The script imports `@supabase/supabase-js` which is installed in the `fca-web/node_modules` directory.

**Output:**
- Lists all tables and their status
- Checks for missing columns
- Provides summary of validation results

**Exit codes:**
- `0` - All validations passed
- `1` - Validation failed or error occurred

## Prerequisites

1. Node.js installed
2. Supabase credentials in `fca-web/.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_SERVICE_KEY`

## Running Validations

### Quick Check
```bash
node scripts/database/validate-schema.js
```

### CI/CD Integration
```bash
# Add to your CI/CD pipeline
npm run validate:db || exit 1
```

## Expected Tables

The validation script checks for these tables:

1. **organizations** - Multi-tenant organizations
2. **users** - User profiles
3. **clients** - Client records
4. **client_notes** - Client notes
5. **marketers** - Marketing representatives
6. **programs** - Available programs
7. **cm_companies** - Case management companies
8. **referrals** - Referral sources
9. **invites** - User invitations

## Troubleshooting

### "Missing Supabase credentials"
- Ensure `fca-web/.env.local` exists
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set

### "Table NOT FOUND"
- Run migrations from `/supabase/migrations/`
- Check Supabase dashboard to verify tables exist

### "Column missing"
- Schema may be out of date
- Run latest migration files
- Check if column was renamed

## Notes

- These scripts use the anon key by default
- For sensitive operations, use service role key
- Always test on development database first

