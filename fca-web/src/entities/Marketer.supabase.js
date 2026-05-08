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
  },

  /**
   * Get the marketer record linked to the currently logged-in user.
   * Returns null if the user is not linked to a marketer.
   */
  async getMine() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('marketers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  /**
   * Update the referral_slug on a marketer.
   * The DB trigger automatically pushes the previous slug into marketer_slug_aliases.
   */
  async updateSlug(id, slug) {
    return marketerService.update(id, { referral_slug: slug })
  },

  /**
   * Check if a slug is available (not used by any marketer or alias).
   * `excludeId` lets you exclude the current marketer from the check (so they can re-save the same slug).
   */
  async isSlugAvailable(slug, excludeId = null) {
    const lower = String(slug).toLowerCase()

    // Check active slugs
    let q = supabase.from('marketers').select('id').eq('referral_slug', lower).limit(1)
    if (excludeId) q = q.neq('id', excludeId)
    const { data: m, error: mErr } = await q
    if (mErr) throw mErr
    if ((m ?? []).length > 0) return false

    // Check aliases (any alias counts as taken, even our own — but the trigger will keep aliases unique to us)
    let q2 = supabase.from('marketer_slug_aliases').select('marketer_id').eq('slug', lower).limit(1)
    const { data: a, error: aErr } = await q2
    if (aErr) throw aErr
    if ((a ?? []).length > 0) {
      // If the only alias hit belongs to the same marketer, that's actually fine (they're reverting)
      if (excludeId && a[0].marketer_id === excludeId) return true
      return false
    }
    return true
  },
}

export default Marketer

