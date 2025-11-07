import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createPageUrl } from '@/utils'

const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Initialize auth state and set up listener
  useEffect(() => {
    let mounted = true
    let sessionRestored = false
    
    // Set up auth state change listener FIRST - this fires immediately with INITIAL_SESSION
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      console.log('🔐 [Auth] onAuthStateChange:', event, 'hasSession=', !!session, 'user=', session?.user?.email)
      
      // Always update session state
      setSession(session)
      
      // Handle INITIAL_SESSION event - this is the source of truth for initial state
      if (event === 'INITIAL_SESSION') {
        sessionRestored = true
        setLoading(false)
        setInitialized(true)
        
        if (session?.user) {
          console.log('🔐 [Auth] INITIAL_SESSION: Restoring user session')
          await loadUserProfile(session.user.id, session.user)
        } else {
          console.log('🔐 [Auth] INITIAL_SESSION: No session found')
          setUser(null)
        }
      } else if (event === 'SIGNED_IN') {
        // SIGNED_IN can fire on refresh if session was restored - treat it like INITIAL_SESSION
        // BUT: Don't auto-navigate if user is on signup page (they might be filling out the form)
        sessionRestored = true
        
        if (session?.user) {
          console.log('🔐 [Auth] SIGNED_IN: Loading user profile')
          // Keep loading=true until profile is loaded
          try {
            await loadUserProfile(session.user.id, session.user)
          } catch (err) {
            console.error('🔐 [Auth] Error in loadUserProfile:', err)
            // If profile load fails, create minimal user
            if (session.user) {
              setUser({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                role: 'viewer'
              })
            }
          } finally {
            // Always set loading to false, even if profile load fails
            setLoading(false)
            setInitialized(true)
          }
          
          // Only navigate if we're not already on a protected route (avoid navigation on refresh)
          // IMPORTANT: Don't navigate away from /signup - user might be filling out the form
          const currentPath = window.location.pathname
          if (currentPath === '/login') {
            // Only navigate from login page, not from signup
            navigate(createPageUrl('Dashboard'), { replace: true })
          }
          // If on /signup, let the signup form handle navigation after successful submission
        } else {
          setLoading(false)
          setInitialized(true)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
        setInitialized(true)
        navigate('/login', { replace: true })
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token refreshed successfully - only reload profile if user changed
        // Don't reload if we already have the same user loaded (avoid unnecessary reloads)
        if (!user || user.id !== session.user.id) {
          console.log('🔐 [Auth] TOKEN_REFRESHED: Reloading user profile (user changed or not loaded)')
          await loadUserProfile(session.user.id, session.user)
        } else {
          console.log('🔐 [Auth] TOKEN_REFRESHED: Same user, skipping profile reload')
        }
      } else if (session?.user) {
        // Other events with session - ensure user profile is loaded
        await loadUserProfile(session.user.id, session.user)
      } else {
        setUser(null)
      }
    })

    // Fallback: If INITIAL_SESSION doesn't fire within 3 seconds, try getSession()
    const timeoutId = setTimeout(async () => {
      if (mounted && !sessionRestored) {
        console.log('🔐 [Auth] INITIAL_SESSION timeout - falling back to getSession()')
        try {
          const { data: { session }, error } = await supabase.auth.getSession()
          console.log('🔐 [Auth] Fallback getSession():', !!session, error ? 'error=' + error.message : '')
          
          setSession(session)
          setLoading(false)
          setInitialized(true)
          
          if (session?.user) {
            await loadUserProfile(session.user.id, session.user)
          } else {
            setUser(null)
          }
        } catch (err) {
          console.warn('🔐 [Auth] Fallback getSession() error:', err)
          setLoading(false)
          setInitialized(true)
          setUser(null)
        }
      }
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [navigate])

  /**
   * Load user profile from database
   */
  const loadUserProfile = async (userId, sessionUser = null) => {
    let timeoutId
    try {
      console.log('🔐 [Auth] loadUserProfile: Loading profile for userId:', userId)
      
      // Wrap query in timeout to prevent hanging forever
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      const timeoutWrapper = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Profile load timeout after 10 seconds'))
        }, 10000)
      })
      
      const { data, error } = await Promise.race([queryPromise, timeoutWrapper])
      
      if (timeoutId) clearTimeout(timeoutId)

      if (error) {
        // If profile doesn't exist yet, that's okay - it will be created on first login
        if (error.code === 'PGRST116') {
          console.log('🔐 [Auth] User profile not found (PGRST116), creating minimal user from session')
          // Create a minimal user object from session until profile is created
          if (sessionUser) {
            setUser({
              id: sessionUser.id,
              email: sessionUser.email,
              name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User',
              role: 'marketer' // Default role until profile is created
            })
            console.log('🔐 [Auth] Created minimal user from session')
          }
          return
        }
        console.error('🔐 [Auth] Error loading user profile:', error)
        // If profile load fails but we have session, create minimal user
        if (sessionUser) {
          console.log('🔐 [Auth] Profile load failed, creating minimal user from session')
              setUser({
                id: sessionUser.id,
                email: sessionUser.email,
                name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User',
                role: 'marketer'
              })
        }
        return
      }

      console.log('🔐 [Auth] User profile loaded:', data?.email, data?.role)
      setUser(data)
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      console.error('🔐 [Auth] Error loading user profile:', error)
      // If profile load fails but we have session, create minimal user
      if (sessionUser) {
        console.log('🔐 [Auth] Profile load error, creating minimal user from session')
              setUser({
                id: sessionUser.id,
                email: sessionUser.email,
                name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User',
                role: 'marketer'
              })
      }
    }
  }

  /**
   * Sign up with email and password
   */
  const signUp = async ({ email, password, name }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0]
          },
          // Disable email confirmation for invite-based signups
          // The invite link click already serves as email verification
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error }
    }
  }

  /**
   * Sign in with email and password
   */
  const loginWithPassword = async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      console.error('Login error:', error)
      return { data: null, error }
    }
  }

  /**
   * Sign in with OAuth provider (Google, GitHub, etc.)
   */
  const loginWithProvider = async (provider) => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider, // 'google', 'github', etc.
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      console.error('OAuth login error:', error)
      return { data: null, error }
    }
  }

  /**
   * Request password reset
   */
  const resetPasswordRequest = async (email) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      console.error('Password reset request error:', error)
      return { data: null, error }
    }
  }

  /**
   * Update password (after reset)
   */
  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      console.error('Password update error:', error)
      return { data: null, error }
    }
  }

  /**
   * Sign out
   */
  const logout = async () => {
    console.log('🔓 AuthProvider logout() called')
    
    // Try to sign out from Supabase with timeout, but don't wait forever
    try {
      console.log('📡 Calling Supabase signOut...')
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SignOut timeout')), 3000)
      )
      
      await Promise.race([signOutPromise, timeoutPromise])
      console.log('✅ Supabase signOut succeeded')
    } catch (signOutError) {
      console.warn('⚠️ Supabase signOut error (continuing anyway):', signOutError.message)
    }

    // Clear local state regardless of signOut success
    console.log('🧹 Clearing local state...')
    setSession(null)
    setUser(null)
    console.log('✅ Local state cleared')

    // Redirect to login
    console.log('🔀 Navigating to /login...')
    navigate('/login', { replace: true })
    console.log('✅ Navigation initiated')

    return { error: null }
  }

  /**
   * Update user profile
   */
  const updateProfile = async (updates) => {
    if (!user?.id) return { data: null, error: new Error('Not authenticated') }

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setUser(data)
      return { data, error: null }
    } catch (error) {
      console.error('Profile update error:', error)
      return { data: null, error }
    }
  }

  /**
   * Accept invitation (for team members)
   */
  const acceptInvite = async ({ token, name, password }) => {
    try {
      // Verify the invite token
      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .single()

      if (inviteError || !invite) {
        throw new Error('Invalid or expired invitation')
      }

      // Check if invite is expired
      if (new Date(invite.expires_at) < new Date()) {
        throw new Error('Invitation has expired')
      }

      // Check if invite is already used
      if (invite.used) {
        throw new Error('This invitation has already been used')
      }

      // Sign up the user
      const { data: authData, error: signUpError } = await signUp({
        email: invite.email,
        password,
        name
      })

      if (signUpError) throw signUpError

      // Mark invite as used immediately after signup (before profile update)
      // This ensures the invite is marked even if profile update fails
      // Use retry logic to ensure it succeeds
      console.log('📝 Marking invite as used...')
      let inviteMarked = false
      let markUsedAttempts = 0
      const maxMarkAttempts = 3
      
      while (!inviteMarked && markUsedAttempts < maxMarkAttempts) {
        markUsedAttempts++
        const { error: markUsedError, data: markUsedData } = await supabase
          .from('invites')
          .update({ 
            used: true, 
            used_at: new Date().toISOString() 
          })
          .eq('token', token)
          .select()

        if (markUsedError) {
          console.error(`❌ Error marking invite as used (attempt ${markUsedAttempts}/${maxMarkAttempts}):`, markUsedError)
          console.error('❌ Mark used error details:', {
            code: markUsedError.code,
            message: markUsedError.message,
            details: markUsedError.details,
            hint: markUsedError.hint
          })
          
          if (markUsedAttempts < maxMarkAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } else if (markUsedData && markUsedData.length > 0) {
          inviteMarked = true
          console.log('✅ Invite marked as used')
        } else {
          console.warn(`⚠️ Mark invite update returned no rows (attempt ${markUsedAttempts}/${maxMarkAttempts})`)
          if (markUsedAttempts < maxMarkAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      }
      
      if (!inviteMarked) {
        console.error('❌ Failed to mark invite as used after multiple attempts - will retry after profile update')
      }

      // Wait a moment for the database trigger to complete (if it exists)
      // The trigger might create a profile with wrong org/role, so we'll update it
      await new Promise(resolve => setTimeout(resolve, 500))

      // Retry logic: Check if user profile exists and update it with invite details
      let profileUpdated = false
      let retries = 3
      
      console.log('📝 Invite details:', {
        organization_id: invite.organization_id,
        email: invite.email,
        role: invite.role
      })
      
      while (!profileUpdated && retries > 0) {
        console.log(`🔄 Checking user profile (attempt ${4 - retries}/3)...`)
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single()

        if (profileCheckError && profileCheckError.code !== 'PGRST116') {
          console.error('❌ Error checking profile:', profileCheckError)
        }

        if (existingProfile) {
          console.log('📋 Existing profile found:', {
            id: existingProfile.id,
            organization_id: existingProfile.organization_id,
            email: existingProfile.email,
            role: existingProfile.role,
            is_active: existingProfile.is_active
          })
          
          // Profile exists - update it with invite details
          console.log('✏️ Updating profile with invite details...')
          const { error: updateError } = await supabase
            .from('users')
            .update({
              organization_id: invite.organization_id,
              email: invite.email,
              name,
              role: invite.role,
              is_active: true // Ensure user is active
            })
            .eq('id', authData.user.id)

          if (updateError) {
            console.error('❌ Error updating user profile:', updateError)
            console.error('❌ Update error details:', {
              code: updateError.code,
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint
            })
            // If it's a constraint error, the profile might not exist yet
            if (updateError.code === 'PGRST116' || updateError.message?.includes('not found')) {
              retries--
              await new Promise(resolve => setTimeout(resolve, 500))
              continue
            }
            throw updateError
          }
          
          // Verify the update worked
          const { data: verifyProfile } = await supabase
            .from('users')
            .select('organization_id, role, email, name, is_active')
            .eq('id', authData.user.id)
            .single()
          
          console.log('✅ Profile update response:', verifyProfile)
          
          if (verifyProfile?.organization_id === invite.organization_id && verifyProfile?.role === invite.role) {
            profileUpdated = true
            console.log('✅ User profile updated successfully with invite details')
            console.log('✅ Final profile:', {
              id: authData.user.id,
              organization_id: verifyProfile.organization_id,
              email: verifyProfile.email,
              role: verifyProfile.role,
              is_active: verifyProfile.is_active
            })
          } else {
            console.warn('⚠️ Profile update verification failed:', {
              expected_org: invite.organization_id,
              actual_org: verifyProfile?.organization_id,
              expected_role: invite.role,
              actual_role: verifyProfile?.role
            })
            retries--
            await new Promise(resolve => setTimeout(resolve, 500))
            continue
          }
        } else {
          // Profile doesn't exist - create it
          console.log('➕ Creating new profile with invite details...')
          const { error: profileError } = await supabase
            .from('users')
            .insert([{
              id: authData.user.id,
              organization_id: invite.organization_id,
              email: invite.email,
              name,
              role: invite.role,
              is_active: true
            }])

          if (profileError) {
            console.error('❌ Error creating user profile:', profileError)
            console.error('❌ Create error details:', {
              code: profileError.code,
              message: profileError.message,
              details: profileError.details,
              hint: profileError.hint
            })
            // If it's a duplicate key error, the profile was created by trigger - retry update
            if (profileError.code === '23505' || profileError.message?.includes('duplicate')) {
              console.log('⚠️ Profile already exists (created by trigger), will retry update...')
              retries--
              await new Promise(resolve => setTimeout(resolve, 500))
              continue
            }
            throw profileError
          }
          
          profileUpdated = true
          console.log('✅ User profile created successfully with invite details')
        }
      }

      if (!profileUpdated) {
        throw new Error('Failed to create/update user profile after multiple attempts')
      }

      // Verify invite was marked as used (try again if early attempt failed)
      const { data: verifyInvite, error: verifyError } = await supabase
        .from('invites')
        .select('used, used_at')
        .eq('token', token)
        .single()
      
      if (verifyError) {
        console.error('❌ Error verifying invite status:', verifyError)
      }
      
      if (!verifyInvite?.used) {
        console.warn('⚠️ Invite not marked as used yet, retrying...')
        // Retry marking as used now that profile is updated
        const { error: markUsedErrorRetry } = await supabase
          .from('invites')
          .update({ 
            used: true, 
            used_at: new Date().toISOString() 
          })
          .eq('token', token)

        if (markUsedErrorRetry) {
          console.error('❌ Error marking invite as used (retry):', markUsedErrorRetry)
        } else {
          console.log('✅ Invite marked as used (retry successful)')
        }
      } else {
        console.log('✅ Invite already marked as used:', verifyInvite)
      }
      
      // Verify the user profile was created correctly
      const { data: verifyUser } = await supabase
        .from('users')
        .select('id, email, name, role, organization_id, is_active')
        .eq('id', authData.user.id)
        .single()
      
      console.log('✅ Verified user profile:', verifyUser)

      return { data: authData, error: null }
    } catch (error) {
      console.error('Accept invite error:', error)
      return { data: null, error }
    }
  }

  /**
   * Get current user's organization
   */
  const getOrganization = async () => {
    if (!user?.organization_id) return null

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', user.organization_id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching organization:', error)
      return null
    }
  }

  const value = useMemo(
    () => {
      const isAuth = !!session?.user
      console.log('📊 Auth Context Value:', {
        hasSession: !!session,
        hasUser: !!user,
        loading,
        initialized,
        isAuthenticated: isAuth
      })
      return {
        // State
        session,
        user,
        loading,
        initialized,
        isAuthenticated: isAuth,
      
      // Auth methods
      signUp,
      loginWithPassword,
      loginWithProvider,
      logout,
      
      // Password reset
      resetPasswordRequest,
      updatePassword,
      
      // Profile
      updateProfile,
      
      // Team/Organization
      acceptInvite,
      getOrganization,
      
        // Supabase client access (for advanced use cases)
        supabase
      }
    },
    [session, user, loading, initialized]
  )

  // Always render children; route guards use `loading` to gate access

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

