import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HOME_CARE_COMPANY_OPTIONS } from '@/lib/prospects-labels'

/** Bottom-sheet filter panel for mobile only. Shows the 5 non-search filters. */
export default function MobileFiltersSheet({ filters, onChange, marketers, counties, cmCompanies, onClose, onClearAll }) {
  const set = (k, v) => onChange({ ...filters, [k]: v })

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1000] md:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-hero-card border-t border-[rgba(147,165,197,0.25)] p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="text-heading-primary font-semibold">Filters</div>
          <button onClick={onClose} className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.marketer || ''} onChange={e => set('marketer', e.target.value)}>
            <option value="">All marketers</option>
            {marketers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.county || ''} onChange={e => set('county', e.target.value)}>
            <option value="">All counties</option>
            {counties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.cmCompany || ''} onChange={e => set('cmCompany', e.target.value)}>
            <option value="">All CM companies</option>
            {cmCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select className="w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
            value={filters.homeCareCompany || ''} onChange={e => set('homeCareCompany', e.target.value)}>
            <option value="">All home care companies</option>
            {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} className="rounded-xl" />
            <Input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)} className="rounded-xl" />
          </div>
        </div>

        <div className="mt-5 flex justify-between">
          <button onClick={onClearAll} className="text-sm text-heading-subdued hover:text-heading-primary underline">Clear all</button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
