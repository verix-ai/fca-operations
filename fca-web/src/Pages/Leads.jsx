import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Archive,
  ArchiveRestore,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  StickyNote,
  X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useToast } from '@/components/ui/toast'
import { confirm } from '@/components/ui/confirm-dialog'
import { Lead } from '@/entities/Lead.supabase'
import { formatPhone } from '@/utils'

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'didnt_answer', label: "Didn't Answer" },
  { value: 'signed_up', label: 'Signed Up' },
  { value: 'doesnt_qualify', label: "Doesn't Qualify" },
]

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]))

// Row tints + matching badge classes per status
const STATUS_STYLES = {
  new:             { row: 'bg-transparent',          badge: 'bg-white/5 text-neutral-200 border-white/10' },
  contacted:       { row: 'bg-blue-500/[0.07]',      badge: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
  didnt_answer:    { row: 'bg-amber-500/[0.08]',     badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  signed_up:       { row: 'bg-emerald-500/[0.08]',   badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  doesnt_qualify:  { row: 'bg-rose-500/[0.08]',      badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom…' },
]

function presetToRange(preset) {
  const now = new Date()
  const start = new Date(now)
  if (preset === 'today') {
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: null }
  }
  if (preset === 'week') {
    const day = start.getDay() // 0=Sun
    start.setDate(start.getDate() - day)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: null }
  }
  if (preset === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: null }
  }
  if (preset === 'last30') {
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: null }
  }
  return { from: null, to: null }
}

function formatTimeIn(iso) {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'MM-dd-yyyy h:mm a')
  } catch {
    return iso
  }
}

export default function Leads() {
  const [view, setView] = useState('active')                 // 'active' | 'archived'
  const [stateFilter, setStateFilter] = useState('GA')       // 'GA' | 'OUT_OF_STATE' | 'all'
  const [statusFilter, setStatusFilter] = useState([])       // string[]
  const [countyFilter, setCountyFilter] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [counties, setCounties] = useState([])

  const [notesLead, setNotesLead] = useState(null)

  const { push: toast } = useToast()

  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : null,
        to: customTo ? new Date(customTo + 'T23:59:59.999').toISOString() : null,
      }
    }
    return presetToRange(datePreset)
  }, [datePreset, customFrom, customTo])

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [view, stateFilter, statusFilter, countyFilter, datePreset, customFrom, customTo, search, pageSize])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const result = await Lead.list({
          view,
          state: stateFilter,
          statuses: statusFilter.length ? statusFilter : undefined,
          county: countyFilter || undefined,
          search: search.trim() || undefined,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          page,
          pageSize,
        })
        if (!cancelled) {
          setRows(result.rows)
          setTotal(result.total)
        }
      } catch (err) {
        console.error('Failed to load leads:', err)
        if (!cancelled) {
          setRows([])
          setTotal(0)
          toast({ title: 'Could not load leads', description: err.message, variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [view, stateFilter, statusFilter, countyFilter, dateRange.from, dateRange.to, search, page, pageSize])

  useEffect(() => {
    Lead.distinctCounties().then(setCounties).catch(() => setCounties([]))
  }, [view])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function toggleStatus(value) {
    setStatusFilter((curr) =>
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value]
    )
  }

  function clearFilters() {
    setStateFilter(view === 'active' ? 'GA' : 'all')
    setStatusFilter([])
    setCountyFilter('')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
    setSearch('')
  }

  async function handleStatusChange(lead, newStatus) {
    if (lead.status === newStatus) return
    try {
      const updated = await Lead.setStatus(lead.id, newStatus)
      setRows((curr) => curr.map((r) => (r.id === lead.id ? { ...r, ...updated } : r)))
    } catch (err) {
      toast({ title: 'Could not update status', description: err.message, variant: 'destructive' })
    }
  }

  async function handleArchive(lead) {
    const ok = await confirm({
      title: 'Archive this lead?',
      description: `${lead.full_name} will move to the Archive view. You can restore it anytime.`,
      confirmText: 'Archive',
    })
    if (!ok) return
    try {
      await Lead.archive(lead.id)
      setRows((curr) => curr.filter((r) => r.id !== lead.id))
      setTotal((t) => Math.max(0, t - 1))
      toast({ title: 'Lead archived' })
    } catch (err) {
      toast({ title: 'Could not archive', description: err.message, variant: 'destructive' })
    }
  }

  async function handleUnarchive(lead) {
    try {
      await Lead.unarchive(lead.id)
      setRows((curr) => curr.filter((r) => r.id !== lead.id))
      setTotal((t) => Math.max(0, t - 1))
      toast({ title: 'Lead restored' })
    } catch (err) {
      toast({ title: 'Could not restore', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workflow"
        title="Leads"
        description="Incoming check-eligibility submissions from the FriendlyCare website."
      />

      <Card>
        <CardContent className="space-y-4">
          {/* View tabs */}
          <Tabs value={view} onValueChange={setView} className="w-full">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archive</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filter row */}
          <div className="flex flex-col gap-4">
            {/* State pill */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-heading-subdued mr-2">State</span>
              {[
                { value: 'GA', label: 'GA' },
                { value: 'OUT_OF_STATE', label: 'Out of State' },
                { value: 'all', label: 'All' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStateFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    stateFilter === opt.value
                      ? 'bg-white/15 text-heading-primary border-white/40'
                      : 'bg-white/[0.03] text-heading-subdued border-white/10 hover:text-heading-primary hover:border-white/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-heading-subdued mr-2">Status</span>
              {STATUS_OPTIONS.map((opt) => {
                const active = statusFilter.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      active
                        ? 'bg-white/15 text-heading-primary border-white/40'
                        : 'bg-white/[0.03] text-heading-subdued border-white/10 hover:text-heading-primary hover:border-white/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
              {statusFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter([])}
                  className="text-xs text-neutral-500 hover:text-white underline-offset-2 hover:underline ml-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* County / Date / Search / Page size */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-1">County</label>
                <Select value={countyFilter || 'all'} onValueChange={(v) => setCountyFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="All counties" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All counties</SelectItem>
                    {counties.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[160px]">
                <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-1">Date</label>
                <Select value={datePreset} onValueChange={setDatePreset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {datePreset === 'custom' && (
                <>
                  <div>
                    <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-1">From</label>
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-1">To</label>
                    <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                </>
              )}

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <Input
                    className="pl-9"
                    placeholder="Name, phone, or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-1">Per page</label>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[88px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={clearFilters}>Reset</Button>
            </div>
          </div>

          {/* Result summary */}
          <div className="flex items-center justify-between text-sm text-heading-subdued">
            <span>{loading ? 'Loading…' : `${total} lead${total === 1 ? '' : 's'}`}</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time In</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>GA Medicaid #</TableHead>
                  <TableHead>Zip</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="py-10 flex items-center justify-center text-heading-subdued">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading leads…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="py-10 text-center text-heading-subdued">
                        No leads match your filters.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((lead) => {
                    const styles = STATUS_STYLES[lead.status] || STATUS_STYLES.new
                    return (
                      <TableRow key={lead.id} className={styles.row}>
                        <TableCell className="whitespace-nowrap text-sm">{formatTimeIn(lead.created_at)}</TableCell>
                        <TableCell className="font-medium">{lead.full_name}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {lead.phone ? (
                            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:underline">
                              <Phone className="h-3.5 w-3.5 opacity-60" />
                              {formatPhone(lead.phone)}
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">
                          {lead.email ? (
                            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:underline">
                              <Mail className="h-3.5 w-3.5 opacity-60" />
                              {lead.email}
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {lead.medicaid_number || '—'}
                        </TableCell>
                        <TableCell>{lead.zip || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {lead.county ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 opacity-60" />
                              {lead.county}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {lead.state === 'GA' ? (
                            <Badge className="bg-white/5 text-neutral-200 border-white/10">GA</Badge>
                          ) : (
                            <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/40">Out of State</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={lead.status}
                            onValueChange={(v) => handleStatusChange(lead, v)}
                          >
                            <SelectTrigger className={`min-w-[150px] py-1.5 px-3 text-sm rounded-full ${styles.badge}`}>
                              <span>{STATUS_LABEL[lead.status]}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNotesLead(lead)}
                            title="Notes & history"
                          >
                            <StickyNote className="h-4 w-4" />
                          </Button>
                          {view === 'active' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(lead)}
                              title="Archive"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnarchive(lead)}
                              title="Restore"
                            >
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-heading-subdued">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {notesLead && (
        <NotesModal
          lead={notesLead}
          onClose={() => setNotesLead(null)}
        />
      )}
    </div>
  )
}

function NotesModal({ lead, onClose }) {
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [adding, setAdding] = useState(false)
  const { push: toast } = useToast()

  async function refreshHistory() {
    try {
      const h = await Lead.statusHistory(lead.id)
      setHistory(h)
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    refreshHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function addNote() {
    const value = draft.trim()
    if (!value) return
    try {
      setAdding(true)
      await Lead.addNote(lead.id, value)
      setDraft('')
      await refreshHistory()
      toast({ title: 'Note added' })
    } catch (err) {
      toast({ title: 'Could not add note', description: err.message, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
          {/* Header */}
          <div className="shrink-0 px-5 py-4 border-b border-white/5 flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-heading-primary font-semibold truncate">{lead.full_name}</div>
              <div className="text-xs text-heading-subdued mt-0.5">
                Lead created {formatTimeIn(lead.created_at)}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-3 p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Add a Note (pinned, doesn't scroll) */}
          <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/5">
            <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">Add a Note</label>
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Call notes, conversation summary, follow-up items…"
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={addNote} disabled={adding || !draft.trim()}>
                {adding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding…</> : 'Add Note'}
              </Button>
            </div>
          </div>

          {/* History label (pinned) */}
          <div className="shrink-0 px-5 pt-4 pb-2">
            <div className="text-xs uppercase tracking-[0.3em] text-heading-subdued">History</div>
          </div>

          {/* History list (scrolls) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
            {loadingHistory ? (
              <div className="text-sm text-heading-subdued">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-heading-subdued">No history yet.</div>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => {
                  const isStatusChange = !!h.to_status
                  return (
                    <li key={h.id} className="text-sm border-l-2 border-white/15 pl-3 py-1">
                      {isStatusChange ? (
                        <div className="flex flex-wrap items-center gap-1.5 font-medium text-heading-primary">
                          <span>Status changed:</span>
                          <span className="px-2 py-0.5 rounded border border-white/15 bg-white/5 text-xs">
                            {h.from_status ? STATUS_LABEL[h.from_status] : 'New'}
                          </span>
                          <span className="text-heading-subdued">→</span>
                          <span className="px-2 py-0.5 rounded border border-white/15 bg-white/10 text-xs">
                            {STATUS_LABEL[h.to_status]}
                          </span>
                        </div>
                      ) : (
                        <div className="text-heading-primary whitespace-pre-wrap">
                          {h.note}
                        </div>
                      )}
                      <div className="text-xs text-heading-subdued mt-1">
                        {isStatusChange ? '' : 'Note '}by {h.changed_by_name || 'Unknown user'} · {formatTimeIn(h.changed_at)}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3 border-t border-white/5 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
