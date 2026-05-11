import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Referral from '@/entities/Referral.supabase'
import CmCompany from '@/entities/CmCompany.supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNavigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useAuth } from '@/auth/AuthProvider.jsx'
import { useToast } from '@/components/ui/toast'

import FiltersBar from '@/components/prospects/FiltersBar'
import MobileFiltersSheet from '@/components/prospects/MobileFiltersSheet'
import ProspectsTable from '@/components/prospects/ProspectsTable'
import ProspectsCards from '@/components/prospects/ProspectsCards'
import ActivityModal from '@/components/prospects/ActivityModal'
import ArchiveModal from '@/components/prospects/ArchiveModal'

const EMPTY_FILTERS = {
  search: '', marketer: '', county: '',
  cmCompany: '', homeCareCompany: '',
  dateFrom: '', dateTo: '',
}

export default function Prospects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { push: toast } = useToast()

  const [view, setView] = useState('active')                 // 'active' | 'archived'
  const [referrals, setReferrals] = useState([])
  const [companies, setCompanies] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [activityRow, setActivityRow] = useState(null)
  const [archiveRow, setArchiveRow] = useState(null)
  const [unarchiveRow, setUnarchiveRow] = useState(null)

  const refreshList = useCallback(async () => {
    try {
      const list = await Referral.list({
        view,
        cmCompany: filters.cmCompany || undefined,
        homeCareCompany: filters.homeCareCompany || undefined,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : undefined,
        dateTo: filters.dateTo || undefined,
      })
      setReferrals(list)
    } catch (err) {
      toast({ title: 'Could not load prospects', description: err.message, variant: 'destructive' })
      setReferrals([])
    }
  }, [view, filters.cmCompany, filters.homeCareCompany, filters.dateFrom, filters.dateTo, toast])

  useEffect(() => {
    (async () => {
      try { setCompanies(await CmCompany.list()) } catch {}
    })()
  }, [])

  useEffect(() => { refreshList() }, [refreshList])

  // Derived options for the filter dropdowns
  const marketerOptions = useMemo(() => {
    const seen = new Set()
    referrals.forEach(r => {
      const k = (r.marketer_name || r.marketer_email || '').trim()
      if (k) seen.add(k)
    })
    return [...seen].sort((a,b) => a.localeCompare(b))
  }, [referrals])

  const countyOptions = useMemo(() => {
    const seen = new Set()
    referrals.forEach(r => { if (r.county) seen.add(r.county) })
    return [...seen].sort((a,b) => a.localeCompare(b))
  }, [referrals])

  // Client-side filters: search + county + marketer (county and marketer live in or
  // alongside the JSON blob and aren't indexed; marketer was removed from server-side
  // filtering to avoid PostgREST .or() injection on names containing commas).
  const rows = useMemo(() => {
    let list = referrals

    if (user?.role === 'marketer') {
      list = list.filter(r =>
        (r.marketer_name || '').trim() === (user.name || '').trim() ||
        (r.marketer_email || '').trim() === (user.email || '').trim()
      )
    }
    if (filters.marketer) {
      const mf = filters.marketer.trim()
      list = list.filter(r =>
        (r.marketer_name || '').trim() === mf ||
        (r.marketer_email || '').trim() === mf
      )
    }
    if (filters.county) {
      list = list.filter(r => String(r.county || '').toLowerCase() === filters.county.toLowerCase())
    }
    const q = (filters.search || '').trim().toLowerCase()
    if (q) {
      list = list.filter(r =>
        [r.referral_name, r.caregiver_name, r.phone, r.address, r.county]
          .map(v => String(v || '').toLowerCase())
          .some(v => v.includes(q))
      )
    }
    return list
  }, [referrals, user, filters.search, filters.county, filters.marketer])

  const activeFilterCount = useMemo(() => {
    const keys = ['marketer','county','cmCompany','homeCareCompany','dateFrom','dateTo']
    return keys.filter(k => !!filters[k]).length
  }, [filters])

  async function handleInlineEdit(id, field, value) {
    const prev = referrals.find(r => r.id === id)
    setReferrals(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
    try {
      const updated = await Referral.update(id, { [field]: value })
      setReferrals(rs => rs.map(r => r.id === id ? { ...r, ...updated } : r))
    } catch (err) {
      setReferrals(rs => rs.map(r => r.id === id ? prev : r))
      toast({ title: 'Could not save change', description: err.message, variant: 'destructive' })
    }
  }

  async function handleArchiveConfirm({ reason, note }) {
    if (!archiveRow) return
    try {
      await Referral.archive(archiveRow.id, { reason, note })
      toast({ title: 'Prospect archived' })
      setArchiveRow(null)
      refreshList()
    } catch (err) {
      toast({ title: 'Could not archive', description: err.message, variant: 'destructive' })
    }
  }

  async function handleUnarchive() {
    if (!unarchiveRow) return
    try {
      await Referral.unarchive(unarchiveRow.id)
      toast({ title: 'Prospect restored' })
      setUnarchiveRow(null)
      refreshList()
    } catch (err) {
      toast({ title: 'Could not unarchive', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Referrals"
        title="Prospects"
        description="View and work the prospects you have referred."
      />

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archive</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border rounded-2xl surface-main">
        <CardHeader className="p-6 border-b border-white/5">
          <CardTitle className="text-heading-primary">Search</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            marketers={marketerOptions}
            counties={countyOptions}
            cmCompanies={companies}
            onOpenMobileFilters={() => setMobileFiltersOpen(true)}
            activeFilterCount={activeFilterCount}
          />
        </CardContent>
      </Card>

      <Card className="border rounded-2xl surface-main">
        <CardHeader className="p-6 border-b border-white/5">
          <CardTitle className="text-heading-primary">{view === 'archived' ? 'Archived Prospects' : 'Your Prospects'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ProspectsTable
            rows={rows}
            companies={companies}
            view={view}
            userRole={user?.role}
            onInlineEdit={handleInlineEdit}
            onOpenProfile={(id) => navigate(`/prospects/${id}`)}
            onOpenActivity={(row) => setActivityRow(row)}
            onArchive={(row) => setArchiveRow(row)}
            onUnarchive={(row) => setUnarchiveRow(row)}
            onStartIntake={(id) => navigate(`${createPageUrl('ClientIntake')}?ref=${id}`)}
          />
          <ProspectsCards
            rows={rows}
            companies={companies}
            view={view}
            userRole={user?.role}
            onInlineEdit={handleInlineEdit}
            onOpenProfile={(id) => navigate(`/prospects/${id}`)}
            onOpenActivity={(row) => setActivityRow(row)}
            onArchive={(row) => setArchiveRow(row)}
            onUnarchive={(row) => setUnarchiveRow(row)}
            onStartIntake={(id) => navigate(`${createPageUrl('ClientIntake')}?ref=${id}`)}
          />
        </CardContent>
      </Card>

      {mobileFiltersOpen && (
        <MobileFiltersSheet
          filters={filters}
          onChange={setFilters}
          marketers={marketerOptions}
          counties={countyOptions}
          cmCompanies={companies}
          onClose={() => setMobileFiltersOpen(false)}
          onClearAll={() => setFilters(EMPTY_FILTERS)}
        />
      )}

      {activityRow && (
        <ActivityModal
          prospect={activityRow}
          readOnly={view === 'archived'}
          onChange={(updated) => {
            setActivityRow(updated)
            setReferrals(rs => rs.map(r => r.id === updated.id ? { ...r, ...updated } : r))
          }}
          onClose={() => setActivityRow(null)}
        />
      )}

      {archiveRow && (
        <ArchiveModal
          prospect={archiveRow}
          onClose={() => setArchiveRow(null)}
          onConfirm={handleArchiveConfirm}
        />
      )}

      {unarchiveRow && (
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUnarchiveRow(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card p-5">
              <div className="text-heading-primary font-semibold mb-2">Restore {unarchiveRow.referral_name}?</div>
              <div className="text-sm text-heading-subdued mb-4">This will move the prospect back to the Active tab.</div>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-2 text-sm rounded border border-[rgba(147,165,197,0.25)]" onClick={() => setUnarchiveRow(null)}>Cancel</button>
                <button className="px-3 py-2 text-sm rounded bg-white/10 hover:bg-white/15 text-heading-primary" onClick={handleUnarchive}>Unarchive</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
