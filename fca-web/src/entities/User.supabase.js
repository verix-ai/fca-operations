import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const userService = new SupabaseService('users')

/**
 * Get current user's organization ID
 */
async function getUserOrganization() {
  // First try to get session - more reliable than getUser()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.error('❌ Session error:', sessionError)
    throw new Error(`Authentication error: ${sessionError.message}`)
  }

  if (!session?.user) {
    console.error('❌ No session found')
    throw new Error('Not authenticated. Please sign in again.')
  }

  const user = session.user

  const { data: userProfile, error } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('❌ Error fetching user profile:', error)
    throw error
  }

  if (!userProfile?.organization_id) {
    throw new Error('User not assigned to an organization')
  }

  return { userId: user.id, organizationId: userProfile.organization_id, role: userProfile.role }
}

export const User = {
  /**
   * List all users in current user's organization
   * @returns {Promise<Array>} Array of user objects
   */
  async list() {
    const { organizationId } = await getUserOrganization()

    console.log('🔍 User.list() - Filtering by organization_id:', organizationId)

    // Explicitly filter by organization_id to ensure RLS works correctly
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching users:', error)
      throw error
    }

    console.log('👥 User.list() - Found users:', data?.length || 0, 'users in organization', organizationId)
    if (data && data.length > 0) {
      console.log('👥 User list details:', data.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        organization_id: u.organization_id,
        is_active: u.is_active
      })))
    }

    return data || []
  },

  /**
   * Get a single user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object
   */
  async get(id) {
    return userService.get(id)
  },

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null
   */
  async findByEmail(email) {
    const users = await this.list()
    const normalized = String(email || '').trim().toLowerCase()
    return users.find(u => String(u.email || '').toLowerCase() === normalized) || null
  },

  /**
   * Update a user
   * @param {string} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  async update(id, updates) {
    const { role } = await getUserOrganization()

    // Only admins can update other users
    if (role !== 'admin') {
      throw new Error('Only admins can update user information')
    }

    return userService.update(id, updates)
  },

  /**
   * Deactivate a user
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  async deactivate(id) {
    const { userId, role } = await getUserOrganization()

    // Only admins can deactivate users
    if (role !== 'admin') {
      throw new Error('Only admins can deactivate users')
    }

    // Prevent self-deactivation
    if (id === userId) {
      throw new Error('Cannot deactivate your own account')
    }

    return userService.update(id, { is_active: false })
  },

  /**
   * Reactivate a user
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  async reactivate(id) {
    const { role } = await getUserOrganization()

    // Only admins can reactivate users
    if (role !== 'admin') {
      throw new Error('Only admins can reactivate users')
    }

    return userService.update(id, { is_active: true })
  },

  /**
   * Change user role
   * @param {string} id - User ID
   * @param {string} newRole - New role ('admin' or 'marketer')
   * @returns {Promise<Object>} Updated user
   */
  async changeRole(id, newRole) {
    const { userId, role } = await getUserOrganization()

    // Only admins can change roles
    if (role !== 'admin') {
      throw new Error('Only admins can change user roles')
    }

    // Prevent self-role-change
    if (id === userId) {
      throw new Error('Cannot change your own role')
    }

    // Validate role
    if (!['admin', 'marketer'].includes(newRole)) {
      throw new Error('Invalid role. Must be admin or marketer')
    }

    return userService.update(id, { role: newRole })
  },

  /**
   * Delete a user permanently
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { role, userId } = await getUserOrganization()

    // Only admins can delete users
    if (role !== 'admin') {
      throw new Error('Only admins can delete users')
    }

    if (id === userId) {
      throw new Error('Cannot delete your own account')
    }

    const { error } = await supabase.rpc('delete_user_by_admin', {
      target_user_id: id
    })

    if (error) {
      console.error('Error calling delete_user_by_admin:', error)
      throw new Error(error.message || 'Failed to delete user')
    }

    return true
  },

  /**
   * Get all active users
   * @returns {Promise<Array>} Array of active users
   */
  async getActive() {
    return userService.list({
      filters: { is_active: true },
      sort: 'name:asc'
    })
  },

  /**
   * Get users by role
   * @param {string} role - Role name
   * @returns {Promise<Array>} Array of users
   */
  async getByRole(role) {
    return userService.list({
      filters: { role },
      sort: 'name:asc'
    })
  }
}

export default User


