import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Loader2, Link2, AlertCircle, Check } from 'lucide-react'
import SlugInput from './SlugInput.jsx'
import QrCodePreview from './QrCodePreview.jsx'
import { Marketer } from '@/entities/Marketer.supabase'
import { slugify } from '@/lib/slug'

export default function ReferralLinkSection({ user }) {
  const [marketer, setMarketer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState('')
  const [valid, setValid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Stable callbacks so SlugInput's effect deps don't thrash
  const handleSlugChange = useCallback((next) => setSlug(next), [])
  const handleValidityChange = useCallback((v) => setValid(v), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await Marketer.getMine()
        if (cancelled) return
        if (!m) {
          setError('No marketer record linked to your account. Ask an admin to link one.')
          setLoading(false)
          return
        }
        setMarketer(m)
        // If no slug yet, auto-suggest from first name
        if (!m.referral_slug) {
          setSlug(slugify((m.name || user?.name || '').split(' ')[0]))
        } else {
          setSlug(m.referral_slug)
        }
        setLoading(false)
      } catch (err) {
        if (!cancelled) { setError(err.message || 'Failed to load'); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const handleSave = async () => {
    if (!marketer || !valid || saving) return
    setSaving(true); setError(null); setSuccess(null)
    try {
      const updated = await Marketer.updateSlug(marketer.id, slug)
      setMarketer(updated)
      setSuccess('Saved!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" /> Referral Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
          </div>
        ) : (
          <>
            <SlugInput
              marketerId={marketer.id}
              currentSlug={marketer.referral_slug || ''}
              onChange={handleSlugChange}
              onValidityChange={handleValidityChange}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={!valid || saving || slug === marketer.referral_slug}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
              {success && <span className="text-sm text-emerald-700 inline-flex items-center"><Check className="w-4 h-4 mr-1" /> {success}</span>}
            </div>
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">QR Code</h4>
              <QrCodePreview slug={marketer.referral_slug} />
              {slug && slug !== marketer.referral_slug && (
                <p className="text-xs text-slate-500 mt-2">
                  Save your changes to update the QR code.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
