/**
 * Script to verify the phase completion notification trigger exists
 * and show what marketers are linked to clients
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Load environment variables from fca-web/.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = resolve(__dirname, 'fca-web', '.env')
dotenv.config({ path: envPath })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in fca-web/.env')
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyTrigger() {
  console.log('🔍 Verifying phase completion notification trigger...\n')

  try {
    // Check if the trigger exists
    const { data: triggers, error: triggerError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          trigger_name,
          event_object_table,
          action_statement,
          action_timing,
          event_manipulation
        FROM information_schema.triggers
        WHERE trigger_name = 'notify_on_phase_completion_trigger'
        OR trigger_name = 'notify_admins_on_phase_completion_trigger';
      `
    })

    if (triggerError) {
      console.log('⚠️  Could not verify trigger (may need admin access)')
      console.log('   Error:', triggerError.message)
    } else if (triggers && triggers.length > 0) {
      console.log('✅ Found trigger(s):')
      triggers.forEach(t => {
        console.log(`   - ${t.trigger_name}`)
        console.log(`     Table: ${t.event_object_table}`)
        console.log(`     Timing: ${t.action_timing} ${t.event_manipulation}`)
      })
    } else {
      console.log('❌ No phase completion triggers found!')
      console.log('   The migration may not have been applied yet.')
    }

    console.log('\n📊 Checking marketer-client relationships...\n')

    // Get clients with marketers
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        marketer_id,
        marketers (
          id,
          name,
          user_id,
          users (
            id,
            name,
            email,
            role,
            is_active
          )
        )
      `)
      .not('marketer_id', 'is', null)
      .limit(10)

    if (clientsError) {
      console.log('❌ Error fetching clients:', clientsError.message)
    } else if (!clients || clients.length === 0) {
      console.log('⚠️  No clients with marketers found')
    } else {
      console.log(`✅ Found ${clients.length} clients with marketers:\n`)
      clients.forEach(client => {
        const marketer = client.marketers
        console.log(`   Client: ${client.first_name} ${client.last_name} (${client.id})`)
        if (marketer) {
          console.log(`   Marketer: ${marketer.name} (${marketer.id})`)
          if (marketer.user_id) {
            const user = marketer.users
            if (user) {
              console.log(`   ✅ Linked User: ${user.name} (${user.email})`)
              console.log(`      Role: ${user.role}, Active: ${user.is_active}`)
            } else {
              console.log(`   ⚠️  Marketer has user_id but user not found`)
            }
          } else {
            console.log(`   ❌ Marketer has NO user_id - CANNOT receive notifications`)
          }
        } else {
          console.log(`   ⚠️  Marketer relationship not found`)
        }
        console.log('')
      })
    }

    // Check for existing notifications
    console.log('📬 Checking recent phase completion notifications...\n')
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        title,
        message,
        created_at,
        is_read,
        users (
          name,
          email,
          role
        )
      `)
      .eq('type', 'phase_completed')
      .order('created_at', { ascending: false })
      .limit(10)

    if (notifError) {
      console.log('❌ Error fetching notifications:', notifError.message)
    } else if (!notifications || notifications.length === 0) {
      console.log('⚠️  No phase completion notifications found')
    } else {
      console.log(`✅ Found ${notifications.length} recent phase completion notifications:\n`)
      notifications.forEach(n => {
        console.log(`   ${n.title} - ${new Date(n.created_at).toLocaleString()}`)
        console.log(`   To: ${n.users.name} (${n.users.email}) - ${n.users.role}`)
        console.log(`   Message: ${n.message}`)
        console.log(`   Read: ${n.is_read ? 'Yes' : 'No'}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message)
  }
}

verifyTrigger()


