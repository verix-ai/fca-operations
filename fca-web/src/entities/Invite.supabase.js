import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'

const inviteService = new SupabaseService('invites')

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

/**
 * Get organization details
 */
async function getOrganizationDetails(organizationId) {
  const { data, error } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single()

  if (error) {
    console.warn('Error fetching organization details:', error)
    return { name: 'Your Organization' }
  }

  return data || { name: 'Your Organization' }
}

/**
 * Get inviter details
 */
async function getInviterDetails(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single()

  if (error) {
    console.warn('Error fetching inviter details:', error)
    return { name: 'A team member', email: '' }
  }

  return data || { name: 'A team member', email: '' }
}

/**
 * Send invite email via Supabase Edge Function or fallback
 * @param {Object} options - Email options
 * @param {Object} options.session - Optional session object to use (avoids calling getSession)
 */
async function sendInviteEmail({ email, inviteUrl, inviteRole, organizationName, inviterName, token, session: providedSession = null }) {
  try {
    console.log('📧 Attempting to send invite email via Edge Function:', { email, inviteUrl: inviteUrl.substring(0, 50) + '...' })

    // Use provided session or get current session (avoid calling getSession if session is provided)
    let session = providedSession
    if (!session) {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session = currentSession
    }

    if (!session) {
      throw new Error('Not authenticated')
    }

    // Get Supabase URL from the client
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const functionUrl = `${supabaseUrl}/functions/v1/send-invite-email`

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        email,
        inviteUrl,
        inviteRole,
        organizationName,
        inviterName,
        token
      })
    })

    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { error: responseText }
    }

    console.log('📧 Edge Function response:', {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      responseText: responseText,  // Also log the raw text
      success: responseData?.success,
      messageId: responseData?.messageId
    })

    if (response.ok && responseData?.success) {
      console.log('✅ Invite email sent successfully via Edge Function', {
        messageId: responseData.messageId,
        provider: responseData.provider
      })
      return { success: true, method: 'edge-function' }
    }

    // If response.ok but success is false, log the error
    if (response.ok && !responseData?.success) {
      console.error('⚠️ Edge Function returned 200 but success=false:', responseData)
    }

    // Log error details
    console.error('❌ Edge Function error:', {
      status: response.status,
      statusText: response.statusText,
      error: responseData.error,
      details: responseData.details,
      config: responseData.config,
      fullResponse: responseData  // Log the entire response
    })

  } catch (err) {
    console.error('❌ Exception calling Edge Function:', err)
    console.log('ℹ️ Email sending not configured. Invite link will be shown to admin for manual sharing.')
  }

  // Note: Email sending requires Supabase Edge Function to be set up
  // For now, return false so the UI can show the invite link to copy manually
  return { success: false, method: 'manual' }
}

/**
 * Generate a secure random token
 * Uses crypto.randomUUID() if available, otherwise falls back to a custom implementation
 */
function generateToken() {
  // Try crypto.randomUUID() first (available in modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID()
    } catch (e) {
      console.warn('crypto.randomUUID() failed, using fallback:', e)
    }
  }

  // Fallback: Generate a UUID v4-like token
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const Invite = {
  /**
   * List all invites in current user's organization
   * @returns {Promise<Array>} Array of invite objects
   */
  async list() {
    const invites = await inviteService.list({ sort: 'created_at:desc' })
    return invites
  },

  /**
   * Get pending (unused and not expired) invites
   * @returns {Promise<Array>} Array of pending invites
   */
  async getPending() {
    const { organizationId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending invites:', error)
      throw error
    }

    // Get all users in the organization to filter out invites for existing users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('email')
      .eq('organization_id', organizationId)

    if (usersError) {
      console.warn('Error fetching users for invite filtering:', usersError)
      // Continue anyway - we'll just show all invites
    }

    console.log('🔍 Checking invites against existing users:', {
      inviteCount: data?.length || 0,
      userCount: users?.length || 0,
      userEmails: (users || []).map(u => u.email)
    })

    // Create a set of existing user emails for fast lookup
    const existingUserEmails = new Set(
      (users || []).map(u => String(u.email || '').toLowerCase().trim())
    )

    // Filter out invites where:
    // 1. Invite is null/undefined/invalid
    // 2. A user already exists with that email in the organization
    const filteredInvites = (data || []).filter(invite => {
      if (!invite || !invite.id || !invite.email) {
        return false
      }

      const inviteEmail = String(invite.email).toLowerCase().trim()
      if (existingUserEmails.has(inviteEmail)) {
        console.log(`🔍 Filtering out invite for ${inviteEmail} - user already exists in public.users`)
        // Auto-mark invite as used since user exists (background cleanup)
        this.markInviteAsUsedIfUserExists(invite.id, inviteEmail).catch(err => {
          console.warn(`Failed to auto-mark invite ${invite.id} as used:`, err)
        })
        return false
      }

      return true
    })

    console.log('✅ Filtered invites:', {
      originalCount: data?.length || 0,
      filteredCount: filteredInvites.length,
      filteredOut: (data?.length || 0) - filteredInvites.length
    })

    return filteredInvites
  },

  /**
   * Mark an invite as used if a user exists with that email
   * This is a helper function to repair stale invites
   */
  async markInviteAsUsedIfUserExists(inviteId, email) {
    try {
      const { organizationId } = await getUserOrganization()

      // Check if user exists
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (user) {
        console.log(`✅ Marking invite ${inviteId} as used - user ${email} exists`)
        const { error } = await supabase
          .from('invites')
          .update({
            used: true,
            used_at: new Date().toISOString()
          })
          .eq('id', inviteId)
          .eq('organization_id', organizationId)

        if (error) {
          console.error(`❌ Error marking invite ${inviteId} as used:`, error)
          return { success: false, error }
        }

        return { success: true }
      }

      return { success: false, reason: 'User not found' }
    } catch (err) {
      console.error(`❌ Error in markInviteAsUsedIfUserExists:`, err)
      return { success: false, error: err }
    }
  },

  /**
   * Create a new invitation
   * @param {Object} data - Invitation data
   * @param {string} data.email - Invitee email (required)
   * @param {string} data.role - Role to assign (required)
   * @returns {Promise<Object>} Created invite with token
   */
  async create(data) {
    const { userId, organizationId, role } = await getUserOrganization()

    // Only admins can create invitations
    if (role !== 'admin') {
      throw new Error('Only admins can invite users')
    }

    const email = (data?.email || '').trim().toLowerCase()
    if (!email) throw new Error('Email is required')

    const inviteRole = data?.role || 'marketer'
    if (!['admin', 'marketer'].includes(inviteRole)) {
      throw new Error('Invalid role. Must be admin or marketer')
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (existingUser) {
      throw new Error('User with this email already exists in your organization')
    }

    // Check if there's already a pending invite for this email
    // First cancel any existing pending invites for this email
    const { data: existingInvites } = await supabase
      .from('invites')
      .select('id')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())

    if (existingInvites && existingInvites.length > 0) {
      // Cancel all existing pending invites for this email
      for (const existingInvite of existingInvites) {
        try {
          await supabase
            .from('invites')
            .delete()
            .eq('id', existingInvite.id)
            .eq('organization_id', organizationId)
        } catch (err) {
          console.warn('Failed to cancel existing invite:', err)
        }
      }
      // Don't throw error - we've cleaned up the old invites, so proceed
    }

    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    const inviteData = {
      organization_id: organizationId,
      email,
      role: inviteRole,
      token,
      expires_at: expiresAt.toISOString(),
      invited_by: userId,
      used: false
    }

    const { data: invite, error } = await supabase
      .from('invites')
      .insert([inviteData])
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating invite:', error)
      throw error
    }

    if (!invite || !invite.token) {
      console.error('❌ Invite created but token is missing:', invite)
      throw new Error('Failed to generate invite token. Please try again.')
    }

    // Generate invite URL
    const inviteUrl = `${window.location.origin}/signup?invite=${token}`

    // Get organization and inviter details for email
    const [orgDetails, inviterDetails] = await Promise.all([
      getOrganizationDetails(organizationId).catch(() => ({ name: 'Your Organization' })),
      getInviterDetails(userId).catch(() => ({ name: 'A team member', email: '' }))
    ])

    // Get current session ONCE to avoid triggering multiple refreshes
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    // Attempt to send email (non-blocking)
    const emailResult = await sendInviteEmail({
      email,
      inviteUrl,
      inviteRole,
      organizationName: orgDetails.name,
      inviterName: inviterDetails.name,
      token,
      session: currentSession  // Pass the session to avoid calling getSession again
    }).catch(err => {
      console.warn('Email sending failed (non-critical):', err)
      return { success: false, method: 'manual' }
    })

    return {
      ...invite,
      inviteUrl,
      emailSent: emailResult.success,
      emailMethod: emailResult.method
    }
  },

  /**
   * Get invite by token
   * @param {string} token - Invitation token
   * @returns {Promise<Object>} Invite object
   */
  async getByToken(token) {
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Verify invite is valid
   * @param {string} token - Invitation token
   * @returns {Promise<Object>} Invite object if valid
   */
  async verify(token) {
    const invite = await this.getByToken(token)

    if (!invite) {
      throw new Error('Invalid invitation')
    }

    if (invite.used) {
      throw new Error('This invitation has already been used')
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new Error('This invitation has expired')
    }

    return invite
  },

  /**
   * Resend an invitation (generates new token)
   * @param {string} id - Invite ID
   * @returns {Promise<Object>} Updated invite
   */
  async resend(id) {
    const { role } = await getUserOrganization()

    // Only admins can resend invitations
    if (role !== 'admin') {
      throw new Error('Only admins can resend invitations')
    }

    const newToken = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    // Get the invite details first
    const { data: existingInvite, error: fetchError } = await supabase
      .from('invites')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const { data: invite, error } = await supabase
      .from('invites')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
        used: false
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating invite:', error)
      throw error
    }

    if (!invite || !invite.token) {
      console.error('❌ Invite updated but token is missing:', invite)
      throw new Error('Failed to generate new invite token. Please try again.')
    }

    const inviteUrl = `${window.location.origin}/signup?invite=${newToken}`

    // Get organization and inviter details for email
    const [orgDetails, inviterDetails] = await Promise.all([
      getOrganizationDetails(existingInvite.organization_id).catch(() => ({ name: 'Your Organization' })),
      getInviterDetails(existingInvite.invited_by).catch(() => ({ name: 'A team member', email: '' }))
    ])

    // Get current session ONCE to avoid triggering multiple refreshes
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    // Attempt to send email (non-blocking)
    const emailResult = await sendInviteEmail({
      email: existingInvite.email,
      inviteUrl,
      inviteRole: existingInvite.role,
      organizationName: orgDetails.name,
      inviterName: inviterDetails.name,
      token: newToken,
      session: currentSession  // Pass the session to avoid calling getSession again
    }).catch(err => {
      console.warn('Email sending failed (non-critical):', err)
      return { success: false, method: 'manual' }
    })

    return {
      ...invite,
      inviteUrl,
      emailSent: emailResult.success,
      emailMethod: emailResult.method
    }
  },

  /**
   * Repair/fix an invite by checking if user exists and creating profile if needed
   * This is an admin function to fix stale invites
   * @param {string} inviteId - Invite ID
   * @returns {Promise<Object>} Repair result
   */
  async repair(inviteId) {
    console.log(`🔧 [Repair] Starting repair for invite: ${inviteId}`)
    const { userId, organizationId, role } = await getUserOrganization()

    // Only admins can repair invites
    if (role !== 'admin') {
      throw new Error('Only admins can repair invites')
    }

    // Get the invite
    console.log(`🔧 [Repair] Fetching invite details...`)
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('id', inviteId)
      .eq('organization_id', organizationId)
      .single()

    if (inviteError || !invite) {
      console.error(`❌ [Repair] Invite not found:`, inviteError)
      throw new Error('Invite not found')
    }

    console.log(`🔧 [Repair] Invite found:`, {
      email: invite.email,
      role: invite.role,
      used: invite.used,
      created_at: invite.created_at
    })

    // Check if user already exists in public.users
    console.log(`🔧 [Repair] Checking if user exists in public.users...`)
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('*')
      .eq('email', invite.email)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (userCheckError) {
      console.warn(`⚠️ [Repair] Error checking user:`, userCheckError)
    }

    if (existingUser) {
      // User exists - just mark invite as used
      console.log(`✅ [Repair] User ${invite.email} already exists in public.users, marking invite as used`)
      const { error: markError } = await supabase
        .from('invites')
        .update({
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('id', inviteId)

      if (markError) {
        console.error(`❌ [Repair] Failed to mark invite as used:`, markError)
        throw new Error(`Failed to mark invite as used: ${markError.message}`)
      }

      console.log(`✅ [Repair] Successfully marked invite as used`)
      return {
        success: true,
        action: 'marked_used',
        message: `User already exists. Invite marked as used.`
      }
    }

    // User doesn't exist in public.users
    // If they signed up, they likely exist in auth.users but profile creation failed
    // Since we can't query auth.users from client, we'll mark the invite as used
    // This prevents it from showing as pending, and they can contact support if needed
    console.log(`⚠️ [Repair] User ${invite.email} not found in public.users`)
    console.log(`⚠️ [Repair] Marking invite as used anyway (user may exist in auth.users but profile creation failed)`)

    const { error: markError } = await supabase
      .from('invites')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', inviteId)

    if (markError) {
      console.error(`❌ [Repair] Failed to mark invite as used:`, markError)
      throw new Error(`Failed to mark invite as used: ${markError.message}`)
    }

    console.log(`✅ [Repair] Marked invite as used (user profile missing)`)
    return {
      success: true,
      action: 'marked_used_no_profile',
      message: `Invite marked as used. Note: User profile not found in database. If ${invite.email} has signed up, they may need to contact support to create their profile.`
    }
  },

  /**
   * Cancel/delete an invitation
   * @param {string} id - Invite ID
   * @returns {Promise<Object>} Success status
   */
  async cancel(id) {
    const { userId, organizationId, role } = await getUserOrganization()

    // Only admins can cancel invitations
    if (role !== 'admin') {
      throw new Error('Only admins can cancel invitations')
    }

    if (!id) {
      throw new Error('Invite ID is required')
    }

    console.log('🗑️ Canceling invite:', { id, userId, organizationId, role })

    // First verify the invite exists and belongs to the organization
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('id, organization_id, email')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching invite:', fetchError)
      throw new Error(`Invite not found: ${fetchError.message}`)
    }

    if (!invite) {
      throw new Error('Invite not found')
    }

    if (invite.organization_id !== organizationId) {
      console.error('❌ Organization mismatch:', {
        inviteOrg: invite.organization_id,
        userOrg: organizationId
      })
      throw new Error('You do not have permission to cancel this invite')
    }

    // Delete the invite (hard delete)
    // Note: RLS policy will automatically filter by organization_id and role
    // We don't need to filter by organization_id in the query - RLS handles it
    console.log('🗑️ Attempting delete with RLS:', { id, organizationId, role, userId })

    const { error, data, count } = await supabase
      .from('invites')
      .delete()
      .eq('id', id)
      .select()

    console.log('🗑️ Delete response:', { error, data, count, hasData: !!data, dataLength: data?.length })

    if (error) {
      console.error('❌ Error deleting invite:', error)
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })

      // Check if it's an RLS policy error
      if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        throw new Error(`Permission denied: Unable to delete invite. Make sure you're an admin and the invite belongs to your organization. Error: ${error.message}`)
      }

      throw new Error(`Failed to cancel invite: ${error.message}`)
    }

    // If no data returned and no error, RLS policy silently filtered out the row
    if (!data || data.length === 0) {
      console.warn('⚠️ Delete returned no rows - checking if invite still exists...')

      // Check if invite still exists (RLS policy may be blocking)
      const { data: checkInvite, error: checkError } = await supabase
        .from('invites')
        .select('id, organization_id, email')
        .eq('id', id)
        .single()

      console.log('🔍 Invite check result:', { checkInvite, checkError, stillExists: !!checkInvite })

      if (checkInvite) {
        console.error('❌ Invite still exists after delete attempt')
        console.error('❌ Invite details:', {
          inviteOrg: checkInvite.organization_id,
          userOrg: organizationId,
          orgMatch: checkInvite.organization_id === organizationId
        })

        throw new Error(`Unable to delete invite. The RLS policy is blocking the delete. Please verify that:
1. You are logged in as an admin (current role: ${role})
2. The invite belongs to your organization (invite org: ${checkInvite.organization_id}, your org: ${organizationId})
3. The RLS policy "Admins can delete invites" exists and is correctly configured in your database

To fix this, run this SQL in your Supabase SQL Editor:
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'invites'
  AND cmd = 'DELETE';`)
      }

      // Invite doesn't exist - it was deleted successfully
      console.log('✅ Invite was deleted successfully (no rows returned due to RLS)')
      return { success: true, deletedInvite: null }
    }

    console.log('✅ Invite canceled successfully:', data[0])
    return { success: true, deletedInvite: data[0] }
  }
}

export default Invite


