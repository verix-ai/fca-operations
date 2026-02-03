import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'
import { Client } from '@/entities/Client.supabase'
import { ClientCaregiver } from '@/entities/ClientCaregiver.supabase'
import { Notification } from '@/entities/Notification.supabase'

const clientConnectService = new SupabaseService('client_connect')

/**
 * Get current user's organization ID and user info
 */
async function getUserOrganization() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: userProfile, error } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', user.id)
        .single()

    if (error) throw error
    if (!userProfile?.organization_id) {
        throw new Error('User not assigned to an organization')
    }

    return { userId: user.id, organizationId: userProfile.organization_id, role: userProfile.role }
}

export const ClientConnect = {
    /**
     * List all client_connect entries in current user's organization
     * @param {Object} options - Query options
     * @param {string} options.status - Filter by status ('pending', 'approved', or null for all)
     * @returns {Promise<Array>} Array of client_connect objects
     */
    async list(options = {}) {
        const { organizationId } = await getUserOrganization()

        let query = supabase
            .from('client_connect')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })

        if (options.status && options.status !== 'all') {
            query = query.eq('status', options.status)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    },

    /**
     * Get a single client_connect entry by ID
     * @param {string} id - Entry ID
     * @returns {Promise<Object>} Client connect object
     */
    async get(id) {
        const { data, error } = await supabase
            .from('client_connect')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        return data
    },

    /**
     * Create a new client_connect entry
     * @param {Object} data - Client connect data
     * @returns {Promise<Object>} Created entry
     */
    async create(data) {
        const { userId, organizationId } = await getUserOrganization()

        const entryData = {
            organization_id: organizationId,
            created_by: userId,
            client_name: data.client_name,
            email: data.email || null,
            phone: data.phone || null,
            location: data.location || null,
            caregiver_name: data.caregiver_name || null,
            caregiver_phone: data.caregiver_phone || null,
            caregiver_email: data.caregiver_email || null,
            relationship: data.relationship || null,
            program: data.program || null,
            company: data.company || null,
            pay_rate: data.pay_rate || null,
            status: 'pending'
        }

        return clientConnectService.create(entryData)
    },

    /**
     * Update a client_connect entry
     * @param {string} id - Entry ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated entry
     */
    async update(id, updates) {
        return clientConnectService.update(id, updates)
    },

    /**
     * Delete a client_connect entry
     * @param {string} id - Entry ID
     * @returns {Promise<Object>} Success status
     */
    async remove(id) {
        return clientConnectService.remove(id)
    },

    /**
     * Approve a client_connect entry
     * Creates real client and caregiver records, links them, and marks entry as approved
     * @param {string} id - Entry ID
     * @returns {Promise<Object>} Object with created client and caregiver
     */
    async approve(id) {
        const { userId, organizationId } = await getUserOrganization()

        // Get the client_connect entry
        const entry = await this.get(id)
        if (!entry) throw new Error('Client Connect entry not found')
        if (entry.status === 'approved') throw new Error('Entry already approved')

        // Parse name into first/last
        const nameParts = (entry.client_name || '').trim().split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        // Create the client record
        const clientData = {
            client_name: entry.client_name,
            first_name: firstName,
            last_name: lastName,
            email: entry.email || null,
            client_phone: entry.phone || null,
            program: entry.program || null,
            intake_date: new Date().toISOString().split('T')[0],
            current_phase: 'onboarding',
            status: 'active',
            // Also store caregiver info directly on client for list view
            caregiver_name: entry.caregiver_name || null,
            caregiver_relationship: entry.relationship || null,
            caregiver_phone: entry.caregiver_phone || null,
            caregiver_email: entry.caregiver_email || null,
        }

        const newClient = await Client.create(clientData)

        // Create the caregiver record if caregiver info provided
        let newCaregiver = null
        if (entry.caregiver_name) {
            const caregiverPayload = {
                full_name: entry.caregiver_name,
                relationship: entry.relationship || null,
                phone: entry.caregiver_phone || null,
                email: entry.caregiver_email || null,
                lives_in_home: false,
                status: 'active',
            }

            newCaregiver = await ClientCaregiver.addCaregiver(newClient.id, caregiverPayload)
        }

        // Update the client_connect entry with approval info
        await this.update(id, {
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: userId,
            client_id: newClient.id,
            caregiver_id: newCaregiver?.id || null
        })

        return {
            client: newClient,
            caregiver: newCaregiver
        }
    },

    /**
     * Check for stale entries and send notifications to admins
     * @param {number} staleDays - Number of days to consider an entry stale
     * @returns {Promise<number>} Number of notifications sent
     */
    async checkStaleEntries(staleDays = 7) {
        const { organizationId } = await getUserOrganization()

        // Calculate threshold date
        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - staleDays)

        // Get pending entries older than threshold that haven't been notified
        const { data: staleEntries, error } = await supabase
            .from('client_connect')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('status', 'pending')
            .is('stale_notified_at', null)
            .lt('created_at', thresholdDate.toISOString())

        if (error) throw error
        if (!staleEntries || staleEntries.length === 0) return 0

        // Get admin users in the organization
        const { data: admins, error: adminError } = await supabase
            .from('users')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('role', 'admin')

        if (adminError) throw adminError

        const adminIds = admins?.map(a => a.id) || []
        let notificationsSent = 0

        // Create notifications for each stale entry
        for (const entry of staleEntries) {
            const daysPending = Math.floor((new Date() - new Date(entry.created_at)) / (1000 * 60 * 60 * 24))

            // Notify all admins
            for (const adminId of adminIds) {
                await Notification.create({
                    user_id: adminId,
                    type: 'client_connect_stale',
                    title: 'Client Connect Entry Needs Attention',
                    message: `"${entry.client_name}" has been pending for ${daysPending} days without approval.`,
                    related_entity_type: 'client_connect',
                    related_entity_id: entry.id
                })
                notificationsSent++
            }

            // Mark entry as notified to prevent duplicate notifications
            await supabase
                .from('client_connect')
                .update({ stale_notified_at: new Date().toISOString() })
                .eq('id', entry.id)
        }

        return notificationsSent
    },

    /**
     * Get count of pending entries
     * @returns {Promise<number>} Count of pending entries
     */
    async getPendingCount() {
        const { organizationId } = await getUserOrganization()

        const { count, error } = await supabase
            .from('client_connect')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('status', 'pending')

        if (error) throw error
        return count || 0
    }
}

export default ClientConnect
