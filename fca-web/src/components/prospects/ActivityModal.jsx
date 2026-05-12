import React, { useEffect, useState, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'
import Referral from '@/entities/Referral.supabase'
import ReferralHistory from '@/entities/ReferralHistory.supabase'
import {
  CM_CALL_STATUS_OPTIONS,
  fieldChangeLabel,
} from '@/lib/prospects-labels'
import { formatDateInTimezone } from '@/utils'

/**
 * The call-center workspace. Workflow controls update the prospect immediately
 * (and emit field_change history entries via Referral.update). Below them, an
 * append-only timeline of all events.
 *
 * Props:
 *   prospect            – the referral row
 *   readOnly?: boolean  – true in the Archive tab; disables all controls
 *   onChange: (updated) => void  – called when prospect fields change so the parent table can update
 *   onClose: () => void
 */
export default function ActivityModal({ prospect, readOnly, onChange, onClose }) {
  const { push: toast } = useToast()
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [local, setLocal] = useState(prospect)

  const refreshHistory = useCallback(async () => {
    try {
      const h = await ReferralHistory.list(prospect.id)
      setHistory(h)
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [prospect.id])

  useEffect(() => { refreshHistory() }, [refreshHistory])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function applyField(field, value) {
    if (readOnly) return
    const prev = local[field]
    setLocal({ ...local, [field]: value })
    try {
      const updated = await Referral.update(prospect.id, { [field]: value })
      setLocal(updated)
      onChange?.(updated)
      await refreshHistory()
    } catch (err) {
      setLocal({ ...local, [field]: prev })
      toast({ title: 'Could not save change', description: err.message, variant: 'destructive' })
    }
  }

  async function addNote() {
    const value = draft.trim()
    if (!value) return
    try {
      setAdding(true)
      await ReferralHistory.addNote(prospect.id, value)
      setDraft('')
      await refreshHistory()
      toast({ title: 'Note added' })
    } catch (err) {
      toast({ title: 'Could not add note', description: err.message, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  function describeEvent(h) {
    if (h.event_type === 'note') return h.note
    if (h.event_type === 'archive') return h.note     // already formatted by ReferralHistory.addArchiveEvent
    if (h.event_type === 'unarchive') return 'Unarchived'
    if (h.event_type === 'field_change') return fieldChangeLabel(h.field_name, h.old_value, h.new_value)
    return h.note || ''
  }

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-6">
        <div className="w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[85vh] flex flex-col rounded-none sm:rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">

          {/* Title bar */}
          <div className="shrink-0 px-5 py-4 border-b border-white/5 flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-heading-primary font-semibold truncate">{local.referral_name || 'Prospect'}</div>
              <div className="text-xs text-heading-subdued mt-0.5">Activity & call log</div>
            </div>
            <button onClick={onClose} className="ml-3 p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Workflow controls */}
          <div className="shrink-0 px-5 py-4 border-b border-white/5 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">
                Did you receive a call from the CM company?
              </label>
              <select
                className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm disabled:opacity-50"
                value={local.cm_call_status || ''}
                disabled={readOnly}
                onChange={(e) => applyField('cm_call_status', e.target.value || null)}
              >
                <option value="">-- Not set --</option>
                {CM_CALL_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 text-sm text-heading-primary">
              <Checkbox
                checked={!!local.assessment_complete}
                disabled={readOnly}
                onCheckedChange={(checked) => applyField('assessment_complete', !!checked)}
              />
              Have you had your assessment?
            </label>

            <label className="flex items-center gap-3 text-sm text-heading-primary">
              <Checkbox
                checked={!!local.waiting_state_approval}
                disabled={readOnly}
                onCheckedChange={(checked) => applyField('waiting_state_approval', !!checked)}
              />
              Waiting on State Approval
            </label>

            <label className="flex items-center gap-3 text-sm text-heading-primary">
              <Checkbox
                checked={!!local.referral_sent}
                disabled={readOnly}
                onCheckedChange={(checked) => applyField('referral_sent', !!checked)}
              />
              Referral sent
            </label>
          </div>

          {/* Add Note (pinned) */}
          {!readOnly && (
            <div className="shrink-0 px-5 py-4 border-b border-white/5">
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
          )}

          {/* Timeline */}
          <div className="shrink-0 px-5 pt-4 pb-2">
            <div className="text-xs uppercase tracking-[0.3em] text-heading-subdued">Timeline</div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
            {loadingHistory ? (
              <div className="text-sm text-heading-subdued">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-heading-subdued">No activity yet.</div>
            ) : (
              <ul className="space-y-2">
                {history.map(h => (
                  <li key={h.id} className="text-sm border-l-2 border-white/15 pl-3 py-1">
                    <div className="text-heading-primary whitespace-pre-wrap">{describeEvent(h)}</div>
                    <div className="text-xs text-heading-subdued mt-1">
                      {h.event_type === 'note' ? 'Note ' : ''}by {h.changed_by_name || 'Unknown user'} · {formatDateInTimezone(h.changed_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
