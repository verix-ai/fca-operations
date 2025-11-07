import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'

/**
 * Check if user has permission
 * Temporary inline version until permissions module is fixed
 */
function can(user, action, resource) {
  if (!user || !user.role) return false
  const PERMISSIONS = {
    admin: { clients: ['create', 'read', 'update', 'delete'] },
    marketer: { clients: ['create', 'read', 'update'] },
    viewer: { clients: ['read'] }
  }
  const rolePerms = PERMISSIONS[user.role]
  if (!rolePerms || !rolePerms[resource]) return false
  return rolePerms[resource].includes(action)
}

/**
 * ProtectedRoute - Requires authentication
 * Redirects to login if not authenticated
 */
export function ProtectedRoute({ children }) {
  const authContext = useAuth()
  const location = useLocation()

  // Safety check - if useAuth returns null/undefined
  if (!authContext) {
    console.error('❌ ProtectedRoute: No auth context available!')
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            Auth Error
          </h1>
          <p className="text-gray-700 dark:text-gray-300">
            AuthProvider not found. Check that routes are wrapped with AuthProvider.
          </p>
        </div>
      </div>
    )
  }

  const { isAuthenticated, loading, user, session, initialized } = authContext

  // Debug logging
  console.log('🛡️ ProtectedRoute check:', {
    path: location.pathname,
    isAuthenticated,
    loading,
    hasUser: !!user,
    hasSession: !!session
  })

  if (loading || !initialized) {
    console.log('⏳ ProtectedRoute: Still loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Require both session AND user profile to be loaded
  // If we have a session but no user yet, we're still loading the profile
  if (!isAuthenticated || (session && !user)) {
    console.log('❌ ProtectedRoute: Not authenticated or user profile not loaded, redirecting to /login')
    console.log('Current auth state:', { session, user, isAuthenticated, loading, initialized })
    
    // If we have a session but no user, wait a bit more for profile to load
    if (session && !user) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading user profile...</p>
          </div>
        </div>
      )
    }
    
    // Redirect immediately if no session
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  console.log('✅ ProtectedRoute: Authenticated, allowing access')
  return children
}

/**
 * PermissionRoute - Requires specific permission
 * Shows error message if user doesn't have permission
 */
export function PermissionRoute({ action, resource, children, fallback }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!can(user, action, resource)) {
    if (fallback) {
      return fallback
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
          <button
            onClick={() => window.history.back()}
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
          >
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  return children
}

/**
 * RoleRoute - Requires specific role(s)
 * Shows error message if user doesn't have required role
 */
export function RoleRoute({ roles, children, fallback }) {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const roleArray = Array.isArray(roles) ? roles : [roles]

  if (!user || !roleArray.includes(user.role)) {
    if (fallback) {
      return fallback
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Access Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This page is only accessible to {roleArray.join(' or ')} users. Please contact your administrator if you need access.
          </p>
          <button
            onClick={() => window.history.back()}
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
          >
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute

