import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Phone } from 'lucide-react'

/**
 * Renders the CM Company dropdown plus, when set, the primary contact phone
 * underneath as a tappable tel: link. Falls back to read-only text if `disabled`.
 *
 * Props:
 *   value: string                         – currently selected CM company name
 *   companies: { id, name }[]             – options pulled by parent
 *   onChange: (newName: string) => void   – called when the user picks a new company
 *   disabled?: boolean                    – render read-only (archive tab)
 */
export default function CmCompanyCell({ value, companies, onChange, disabled }) {
  const [phone, setPhone] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadPhone() {
      if (!value) { setPhone(null); return }
      const company = companies.find(c => c.name === value)
      if (!company) { setPhone(null); return }
      const { data, error } = await supabase
        .from('cm_company_contacts')
        .select('phone')
        .eq('cm_company_id', company.id)
        .order('created_at', { ascending: true })
        .limit(1)
      if (cancelled) return
      if (error || !data || !data.length) { setPhone(null); return }
      setPhone(data[0].phone || null)
    }
    loadPhone()
    return () => { cancelled = true }
  }, [value, companies])

  if (disabled) {
    return (
      <div>
        <div className="text-heading-primary/80">{value || '-'}</div>
        {phone && (
          <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-heading-subdued hover:text-heading-primary">
            <Phone className="h-3 w-3" /> {phone}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-[10rem]">
      <select
        className="w-full rounded-lg bg-transparent border border-[rgba(147,165,197,0.25)] px-2 py-1"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Select --</option>
        {companies.map(c => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
      {phone && (
        <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-heading-subdued hover:text-heading-primary">
          <Phone className="h-3 w-3" /> {phone}
        </a>
      )}
    </div>
  )
}
