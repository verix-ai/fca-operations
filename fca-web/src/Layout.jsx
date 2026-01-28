import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  Link as LinkIcon,
  MessageSquare,
  PieChart,
  Plus,
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider.jsx'
import { createPageUrl } from '@/utils'
import { Button } from '@/components/ui/button'
import NotificationNavItem from '@/components/layout/NotificationNavItem.jsx'

const softSpringEasing = 'cubic-bezier(0.25, 1.1, 0.4, 1)'

function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

function buildNavigationSections(user) {
  const isMarketer = user?.role === 'marketer'
  const managementItems = isMarketer
    ? [
      { id: 'marketer-intake', title: 'Referral Form', icon: ClipboardList, url: createPageUrl('MarketerIntake') },
      { id: 'clients', title: 'Clients', icon: Users, url: createPageUrl('ClientList') },
      { id: 'prospects', title: 'Prospects', icon: Users, url: createPageUrl('Prospects') },
      { id: 'reports', title: 'Reports', icon: PieChart, url: createPageUrl('Reports') },
      { id: 'messages', title: 'Messages', icon: MessageSquare, url: createPageUrl('Messages') },
    ]
    : [
      { id: 'dashboard', title: 'Operation Board', icon: BarChart3, url: createPageUrl('Dashboard') },
      { id: 'clients', title: 'All Clients', icon: Users, url: createPageUrl('ClientList') },
      { id: 'caregivers', title: 'All Caregivers', icon: HeartHandshake, url: createPageUrl('CaregiverList') },
      { id: 'prospects', title: 'Prospects', icon: Users, url: createPageUrl('Prospects') },
      { id: 'reports', title: 'Reports', icon: PieChart, url: createPageUrl('Reports') },
      { id: 'marketer-intake', title: 'Referral Form', icon: ClipboardList, url: createPageUrl('MarketerIntake') },
      { id: 'messages', title: 'Messages', icon: MessageSquare, url: createPageUrl('Messages') },
    ]

  const base = [
    {
      id: 'management',
      title: 'Management',
      items: managementItems,
    },
    {
      id: 'workspace',
      title: 'Workspace',
      items: [
        { id: 'notifications', title: 'Notifications', icon: Bell, url: createPageUrl('Notifications'), isCustom: true },
        // Settings hidden for marketers
        ...(!isMarketer ? [{ id: 'settings', title: 'Settings', icon: Settings, url: createPageUrl('Settings'), placement: 'footer' }] : []),
      ],
    },
  ]
  return base
}

const railLogoShadeClass =
  'relative flex items-center justify-center rounded-2xl border border-[rgba(var(--border),0.55)] bg-[rgba(var(--bg),0.9)] shadow-[0_12px_28px_-18px_rgba(0,0,0,0.65)]'

function NavigationRail({ items, footerItems, isDetailCollapsed, onToggleDetail, user }) {
  return (
    <aside
      data-sidebar
      className="hidden lg:flex sticky top-0 h-full w-20 shrink-0 flex-col items-center gap-4 border-r border-[rgba(var(--border),0.4)] bg-[rgba(var(--bg-soft),0.85)] px-4 py-6 backdrop-blur-xl"
      style={{ transitionTimingFunction: softSpringEasing }}
    >
      <div className="flex w-full flex-col items-center gap-3">
        <div className={classNames(railLogoShadeClass, 'h-12 w-12 overflow-hidden')}>
          <img src="/fca-logo.png" alt="FCA" className="h-full w-full object-contain p-1.5" />
        </div>
        <button
          type="button"
          onClick={onToggleDetail}
          aria-pressed={!isDetailCollapsed}
          aria-label={isDetailCollapsed ? 'Expand detail sidebar' : 'Collapse detail sidebar'}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgba(var(--muted),0.8)] transition-colors motion-safe:duration-300 hover:border-[rgba(var(--border),0.55)] hover:text-[rgb(var(--text))]"
          style={{ transitionTimingFunction: softSpringEasing }}
        >
          {isDetailCollapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">
            {isDetailCollapsed ? 'Expand navigation detail panel' : 'Collapse navigation detail panel'}
          </span>
        </button>
      </div>
      <nav className="flex w-full flex-1 flex-col items-center gap-2">
        {items.map((item) => {
          // Render custom NotificationNavItem for notifications
          if (item.isCustom && item.id === 'notifications') {
            return <NotificationNavItem key={item.id} variant="rail" />
          }

          return (
            <NavLink
              key={item.id}
              to={item.url}
              className={({ isActive }) =>
                classNames(
                  'group flex h-12 w-12 items-center justify-center rounded-xl border transition-all motion-safe:duration-300',
                  'border-transparent text-[rgba(var(--muted),0.75)] hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.22)] hover:text-[rgb(var(--text))]',
                  isActive &&
                  'border-[rgba(var(--brand),0.45)] bg-[rgba(var(--border),0.35)] text-[rgb(var(--text))] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)]',
                )
              }
              title={item.title}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">{item.title}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="flex w-full flex-col items-center gap-2">
        {footerItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.url}
            className={({ isActive }) =>
              classNames(
                'group flex h-12 w-12 items-center justify-center rounded-xl border transition-all motion-safe:duration-300',
                'border-transparent text-[rgba(var(--muted),0.75)] hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.22)] hover:text-[rgb(var(--text))]',
                isActive &&
                'border-[rgba(var(--brand),0.45)] bg-[rgba(var(--border),0.35)] text-[rgb(var(--text))] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)]',
              )
            }
            title={item.title}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">{item.title}</span>
          </NavLink>
        ))}
        {/* Profile Link */}
        <NavLink
          to={createPageUrl('Profile')}
          className={({ isActive }) =>
            classNames(
              'group flex h-12 w-12 items-center justify-center rounded-xl border transition-all motion-safe:duration-300 overflow-hidden',
              'border-transparent text-[rgba(var(--muted),0.75)] hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.22)] hover:text-[rgb(var(--text))]',
              isActive &&
              'border-[rgba(var(--brand),0.45)] bg-[rgba(var(--border),0.35)] text-[rgb(var(--text))] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)]',
            )
          }
          title="Profile"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-5 w-5" aria-hidden="true" />
          )}
          <span className="sr-only">Profile</span>
        </NavLink>
      </div>
    </aside>
  )
}

function DetailSidebar({ sections, currentPageName, onCollapse, user }) {
  const [searchValue, setSearchValue] = useState('')
  const filteredSections = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) return sections
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.title.toLowerCase().includes(query)),
      }))
      .filter((section) => section.items.length > 0)
  }, [sections, searchValue])

  return (
    <aside
      data-sidebar
      className="hidden md:flex sticky top-0 h-full w-[22rem] shrink-0 flex-col gap-5 overflow-hidden border-r border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg-soft),0.92)] px-6 py-6 backdrop-blur-xl"
      style={{ transitionTimingFunction: softSpringEasing }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={classNames(railLogoShadeClass, 'h-12 w-12 overflow-hidden')}>
            <img src="/fca-logo.png" alt="FCA" className="h-full w-full object-contain p-1.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-[rgba(var(--muted),0.7)]">
              Friendly Care Agency
            </span>
            <span className="text-xl font-semibold text-[rgb(var(--text))]">FCA Operations</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.75)] text-[rgba(var(--muted),0.8)] transition-colors hover:border-[rgba(var(--border),0.55)] hover:text-[rgb(var(--text))]"
          aria-label="Collapse detailed sidebar"
          style={{ transitionTimingFunction: softSpringEasing }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Collapse sidebar</span>
        </button>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-[rgba(var(--muted),0.6)]">
          Currently viewing
        </p>
        <p className="mt-2 text-lg font-semibold text-[rgb(var(--text))]">{currentPageName}</p>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] px-4 py-2">
        <div className="flex items-center gap-2 text-[rgba(var(--muted),0.75)]">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="w-full bg-transparent text-sm text-[rgb(var(--text))] outline-none placeholder:text-[rgba(var(--muted),0.6)]"
            placeholder="Quick search"
          />
        </div>
      </div>

      <nav className="flex w-full flex-1 flex-col gap-6 overflow-y-auto pr-1">
        {filteredSections.map((section) => (
          <div key={section.id} className="flex w-full flex-col gap-3">
            <h3 className="px-2 text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(var(--muted),0.6)]">
              {section.title}
            </h3>
            <div className="flex flex-col gap-2">
              {section.items.map((item) => {
                // Render custom NotificationNavItem for notifications
                if (item.isCustom && item.id === 'notifications') {
                  return <NotificationNavItem key={item.id} variant="detail" />
                }

                return (
                  <NavLink
                    key={item.id}
                    to={item.url}
                    className={({ isActive }) =>
                      classNames(
                        'group flex items-center gap-3 rounded-xl border border-transparent px-4 py-2 text-sm font-medium transition-all motion-safe:duration-300',
                        'text-[rgba(var(--muted),0.75)] hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.18)] hover:text-[rgb(var(--text))]',
                        isActive &&
                        'border-[rgba(var(--brand),0.45)] bg-[rgba(255,255,255,0.12)] text-[rgb(var(--text))] shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)]',
                      )
                    }
                    title={item.title}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgba(var(--muted),0.8)] shadow-[0_12px_24px_-20px_rgba(0,0,0,0.65)] transition-colors group-hover:border-[rgba(var(--border),0.55)] group-hover:text-[rgb(var(--text))]">
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex flex-1 flex-col text-left">
                      <span>{item.title}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-[rgba(var(--muted),0.55)] opacity-0 transition-opacity group-hover:opacity-100">
                      <LinkIcon className="h-3 w-3" aria-hidden="true" />
                      Open
                    </span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile Link */}
      <NavLink
        to={createPageUrl('Profile')}
        className={({ isActive }) =>
          classNames(
            'w-full rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all',
            isActive
              ? 'border-[rgba(var(--brand),0.45)] bg-[rgba(255,255,255,0.12)] shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)]'
              : 'border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.82)] hover:border-[rgba(var(--border),0.55)] hover:bg-[rgba(var(--border),0.18)]'
          )
        }
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(var(--border),0.45)] bg-[rgba(var(--bg),0.8)] shadow-[0_14px_30px_-28px_rgba(0,0,0,0.75)] overflow-hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-5 w-5 text-[rgb(var(--text))]" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-[rgb(var(--text))] truncate">{user?.name || 'Profile'}</span>
          <span className="text-xs text-[rgba(var(--muted),0.65)] truncate">{user?.email || 'Manage your account'}</span>
        </div>
      </NavLink>
    </aside>
  )
}

function MobileNavigation({ sections, isOpen, onToggle }) {
  return (
    <div className="md:hidden border-b border-[rgba(var(--border),0.25)] bg-[rgba(var(--bg-soft),0.95)] px-4 py-3 backdrop-blur-lg">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.8)] text-[rgb(var(--text))]"
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
        >
          <span className="sr-only">Toggle navigation</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M4 6h16a1 1 0 1 0 0-2H4a1 1 0 0 0 0 2Zm16 5H4a1 1 0 1 0 0 2h16a1 1 0 0 0 0-2Zm0 7H4a1 1 0 1 0 0 2h16a1 1 0 0 0 0-2Z" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className={classNames(railLogoShadeClass, 'h-11 w-11 overflow-hidden')}>
            <img src="/fca-logo.png" alt="FCA" className="h-full w-full object-contain p-1.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-[rgba(var(--muted),0.6)]">
              FCA Operations
            </span>
            <span className="text-sm font-semibold text-[rgb(var(--text))]">Navigation</span>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="mt-3 flex flex-col gap-3">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-2">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[rgba(var(--muted),0.6)]">
                {section.title}
              </span>
              <div className="flex flex-col">
                {section.items.map((item) => {
                  // Render custom NotificationNavItem for notifications
                  if (item.isCustom && item.id === 'notifications') {
                    return <NotificationNavItem key={item.id} variant="mobile" />
                  }

                  return (
                    <NavLink
                      key={item.id}
                      to={item.url}
                      className={({ isActive }) =>
                        classNames(
                          'flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-[rgba(var(--muted),0.75)] transition-colors',
                          'hover:border-[rgba(var(--border),0.45)] hover:bg-[rgba(var(--border),0.12)] hover:text-[rgb(var(--text))]',
                          isActive && 'border-[rgba(var(--brand),0.45)] bg-[rgba(var(--border),0.2)] text-[rgb(var(--text))]',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span className="flex-1 text-left">{item.title}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout({ children, currentPageName }) {
  const authValue = useAuth() || {}
  const { user, logout } = authValue
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDetailCollapsed, setDetailCollapsed] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    console.log('🔓 Logout button clicked')
    try {
      await logout()
      console.log('✅ Logout successful')
    } catch (error) {
      console.error('❌ Logout failed:', error)
    }
  }

  const sections = useMemo(() => buildNavigationSections(user), [user])

  const { railItems, footerItems } = useMemo(() => {
    const allItems = sections.flatMap((section) => section.items)
    return {
      railItems: allItems.filter((item) => item.placement !== 'footer'),
      footerItems: allItems.filter((item) => item.placement === 'footer'),
    }
  }, [sections])

  return (
    <div className="h-screen w-full overflow-hidden bg-noise">
      <div className="flex h-full flex-col md:flex-row">
        {isDetailCollapsed ? (
          <NavigationRail
            items={railItems}
            footerItems={footerItems}
            isDetailCollapsed={isDetailCollapsed}
            onToggleDetail={() => setDetailCollapsed(false)}
            user={user}
          />
        ) : (
          <DetailSidebar
            sections={sections}
            currentPageName={currentPageName}
            onCollapse={() => setDetailCollapsed(true)}
            user={user}
          />
        )}
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          <MobileNavigation
            sections={sections}
            isOpen={mobileMenuOpen}
            onToggle={() => setMobileMenuOpen((value) => !value)}
          />
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-6 lg:px-8 xl:px-10">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex items-center gap-2 sm:mr-auto">
                {user?.role && (
                  <span className="rounded-lg border border-[rgba(var(--border),0.35)] bg-[rgba(var(--bg),0.75)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(var(--muted),0.8)]">
                    {user.role}
                  </span>
                )}
                {user?.name && (
                  <span className="text-xs text-[rgba(var(--muted),0.7)]">{user.name}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  borderRadius="999px"
                  className="px-3 py-1 text-xs"
                  onClick={handleLogout}
                  title="Log out"
                >
                  Logout
                </Button>
              </div>
            </div>
            <div className="mx-auto w-full max-w-[110rem]">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}





