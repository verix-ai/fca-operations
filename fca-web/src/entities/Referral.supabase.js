import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const referralService = new SupabaseService('referrals')

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
 * Parse and merge notes field from referral data
 */
function parseReferralNotes(referral) {
  if (!referral) return referral
  
  // If notes is a JSON string, parse it and merge into the object
  if (referral.notes && typeof referral.notes === 'string') {
    try {
      const parsed = JSON.parse(referral.notes)
      return { ...referral, ...parsed }
    } catch {
      // If parsing fails, just return as-is
      return referral
    }
  }
  
  return referral
}

export const Referral = {
  /**
   * List all referrals in current user's organization
   * @returns {Promise<Array>} Array of referral objects (newest first)
   */
  async list() {
    const referrals = await referralService.list({ sort: 'created_at:desc' })
    // Parse notes field for each referral
    return referrals.map(parseReferralNotes)
  },

  /**
   * Get a single referral by ID
   * @param {string} id - Referral ID
   * @returns {Promise<Object>} Referral object
   */
  async get(id) {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        client:clients(id, first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return parseReferralNotes(data)
  },

  /**
   * Get referrals for a specific client
   * @param {string} clientId - Client ID
   * @returns {Promise<Array>} Array of referrals for the client
   */
  async getByClient(clientId) {
    return referralService.list({
      filters: { client_id: clientId },
      sort: 'created_at:desc'
    })
  },

  /**
   * Create a new referral
   * @param {Object} data - Referral data
   * @param {string} data.client_id - Client ID (optional - null for prospects)
   * @param {string} data.referred_by - Who referred the client
   * @param {string} data.referral_date - Date of referral
   * @param {string} data.referral_source - Source of referral
   * @param {string} data.notes - Additional notes
   * @returns {Promise<Object>} Created referral
   */
  async create(data) {
    const { organizationId } = await getUserOrganization()

    // Extract only the core fields that exist in the database table
    // Schema: id, organization_id, client_id, referred_by, referral_date, referral_source, notes, created_at, updated_at
    const {
      client_id,
      referred_by,
      referral_date,
      referral_source,
      ...extraFields
    } = data

    // Store all extra fields (including marketer info) in the notes field as JSON
    const referralData = {
      organization_id: organizationId,
      client_id,
      referred_by: referred_by || null,
      referral_date: referral_date || null,
      referral_source: referral_source || null,
      notes: JSON.stringify(extraFields)
    }

    const result = await referralService.create(referralData)
    return parseReferralNotes(result)
  },

  /**
   * Update a referral
   * @param {string} id - Referral ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated referral
   */
  async update(id, updates) {
    // First, get the existing referral to merge with
    const existing = await this.get(id)
    
    // Extract only core fields that exist in database
    // Schema: id, organization_id, client_id, referred_by, referral_date, referral_source, notes, created_at, updated_at
    const {
      client_id,
      referred_by,
      referral_date,
      referral_source,
      notes,
      organization_id,
      created_at,
      updated_at,
      client, // Remove nested client object from updates
      id: _id, // Remove id from updates
      ...extraFields
    } = updates

    // Build update data with only core fields
    const updateData = {
      ...(client_id !== undefined && { client_id }),
      ...(referred_by !== undefined && { referred_by }),
      ...(referral_date !== undefined && { referral_date }),
      ...(referral_source !== undefined && { referral_source }),
    }

    // Merge extra fields with existing notes data
    if (Object.keys(extraFields).length > 0) {
      // Parse existing notes to preserve all data
      let existingNotes = {}
      if (existing.notes && typeof existing.notes === 'string') {
        try {
          existingNotes = JSON.parse(existing.notes)
        } catch {
          // If parsing fails, start fresh
        }
      }
      
      // Merge existing notes with new fields
      const mergedNotes = { ...existingNotes, ...extraFields }
      updateData.notes = JSON.stringify(mergedNotes)
    }

    const result = await referralService.update(id, updateData)
    return parseReferralNotes(result)
  },

  /**
   * Delete a referral
   * @param {string} id - Referral ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    return referralService.remove(id)
  },

  /**
   * Search referrals by source or referred_by
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching referrals
   */
  async search(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.list()
    }

    const term = searchTerm.toLowerCase().trim()

    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        client:clients(id, first_name, last_name)
      `)
      .or(`referred_by.ilike.%${term}%,referral_source.ilike.%${term}%,notes.ilike.%${term}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(parseReferralNotes)
  },

  /**
   * Get referral statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    const referrals = await this.list()

    // Count by source
    const bySource = {}
    referrals.forEach(ref => {
      const source = ref.referral_source || 'Unknown'
      bySource[source] = (bySource[source] || 0) + 1
    })

    return {
      total: referrals.length,
      by_source: bySource
    }
  }
}

export default Referral

