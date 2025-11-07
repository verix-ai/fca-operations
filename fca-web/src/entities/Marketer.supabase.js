import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const marketerService = new SupabaseService('marketers')

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

export const Marketer = {
  /**
   * List all marketers in current user's organization
   * @returns {Promise<Array>} Array of marketer objects
   */
  async list() {
    return marketerService.list({ sort: 'name:asc' })
  },

  /**
   * Get a single marketer by ID
   * @param {string} id - Marketer ID
   * @returns {Promise<Object>} Marketer object
   */
  async get(id) {
    return marketerService.get(id)
  },

  /**
   * Create a new marketer
   * @param {Object} data - Marketer data
   * @param {string} data.name - Marketer name (required)
   * @param {string} data.email - Email address
   * @param {string} data.phone - Phone number
   * @param {string} data.territory - Territory/region
   * @returns {Promise<Object>} Created marketer
   */
  async create(data) {
    const { organizationId } = await getUserOrganization()

    const name = (data?.name || '').trim()
    if (!name) throw new Error('Name is required')

    // Check if marketer already exists with same name
    const existing = await marketerService.list({ filters: { name } })
    if (existing.length > 0) {
      throw new Error('Marketer with this name already exists')
    }

    const marketerData = {
      organization_id: organizationId,
      name,
      email: data.email || null,
      phone: data.phone || null,
      territory: data.territory || null,
      is_active: data.is_active !== false, // Default to true
    }

    return marketerService.create(marketerData)
  },

  /**
   * Update a marketer
   * @param {string} id - Marketer ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated marketer
   */
  async update(id, updates) {
    // If updating name, check for duplicates
    if (updates.name) {
      const name = updates.name.trim()
      if (!name) throw new Error('Name is required')

      const existing = await marketerService.list({ filters: { name } })
      const duplicate = existing.find(m => m.id !== id)
      if (duplicate) {
        throw new Error('Marketer with this name already exists')
      }
    }

    return marketerService.update(id, updates)
  },

  /**
   * Delete a marketer
   * @param {string} id - Marketer ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    return marketerService.remove(id)
  },

  /**
   * Get all active marketers
   * @returns {Promise<Array>} Array of active marketers
   */
  async getActive() {
    return marketerService.list({
      filters: { is_active: true },
      sort: 'name:asc'
    })
  },

  /**
   * Get marketers by territory
   * @param {string} territory - Territory name
   * @returns {Promise<Array>} Array of marketers
   */
  async getByTerritory(territory) {
    return marketerService.list({
      filters: { territory },
      sort: 'name:asc'
    })
  },

  /**
   * Link marketer to user account
   * @param {string} marketerId - Marketer ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated marketer
   */
  async linkToUser(marketerId, userId) {
    return marketerService.update(marketerId, { user_id: userId })
  },

  /**
   * Unlink marketer from user account
   * @param {string} marketerId - Marketer ID
   * @returns {Promise<Object>} Updated marketer
   */
  async unlinkFromUser(marketerId) {
    return marketerService.update(marketerId, { user_id: null })
  },

  /**
   * Deactivate a marketer
   * @param {string} id - Marketer ID
   * @returns {Promise<Object>} Updated marketer
   */
  async deactivate(id) {
    return marketerService.update(id, { is_active: false })
  },

  /**
   * Reactivate a marketer
   * @param {string} id - Marketer ID
   * @returns {Promise<Object>} Updated marketer
   */
  async reactivate(id) {
    return marketerService.update(id, { is_active: true })
  }
}

export default Marketer

