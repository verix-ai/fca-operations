// Database Backup Script
// Run with: node scripts/backup-db.js

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function backupTable(tableName) {
    console.log(`📦 Backing up ${tableName}...`)

    const { data, error } = await supabase
        .from(tableName)
        .select('*')

    if (error) {
        console.error(`❌ Error backing up ${tableName}:`, error.message)
        return null
    }

    console.log(`   ✓ ${data.length} rows`)
    return data
}

async function main() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = `./backups/${timestamp}`

    // Create backup directory
    mkdirSync(backupDir, { recursive: true })
    console.log(`\n📁 Backup directory: ${backupDir}\n`)

    // Tables to backup
    const tables = [
        'client_caregivers',
        'clients',
    ]

    const backup = {}

    for (const table of tables) {
        const data = await backupTable(table)
        if (data) {
            backup[table] = data
            // Save individual table file
            writeFileSync(`${backupDir}/${table}.json`, JSON.stringify(data, null, 2))
        }
    }

    // Save combined backup
    writeFileSync(`${backupDir}/full-backup.json`, JSON.stringify(backup, null, 2))

    console.log(`\n✅ Backup complete!`)
    console.log(`   Location: ${backupDir}/full-backup.json`)
}

main().catch(console.error)
