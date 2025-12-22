import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const messageService = new SupabaseService('messages')

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

export const Message = {
  /**
   * List all messages for current user (sent or received)
   * @param {Object} options - Query options
   * @param {string} options.filter - 'inbox', 'sent', or 'all'
   * @returns {Promise<Array>} Array of message objects with sender/recipient details
   */
  async list(options = {}) {
    const { userId, organizationId } = await getUserOrganization()
    const filter = options.filter || 'inbox'

    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email, avatar_url),
        recipient:users!messages_recipient_id_fkey(id, name, email, avatar_url)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    // Apply filter
    if (filter === 'inbox') {
      query = query.eq('recipient_id', userId)
    } else if (filter === 'sent') {
      query = query.eq('sender_id', userId)
    } else {
      // 'all' - show both sent and received
      query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  /**
   * Get messages for a specific conversation between two users
   * @param {string} otherUserId - The other user's ID
   * @returns {Promise<Array>} Array of messages in the conversation
   */
  async getConversation(otherUserId) {
    const { userId, organizationId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email, avatar_url),
        recipient:users!messages_recipient_id_fkey(id, name, email, avatar_url)
      `)
      .eq('organization_id', organizationId)
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Get a single message by ID
   * @param {string} id - Message ID
   * @returns {Promise<Object>} Message object with sender/recipient details
   */
  async get(id) {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email, avatar_url),
        recipient:users!messages_recipient_id_fkey(id, name, email, avatar_url)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Send a new message
   * @param {Object} data - Message data
   * @param {string} data.recipient_id - Recipient user ID
   * @param {string} data.subject - Message subject
   * @param {string} data.content - Message content
   * @returns {Promise<Object>} Created message
   */
  async send(data) {
    const { userId, organizationId } = await getUserOrganization()

    const messageData = {
      organization_id: organizationId,
      sender_id: userId,
      recipient_id: data.recipient_id,
      subject: data.subject,
      content: data.content,
      is_read: false
    }

    const result = await messageService.create(messageData)

    // Fetch the full message with sender/recipient details
    return this.get(result.id)
  },

  /**
   * Mark a message as read
   * @param {string} id - Message ID
   * @returns {Promise<Object>} Updated message
   */
  async markAsRead(id) {
    const { userId } = await getUserOrganization()

    // First verify the current user is the recipient
    const message = await this.get(id)
    if (message.recipient_id !== userId) {
      throw new Error('Cannot mark another user\'s message as read')
    }

    const { data, error } = await supabase
      .from('messages')
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
   * Mark multiple messages as read
   * @param {Array<string>} ids - Array of message IDs
   * @returns {Promise<Array>} Updated messages
   */
  async markMultipleAsRead(ids) {
    const { userId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .in('id', ids)
      .eq('recipient_id', userId) // Only mark messages where user is recipient
      .select()

    if (error) throw error
    return data || []
  },

  /**
   * Get unread message count for current user
   * @returns {Promise<number>} Number of unread messages
   */
  async getUnreadCount() {
    const { userId, organizationId } = await getUserOrganization()

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('recipient_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return count || 0
  },

  /**
   * Get list of users with whom current user has conversations
   * @returns {Promise<Array>} Array of users with conversation metadata
   */
  async getConversationList() {
    const { userId, organizationId } = await getUserOrganization()

    // Get all messages involving current user
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email, avatar_url),
        recipient:users!messages_recipient_id_fkey(id, name, email, avatar_url)
      `)
      .eq('organization_id', organizationId)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Group by conversation partner and get latest message + unread count
    const conversationMap = new Map()

    messages.forEach(msg => {
      const isReceived = msg.recipient_id === userId
      const otherUser = isReceived ? msg.sender : msg.recipient
      const otherUserId = otherUser.id

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          user: otherUser,
          lastMessage: msg,
          unreadCount: 0
        })
      }

      // Count unread messages from this user
      if (isReceived && !msg.is_read) {
        conversationMap.get(otherUserId).unreadCount++
      }
    })

    return Array.from(conversationMap.values())
  },

  /**
   * Broadcast a message to multiple users
   * @param {Object} data - message data
   * @param {string} data.subject - Subject
   * @param {string} data.content - Content
   * @param {Array<string>} data.recipientIds - Specific recipient IDs (optional)
   * @param {boolean} data.allUsers - If true, send to all active users in organization
   */
  async broadcast({ subject, content, recipientIds = [], allUsers = false }) {
    const { userId, organizationId } = await getUserOrganization()

    // Determine recipients
    let targets = []

    if (allUsers) {
      // Import User dynamically to avoid circular dependency if possible, 
      // or assume we need to fetch users manually here to be safe and efficient
      const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .neq('id', userId) // Don't send to self

      if (error) throw error
      targets = users.map(u => u.id)
    } else {
      targets = recipientIds.filter(id => id !== userId)
    }

    if (targets.length === 0) {
      return { sentCount: 0 }
    }

    // Prepare batch insert
    const messages = targets.map(targetId => ({
      organization_id: organizationId,
      sender_id: userId,
      recipient_id: targetId,
      subject: subject,
      content: content,
      is_read: false,
      created_at: new Date().toISOString()
    }))

    // Perform batch insert
    const { error: insertError } = await supabase
      .from('messages')
      .insert(messages)

    if (insertError) throw insertError

    return { sentCount: targets.length }
  },

  /**
   * Delete a message (soft delete - only removes from sender's view)
   * @param {string} id - Message ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    return messageService.remove(id)
  },

  /**
   * Search messages by subject or content
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching messages
   */
  async search(searchTerm) {
    const { userId, organizationId } = await getUserOrganization()

    if (!searchTerm || searchTerm.trim() === '') {
      return this.list()
    }

    const term = searchTerm.toLowerCase().trim()

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, email, avatar_url),
        recipient:users!messages_recipient_id_fkey(id, name, email, avatar_url)
      `)
      .eq('organization_id', organizationId)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .or(`subject.ilike.%${term}%,content.ilike.%${term}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}

export default Message

