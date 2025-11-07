/**
 * Database Validation Script
 * 
 * This script validates that all required tables exist in the Supabase database
 * and checks the schema structure matches the entity files.
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from fca-web/.env.local
const envPath = join(__dirname, 'fca-web', '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim()
  }
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

// Create Supabase client with service role key if available
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Expected tables based on entity files
const expectedTables = [
  {
    name: 'organizations',
    description: 'Multi-tenant organizations',
    expectedColumns: ['id', 'name', 'created_at', 'settings']
  },
  {
    name: 'users',
    description: 'User profiles linked to auth.users',
    expectedColumns: ['id', 'organization_id', 'email', 'name', 'role', 'is_active', 'avatar_url', 'created_at', 'updated_at']
  },
  {
    name: 'clients',
    description: 'Client records',
    expectedColumns: [
      'id', 'organization_id', 'created_by', 'first_name', 'last_name', 'email',
      'phone_numbers', 'county', 'current_phase', 'status', 'cost_share_amount',
      'marketer_id', 'program_id', 'cm_company_id', 'referral_id',
      'clinical_lead_completed', 'clinical_scheduler_completed', 'clinical_third_completed',
      'intake_finalized', 'onboarding_finalized', 'service_initiation_finalized',
      'created_at', 'updated_at'
    ]
  },
  {
    name: 'client_notes',
    description: 'Notes attached to clients',
    expectedColumns: ['id', 'organization_id', 'client_id', 'user_id', 'note', 'is_important', 'created_at', 'updated_at']
  },
  {
    name: 'marketers',
    description: 'Marketing representatives',
    expectedColumns: ['id', 'organization_id', 'name', 'email', 'phone', 'territory', 'user_id', 'is_active', 'created_at', 'updated_at']
  },
  {
    name: 'programs',
    description: 'Available programs',
    expectedColumns: ['id', 'organization_id', 'name', 'description', 'created_at', 'updated_at']
  },
  {
    name: 'cm_companies',
    description: 'Case management companies',
    expectedColumns: ['id', 'organization_id', 'name', 'contact_name', 'contact_email', 'contact_phone', 'created_at', 'updated_at']
  },
  {
    name: 'referrals',
    description: 'Referral sources',
    expectedColumns: ['id', 'organization_id', 'client_id', 'referred_by', 'referral_date', 'referral_source', 'notes', 'created_at', 'updated_at']
  },
  {
    name: 'invites',
    description: 'User invitations',
    expectedColumns: ['id', 'organization_id', 'email', 'role', 'token', 'expires_at', 'used', 'used_at', 'invited_by', 'created_at']
  }
]

async function validateDatabase() {
  console.log('🔍 Validating Supabase Database Schema\n')
  console.log(`📍 Connected to: ${supabaseUrl}\n`)
  console.log('=' .repeat(80))
  
  const results = {
    tablesFound: [],
    tablesMissing: [],
    columnsChecked: [],
    columnsMissing: [],
    errors: []
  }

  // Check each expected table
  for (const table of expectedTables) {
    console.log(`\n📋 Checking table: ${table.name}`)
    console.log(`   Description: ${table.description}`)

    try {
      // Try to query the table to see if it exists
      const { data, error, count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.log(`   ❌ Table NOT FOUND`)
          results.tablesMissing.push(table.name)
        } else {
          console.log(`   ⚠️  Error checking table: ${error.message}`)
          results.errors.push({ table: table.name, error: error.message })
        }
      } else {
        console.log(`   ✅ Table EXISTS (${count || 0} rows)`)
        results.tablesFound.push(table.name)

        // Check columns by trying to select them
        const { data: sample, error: colError } = await supabase
          .from(table.name)
          .select(table.expectedColumns.join(', '))
          .limit(1)

        if (colError) {
          // Try to figure out which column is missing
          for (const col of table.expectedColumns) {
            const { error: singleColError } = await supabase
              .from(table.name)
              .select(col)
              .limit(1)

            if (singleColError) {
              console.log(`      ❌ Column missing: ${col}`)
              results.columnsMissing.push({ table: table.name, column: col })
            } else {
              results.columnsChecked.push({ table: table.name, column: col })
            }
          }
        } else {
          console.log(`      ✅ All ${table.expectedColumns.length} expected columns found`)
          table.expectedColumns.forEach(col => {
            results.columnsChecked.push({ table: table.name, column: col })
          })
        }
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`)
      results.errors.push({ table: table.name, error: err.message })
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 VALIDATION SUMMARY\n')
  
  console.log(`✅ Tables Found: ${results.tablesFound.length}/${expectedTables.length}`)
  if (results.tablesFound.length > 0) {
    console.log(`   - ${results.tablesFound.join(', ')}`)
  }

  if (results.tablesMissing.length > 0) {
    console.log(`\n❌ Tables Missing: ${results.tablesMissing.length}`)
    console.log(`   - ${results.tablesMissing.join(', ')}`)
  }

  if (results.columnsMissing.length > 0) {
    console.log(`\n⚠️  Columns Missing: ${results.columnsMissing.length}`)
    results.columnsMissing.forEach(({ table, column }) => {
      console.log(`   - ${table}.${column}`)
    })
  }

  if (results.errors.length > 0) {
    console.log(`\n🚨 Errors Encountered: ${results.errors.length}`)
    results.errors.forEach(({ table, error }) => {
      console.log(`   - ${table}: ${error}`)
    })
  }

  console.log('\n' + '='.repeat(80))

  // Test RLS policies
  console.log('\n🔒 Testing Row Level Security (RLS)\n')
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('⚠️  Not authenticated - cannot test RLS policies')
      console.log('   Sign in to test RLS policies work correctly')
    } else {
      console.log(`✅ Authenticated as: ${user.email}`)
      
      // Try to fetch organizations
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
      
      if (orgError) {
        console.log(`❌ RLS may be blocking access: ${orgError.message}`)
      } else {
        console.log(`✅ Can read organizations table (${orgs?.length || 0} records)`)
      }
    }
  } catch (err) {
    console.log(`⚠️  Could not test RLS: ${err.message}`)
  }

  console.log('\n' + '='.repeat(80))

  // Final verdict
  const allTablesExist = results.tablesMissing.length === 0
  const noMissingColumns = results.columnsMissing.length === 0
  const noErrors = results.errors.length === 0

  if (allTablesExist && noMissingColumns && noErrors) {
    console.log('\n✅ DATABASE VALIDATION PASSED')
    console.log('   All tables and columns are present and accessible.\n')
    return true
  } else {
    console.log('\n❌ DATABASE VALIDATION FAILED')
    if (!allTablesExist) {
      console.log(`   - ${results.tablesMissing.length} table(s) missing`)
    }
    if (!noMissingColumns) {
      console.log(`   - ${results.columnsMissing.length} column(s) missing`)
    }
    if (!noErrors) {
      console.log(`   - ${results.errors.length} error(s) encountered`)
    }
    console.log('\n   Please run the migration files to set up the database.')
    console.log('   See: /supabase/migrations/README.md\n')
    return false
  }
}

// Run validation
validateDatabase()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err)
    process.exit(1)
  })

