import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const cmCompanyService = new SupabaseService('cm_companies')

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

export const CmCompany = {
  /**
   * List all case management companies in current user's organization
   * @returns {Promise<Array>} Array of CM company objects
   */
  async list() {
    return cmCompanyService.list({ sort: 'name:asc' })
  },

  /**
   * Get a single CM company by ID
   * @param {string} id - CM company ID
   * @returns {Promise<Object>} CM company object
   */
  async get(id) {
    return cmCompanyService.get(id)
  },

  /**
   * Create a new CM company
   * @param {Object} data - CM company data
   * @param {string} data.name - Company name (required)
   * @param {string} data.contact_name - Contact person name
   * @param {string} data.contact_email - Contact email
   * @param {string} data.contact_phone - Contact phone
   * @returns {Promise<Object>} Created CM company
   */
  async create(data) {
    const { organizationId } = await getUserOrganization()

    const name = (data?.name || '').trim()
    if (!name) throw new Error('Name is required')

    // Check if CM company already exists with same name
    const existing = await cmCompanyService.list({ filters: { name } })
    if (existing.length > 0) {
      throw new Error('CM company with this name already exists')
    }

    const companyData = {
      organization_id: organizationId,
      name,
      contact_name: data.contact_name || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      contact_fax: data.contact_fax || null,
    }

    return cmCompanyService.create(companyData)
  },

  /**
   * Update a CM company
   * @param {string} id - CM company ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated CM company
   */
  async update(id, updates) {
    // If updating name, check for duplicates
    if (updates.name) {
      const name = updates.name.trim()
      if (!name) throw new Error('Name is required')

      const existing = await cmCompanyService.list({ filters: { name } })
      const duplicate = existing.find(c => c.id !== id)
      if (duplicate) {
        throw new Error('CM company with this name already exists')
      }
    }

    return cmCompanyService.update(id, updates)
  },

  /**
   * Delete a CM company
   * @param {string} id - CM company ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    // Check if any clients are using this CM company
    const { count, error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('cm_company_id', id)

    if (error) throw error

    if (count > 0) {
      throw new Error(`Cannot delete CM company: ${count} client(s) are assigned to it`)
    }

    return cmCompanyService.remove(id)
  },

  /**
   * Get CM company with client count
   * @param {string} id - CM company ID
   * @returns {Promise<Object>} CM company with client count
   */
  async getWithStats(id) {
    const company = await cmCompanyService.get(id)

    const { count, error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('cm_company_id', id)

    if (error) throw error

    return {
      ...company,
      client_count: count || 0
    }
  }
}

export default CmCompany

