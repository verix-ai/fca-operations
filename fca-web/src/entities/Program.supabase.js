import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const programService = new SupabaseService('programs')

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

export const Program = {
  /**
   * List all programs in current user's organization
   * @returns {Promise<Array>} Array of program objects
   */
  async list() {
    return programService.list({ sort: 'name:asc' })
  },

  /**
   * Get a single program by ID
   * @param {string} id - Program ID
   * @returns {Promise<Object>} Program object
   */
  async get(id) {
    return programService.get(id)
  },

  /**
   * Create a new program
   * @param {Object} data - Program data
   * @param {string} data.name - Program name (required)
   * @param {string} data.description - Program description
   * @returns {Promise<Object>} Created program
   */
  async create(data) {
    const { organizationId } = await getUserOrganization()

    const name = (data?.name || '').trim()
    if (!name) throw new Error('Name is required')

    // Check if program already exists with same name
    const existing = await programService.list({ filters: { name } })
    if (existing.length > 0) {
      throw new Error('Program with this name already exists')
    }

    const programData = {
      organization_id: organizationId,
      name,
      description: data.description || null,
    }

    return programService.create(programData)
  },

  /**
   * Update a program
   * @param {string} id - Program ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated program
   */
  async update(id, updates) {
    // If updating name, check for duplicates
    if (updates.name) {
      const name = updates.name.trim()
      if (!name) throw new Error('Name is required')

      const existing = await programService.list({ filters: { name } })
      const duplicate = existing.find(p => p.id !== id)
      if (duplicate) {
        throw new Error('Program with this name already exists')
      }
    }

    return programService.update(id, updates)
  },

  /**
   * Delete a program
   * @param {string} id - Program ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    // Check if any clients are using this program
    const { count, error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', id)

    if (error) throw error

    if (count > 0) {
      throw new Error(`Cannot delete program: ${count} client(s) are using it`)
    }

    return programService.remove(id)
  },

  /**
   * Get program with client count
   * @param {string} id - Program ID
   * @returns {Promise<Object>} Program with client count
   */
  async getWithStats(id) {
    const program = await programService.get(id)

    const { count, error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', id)

    if (error) throw error

    return {
      ...program,
      client_count: count || 0
    }
  },

  /**
   * Get all programs with client counts
   * @returns {Promise<Array>} Array of programs with client counts
   */
  async listWithStats() {
    const programs = await this.list()

    // Get client counts for all programs
    const programsWithStats = await Promise.all(
      programs.map(async (program) => {
        const { count, error } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('program_id', program.id)

        return {
          ...program,
          client_count: error ? 0 : (count || 0)
        }
      })
    )

    return programsWithStats
  }
}

export default Program

