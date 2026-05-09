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
   * Update a user's title (free-text). Pass null/empty to clear.
   * RLS handles authorization (self-edit + admin-in-org).
   * @param {string} userId
   * @param {string|null} title
   * @returns {Promise<object>} updated user row
   */
  async updateTitle(userId, title) {
    const trimmed = (title ?? '').trim()
    const next = trimmed.length === 0 ? null : trimmed
    if (next != null && next.length > 100) {
      throw new Error('Title must be 100 characters or fewer.')
    }
    const { data, error } = await supabase
      .from('users')
      .update({ title: next })
      .eq('id', userId)
      .select()
      .single()
    if (error) {
      console.error('❌ User.updateTitle error:', error)
      throw error
    }
    return data
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
  },

  /**
   * Get the currently logged-in user's referral_slug + identity.
   * Returns null if not authenticated. Returns { id, role, referral_slug }.
   */
  async getMySlug() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null
    const { data, error } = await supabase
      .from('users')
      .select('id, role, referral_slug')
      .eq('id', session.user.id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  /**
   * Update the current user's referral_slug.
   * The DB trigger automatically pushes the previous slug into user_slug_aliases.
   */
  async updateMySlug(slug) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('users')
      .update({ referral_slug: slug })
      .eq('id', session.user.id)
      .select('id, role, referral_slug')
      .single()
    if (error) throw error
    return data
  },

  /**
   * Check if a slug is available (not used by any user or alias).
   * `excludeUserId` lets you exclude the current user from the check
   * so they can re-save their existing slug.
   */
  async isSlugAvailable(slug, excludeUserId = null) {
    const lower = String(slug).toLowerCase()

    let q = supabase.from('users').select('id').eq('referral_slug', lower).limit(1)
    if (excludeUserId) q = q.neq('id', excludeUserId)
    const { data: u, error: uErr } = await q
    if (uErr) throw uErr
    if ((u ?? []).length > 0) return false

    const { data: a, error: aErr } = await supabase
      .from('user_slug_aliases')
      .select('user_id')
      .eq('slug', lower)
      .limit(1)
    if (aErr) throw aErr
    if ((a ?? []).length > 0) {
      // If the only alias hit belongs to the same user, that's actually fine (reverting).
      if (excludeUserId && a[0].user_id === excludeUserId) return true
      return false
    }
    return true
  },
}

export default User


