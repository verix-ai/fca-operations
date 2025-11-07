import React, { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import Invite from '@/entities/Invite.supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export default function Signup() {
  const { signUp, loginWithProvider, acceptInvite, user: currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const inviteToken = searchParams.get('invite')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [invite, setInvite] = useState(null)
  const [verifyingInvite, setVerifyingInvite] = useState(!!inviteToken)
  const [formStarted, setFormStarted] = useState(false)

  // Prevent navigation if user is already logged in AND form has been started
  // This prevents auto-login from interrupting the signup process
  useEffect(() => {
    if (currentUser && formStarted && inviteToken) {
      // User is logged in but they're signing up someone else - don't navigate
      // Only navigate if they're not filling out the form
      console.log('⚠️ [Signup] User already logged in but form started - preventing auto-navigation')
      return
    }
    
    // If user is logged in and no form interaction, redirect to dashboard
    if (currentUser && !formStarted && !inviteToken) {
      console.log('⚠️ [Signup] User already logged in, redirecting to dashboard')
      navigate('/dashboard', { replace: true })
    }
  }, [currentUser, formStarted, inviteToken, navigate])

  // Verify invite token on mount
  useEffect(() => {
    if (!inviteToken) {
      // No invite token - redirect to login immediately
      console.error('Signup attempted without invite token - redirecting to login')
      navigate('/login', {
        state: { 
          error: 'Signups are invite-only. Please use the invitation link sent to your email.' 
        },
        replace: true
      })
      return
    }

    const verifyInvite = async () => {
      try {
        setVerifyingInvite(true)
        const inviteData = await Invite.verify(inviteToken)
        setInvite(inviteData)
        setFormData(prev => ({ ...prev, email: inviteData.email }))
      } catch (err) {
        setError(err.message || 'Invalid or expired invitation')
        // Redirect to login after showing error
        setTimeout(() => {
          navigate('/login', {
            state: { 
              error: err.message || 'Invalid or expired invitation' 
            },
            replace: true
          })
        }, 3000)
      } finally {
        setVerifyingInvite(false)
      }
    }

    verifyInvite()
  }, [inviteToken, navigate])

  const handleChange = (e) => {
    setFormStarted(true) // Mark that user has started interacting with the form
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    // Require invite token to sign up
    if (!inviteToken || !invite) {
      setError('An invitation is required to sign up. Please use the invite link sent to your email.')
      setLoading(false)
      return
    }

    try {
      // Sign up via invitation (only allowed method)
      const { error: inviteError } = await acceptInvite({
        token: inviteToken,
        name: formData.name,
        password: formData.password
      })

      if (inviteError) {
        setError(inviteError.message || 'Failed to accept invitation')
      } else {
        // Redirect to login after successful account creation
        // User needs to login with their new credentials
        navigate('/login', { 
          state: { 
            message: 'Account created successfully! Please sign in with your credentials.' 
          } 
        })
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignup = async (provider) => {
    // OAuth signup requires invite token
    if (!inviteToken || !invite) {
      setError('An invitation is required to sign up. Please use the invite link sent to your email.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const { error: oauthError } = await loginWithProvider(provider)
      if (oauthError) {
        setError(oauthError.message || `Failed to sign up with ${provider}`)
        setLoading(false)
      }
      // Note: OAuth redirect happens automatically
      // After OAuth callback, user will need to complete invite acceptance
    } catch (err) {
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  if (verifyingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 mb-4">
              <svg
                className="animate-spin h-12 w-12 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Verifying invitation...
            </h2>
          </div>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Check your email
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We've sent a confirmation link to <strong>{formData.email}</strong>.
              Click the link to verify your account and sign in.
            </p>
            <Link to="/login">
              <Button className="w-full">
                Go to Login
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {invite ? 'Accept Invitation' : 'Signup Requires Invitation'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {invite 
              ? `Join ${invite.organization_id} as a ${invite.role}`
              : 'Signups are invite-only. Please use the invitation link sent to your email.'
            }
          </p>
        </div>

        {!inviteToken && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Invitation Required:</strong> Signups are only available through invitation links sent by administrators.
            </p>
          </div>
        )}

        {invite && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>You've been invited!</strong> Complete the form below to join the team.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="name"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading || !!invite}
              autoComplete="email"
            />
            {invite && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Email is pre-filled from your invitation
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Must be at least 6 characters
            </p>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !inviteToken || !invite}
          >
            {loading 
              ? 'Accepting invitation...'
              : (invite ? 'Accept & Join' : 'Invitation Required')
            }
          </Button>
        </form>

        {invite && (
          <>
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                    Or sign up with
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthSignup('google')}
                  disabled={loading}
                  className="w-full"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthSignup('github')}
              disabled={loading}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
          </span>
          <Link
            to="/login"
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  )
}

