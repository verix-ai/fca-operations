import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { createPageUrl } from '@/utils'

/**
 * AuthCallback - Handles OAuth redirect callbacks
 * 
 * This page is shown briefly after OAuth providers (Google, GitHub) redirect back.
 * It exchanges the auth code for a session and redirects to the dashboard.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash fragment from the URL which contains the auth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        if (error) {
          throw new Error(errorDescription || error)
        }

        if (!accessToken) {
          throw new Error('No access token found in callback')
        }

        // Set the session with the tokens
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (sessionError) {
          throw sessionError
        }

        // Check if user profile exists in database
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        // If no profile exists, this is a new OAuth signup
        // Signups are invite-only, so we need to check for an invite
        if (profileError?.code === 'PGRST116') {
          // Check if there's a pending invite for this email
          const { data: pendingInvite, error: inviteCheckError } = await supabase
            .from('invites')
            .select('*')
            .eq('email', data.user.email)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!pendingInvite || inviteCheckError) {
            // No invite found - signup not allowed
            console.error('OAuth signup attempted without invite:', data.user.email)
            
            // Sign out the user since they shouldn't have access
            await supabase.auth.signOut()
            
            // Redirect to login with error message
            navigate('/login', {
              state: { 
                error: 'Signups are invite-only. Please use the invitation link sent to your email.' 
              },
              replace: true
            })
            return
          }

          // Invite found - complete the invite acceptance
          try {
            // Mark invite as used
            const { error: inviteError } = await supabase
              .from('invites')
              .update({ 
                used: true, 
                used_at: new Date().toISOString() 
              })
              .eq('token', pendingInvite.token)

            if (inviteError) {
              console.error('Error marking invite as used:', inviteError)
            }

            // Create user profile with invite details
            const { error: createProfileError } = await supabase
              .from('users')
              .insert([{
                id: data.user.id,
                organization_id: pendingInvite.organization_id,
                email: pendingInvite.email,
                name: data.user.user_metadata.name || data.user.user_metadata.full_name || pendingInvite.email.split('@')[0],
                role: pendingInvite.role,
                is_active: true,
                avatar_url: data.user.user_metadata.avatar_url || data.user.user_metadata.picture
              }])

            if (createProfileError) {
              console.error('Error creating user profile:', createProfileError)
              throw createProfileError
            }
          } catch (err) {
            console.error('Error completing invite acceptance:', err)
            await supabase.auth.signOut()
            navigate('/login', {
              state: { error: 'Failed to complete invitation acceptance. Please try again.' },
              replace: true
            })
            return
          }
        }

        // Redirect to dashboard
        navigate(createPageUrl('Dashboard'), { replace: true })
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err.message || 'Authentication failed')
        
        // Redirect to login after a delay
        setTimeout(() => {
          navigate('/login', { 
            state: { error: err.message || 'Authentication failed' },
            replace: true 
          })
        }, 3000)
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Authentication Failed
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <p className="text-sm text-gray-500">
            Redirecting to login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Completing sign in...
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Please wait while we set up your account
        </p>
      </div>
    </div>
  )
}

