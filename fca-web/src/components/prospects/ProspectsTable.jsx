import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import CmCompanyCell from './CmCompanyCell'
import { CODE_OPTIONS, HOME_CARE_COMPANY_OPTIONS } from '@/lib/prospects-labels'
import { formatDateInTimezone } from '@/utils'

/**
 * Desktop table view. Inline dropdowns on Code / Home Care Company / CM Company.
 * In the Archive view, dropdowns become read-only text.
 *
 * Props:
 *   rows                            – referrals to render
 *   companies                       – CM companies list
 *   view: 'active' | 'archived'
 *   userRole                        – used to hide "Start Intake" from marketers
 *   onInlineEdit(id, field, value)
 *   onOpenProfile(id)
 *   onOpenActivity(row)
 *   onArchive(row)
 *   onUnarchive(row)
 *   onStartIntake(id)
 */
export default function ProspectsTable({
  rows, companies, view, userRole,
  onInlineEdit, onOpenProfile, onOpenActivity, onArchive, onUnarchive, onStartIntake,
}) {
  const archived = view === 'archived'

  return (
    <div className="hidden lg:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-white/5">
            <TableHead className="text-heading-subdued p-4">Client Name</TableHead>
            <TableHead className="text-heading-subdued p-4">Caregiver</TableHead>
            <TableHead className="text-heading-subdued p-4">Phone</TableHead>
            <TableHead className="text-heading-subdued p-4">County</TableHead>
            <TableHead className="text-heading-subdued p-4">Program</TableHead>
            <TableHead className="text-heading-subdued p-4">Code</TableHead>
            <TableHead className="text-heading-subdued p-4">Home Care Company</TableHead>
            <TableHead className="text-heading-subdued p-4">Case Management Company</TableHead>
            <TableHead className="text-heading-subdued p-4">Submitted</TableHead>
            <TableHead className="text-heading-subdued p-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={10} className="text-center text-heading-subdued py-10">No prospects found</TableCell></TableRow>
          ) : rows.map(r => (
            <TableRow key={r.id} className={`border-b border-white/5 align-top ${r.referral_sent ? 'bg-emerald-500/[0.08]' : ''}`}>
              <TableCell className="p-4 text-heading-primary">{r.referral_name}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.caregiver_name}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.phone}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.county}</TableCell>
              <TableCell className="p-4 text-heading-primary/80">{r.requested_program}</TableCell>

              <TableCell className="p-4 text-heading-primary/80">
                {archived ? (
                  <span>{r.code || '-'}</span>
                ) : (
                  <select className="rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-2 py-1"
                    value={r.code || ''}
                    onChange={e => onInlineEdit(r.id, 'code', e.target.value || null)}>
                    <option value="">-- Select --</option>
                    {CODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </TableCell>

              <TableCell className="p-4 text-heading-primary/80">
                {archived ? (
                  <span>{r.home_care_company || 'FCA'}</span>
                ) : (
                  <select className="rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-2 py-1"
                    value={r.home_care_company || 'FCA'}
                    onChange={e => onInlineEdit(r.id, 'home_care_company', e.target.value)}>
                    {HOME_CARE_COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </TableCell>

              <TableCell className="p-4 text-heading-primary/80">
                <CmCompanyCell
                  value={r.cm_company}
                  companies={companies}
                  disabled={archived}
                  onChange={v => onInlineEdit(r.id, 'cm_company', v || null)}
                />
              </TableCell>

              <TableCell className="p-4 text-heading-primary/60"><span>{formatDateInTimezone(r.created_at)}</span></TableCell>

              <TableCell className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {!archived && userRole !== 'marketer' && (
                    <Button variant="outline" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                      onClick={() => onStartIntake(r.id)}>Start Intake</Button>
                  )}
                  <Button variant="secondary" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                    onClick={() => onOpenProfile(r.id)}>Open Profile</Button>
                  <Button variant="secondary" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                    onClick={() => onOpenActivity(r)}>Activity</Button>
                  {archived ? (
                    <Button variant="outline" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                      onClick={() => onUnarchive(r)}>Unarchive</Button>
                  ) : (
                    <Button variant="outline" borderRadius="1rem" className="px-3 py-1 text-xs whitespace-nowrap"
                      onClick={() => onArchive(r)}>Archive</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
