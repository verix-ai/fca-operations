import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const clientService = new SupabaseService('clients')

/**
 * Get current user's organization ID
 */
async function getUserOrganization() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: userProfile, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (error) throw error
  if (!userProfile?.organization_id) {
    throw new Error('User not assigned to an organization')
  }

  return { userId: user.id, organizationId: userProfile.organization_id }
}

/**
 * Coerce client record to ensure proper types
 */
function coerceClientRecord(input) {
  const record = { ...input }

  // Normalize cost_share_amount to number
  if ('cost_share_amount' in record) {
    if (typeof record.cost_share_amount === 'string' && record.cost_share_amount.trim() !== '') {
      const parsed = parseFloat(record.cost_share_amount)
      record.cost_share_amount = Number.isFinite(parsed) ? parsed : 0
    } else if (record.cost_share_amount == null) {
      record.cost_share_amount = 0
    }
  }

  // Normalize phone_numbers to array
  if ('phone_numbers' in record) {
    if (!Array.isArray(record.phone_numbers)) {
      record.phone_numbers = record.phone_numbers ? [String(record.phone_numbers)] : []
    }
  }

  return record
}

export const Client = {
  /**
   * List all clients in current user's organization
   * @param {string} sortBy - Sort field and direction (e.g., '-created_at', 'last_name')
   * @returns {Promise<Array>} Array of client objects
   */
  async list(sortBy) {
    // Convert sortBy format from '-field' to 'field:desc'
    let sort = 'created_at:desc' // default
    if (sortBy) {
      const isDescending = sortBy.startsWith('-')
      const field = sortBy.replace(/^[-+]/, '')
      sort = `${field}:${isDescending ? 'desc' : 'asc'}`
    }

    return clientService.list({ sort })
  },

  /**
   * Get a single client by ID with related data
   * @param {string} id - Client ID
   * @returns {Promise<Object>} Client object with related data
   */
  async get(id) {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        *,
        caregivers:client_caregivers(*),
        marketer:marketers(*),
        cm_company:cm_companies(*),
        notes:client_notes(
          *,
          user:users(id, name, email)
        ),
        referral:referrals(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new client
   * @param {Object} data - Client data
   * @returns {Promise<Object>} Created client
   */
  async create(data) {
    const { userId, organizationId } = await getUserOrganization()

    const clientData = coerceClientRecord({
      ...data,
      organization_id: organizationId,
      created_by: userId,
      // Ensure defaults
      current_phase: data.current_phase || 'intake',
      status: data.status || 'active',
      cost_share_amount: data.cost_share_amount || 0,
      // Clinical tracking defaults
      clinical_lead_completed: data.clinical_lead_completed || false,
      clinical_scheduler_completed: data.clinical_scheduler_completed || false,
      clinical_third_completed: data.clinical_third_completed || false,
      // Phase finalization defaults
      intake_finalized: data.intake_finalized || false,
      onboarding_finalized: data.onboarding_finalized || false,
      service_initiation_finalized: data.service_initiation_finalized || false,
    })

    return clientService.create(clientData)
  },

  /**
   * Update a client
   * @param {string} id - Client ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated client
   */
  async update(id, updates) {
    const coercedUpdates = coerceClientRecord(updates)
    return clientService.update(id, coercedUpdates)
  },

  /**
   * Delete a client
   * @param {string} id - Client ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    return clientService.remove(id)
  },

  /**
   * Get clients by phase
   * @param {string} phase - Phase name
   * @returns {Promise<Array>} Array of clients
   */
  async getByPhase(phase) {
    return clientService.list({
      filters: { current_phase: phase },
      sort: 'updated_at:desc'
    })
  },

  /**
   * Get clients by status
   * @param {string} status - Status name
   * @returns {Promise<Array>} Array of clients
   */
  async getByStatus(status) {
    return clientService.list({
      filters: { status },
      sort: 'updated_at:desc'
    })
  },

  /**
   * Get clients by county
   * @param {string} county - County name
   * @returns {Promise<Array>} Array of clients
   */
  async getByCounty(county) {
    return clientService.list({
      filters: { county },
      sort: 'last_name:asc'
    })
  },

  /**
   * Get clients by marketer
   * @param {string} marketerId - Marketer ID
   * @returns {Promise<Array>} Array of clients
   */
  async getByMarketer(marketerId) {
    return clientService.list({
      filters: { marketer_id: marketerId },
      sort: 'created_at:desc'
    })
  },

  /**
   * Get clients by program
   * @param {string} programId - Program ID
   * @returns {Promise<Array>} Array of clients
   */
  async getByProgram(programId) {
    return clientService.list({
      filters: { program_id: programId },
      sort: 'created_at:desc'
    })
  },

  /**
   * Search clients by name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching clients
   */
  async search(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.list()
    }

    const term = searchTerm.toLowerCase().trim()

    // Search across first_name, last_name, and email
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
      .order('last_name', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Get summary statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    const { userId, organizationId } = await getUserOrganization()

    // Get counts by phase
    const { data: clients, error } = await supabase
      .from('clients')
      .select('current_phase, status')
      .eq('organization_id', organizationId)

    if (error) throw error

    const stats = {
      total: clients.length,
      active: clients.filter(c => c.status === 'active').length,
      inactive: clients.filter(c => c.status === 'inactive').length,
      byPhase: {
        intake: clients.filter(c => c.current_phase === 'intake').length,
        onboarding: clients.filter(c => c.current_phase === 'onboarding').length,
        service_initiation: clients.filter(c => c.current_phase === 'service_initiation').length,
        active: clients.filter(c => c.current_phase === 'active').length,
        closed: clients.filter(c => c.current_phase === 'closed').length,
      }
    }

    return stats
  }
}

export default Client

