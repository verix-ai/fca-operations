import React from 'react'
import { Search, Filter as FilterIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { HOME_CARE_COMPANY_OPTIONS, CODE_OPTIONS } from '@/lib/prospects-labels'
import { GroupLabel, StatusChips } from './FilterControls'

/**
 * The header strip above the Prospects table:
 *   - Desktop: search + three labeled groups (People & Program / Status / Dates).
 *   - Mobile:  search + a "Filters" button that opens MobileFiltersSheet.
 *
 * Props:
 *   filters: { search, marketer, county, cmCompany, homeCareCompany, code, dateFrom, dateTo, ...status }
 *   onChange: (next) => void
 *   marketers: string[]
 *   counties: string[]
 *   cmCompanies: { id, name }[]
 *   onOpenMobileFilters: () => void
 *   onClearAll: () => void
 *   activeFilterCount: number   – shown on the mobile button + gates the desktop "Clear all"
 */
const selectCls = 'w-full rounded-xl bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm'

export default function FiltersBar({
  filters, onChange,
  marketers, counties, cmCompanies,
  onOpenMobileFilters, onClearAll, activeFilterCount,
}) {
  const set = (k, v) => onChange({ ...filters, [k]: v })

  return (
    <div className="p-6 space-y-5">
      {/* Always visible: search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-heading-subdued w-4 h-4" />
          <Input
            value={filters.search || ''}
            onChange={e => set('search', e.target.value)}
            placeholder="Search prospects"
            className="pl-12 rounded-xl"
          />
        </div>
        {/* Mobile-only filters button */}
        <button
          type="button"
          onClick={onOpenMobileFilters}
          className="md:hidden inline-flex items-center gap-2 rounded-xl border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm text-heading-primary"
        >
          <FilterIcon className="h-4 w-4" /> Filters{activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-xs">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Desktop-only: grouped filters */}
      <div className="hidden md:block space-y-5">
        {/* People & Program */}
        <div>
          <GroupLabel>People &amp; Program</GroupLabel>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <select className={selectCls}
              value={filters.marketer || ''} onChange={e => set('marketer', e.target.value)}>
              <option value="">All marketers</option>
              {marketers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className={selectCls}
              value={filters.county || ''} onChange={e => set('county', e.target.value)}>
              <option value="">All counties</option>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={selectCls}
              value={filters.cmCompany || ''} onChange={e => set('cmCompany', e.target.value)}>
              <option value="">All CM companies</option>
              {cmCompanies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select className={selectCls}
              value={filters.homeCareCompany || ''} onChange={e => set('homeCareCompany', e.target.value)}>
              <option value="">All home care companies</option>
              {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectCls}
              value={filters.code || ''} onChange={e => set('code', e.target.value)}>
              <option value="">All codes</option>
              {CODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Workflow status */}
        <div>
          <GroupLabel>Status</GroupLabel>
          <StatusChips filters={filters} set={set} />
        </div>

        {/* Date submitted */}
        <div>
          <GroupLabel>Date Submitted</GroupLabel>
          <div className="flex items-center gap-2">
            <div className="w-44"><Input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} className="rounded-xl" /></div>
            <span className="text-sm text-heading-subdued">to</span>
            <div className="w-44"><Input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)} className="rounded-xl" /></div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={onClearAll}
                className="ml-auto text-sm text-heading-subdued hover:text-heading-primary underline whitespace-nowrap">
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
