import React, { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ARCHIVE_REASON_OPTIONS } from '@/lib/prospects-labels'

/**
 * Confirmation modal for archiving a prospect. The reason dropdown is required;
 * the note textarea is optional. Calls `onConfirm({ reason, note })` on submit.
 */
export default function ArchiveModal({ prospect, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleConfirm() {
    if (!reason || submitting) return
    try {
      setSubmitting(true)
      await onConfirm({ reason, note })
    } finally {
      setSubmitting(false)
    }
  }

  const name = prospect?.referral_name || 'this prospect'

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
          <div className="px-5 py-4 border-b border-white/5 flex items-start justify-between">
            <div className="text-heading-primary font-semibold">Archive {name}?</div>
            <button onClick={onClose} className="ml-3 p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">Reason <span className="text-red-400">*</span></label>
              <select
                className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">-- Select a reason --</option>
                {ARCHIVE_REASON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-heading-subdued mb-2">Additional note (optional)</label>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Passed to Genesis on 5/11."
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!reason || submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Archiving…</> : 'Archive'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
