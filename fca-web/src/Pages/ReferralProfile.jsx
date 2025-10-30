import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Referral from '@/entities/Referral'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { createPageUrl, formatDateInTimezone } from '@/utils'
import SettingsStore from '@/entities/Settings'

export default function ReferralProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [form, setForm] = React.useState(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [confirmText, setConfirmText] = React.useState('')
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [countyOptions, setCountyOptions] = React.useState([])

  React.useEffect(() => {
    (async () => {
      const data = await Referral.get(id)
      if (!data) {
        setNotFound(true)
      } else {
        setForm({ ...data })
      }
      setLoading(false)
    })()
  }, [id])

  // Load configured counties from Settings and flatten into label/value pairs
  React.useEffect(() => {
    (async () => {
      try {
        const all = await SettingsStore.get()
        const regions = all?.regions || {}
        const opts = []
        for (const code of Object.keys(regions)) {
          const list = Array.isArray(regions[code]) ? regions[code] : []
          for (const county of list) {
            opts.push({ value: county, label: `${county}, ${code}` })
          }
        }
        // Deduplicate by value, keep first label
        const uniqueMap = new Map()
        for (const o of opts) if (!uniqueMap.has(o.value)) uniqueMap.set(o.value, o.label)
        setCountyOptions(Array.from(uniqueMap, ([value, label]) => ({ value, label })))
      } catch {}
    })()
  }, [])

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const toggleService = (k, v) => setForm(prev => ({ ...prev, services_needed: { ...(prev?.services_needed || {}), [k]: v } }))
  const toggleFlag = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const serviceRows = ['Ambulating/Transferring','Bathing','Dressing','Feeding','Hygiene/Grooming','Basic Housekeeping','Errand Assistance','Emergency Response/Alert System or Device','Do you require supplies to accommodate your individual needs?']

  if (loading) return <div className="p-6">Loading...</div>
  if (notFound) return (
    <div className="p-6 space-y-6">
      <div className="text-heading-primary">Referral not found</div>
      <Button variant="outline" onClick={() => navigate(createPageUrl('Prospects'))}>Back to Prospects</Button>
    </div>
  )

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Referral"
        title="Referral Profile"
        description="View and edit the captured details for this referral."
      />

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          await Referral.update(id, { ...form })
          navigate(createPageUrl('Prospects'))
        }}
        className="space-y-8"
      >
        <Card className="bg-[rgba(9,16,33,0.78)] border rounded-2xl surface-main">
          <CardHeader className="p-6"><CardTitle className="text-heading-primary">Basics</CardTitle></CardHeader>
          <CardContent className="p-6 grid md:grid-cols-2 gap-6">
            <div>
              <Label className="text-heading-subdued font-medium">Referral Name</Label>
              <Input value={form.referral_name || ''} onChange={(e)=>setField('referral_name', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Caregiver Name</Label>
              <Input value={form.caregiver_name || ''} onChange={(e)=>setField('caregiver_name', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Caregiver Relationship</Label>
              <Input value={form.caregiver_relationship || ''} onChange={(e)=>setField('caregiver_relationship', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Marketer</Label>
              <Input value={form.marketer_name || form.marketer_email || ''} disabled className="rounded-xl py-3 opacity-70" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Sex</Label>
              <Input value={form.sex || ''} onChange={(e)=>setField('sex', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Referral DOB</Label>
              <Input type="date" value={form.referral_dob || ''} onChange={(e)=>setField('referral_dob', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">GA Medicaid or SS#</Label>
              <Input value={form.medicaid_or_ssn || ''} onChange={(e)=>setField('medicaid_or_ssn', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Requested Program</Label>
              <Input value={form.requested_program || ''} onChange={(e)=>setField('requested_program', e.target.value)} className="rounded-xl py-3" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[rgba(9,16,33,0.78)] border rounded-2xl surface-main">
          <CardHeader className="p-6"><CardTitle className="text-heading-primary">Contacts</CardTitle></CardHeader>
          <CardContent className="p-6 grid md:grid-cols-2 gap-6">
            <div>
              <Label className="text-heading-subdued font-medium">Phone</Label>
              <Input value={form.phone || ''} onChange={(e)=>setField('phone', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Caregiver Phone</Label>
              <Input value={form.caregiver_phone || ''} onChange={(e)=>setField('caregiver_phone', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-heading-subdued font-medium">Physician</Label>
              <Input value={form.physician || ''} onChange={(e)=>setField('physician', e.target.value)} className="rounded-xl py-3" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[rgba(9,16,33,0.78)] border rounded-2xl surface-main">
          <CardHeader className="p-6"><CardTitle className="text-heading-primary">Address</CardTitle></CardHeader>
          <CardContent className="p-6 grid md:grid-cols-2 gap-6">
            <div>
              <Label className="text-heading-subdued font-medium">Street Address</Label>
              <Input value={form.address_line1 || ''} onChange={(e)=>setField('address_line1', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Apt, Suite, etc.</Label>
              <Input value={form.address_line2 || ''} onChange={(e)=>setField('address_line2', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">City</Label>
              <Input value={form.city || ''} onChange={(e)=>setField('city', e.target.value)} className="rounded-xl py-3" />
            </div>
            
            <div>
              <Label className="text-heading-subdued font-medium">ZIP</Label>
              <Input value={form.zip || ''} onChange={(e)=>setField('zip', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">County & State</Label>
              {countyOptions.length > 0 ? (
                <>
                  <Select value={(form.county || '').replace(/,\s*[A-Z]{2}$/,'')} onValueChange={(v)=>setField('county', v)}>
                    <SelectTrigger className="rounded-xl py-3">
                      <SelectValue placeholder="Select county & state" />
                    </SelectTrigger>
                    <SelectContent>
                      {countyOptions.map(opt => (
                        <SelectItem key={opt.label} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <Input value={form.county || ''} onChange={(e)=>setField('county', e.target.value)} placeholder="e.g., Bibb, GA" className="rounded-xl py-3" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[rgba(9,16,33,0.78)] border rounded-2xl surface-main">
          <CardHeader className="p-6"><CardTitle className="text-heading-primary">Medical & Services</CardTitle></CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <Label className="text-heading-subdued font-medium">Diagnosis</Label>
              <Input value={form.diagnosis || ''} onChange={(e)=>setField('diagnosis', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {serviceRows.map(row => (
                <label key={row} className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(form?.services_needed?.[row])} onChange={(e)=>toggleService(row, e.target.checked)} />
                  <span>{row}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[rgba(9,16,33,0.78)] border rounded-2xl surface-main">
          <CardHeader className="p-6"><CardTitle className="text-heading-primary">Pre-Onboarding (Optional)</CardTitle></CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="text-heading-subdued text-sm">You can start these while intake is pending approval.</div>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.viventium_onboarding_completed)} onChange={(e) => toggleFlag('viventium_onboarding_completed', e.target.checked)} />
                <span>Viventium Onboarding Complete?</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.caregiver_fingerprinted)} onChange={(e) => toggleFlag('caregiver_fingerprinted', e.target.checked)} />
                <span>Caregiver has been Finger Printed?</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.background_results_uploaded)} onChange={(e) => toggleFlag('background_results_uploaded', e.target.checked)} />
                <span>Background Results Received & Uploaded?</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.drivers_license_submitted)} onChange={(e) => toggleFlag('drivers_license_submitted', e.target.checked)} />
                <span>Drivers License Submitted?</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.ssn_or_birth_certificate_submitted)} onChange={(e) => toggleFlag('ssn_or_birth_certificate_submitted', e.target.checked)} />
                <span>Social Security and/or Birth Certificate Submitted?</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.tb_test_completed)} onChange={(e) => toggleFlag('tb_test_completed', e.target.checked)} />
                <span>Completed TB Test?</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.cpr_first_aid_completed)} onChange={(e) => toggleFlag('cpr_first_aid_completed', e.target.checked)} />
                <span>Completed CPR/First Aid?</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(form?.pca_cert_including_2_of_3)} onChange={(e) => toggleFlag('pca_cert_including_2_of_3', e.target.checked)} />
                <span>PCA Cert incl 2/3</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[rgba(9,16,33,0.78)] border rounded-2xl surface-main">
          <CardHeader className="p-6"><CardTitle className="text-heading-primary">Notes</CardTitle></CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <Label className="text-heading-subdued font-medium">How did you hear about us?</Label>
              <Input value={form.heard_about_us || ''} onChange={(e)=>setField('heard_about_us', e.target.value)} className="rounded-xl py-3" />
            </div>
            <div>
              <Label className="text-heading-subdued font-medium">Additional Info</Label>
              <Textarea value={form.additional_info || ''} onChange={(e)=>setField('additional_info', e.target.value)} className="rounded-xl h-28" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-heading-subdued text-xs sm:text-sm order-2 sm:order-1">Submitted {formatDateInTimezone(form.created_at)}</div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3 order-1 sm:order-2 w-full">
            <Button
              type="button"
              variant="outline"
              borderRadius="1rem"
              background="rgba(239,68,68,0.1)"
              textColor="rgb(239,68,68)"
              style={{ borderColor: 'rgba(239,68,68,0.4)' }}
              className="px-4 py-2 sm:py-0 hover:bg-red-500/15 w-full sm:w-auto"
              onClick={() => { setConfirmText(''); setConfirmOpen(true) }}
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              borderRadius="1rem"
              className="px-4 py-2 sm:py-0 w-full sm:w-auto"
              onClick={() => navigate(createPageUrl('Prospects'))}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              borderRadius="1rem"
              className="px-4 py-2 sm:py-0 w-full sm:w-auto"
              onClick={() => navigate(`${createPageUrl('ClientIntake')}?ref=${id}`)}
              title="Start intake from this referral"
            >
              Start Intake
            </Button>
            <Button type="submit" borderRadius="1rem" className="px-4 py-2 sm:py-0 w-full sm:w-auto">Save Changes</Button>
          </div>
        </div>
      </form>
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setConfirmOpen(false)} />
          <div className="relative bg-[rgba(7,12,21,0.95)] border border-[rgba(147,165,197,0.2)] rounded-3xl w-full max-w-md mx-4 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-lg font-semibold text-heading-primary">Delete Prospect</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-heading-subdued text-sm">
                This action cannot be undone. To confirm, type <span className="font-semibold">DELETE</span> below.
              </p>
              <p className="text-heading-primary text-sm">
                Prospect: <span className="font-semibold">{form?.referral_name}</span>
              </p>
              <input
                className="w-full rounded-2xl bg-[rgba(9,16,33,0.82)] border border-[rgba(147,165,197,0.25)] text-heading-primary placeholder-neutral-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                autoFocus
                disabled={isDeleting}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="inline-flex items-center justify-center rounded-2xl border border-[rgba(147,165,197,0.25)] px-4 py-2 text-neutral-800 hover:border-brand/35 hover:bg-brand/10 transition-all"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-heading-primary bg-red-500/90 border-red-500 hover:brightness-90 disabled:opacity-50"
                  disabled={confirmText !== 'DELETE' || isDeleting}
                  onClick={async () => {
                    if (confirmText !== 'DELETE') return
                    setIsDeleting(true)
                    try {
                      await Referral.remove(id)
                      setIsDeleting(false)
                      navigate(createPageUrl('Prospects'))
                    } catch (e) {
                      setIsDeleting(false)
                      setConfirmOpen(false)
                    }
                  }}
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


