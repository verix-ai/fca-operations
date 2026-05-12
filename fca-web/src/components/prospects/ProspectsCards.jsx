import React from 'react'
import { Button } from '@/components/ui/button'
import CmCompanyCell from './CmCompanyCell'
import { CODE_OPTIONS, HOME_CARE_COMPANY_OPTIONS } from '@/lib/prospects-labels'
import { formatDateInTimezone } from '@/utils'

export default function ProspectsCards({
  rows, companies, view, userRole,
  onInlineEdit, onOpenProfile, onOpenActivity, onArchive, onUnarchive, onStartIntake,
}) {
  const archived = view === 'archived'

  if (rows.length === 0) {
    return <div className="lg:hidden text-center text-heading-subdued py-10 px-4">No prospects found</div>
  }

  return (
    <div className="lg:hidden divide-y divide-white/5">
      {rows.map(r => (
        <div key={r.id} className={`p-4 space-y-3 ${r.referral_sent ? 'bg-emerald-500/[0.08]' : ''}`}>
          <div className="text-heading-primary font-medium truncate">{r.referral_name}</div>
          <div className="text-sm text-heading-subdued">Caregiver: {r.caregiver_name}</div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><div className="text-heading-subdued text-xs">Phone</div><div className="text-heading-primary">{r.phone || '-'}</div></div>
            <div><div className="text-heading-subdued text-xs">County</div><div className="text-heading-primary">{r.county || '-'}</div></div>
            <div><div className="text-heading-subdued text-xs">Program</div><div className="text-heading-primary">{r.requested_program || '-'}</div></div>
            <div><div className="text-heading-subdued text-xs">Submitted</div><div className="text-heading-primary">{formatDateInTimezone(r.created_at)}</div></div>
          </div>

          {/* Code */}
          <div>
            <div className="text-heading-subdued text-xs mb-1">Code</div>
            {archived ? (
              <div className="text-heading-primary">{r.code || '-'}</div>
            ) : (
              <select className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
                value={r.code || ''} onChange={e => onInlineEdit(r.id, 'code', e.target.value || null)}>
                <option value="">-- Select --</option>
                {CODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          {/* Home Care Company */}
          <div>
            <div className="text-heading-subdued text-xs mb-1">Home Care Company</div>
            {archived ? (
              <div className="text-heading-primary">{r.home_care_company || 'FCA'}</div>
            ) : (
              <select className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
                value={r.home_care_company || 'FCA'} onChange={e => onInlineEdit(r.id, 'home_care_company', e.target.value)}>
                {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>

          {/* CM Company + phone */}
          <div>
            <div className="text-heading-subdued text-xs mb-1">Case Management Company</div>
            <CmCompanyCell
              value={r.cm_company}
              companies={companies}
              disabled={archived}
              onChange={v => onInlineEdit(r.id, 'cm_company', v || null)}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {!archived && userRole !== 'marketer' && (
              <Button variant="outline" borderRadius="1rem" className="flex-1 text-xs"
                onClick={() => onStartIntake(r.id)}>Start Intake</Button>
            )}
            <Button variant="secondary" borderRadius="1rem" className="flex-1 text-xs"
              onClick={() => onOpenProfile(r.id)}>Open Profile</Button>
            <Button variant="secondary" borderRadius="1rem" className="flex-1 text-xs"
              onClick={() => onOpenActivity(r)}>Activity</Button>
            {archived ? (
              <Button variant="outline" borderRadius="1rem" className="flex-1 text-xs"
                onClick={() => onUnarchive(r)}>Unarchive</Button>
            ) : (
              <Button variant="outline" borderRadius="1rem" className="flex-1 text-xs"
                onClick={() => onArchive(r)}>Archive</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
