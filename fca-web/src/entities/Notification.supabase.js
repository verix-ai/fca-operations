import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const notificationService = new SupabaseService('notifications')

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

export const Notification = {
  /**
   * List all notifications for current user
   * @param {Object} options - Query options
   * @param {string} options.type - Filter by notification type
   * @param {boolean} options.unreadOnly - Only show unread notifications
   * @param {number} options.limit - Limit number of results
   * @returns {Promise<Array>} Array of notification objects
   */
  async list(options = {}) {
    const { userId, organizationId } = await getUserOrganization()

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (options.type) {
      query = query.eq('type', options.type)
    }

    if (options.unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  /**
   * Get a single notification by ID
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Notification object
   */
  async get(id) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new notification (typically used by system/admins)
   * Respects user notification preferences - won't create if user has disabled that type
   * @param {Object} data - Notification data
   * @param {string} data.user_id - Target user ID (if not current user)
   * @param {string} data.type - Notification type
   * @param {string} data.title - Notification title
   * @param {string} data.message - Notification message
   * @param {string} data.related_entity_type - Related entity type (optional)
   * @param {string} data.related_entity_id - Related entity ID (optional)
   * @param {boolean} data.force - If true, bypasses user preferences (optional)
   * @returns {Promise<Object|null>} Created notification, or null if user has disabled this type
   */
  async create(data) {
    const { organizationId } = await getUserOrganization()
    const notificationType = data.type || 'general'

    // Check user's notification preferences (unless force is true)
    if (!data.force && data.user_id) {
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', data.user_id)
        .single()

      if (!userError && targetUser?.notification_preferences) {
        const prefs = targetUser.notification_preferences
        // Check if in-app notifications are disabled for this type
        if (prefs.in_app && prefs.in_app[notificationType] === false) {
          console.log(`📵 Skipping notification for user ${data.user_id}: ${notificationType} is disabled`)
          return null
        }
      }
    }

    const notificationData = {
      organization_id: organizationId,
      user_id: data.user_id,
      type: notificationType,
      title: data.title,
      message: data.message,
      related_entity_type: data.related_entity_type || null,
      related_entity_id: data.related_entity_id || null,
      is_read: false
    }

    return notificationService.create(notificationData)
  },

  /**
   * Mark a notification as read
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(id) {
    const { userId } = await getUserOrganization()

    // First verify the current user owns this notification
    const notification = await this.get(id)
    if (notification.user_id !== userId) {
      throw new Error('Cannot mark another user\'s notification as read')
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Mark multiple notifications as read
   * @param {Array<string>} ids - Array of notification IDs
   * @returns {Promise<Array>} Updated notifications
   */
  async markMultipleAsRead(ids) {
    const { userId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .in('id', ids)
      .eq('user_id', userId) // Only mark notifications owned by current user
      .select()

    if (error) throw error
    return data || []
  },

  /**
   * Mark all notifications as read for current user
   * @returns {Promise<Array>} Updated notifications
   */
  async markAllAsRead() {
    const { userId, organizationId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_read', false)
      .select()

    if (error) throw error
    return data || []
  },

  /**
   * Get unread notification count for current user
   * @returns {Promise<number>} Number of unread notifications
   */
  async getUnreadCount() {
    const { userId, organizationId } = await getUserOrganization()

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return count || 0
  },

  /**
   * Get unread notifications count by type
   * @returns {Promise<Object>} Object with counts by notification type
   */
  async getUnreadCountByType() {
    const { userId, organizationId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('notifications')
      .select('type')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error

    const counts = {
      referral_created: 0,
      phase_completed: 0,
      message_received: 0,
      client_updated: 0,
      general: 0
    }

    data?.forEach(notification => {
      if (counts[notification.type] !== undefined) {
        counts[notification.type]++
      }
    })

    return counts
  },

  /**
   * Delete a notification
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    const { userId } = await getUserOrganization()

    // First verify the current user owns this notification
    const notification = await this.get(id)
    if (notification.user_id !== userId) {
      throw new Error('Cannot delete another user\'s notification')
    }

    return notificationService.remove(id)
  },

  /**
   * Delete multiple notifications
   * @param {Array<string>} ids - Array of notification IDs
   * @returns {Promise<Object>} Success status
   */
  async removeMultiple(ids) {
    const { userId } = await getUserOrganization()

    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', ids)
      .eq('user_id', userId) // Only delete notifications owned by current user

    if (error) throw error
    return { success: true }
  },

  /**
   * Clear all read notifications for current user
   * @returns {Promise<Object>} Success status
   */
  async clearRead() {
    const { userId, organizationId } = await getUserOrganization()

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_read', true)

    if (error) throw error
    return { success: true }
  },

  /**
   * Get recent notifications (last 24 hours)
   * @param {number} limit - Maximum number to return
   * @returns {Promise<Array>} Array of recent notifications
   */
  async getRecent(limit = 10) {
    const { userId, organizationId } = await getUserOrganization()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Check if a user has a specific notification type enabled
   * @param {string} userId - User ID to check
   * @param {string} type - Notification type
   * @returns {Promise<boolean>} True if enabled, false if disabled
   */
  async isTypeEnabledForUser(userId, type) {
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', userId)
      .single()

    if (error || !user?.notification_preferences) {
      // Default to enabled if preferences not set
      return true
    }

    const prefs = user.notification_preferences
    return prefs.in_app?.[type] !== false
  },

  /**
   * Create notifications for multiple users, respecting each user's preferences
   * @param {Array<string>} userIds - Array of user IDs
   * @param {Object} data - Notification data (type, title, message, etc.)
   * @returns {Promise<Array>} Array of created notifications (excludes users who have disabled this type)
   */
  async createForMultipleUsers(userIds, data) {
    const results = []
    for (const userId of userIds) {
      const notification = await this.create({
        ...data,
        user_id: userId
      })
      if (notification) {
        results.push(notification)
      }
    }
    return results
  },

  /**
   * Subscribe to real-time notifications for current user
   * @param {Function} callback - Callback function when new notification arrives
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(callback) {
    const setupSubscription = async () => {
      const { userId, organizationId } = await getUserOrganization()

      const subscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            callback(payload.new)
          }
        )
        .subscribe()

      return subscription
    }

    let subscription = null
    setupSubscription().then(sub => {
      subscription = sub
    })

    return {
      unsubscribe: () => {
        if (subscription) {
          supabase.removeChannel(subscription)
        }
      }
    }
  }
}

export default Notification

