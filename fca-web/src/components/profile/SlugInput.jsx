// fca-web/src/components/profile/SlugInput.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Check, AlertCircle, Loader2 } from 'lucide-react'
import { isValidSlug, slugify, RESERVED_SLUGS } from '@/lib/slug'
import { User } from '@/entities/User.supabase'

const PUBLIC_BASE = 'friendlycareagency.org/ref/'

export default function SlugInput({ userId, currentSlug, onChange, onValidityChange }) {
  const [value, setValue] = useState(currentSlug || '')
  const [status, setStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [reason, setReason] = useState('')
  const debounceRef = useRef(null)

  const formatHint = useMemo(() => {
    if (!value) return ''
    if (value !== value.toLowerCase()) return 'Use lowercase only'
    if (value.length < 2) return 'At least 2 characters'
    if (value.length > 30) return 'Max 30 characters'
    if (/^-|-$/.test(value)) return 'Cannot start or end with a hyphen'
    if (!/^[a-z0-9-]+$/.test(value)) return 'Only letters, numbers, and hyphens'
    if (RESERVED_SLUGS.has(value)) return `"${value}" is reserved`
    return ''
  }, [value])

  useEffect(() => {
    onChange?.(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value) {
      setStatus('idle'); setReason(''); onValidityChange?.(false)
      return
    }
    if (!isValidSlug(value)) {
      setStatus('invalid'); setReason(formatHint); onValidityChange?.(false)
      return
    }
    if (value === currentSlug) {
      setStatus('available'); setReason('Current slug'); onValidityChange?.(true)
      return
    }

    setStatus('checking'); setReason('')
    debounceRef.current = setTimeout(async () => {
      try {
        const ok = await User.isSlugAvailable(value, userId)
        if (ok) {
          setStatus('available'); setReason('Available'); onValidityChange?.(true)
        } else {
          setStatus('taken'); setReason('Already taken'); onValidityChange?.(false)
        }
      } catch (err) {
        setStatus('invalid'); setReason('Could not check availability'); onValidityChange?.(false)
      }
    }, 350)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [value, currentSlug, userId, formatHint, onChange, onValidityChange])

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Your referral link</label>
      <div className="flex items-stretch rounded-lg overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-300">
        <span className="px-3 inline-flex items-center bg-slate-50 text-slate-500 text-sm select-none">
          {PUBLIC_BASE}
        </span>
        <Input
          value={value}
          onChange={(e) => setValue(slugify(e.target.value))}
          maxLength={30}
          placeholder="jane"
          className="flex-1 border-0 focus-visible:ring-0 rounded-none"
          aria-describedby="slug-status"
        />
        <span id="slug-status" className="px-3 inline-flex items-center text-sm w-28 justify-end">
          {status === 'checking' && <><Loader2 className="w-4 h-4 animate-spin mr-1" /> checking</>}
          {status === 'available' && <><Check className="w-4 h-4 text-emerald-600 mr-1" /> {reason || 'available'}</>}
          {(status === 'taken' || status === 'invalid') && (
            <><AlertCircle className="w-4 h-4 text-rose-600 mr-1" /> {reason || 'invalid'}</>
          )}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        2–30 lowercase letters, numbers, and hyphens. This is the link clients use to refer through you.
      </p>
    </div>
  )
}
