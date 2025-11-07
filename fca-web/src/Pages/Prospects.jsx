import React, { useEffect, useMemo, useState } from 'react'
import Referral from '@/entities/Referral.supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { createPageUrl, formatDateInTimezone } from '@/utils'
import CmCompany from '@/entities/CmCompany.supabase'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useAuth } from '@/auth/AuthProvider.jsx'

export default function Prospects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [referrals, setReferrals] = useState([])
  const [search, setSearch] = useState('')
  const [companies, setCompanies] = useState([])
  const [marketerFilter, setMarketerFilter] = useState('')
  const [countyFilter, setCountyFilter] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const list = await Referral.list()
        console.log('📋 All referrals loaded:', list)
        console.log('👤 Current user:', user)
        // Log marketer info for debugging
        list.forEach(r => {
          console.log(`📝 Referral ${r.id}:`)
          console.log('  - marketer_id:', r.marketer_id)
          console.log('  - marketer_name:', r.marketer_name)
          console.log('  - marketer_email:', r.marketer_email)
          console.log('  - notes (raw):', r.notes)
          console.log('  - Full referral object:', r)
        })
        setReferrals(list)
      } catch {}
      try {
        const list = await CmCompany.list()
        setCompanies(list)
      } catch {}
    })()
  }, [user])

  const marketerOptions = useMemo(() => {
    const seen = new Set()
    const list = []
    referrals.forEach(r => {
      const key = (r.marketer_name || r.marketer_email || '').trim()
      if (!key) return
      if (seen.has(key)) return
      seen.add(key)
      list.push(key)
    })
    return list.sort((a, b) => a.localeCompare(b))
  }, [referrals])

  const countyOptions = useMemo(() => {
    const seen = new Set()
    const list = []
    referrals.forEach(r => {
      const key = (r.county || '').trim()
      if (!key) return
      if (seen.has(key)) return
      seen.add(key)
      list.push(key)
    })
    return list.sort((a, b) => a.localeCompare(b))
  }, [referrals])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = referrals
    
    // Filter for marketers: show only their own referrals
    if (user?.role === 'marketer') {
      // First try to get marketer record ID
      list = list.filter(r => {
        // Check by marketer_id (if marketer record exists)
        if (r.marketer_id && user.id) {
          // We need to check if this marketer_id belongs to this user
          // For now, also check by name/email as backup
          const matchesName = (r.marketer_name || '').trim() === (user?.name || '').trim()
          const matchesEmail = (r.marketer_email || '').trim() === (user?.email || '').trim()
          return matchesName || matchesEmail
        }
        // Fallback: check by name or email
        const matchesName = (r.marketer_name || '').trim() === (user?.name || '').trim()
        const matchesEmail = (r.marketer_email || '').trim() === (user?.email || '').trim()
        return matchesName || matchesEmail
      })
    }
    
    if (marketerFilter) {
      const mf = marketerFilter.trim()
      list = list.filter(r => (r.marketer_name || r.marketer_email || '').trim() === mf)
    }
    if (countyFilter) {
      const cf = countyFilter.trim().toLowerCase()
      list = list.filter(r => String(r.county || '').toLowerCase() === cf)
    }
    if (!q) return list
    return list.filter(r =>
      [r.referral_name, r.caregiver_name, r.phone, r.address, r.county]
        .map(v => String(v || '').toLowerCase())
        .some(v => v.includes(q))
    )
  }, [referrals, user, search, marketerFilter, countyFilter])
  

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Referrals"
        title="Prospects"
        description="View the prospects you have referred and their captured details."
      />

      <Card className="border rounded-2xl surface-main">
        <CardHeader className="p-6 border-b border-white/5">
          <CardTitle className="text-heading-primary">Search</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-heading-subdued w-4 h-4" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prospects" className="pl-12 rounded-xl" />
            </div>
            <div>
              <Select value={marketerFilter} onValueChange={setMarketerFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Filter by marketer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All marketers</SelectItem>
                  {marketerOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={countyFilter} onValueChange={setCountyFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Filter by county" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All counties</SelectItem>
                  {countyOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border rounded-2xl surface-main">
        <CardHeader className="p-6 border-b border-white/5">
          <CardTitle className="text-heading-primary">Your Prospects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/5">
                  <TableHead className="text-heading-subdued p-4">Referral Name</TableHead>
                  <TableHead className="text-heading-subdued p-4">Caregiver</TableHead>
                  <TableHead className="text-heading-subdued p-4">Phone</TableHead>
                  <TableHead className="text-heading-subdued p-4">County</TableHead>
                  <TableHead className="text-heading-subdued p-4">Program</TableHead>
                  <TableHead className="text-heading-subdued p-4">Case Management Company</TableHead>
                  <TableHead className="text-heading-subdued p-4">Submitted</TableHead>
                  <TableHead className="text-heading-subdued p-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-heading-subdued py-10">No prospects found</TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id} className="border-b border-white/5">
                    <TableCell className="p-4 text-heading-primary">{r.referral_name}</TableCell>
                    <TableCell className="p-4 text-heading-primary/80">{r.caregiver_name}</TableCell>
                    <TableCell className="p-4 text-heading-primary/80">{r.phone}</TableCell>
                    <TableCell className="p-4 text-heading-primary/80">{r.county}</TableCell>
                    <TableCell className="p-4 text-heading-primary/80">{r.requested_program}</TableCell>
                    <TableCell className="p-4 text-heading-primary/80">
                      {user?.role !== 'marketer' ? (
                        <select
                          className="rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-2 py-1"
                          value={r.cm_company || ''}
                          onChange={async (e) => {
                            const value = e.target.value
                            const updated = { ...r, cm_company: value }
                            setReferrals(prev => prev.map(x => x.id === r.id ? updated : x))
                            try { await Referral.update(r.id, { cm_company: value }) } catch {}
                          }}
                        >
                          <option value="">-- Select --</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-heading-primary/70">{r.cm_company || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="p-4 text-heading-primary/60">
                      <span>{formatDateInTimezone(r.created_at)}</span>
                    </TableCell>
                    <TableCell className="p-4 text-heading-primary/60">
                      <div className="flex items-center gap-2">
                        {user?.role !== 'marketer' && (
                          <Button
                            variant="outline"
                            borderRadius="1rem"
                            className="px-3 py-1 text-xs whitespace-nowrap"
                            onClick={() => navigate(`${createPageUrl('ClientIntake')}?ref=${r.id}`)}
                            title="Start intake from this referral"
                          >
                            Start Intake
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          borderRadius="1rem"
                          className="px-3 py-1 text-xs whitespace-nowrap"
                          onClick={() => navigate(`/prospects/${r.id}`)}
                          title="Open referral profile"
                        >
                          Open Profile
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            {rows.length === 0 ? (
              <div className="text-center text-heading-subdued py-10 px-4">No prospects found</div>
            ) : (
              <div className="divide-y divide-white/5">
                {rows.map(r => (
                  <div key={r.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-heading-primary font-medium truncate">{r.referral_name}</div>
                        <div className="text-sm text-heading-subdued">Caregiver: {r.caregiver_name}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-heading-subdued text-xs">Phone</div>
                        <div className="text-heading-primary">{r.phone || '-'}</div>
                      </div>
                      <div>
                        <div className="text-heading-subdued text-xs">County</div>
                        <div className="text-heading-primary">{r.county || '-'}</div>
                      </div>
                      <div>
                        <div className="text-heading-subdued text-xs">Program</div>
                        <div className="text-heading-primary">{r.requested_program || '-'}</div>
                      </div>
                      <div>
                        <div className="text-heading-subdued text-xs">Submitted</div>
                        <div className="text-heading-primary">{formatDateInTimezone(r.created_at)}</div>
                      </div>
                    </div>

                    {user?.role !== 'marketer' && (
                      <div>
                        <div className="text-heading-subdued text-xs mb-1">Case Management Company</div>
                        <select
                          className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
                          value={r.cm_company || ''}
                          onChange={async (e) => {
                            const value = e.target.value
                            const updated = { ...r, cm_company: value }
                            setReferrals(prev => prev.map(x => x.id === r.id ? updated : x))
                            try { await Referral.update(r.id, { cm_company: value }) } catch {}
                          }}
                        >
                          <option value="">-- Select --</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {user?.role !== 'marketer' && (
                        <Button
                          variant="outline"
                          borderRadius="1rem"
                          className="flex-1 text-xs"
                          onClick={() => navigate(`${createPageUrl('ClientIntake')}?ref=${r.id}`)}
                        >
                          Start Intake
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        borderRadius="1rem"
                        className="flex-1 text-xs"
                        onClick={() => navigate(`/prospects/${r.id}`)}
                      >
                        Open Profile
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


