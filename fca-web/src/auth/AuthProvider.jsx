import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import UserStore from '@/entities/User'

const STORAGE_KEY = 'fca_auth_session'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [session])

  const loginWithProvider = async (provider) => {
    // Placeholder: Integrate real OAuth provider (e.g., Cognito, Auth0, Firebase, Google) here
    // For now, simulate a user
    const mockUser = { id: 'mock-user', email: 'demo@fca.local', name: 'Demo User', role: 'admin' }
    setSession({ user: mockUser })
    navigate(createPageUrl('Dashboard'))
  }

  const loginWithPassword = async ({ email }) => {
    // Local mock: find user by email and sign-in
    const user = await UserStore.findByEmail(email)
    if (!user) throw new Error('User not found')
    setSession({ user })
    const redirectTo = (location.state && location.state.from) || createPageUrl('Dashboard')
    navigate(redirectTo)
  }

  const acceptInvite = async ({ token, name, email }) => {
    const created = await UserStore.acceptInvite({ token, name, email })
    setSession({ user: created })
    navigate(createPageUrl('Dashboard'))
  }

  const logout = async () => {
    setSession(null)
    navigate(createPageUrl('Login'))
  }

  const value = useMemo(() => ({
    user: session?.user || null,
    isAuthenticated: Boolean(session?.user),
    loginWithProvider,
    loginWithPassword,
    acceptInvite,
    logout,
  }), [session])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}


