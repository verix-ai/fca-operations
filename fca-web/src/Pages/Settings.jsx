import React, { useEffect, useState } from 'react'
import Program from '@/entities/Program.supabase'
import CmCompany from '@/entities/CmCompany.supabase'
import User from '@/entities/User.supabase'
import Invite from '@/entities/Invite.supabase'
import SettingsStore from '@/entities/Settings.supabase'
import countiesData from '@/data/counties.json'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Save, UserPlus, Mail, Copy, X, RefreshCw, Shield, UserCheck, UserX, Wrench } from 'lucide-react'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { usePermissions } from '@/utils/permissions.jsx'
import { useAuth } from '@/auth/AuthProvider'

export default function Settings() {
  const { isAdmin } = usePermissions()

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage the foundational data that powers programs, service regions, and marketer preferences."
      />

      <div className="grid gap-3 items-start lg:grid-cols-2">
        {isAdmin && <EmployeeManagementSection />}
        <ProgramsSection />
        <CmCompaniesSection />
        <CaregiverAlertsSection />
        <CountiesSection />
      </div>
    </div>
  )
}

function EmployeeManagementSection() {
  const [users, setUsers] = useState([])
  const [invites, setInvites] = useState([])
  const [isInviting, setIsInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('marketer')
  const [copiedToken, setCopiedToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [newInvite, setNewInvite] = useState(null)
  const { user: currentUser } = useAuth()

  const load = async () => {
    try {
      setLoading(true)
      console.log('🔄 Loading users and invites...')
      const [usersData, invitesData] = await Promise.all([
        User.list(),
        Invite.getPending()
      ])
      console.log('✅ Loaded users:', usersData.length, 'invites:', invitesData.length)
      console.log('📊 Users:', usersData.map(u => ({ email: u.email, name: u.name, role: u.role })))
      console.log('📧 Pending invites:', invitesData.map(i => ({ email: i.email, used: i.used, expires_at: i.expires_at })))
      setUsers(usersData.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)))
      setInvites(invitesData)
      setError(null)
    } catch (err) {
      console.error('❌ Error loading users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleInvite = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)
      setNewInvite(null)

      const invite = await Invite.create({ email: inviteEmail, role: inviteRole })

      if (!invite || !invite.token) {
        throw new Error('Failed to generate invite code. Please try again.')
      }

      setNewInvite(invite)

      if (invite.emailSent) {
        setSuccessMessage(`Invitation email sent successfully to ${inviteEmail}`)
      } else {
        setSuccessMessage(`Invitation created! Email sending is not configured. Copy the link below to share with ${inviteEmail}`)
      }

      setInviteEmail('')
      setInviteRole('marketer')
      setIsInviting(false)

      // Reload invites in background (non-blocking)
      load().catch(err => {
        console.warn('Background reload failed:', err)
      })

      // Auto-hide success message after 10 seconds
      setTimeout(() => {
        setSuccessMessage(null)
        setNewInvite(null)
      }, 10000)
    } catch (err) {
      console.error('Error creating invite:', err)
      setError(err.message || 'Failed to create invitation. Please try again.')
      setNewInvite(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyInvite = async (inviteId) => {
    try {
      const invite = await Invite.resend(inviteId)
      navigator.clipboard.writeText(invite.inviteUrl)
      setCopiedToken(inviteId)
      setTimeout(() => setCopiedToken(null), 2000)
    } catch (err) {
      console.error('Error copying invite:', err)
      setError(err.message)
    }
  }

  const handleCancelInvite = async (inviteId) => {
    if (!inviteId) {
      setError('Invalid invite ID')
      return
    }

    if (!confirm('Cancel this invitation? This action cannot be undone.')) return

    // Store the invite being deleted in case we need to revert
    const inviteToDelete = invites.find(inv => inv.id === inviteId)

    try {
      setError(null)
      setSuccessMessage(null)
      setLoading(true)

      console.log('Canceling invite:', inviteId)
      const result = await Invite.cancel(inviteId)

      if (result.success) {
        setSuccessMessage('Invitation canceled successfully')

        // Reload to ensure we have fresh data from the database
        await load()

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000)
      }
    } catch (err) {
      console.error('Error canceling invite:', err)
      setError(err.message || 'Failed to cancel invitation. Please try again.')
      setSuccessMessage(null)

      // Reload to ensure sync with database
      await load()
    } finally {
      setLoading(false)
    }
  }

  const handleRepairInvite = async (inviteId) => {
    if (!inviteId) {
      setError('Invalid invite ID')
      return
    }

    try {
      setError(null)
      setSuccessMessage(null)
      setLoading(true)

      console.log('Repairing invite:', inviteId)
      const result = await Invite.repair(inviteId)

      if (result.success) {
        setSuccessMessage(result.message || 'Invite repaired successfully')

        // Reload to ensure we have fresh data from the database
        await load()

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(result.message || 'Failed to repair invite. User profile may not exist.')
        // Still reload to refresh the UI
        await load()
      }
    } catch (err) {
      console.error('Error repairing invite:', err)
      setError(err.message || 'Failed to repair invitation. Please try again.')
      setSuccessMessage(null)

      // Reload to ensure sync with database
      await load()
    } finally {
      setLoading(false)
    }
  }

  const handleChangeRole = async (userId, newRole) => {
    try {
      setLoading(true)
      await User.changeRole(userId, newRole)
      await load()
    } catch (err) {
      console.error('Error changing role:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (userId, isActive) => {
    try {
      setLoading(true)
      if (isActive) {
        await User.deactivate(userId)
      } else {
        await User.reactivate(userId)
      }
      await load()
    } catch (err) {
      console.error('Error toggling user status:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
      case 'marketer': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  return (
    <>
      <Card className="bg-hero-card border rounded-2xl surface-main lg:col-span-2">
        <CardHeader className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-heading-primary">Team Members</CardTitle>
            <p className="text-sm text-heading-subdued mt-1">Manage employee access and permissions</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={load} variant="outline" borderRadius="999px" className="h-9 gap-2 px-3 sm:px-4 flex-1 sm:flex-none" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button onClick={() => setIsInviting(true)} variant="default" borderRadius="999px" className="h-9 gap-2 px-3 sm:px-4 flex-1 sm:flex-none">
              <UserPlus className="w-4 h-4" />
              <span className="sm:ml-2">Invite</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          {successMessage && !newInvite && (
            <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm border-b border-[rgba(147,165,197,0.2)]">
              {successMessage}
            </div>
          )}
          {successMessage && newInvite && (
            <div className="px-4 py-4 bg-green-50 dark:bg-green-900/20 border-b border-[rgba(147,165,197,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-green-700 dark:text-green-300 font-medium mb-2">{successMessage}</p>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Invite Code:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        borderRadius="0.5rem"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(newInvite.token)
                          setCopiedToken('code')
                          setTimeout(() => setCopiedToken(null), 2000)
                        }}
                      >
                        {copiedToken === 'code' ? '✓ Copied' : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <code className="text-xs text-gray-800 dark:text-gray-200 break-all font-mono block">
                      {newInvite.token}
                    </code>
                  </div>
                  <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Invite URL:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        borderRadius="0.5rem"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(newInvite.inviteUrl)
                          setCopiedToken('url')
                          setTimeout(() => setCopiedToken(null), 2000)
                        }}
                      >
                        {copiedToken === 'url' ? '✓ Copied' : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <code className="text-xs text-gray-800 dark:text-gray-200 break-all font-mono block">
                      {newInvite.inviteUrl}
                    </code>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  borderRadius="0.5rem"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setSuccessMessage(null)
                    setNewInvite(null)
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[rgba(147,165,197,0.2)]">
                  <TableHead className="text-heading-subdued p-3 sm:p-4">Name</TableHead>
                  <TableHead className="text-heading-subdued p-3 sm:p-4 hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-heading-subdued p-3 sm:p-4">Role</TableHead>
                  <TableHead className="text-heading-subdued p-3 sm:p-4 hidden lg:table-cell">Status</TableHead>
                  <TableHead className="text-heading-subdued p-3 sm:p-4 w-24 sm:w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id} className="border-b border-[rgba(147,165,197,0.2)]">
                    <TableCell className="p-3 sm:p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-heading-primary font-medium text-sm sm:text-base">{u.name || 'Unnamed'}</span>
                          {u.id === currentUser?.id && (
                            <span className="text-xs text-heading-subdued">(You)</span>
                          )}
                        </div>
                        <span className="text-xs text-heading-subdued md:hidden">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 sm:p-4 text-heading-subdued hidden md:table-cell">{u.email}</TableCell>
                    <TableCell className="p-3 sm:p-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium w-fit ${getRoleBadgeColor(u.role)}`}>
                          {u.role || 'No role'}
                        </span>
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs lg:hidden">
                            <UserCheck className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs lg:hidden">
                            <UserX className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-3 sm:p-4 hidden lg:table-cell">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                          <UserCheck className="w-4 h-4" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                          <UserX className="w-4 h-4" />
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="p-3 sm:p-4">
                      {u.id !== currentUser?.id && (
                        <Button
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          variant="outline"
                          borderRadius="1rem"
                          className="px-2 sm:px-3 h-8 text-xs sm:text-sm"
                          disabled={loading}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {invites.length > 0 && (
            <div className="border-t border-[rgba(147,165,197,0.2)]">
              <div className="px-3 sm:px-4 py-3 bg-[rgba(147,165,197,0.05)]">
                <h4 className="text-sm font-medium text-heading-primary flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Pending Invitations
                </h4>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[rgba(147,165,197,0.2)]">
                      <TableHead className="text-heading-subdued p-3 sm:p-4">Email</TableHead>
                      <TableHead className="text-heading-subdued p-3 sm:p-4 hidden sm:table-cell">Role</TableHead>
                      <TableHead className="text-heading-subdued p-3 sm:p-4 hidden md:table-cell">Invite Code</TableHead>
                      <TableHead className="text-heading-subdued p-3 sm:p-4 hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="text-heading-subdued p-3 sm:p-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map(inv => (
                      <TableRow key={inv.id} className="border-b border-[rgba(147,165,197,0.2)]">
                        <TableCell className="p-3 sm:p-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-heading-subdued text-sm">{inv.email}</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium w-fit sm:hidden ${getRoleBadgeColor(inv.role)}`}>
                              {inv.role}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-3 sm:p-4 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(inv.role)}`}>
                            {inv.role}
                          </span>
                        </TableCell>
                        <TableCell className="p-3 sm:p-4 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-heading-subdued font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {inv.token?.substring(0, 8)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              borderRadius="0.5rem"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(inv.token)
                                setCopiedToken(`token-${inv.id}`)
                                setTimeout(() => setCopiedToken(null), 2000)
                              }}
                              title="Copy full token"
                            >
                              {copiedToken === `token-${inv.id}` ? (
                                <span className="text-xs">✓</span>
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="p-3 sm:p-4 text-sm text-heading-subdued hidden lg:table-cell">
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              onClick={() => handleRepairInvite(inv.id)}
                              variant="outline"
                              borderRadius="1rem"
                              className="px-2 sm:px-3 h-8 text-xs sm:text-sm whitespace-nowrap"
                              disabled={loading}
                              title="Repair invite - check if user exists and mark invite as used"
                            >
                              <Wrench className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Repair</span>
                            </Button>
                            <Button
                              onClick={() => handleCopyInvite(inv.id)}
                              variant="outline"
                              borderRadius="1rem"
                              className="px-2 sm:px-3 h-8 text-xs sm:text-sm whitespace-nowrap"
                              disabled={loading}
                            >
                              {copiedToken === inv.id ? (
                                <>✓ Copied</>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Copy Link</span>
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleCancelInvite(inv.id)}
                              variant="outline"
                              borderRadius="1rem"
                              className="px-2 sm:px-3 h-8 text-xs sm:text-sm"
                              disabled={loading}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isInviting && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsInviting(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[rgb(var(--card))] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Invite Team Member</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-heading-primary mb-2">Email Address</label>
                  <Input
                    autoFocus
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-heading-primary mb-2">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div>
                          <div className="font-medium">Admin</div>
                          <div className="text-xs text-heading-subdued">Full access to all features</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="marketer">
                        <div>
                          <div className="font-medium">Marketer</div>
                          <div className="text-xs text-heading-subdued">Can create and manage clients</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    borderRadius="1rem"
                    className="px-4"
                    onClick={() => {
                      setIsInviting(false)
                      setInviteEmail('')
                      setInviteRole('marketer')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    borderRadius="1rem"
                    className="gap-2 px-5"
                    onClick={handleInvite}
                    disabled={!inviteEmail || loading}
                  >
                    {loading ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CmCompaniesSection() {
  const [list, setList] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)

  const load = async () => {
    const companies = await CmCompany.list()
    setList(companies.sort((a, b) => a.name.localeCompare(b.name)))
  }
  useEffect(() => {
    (async () => {
      let companies = await CmCompany.list()
      if (companies.length === 0) {
        // seed with existing values from legacy constant
        const defaults = ['B & B Care', 'NSC', 'Infinity', 'Compassionate', 'Legacy-ICWP', 'HCM-ICWP', 'AAA', 'First Choice', 'Paris Heights', 'Rapha Health']
        for (const name of defaults) {
          try {
            await CmCompany.create({ name })
          } catch (err) {
            // Ignore "already exists" errors during seeding
            if (!err.message?.includes('already exists')) {
              console.warn(`Failed to seed company "${name}":`, err.message)
            }
          }
        }
        companies = await CmCompany.list()
      }
      setList(companies.sort((a, b) => a.name.localeCompare(b.name)))
    })()
  }, [])

  const addItem = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      setError(null)
      await CmCompany.create({ name })
      setNewName('')
      await load()
    } catch (err) {
      console.error('Error creating company:', err)
      setError(err.message || 'Failed to create company. Please try again.')
    }
  }

  const startEdit = (m) => { setEditingId(m.id); setEditingName(m.name) }
  const saveEdit = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    await CmCompany.update(editingId, { id: name, name })
    setEditingId(null); setEditingName('')
    load()
  }
  const remove = async (id) => { await CmCompany.remove(id); load() }

  return (
    <>
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Case Management Companies</CardTitle>
          <Button onClick={() => setIsAdding(true)} variant="default" borderRadius="999px" className="h-9 gap-2 px-4">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(147,165,197,0.2)]">
                <TableHead className="text-heading-subdued p-4">Name</TableHead>
                <TableHead className="text-heading-subdued p-4 w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(m => (
                <TableRow key={m.id} className="border-b border-[rgba(147,165,197,0.2)]">
                  <TableCell className="p-4">
                    {editingId === m.id ? (
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="rounded-xl" />
                    ) : (
                      <span className="text-heading-primary">{m.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    {editingId === m.id ? (
                      <Button onClick={saveEdit} variant="default" borderRadius="1rem" className="gap-2 px-5">
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={() => startEdit(m)} variant="outline" borderRadius="1rem" className="px-4">Edit</Button>
                        <Button onClick={() => remove(m.id)} variant="outline" borderRadius="1rem" className="px-4"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsAdding(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[rgb(var(--card))] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Add Case Management Company</h3>
              </div>
              <div className="p-4 space-y-3">
                <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Company name" className="rounded-xl" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" borderRadius="1rem" className="px-4" onClick={() => { setIsAdding(false); setNewName('') }}>Cancel</Button>
                  <Button variant="default" borderRadius="1rem" className="gap-2 px-5" onClick={async () => { await addItem(); setIsAdding(false) }}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ProgramsSection() {
  const [programs, setPrograms] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = async () => {
    const list = await Program.list()
    setPrograms(list.sort((a, b) => a.name.localeCompare(b.name)))
  }
  useEffect(() => { load() }, [])

  const addProgram = async () => {
    const name = newName.trim()
    if (!name) return
    await Program.create({ name })
    setNewName('')
    load()
  }

  const startEdit = (p) => { setEditingId(p.id); setEditingName(p.name) }
  const saveEdit = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    await Program.update(editingId, { id: name, name })
    setEditingId(null); setEditingName('')
    load()
  }
  const remove = async (id) => { await Program.remove(id); load() }

  return (
    <>
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Programs</CardTitle>
          <Button
            onClick={() => setIsAdding(true)}
            variant="default"
            borderRadius="999px"
            className="h-9 gap-2 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(147,165,197,0.2)]">
                <TableHead className="text-heading-subdued p-4">Name</TableHead>
                <TableHead className="text-heading-subdued p-4 w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map(p => (
                <TableRow key={p.id} className="border-b border-[rgba(147,165,197,0.2)]">
                  <TableCell className="p-4">
                    {editingId === p.id ? (
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="rounded-xl" />
                    ) : (
                      <span className="text-heading-primary">{p.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-4">
                    {editingId === p.id ? (
                      <Button
                        onClick={saveEdit}
                        variant="default"
                        borderRadius="1rem"
                        className="gap-2 px-5"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => startEdit(p)}
                          variant="outline"
                          borderRadius="1rem"
                          className="px-4"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => remove(p.id)}
                          variant="outline"
                          borderRadius="1rem"
                          className="px-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsAdding(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[rgb(var(--card))] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Add Program</h3>
              </div>
              <div className="p-4 space-y-3">
                <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Program name" className="rounded-xl" />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    borderRadius="1rem"
                    className="px-4"
                    onClick={() => {
                      setIsAdding(false)
                      setNewName('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    borderRadius="1rem"
                    className="gap-2 px-5"
                    onClick={async () => {
                      await addProgram()
                      setIsAdding(false)
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


const US_STATES = [
  { code: 'GA', name: 'Georgia' },
  { code: 'FL', name: 'Florida' },
  { code: 'AL', name: 'Alabama' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'NC', name: 'North Carolina' },
];

async function fetchCountiesCSV(stateCode) {
  const cacheKey = `fca_counties_${stateCode}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) } catch { }
  }
  // Try multiple CSV sources, stop on first success
  const sources = [
    'https://raw.githubusercontent.com/kjhealy/fips-codes/master/state_and_county_fips_master.csv',
    'https://raw.githubusercontent.com/kjhealy/fips-codes/master/county_fips_master.csv',
  ]
  for (const url of sources) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const text = await res.text()
      const lines = text.split(/\r?\n/)
      const header = lines.shift() || ''
      const cols = header.split(',').map(s => s.trim().toLowerCase())
      const stateIdx = cols.findIndex(c => c === 'state' || c === 'stusab' || c === 'stateabbr')
      const nameIdx = cols.findIndex(c => c.includes('county') && c.includes('name'))
      const countyIdx = nameIdx >= 0 ? nameIdx : cols.findIndex(c => c === 'county' || c === 'county_name')
      if (stateIdx === -1 || countyIdx === -1) continue
      const names = []
      for (const line of lines) {
        if (!line) continue
        const parts = line.split(',')
        const st = (parts[stateIdx] || '').replace(/"/g, '').trim()
        const county = (parts[countyIdx] || '').replace(/"/g, '').trim()
        // state column might be full name; map to code if needed
        const match = US_STATES.find(s => s.code === st || s.name.toLowerCase() === st.toLowerCase())
        if (match && match.code === stateCode && county) {
          const cleaned = county.replace(/ County$/i, '')
          names.push(cleaned)
        }
      }
      const unique = Array.from(new Set(names)).sort()
      if (unique.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(unique))
        return unique
      }
    } catch (e) {
      // try next source
    }
  }
  return []
}


async function fetchCounties(stateCode) {
  return countiesData[stateCode] || []
}

function CountiesSection() {
  const [regions, setRegions] = useState({})
  const [isAdding, setIsAdding] = useState(false)
  const [modalState, setModalState] = useState('GA')
  const [modalSelected, setModalSelected] = useState([])
  const [modalOriginal, setModalOriginal] = useState([])
  const [modalCounties, setModalCounties] = useState([])

  useEffect(() => {
    (async () => {
      const all = await SettingsStore.get()
      setRegions(all?.regions || {})
    })()
  }, [])

  const openAdd = async () => {
    const all = await SettingsStore.get()
    const list = all?.regions?.[modalState] || []
    setModalOriginal(list)
    setModalSelected(list)
    setIsAdding(true)
    const full = await fetchCounties(modalState)
    setModalCounties(full)
  }

  const loadModalForState = async (code) => {
    setModalState(code)
    const list = (regions || {})[code] || []
    setModalOriginal(list)
    setModalSelected(list)
    const full = await fetchCounties(code)
    setModalCounties(full)
  }

  const arraysEqual = (a, b) => {
    if (a.length !== b.length) return false
    const sa = [...a].sort(); const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i])
  }

  const toggleModalCounty = (county) => {
    setModalSelected(prev => prev.includes(county) ? prev.filter(c => c !== county) : [...prev, county])
  }

  const saveModal = async () => {
    await SettingsStore.setRegions(modalState, modalSelected)
    // refresh local regions
    const all = await SettingsStore.get()
    setRegions(all?.regions || {})
    setIsAdding(false)
  }

  const selectedStates = Object.keys(regions).filter(k => (regions[k] || []).length > 0)

  return (
    <>
      <Card className="bg-hero-card border rounded-2xl surface-main">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary">Counties</CardTitle>
          <Button
            onClick={openAdd}
            variant="default"
            borderRadius="999px"
            className="h-9 gap-2 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 pt-4 pb-4">
            {selectedStates.length === 0 ? (
              <p className="text-heading-subdued text-sm">No counties selected yet.</p>
            ) : (
              <div className="space-y-4">
                {selectedStates.map(code => (
                  <div key={code}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-heading-subdued font-medium">{US_STATES.find(s => s.code === code)?.name || code}</div>
                      <Button
                        variant="outline"
                        borderRadius="1rem"
                        className="h-8 px-3"
                        onClick={() => {
                          setIsAdding(true)
                          loadModalForState(code)
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(regions[code] || []).map(c => (
                        <span key={c} className="county-chip">{c} County</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsAdding(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[rgb(var(--card))] rounded-2xl border surface-top">
              <div className="p-4 border-b border-[rgba(147,165,197,0.2)] flex items-center justify-between">
                <h3 className="text-heading-primary font-semibold">Select Counties</h3>
                <div className="w-52">
                  <Select value={modalState} onValueChange={(v) => { loadModalForState(v) }}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-4 max-h-[60vh] overflow-auto space-y-2">
                {modalCounties.map(c => (
                  <label key={c} className="flex items-center gap-2 text-neutral-800">
                    <Checkbox checked={modalSelected.includes(c)} onCheckedChange={() => toggleModalCounty(c)} />
                    <span>{c} County</span>
                  </label>
                ))}
              </div>
              <div className="p-4 border-t border-[rgba(147,165,197,0.2)] flex justify-end gap-2">
                <Button
                  variant="outline"
                  borderRadius="1rem"
                  className="px-4"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  borderRadius="1rem"
                  className="gap-2 px-5"
                  disabled={arraysEqual(modalSelected, modalOriginal)}
                  onClick={saveModal}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
/* ... existing code ... */

function CaregiverAlertsSection() {
  const [settings, setSettings] = useState({
    cpr_days: 30,
    tb_days: 30,
    drivers_license_days: 30,
    training_days: 30
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const s = await SettingsStore.get()
        if (s.caregiver_alerts) {
          setSettings(prev => ({ ...prev, ...s.caregiver_alerts }))
        }
      } catch (e) {
        console.error("Failed to load caregiver alert settings", e)
      }
    })()
  }, [])

  const handleChange = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: parseInt(val) || 0 }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await SettingsStore.update({ caregiver_alerts: settings })
    } catch (e) {
      console.error("Failed to save settings", e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-hero-card border rounded-2xl surface-main">
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <CardTitle className="text-heading-primary">Caregiver Expiration Alerts</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-heading-subdued">
          Set the number of days before expiration to trigger notifications for administrators.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-heading-subdued">CPR & First Aid</label>
            <div className="relative">
              <Input
                type="number"
                value={settings.cpr_days}
                onChange={e => handleChange('cpr_days', e.target.value)}
                className="rounded-xl pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-heading-subdued">Days</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-heading-subdued">TB Test</label>
            <div className="relative">
              <Input
                type="number"
                value={settings.tb_days}
                onChange={e => handleChange('tb_days', e.target.value)}
                className="rounded-xl pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-heading-subdued">Days</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-heading-subdued">License</label>
            <div className="relative">
              <Input
                type="number"
                value={settings.drivers_license_days}
                onChange={e => handleChange('drivers_license_days', e.target.value)}
                className="rounded-xl pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-heading-subdued">Days</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-heading-subdued">Training</label>
            <div className="relative">
              <Input
                type="number"
                value={settings.training_days}
                onChange={e => handleChange('training_days', e.target.value)}
                className="rounded-xl pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-heading-subdued">Days</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} variant="default" className="w-full sm:w-auto">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
