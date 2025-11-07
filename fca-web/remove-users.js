#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fupcxuwfonuajbblwlfd.supabase.co'

// Get service role key from environment variable or command line argument
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2]

if (!serviceRoleKey || serviceRoleKey.trim() === '') {
  console.error('❌ Service role key is required')
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=your_key node remove-users.js')
  console.error('   OR: node remove-users.js your_key')
  process.exit(1)
}

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey.trim(), {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

;(async () => {

  try {
    console.log('🔍 Fetching all users...')
    
    // List all users using admin API
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      process.exit(1)
    }

    console.log(`\n📊 Found ${users.length} user(s) total`)
    
    // Filter out the user to keep
    const keepEmail = 'jalexander@verix.ai'
    const usersToDelete = users.filter(user => user.email !== keepEmail)
    const userToKeep = users.find(user => user.email === keepEmail)

    if (!userToKeep) {
      console.error(`❌ User ${keepEmail} not found. Aborting to prevent deleting all users.`)
      process.exit(1)
    }

    console.log(`\n✅ Keeping user: ${keepEmail} (ID: ${userToKeep.id})`)
    console.log(`\n🗑️  Will delete ${usersToDelete.length} user(s):`)
    usersToDelete.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`)
    })

    if (usersToDelete.length === 0) {
      console.log('\n✅ No users to delete. Only jalexander@verix.ai exists.')
      process.exit(0)
    }

    console.log('\n🚀 Deleting users...')
    
    // Delete each user
    for (const user of usersToDelete) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
      
      if (deleteError) {
        console.error(`❌ Error deleting ${user.email}:`, deleteError.message)
      } else {
        console.log(`✅ Deleted ${user.email}`)
      }
    }

    // Verify deletion
    console.log('\n🔍 Verifying results...')
    const { data: { users: remainingUsers }, error: verifyError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (verifyError) {
      console.error('❌ Error verifying deletion:', verifyError.message)
      process.exit(1)
    }

    console.log(`\n✅ Deletion complete! ${remainingUsers.length} user(s) remaining:`)
    remainingUsers.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`)
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
})()

