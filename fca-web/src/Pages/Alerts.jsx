import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { AlertTriangle, BellRing, Loader2, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useToast } from '@/components/ui/toast'
import { loadAlerts, getAlertProviders, ALERT_CATEGORIES } from '@/services/alerts'
import { Notification } from '@/entities/Notification.supabase'
import { useAuth } from '@/auth/AuthProvider.jsx'
import { createPageUrl } from '@/utils'

const PAGE_SIZE = 10

function severityBadge(severity) {
  if (severity === 'expired') {
    return <Badge className="bg-red-500/15 text-red-300 border-red-500/40">Expired</Badge>
  }
  if (severity === 'warning') {
    return <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/40">Expiring soon</Badge>
  }
  return <Badge className="bg-white/5 text-neutral-300 border-white/10">OK</Badge>
}

function formatDueDate(iso) {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'MM-dd-yyyy')
  } catch {
    return iso
  }
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(ALERT_CATEGORIES.DOCUMENT_EXPIRATION)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('upcoming')
  const [page, setPage] = useState(1)
  const [remindingId, setRemindingId] = useState(null)
  const { push: toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth() || {}

  const providers = useMemo(() => getAlertProviders(), [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setIsLoading(true)
        const data = await loadAlerts({ category: activeCategory })
        if (!cancelled) setAlerts(data)
      } catch (err) {
        console.error('Failed to load alerts:', err)
        if (!cancelled) setAlerts([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [activeCategory])

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return alerts.filter((a) => {
      if (statusFilter === 'expired' && a.severity !== 'expired') return false
      if (statusFilter === 'warning' && a.severity !== 'warning') return false
      if (statusFilter === 'upcoming' && a.severity === 'ok') return false
      if (term) {
        const hay = `${a.entity.displayName} ${a.title}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [alerts, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  )

  useEffect(() => { setPage(1) }, [searchTerm, statusFilter, activeCategory])

  const counts = useMemo(() => {
    const expired = alerts.filter((a) => a.severity === 'expired').length
    const warning = alerts.filter((a) => a.severity === 'warning').length
    return { expired, warning, total: alerts.length }
  }, [alerts])

  const handleRemind = async (alert) => {
    try {
      setRemindingId(alert.id)
      if (!user?.id) throw new Error('Not authenticated')
      await Notification.create({
        user_id: user.id,
        type: 'client_updated',
        title: `${alert.title} expiring`,
        message: `${alert.entity.displayName} — ${alert.title} expires ${formatDueDate(alert.dueDate)}`,
        related_entity_type: 'client',
        related_entity_id: alert.entity.clientId || alert.entity.id,
        force: true,
      })
      toast({ title: 'Reminder sent', description: `Notification created for ${alert.entity.displayName}.` })
    } catch (err) {
      console.error('Failed to send reminder:', err)
      toast({ title: 'Could not send reminder', description: err?.message || 'Try again.', variant: 'destructive' })
    } finally {
      setRemindingId(null)
    }
  }

  const handleOpen = (alert) => {
    if (alert.entity.kind === 'caregiver') {
      navigate(createPageUrl('CaregiverDetail', { id: alert.entity.id }))
    } else {
      navigate(createPageUrl('ClientDetail', { id: alert.entity.id }))
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Workspace"
        title="Alerts"
        description="Upcoming items that need attention. Categories will expand over time as we add more workflows."
      >
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge className="bg-red-500/15 text-red-300 border-red-500/40">
            {counts.expired} Expired
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/40">
            {counts.warning} Expiring soon
          </Badge>
          <Badge className="bg-white/5 text-neutral-300 border-white/10">
            {counts.total} Total
          </Badge>
        </div>
      </SectionHeader>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-6">
        <TabsList>
          {providers.map((p) => (
            <TabsTrigger key={p.category} value={p.category}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {providers.map((p) => (
          <TabsContent key={p.category} value={p.category} className="space-y-4">
            <Card className="surface-main">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-heading-subdued" />
                    <Input
                      placeholder="Search by name or document..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'upcoming', label: 'Upcoming + Expired' },
                      { id: 'warning', label: 'Expiring soon' },
                      { id: 'expired', label: 'Expired' },
                      { id: 'all', label: 'All' },
                    ].map((opt) => (
                      <Button
                        key={opt.id}
                        size="sm"
                        variant={statusFilter === opt.id ? 'default' : 'outline'}
                        onClick={() => setStatusFilter(opt.id)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-heading-subdued">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Loading alerts…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-heading-subdued">
                    <AlertTriangle className="w-8 h-8 mb-2 opacity-60" />
                    <p>No alerts match the current filter.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-white/5">
                            <TableHead>Name</TableHead>
                            <TableHead>Document Name</TableHead>
                            <TableHead>Date Of Expiry</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageItems.map((alert) => (
                            <TableRow key={alert.id}>
                              <TableCell>
                                <button
                                  onClick={() => handleOpen(alert)}
                                  className="text-brand hover:underline text-left"
                                >
                                  {alert.entity.displayName}
                                </button>
                              </TableCell>
                              <TableCell>{alert.title}</TableCell>
                              <TableCell>{formatDueDate(alert.dueDate)}</TableCell>
                              <TableCell>{severityBadge(alert.severity)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-brand"
                                  onClick={() => handleRemind(alert)}
                                  disabled={remindingId === alert.id}
                                >
                                  {remindingId === alert.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                  ) : (
                                    <BellRing className="w-3 h-3 mr-1" />
                                  )}
                                  Remind
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-end gap-1 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePage === 1}
                        >
                          ‹
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                          <Button
                            key={n}
                            size="sm"
                            variant={n === safePage ? 'default' : 'outline'}
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage === totalPages}
                        >
                          ›
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
