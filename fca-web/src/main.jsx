import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom'
import './index.css'

import Dashboard from '@/Pages/Dashboard.jsx'
import Reports from '@/Pages/Reports.jsx'
import ClientList from '@/Pages/ClientList.jsx'
import ClientIntake from '@/Pages/ClientIntake.jsx'
import ClientDetail from '@/Pages/ClientDetail.jsx'
import Messages from '@/Pages/Messages.jsx'
import Notifications from '@/Pages/Notifications.jsx'
import MarketerIntake from '@/Pages/MarketerIntake.jsx'
import Prospects from '@/Pages/Prospects.jsx'
import ReferralProfile from '@/Pages/ReferralProfile.jsx'
import Settings from '@/Pages/Settings.jsx'
import Login from '@/Pages/Login.jsx'
import Signup from '@/Pages/Signup.jsx'
import ResetPassword from '@/Pages/ResetPassword.jsx'
import AuthCallback from '@/Pages/AuthCallback.jsx'
import Layout from './Layout.jsx'
import { createPageUrl } from '@/utils'
import { ToastProvider } from '@/components/ui/toast.jsx'
import { ThemeProvider } from '@/components/theme/ThemeProvider.jsx'
// Using Supabase AuthProvider for authentication (renamed from .supabase to default)
import AuthProvider from '@/auth/AuthProvider.jsx'
import { ProtectedRoute, RoleRoute } from '@/components/auth/ProtectedRoute.jsx'
import { useAuth } from '@/auth/AuthProvider.jsx'

// Root component that wraps everything with AuthProvider
function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

// Wrapper for protected pages - requires authentication
function ProtectedPage({ children, currentPageName }) {
  return (
    <ProtectedRoute>
      <Layout currentPageName={currentPageName}>
        {children}
      </Layout>
    </ProtectedRoute>
  )
}

// Wrapper for public pages - no authentication required
function PublicPage({ children }) {
  return children
}

// Home redirect component - redirects based on user role
function HomeRedirect() {
  const { user } = useAuth()
  
  // Default to dashboard for non-marketers, referral form for marketers
  if (user?.role === 'marketer') {
    return <Navigate to={createPageUrl('MarketerIntake')} replace />
  }
  
  return <Navigate to={createPageUrl('Dashboard')} replace />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
  {
    path: createPageUrl('Dashboard'),
    element: (
      <ProtectedRoute>
        <RoleRoute roles={['admin']}>
          <Layout currentPageName="Dashboard">
            <Dashboard />
          </Layout>
        </RoleRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: createPageUrl('MarketerIntake'),
    element: (
      <ProtectedPage currentPageName="MarketerIntake">
        <MarketerIntake />
      </ProtectedPage>
    ),
  },
  {
    path: createPageUrl('Prospects'),
    element: (
      <ProtectedPage currentPageName="Prospects">
        <Prospects />
      </ProtectedPage>
    ),
  },
  {
    path: '/prospects/:id',
    element: (
      <ProtectedPage currentPageName="Prospects">
        <ReferralProfile />
      </ProtectedPage>
    ),
  },
  {
    path: createPageUrl('Reports'),
    element: (
      <ProtectedPage currentPageName="Reports">
        <Reports />
      </ProtectedPage>
    ),
  },
  {
    path: createPageUrl('ClientList'),
    element: (
      <ProtectedPage currentPageName="ClientList">
        <ClientList />
      </ProtectedPage>
    ),
  },
  {
    path: createPageUrl('ClientIntake'),
    element: (
      <ProtectedPage currentPageName="ClientIntake">
        <ClientIntake />
      </ProtectedPage>
    ),
  },
  {
    path: createPageUrl('Messages'),
    element: (
      <ProtectedPage currentPageName="Messages">
        <Messages />
      </ProtectedPage>
    ),
  },
  {
    path: createPageUrl('Notifications'),
    element: (
      <ProtectedPage currentPageName="Notifications">
        <Notifications />
      </ProtectedPage>
    ),
  },
  {
    path: '/client/:id',
    element: (
      <ProtectedPage currentPageName="ClientDetail">
        <ClientDetail />
      </ProtectedPage>
    ),
  },
  {
    path: createPageUrl('Settings'),
    element: (
      <ProtectedPage currentPageName="Settings">
        <Settings />
      </ProtectedPage>
    ),
  },
  { 
    path: '', 
    element: (
      <ProtectedRoute>
        <HomeRedirect />
      </ProtectedRoute>
    ) 
  },
  // Auth Routes - Don't require authentication to access
  { path: 'login', element: <PublicPage><Login /></PublicPage> },
  { path: 'signup', element: <PublicPage><Signup /></PublicPage> },
  { path: 'reset-password', element: <PublicPage><ResetPassword /></PublicPage> },
  { path: 'auth/callback', element: <PublicPage><AuthCallback /></PublicPage> },
    ]
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
