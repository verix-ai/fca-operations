import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

import Dashboard from '@/Pages/Dashboard.jsx'
import Reports from '@/Pages/Reports.jsx'
import ClientList from '@/Pages/ClientList.jsx'
import ClientIntake from '@/Pages/ClientIntake.jsx'
import ClientDetail from '@/Pages/ClientDetail.jsx'
import Messages from '@/Pages/Messages.jsx'
import MarketerIntake from '@/Pages/MarketerIntake.jsx'
import Prospects from '@/Pages/Prospects.jsx'
import ReferralProfile from '@/Pages/ReferralProfile.jsx'
import Settings from '@/Pages/Settings.jsx'
import Layout from '@/Layout.jsx'
import { createPageUrl } from '@/utils'
import { ToastProvider } from '@/components/ui/toast.jsx'
import { ThemeProvider } from '@/components/theme/ThemeProvider.jsx'
import AuthProvider from '@/auth/AuthProvider.jsx'

function AppShell({ children, currentPageName }) {
  return (
    <AuthProvider>
      <Layout currentPageName={currentPageName}>
        {children}
      </Layout>
    </AuthProvider>
  )
}

const router = createBrowserRouter([
  {
    path: createPageUrl('Dashboard'),
    element: (
      <AppShell currentPageName="Dashboard">
        <Dashboard />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('MarketerIntake'),
    element: (
      <AppShell currentPageName="MarketerIntake">
        <MarketerIntake />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('Prospects'),
    element: (
      <AppShell currentPageName="Prospects">
        <Prospects />
      </AppShell>
    ),
  },
  {
    path: '/prospects/:id',
    element: (
      <AppShell currentPageName="Prospects">
        <ReferralProfile />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('Reports'),
    element: (
      <AppShell currentPageName="Reports">
        <Reports />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('ClientList'),
    element: (
      <AppShell currentPageName="ClientList">
        <ClientList />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('ClientIntake'),
    element: (
      <AppShell currentPageName="ClientIntake">
        <ClientIntake />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('Messages'),
    element: (
      <AppShell currentPageName="Messages">
        <Messages />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('ClientDetail'),
    element: (
      <AppShell currentPageName="ClientDetail">
        <ClientDetail />
      </AppShell>
    ),
  },
  {
    path: createPageUrl('Settings'),
    element: (
      <AppShell currentPageName="Settings">
        <Settings />
      </AppShell>
    ),
  },
  { path: '/', element: (<AppShell currentPageName="Dashboard"><Dashboard /></AppShell>) },
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
