import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const noteService = new SupabaseService('client_notes')

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

export const ClientNotes = {
  /**
   * List all notes for a client
   * @param {string} clientId - Client ID
   * @returns {Promise<Array>} Array of note objects (newest first)
   */
  async list(clientId) {
    const { data, error } = await supabase
      .from('client_notes')
      .select(`
        *,
        user:users(id, name, email, avatar_url)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get a single note by ID
   * @param {string} noteId - Note ID
   * @returns {Promise<Object>} Note object
   */
  async get(noteId) {
    const { data, error } = await supabase
      .from('client_notes')
      .select(`
        *,
        user:users(id, name, email, avatar_url)
      `)
      .eq('id', noteId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new note
   * @param {string} clientId - Client ID
   * @param {Object} noteData - Note data
   * @param {string} noteData.note - Note content (required)
   * @param {boolean} noteData.is_important - Whether note is important
   * @returns {Promise<Object>} Created note
   */
  async create(clientId, noteData) {
    const { userId, organizationId } = await getUserOrganization()

    if (!noteData.note || noteData.note.trim() === '') {
      throw new Error('Note content is required')
    }

    const note = {
      client_id: clientId,
      organization_id: organizationId,
      user_id: userId,
      note: noteData.note.trim(),
      is_important: noteData.is_important || false
    }

    const created = await noteService.create(note)

    // Re-fetch with user data
    return this.get(created.id)
  },

  /**
   * Update a note
   * @param {string} noteId - Note ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated note
   */
  async update(noteId, updates) {
    const { userId } = await getUserOrganization()

    // Verify user owns this note
    const note = await noteService.get(noteId)
    if (note.user_id !== userId) {
      throw new Error('You can only edit your own notes')
    }

    await noteService.update(noteId, updates)

    // Re-fetch with user data
    return this.get(noteId)
  },

  /**
   * Delete a note
   * @param {string} noteId - Note ID
   * @returns {Promise<Object>} Success status
   */
  async remove(noteId) {
    const { userId } = await getUserOrganization()

    // Get user role to check if admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    const isAdmin = userProfile?.role === 'admin'

    // Verify user owns this note or is admin
    const note = await noteService.get(noteId)
    if (note.user_id !== userId && !isAdmin) {
      throw new Error('You can only delete your own notes')
    }

    return noteService.remove(noteId)
  },

  /**
   * Get important notes for a client
   * @param {string} clientId - Client ID
   * @returns {Promise<Array>} Array of important notes
   */
  async getImportant(clientId) {
    const { data, error } = await supabase
      .from('client_notes')
      .select(`
        *,
        user:users(id, name, email, avatar_url)
      `)
      .eq('client_id', clientId)
      .eq('is_important', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Toggle important flag on a note
   * @param {string} noteId - Note ID
   * @returns {Promise<Object>} Updated note
   */
  async toggleImportant(noteId) {
    const note = await noteService.get(noteId)
    return this.update(noteId, { is_important: !note.is_important })
  },

  /**
   * Get notes by user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of notes by the user
   */
  async getByUser(userId) {
    const { data, error } = await supabase
      .from('client_notes')
      .select(`
        *,
        user:users(id, name, email, avatar_url),
        client:clients(id, first_name, last_name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Search notes by content
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching notes
   */
  async search(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return []
    }

    const term = searchTerm.toLowerCase().trim()

    const { data, error } = await supabase
      .from('client_notes')
      .select(`
        *,
        user:users(id, name, email, avatar_url),
        client:clients(id, first_name, last_name)
      `)
      .ilike('note', `%${term}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}

export default ClientNotes

