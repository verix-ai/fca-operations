import React, { useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider.jsx'
import Referral from '@/entities/Referral.supabase'
import Marketer from '@/entities/Marketer.supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Program from '@/entities/Program.supabase'
import SettingsStore from '@/entities/Settings.supabase'
import SectionHeader from '@/components/layout/SectionHeader.jsx'
import { useNavigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { CAREGIVER_RELATIONSHIPS } from '../constants/caregiver.js'

const INTAKE_BY = ['Ahmad','Quantez','Manda','Carlos','Emory','Melvin','Dwayne','Tevin','Kayla','Brittany','Carrie','Lorenzo','Jeffrey','Miya','Maurice','Reggie','Jimmy/Precious','Aubrey','Alexus/Shan','Dentay','Latina','Otis','Jeremiah','Josiah','Maddox','Jeanette','Lanita','Darius','Travis','Meg','Darius Rogers-Wilson','J Hall','Stacy','Diane Davis','Alexus','Brian','Mike','Sumo','Ms. Val','Adonis “AD” Thomas','Lovie','Valencia','Angel']
const SEX = ['Female','Male','Prefer not to say']
// Formatting helpers
function formatSSN(input) {
  const digits = String(input || '').replace(/\D/g, '').slice(0, 9)
  const part1 = digits.slice(0, 3)
  const part2 = digits.slice(3, 5)
  const part3 = digits.slice(5, 9)
  if (digits.length > 5) return `${part1}-${part2}-${part3}`
  if (digits.length > 3) return `${part1}-${part2}`
  return part1
}

function formatUSPhone(input) {
  const digits = String(input || '').replace(/\D/g, '').replace(/^1/, '').slice(0, 10)
  const area = digits.slice(0, 3)
  const mid = digits.slice(3, 6)
  const last = digits.slice(6, 10)
  if (digits.length > 6) return `(${area}) ${mid}-${last}`
  if (digits.length > 3) return `(${area}) ${mid}`
  if (digits.length > 0) return `(${area}`
  return ''
}

export default function MarketerIntake() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  React.useEffect(() => {
    (async () => {
      try { const list = await Program.list(); setPrograms(list.map(p => p.name)) } catch {}
    })()
  }, [])
  const [countyOptions, setCountyOptions] = useState([])
  const [form, setForm] = useState({
    // intake_by removed; we infer from logged-in user
    requested_program: '',
    sex: '',
    referral_name: '',
    caregiver_name: '',
    referral_dob: '',
    medicaid_or_ssn: '',
    phone: '',
    caregiver_phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'GA',
    zip: '',
    county: '',
    caregiver_lives_in_home: '',
    caregiver_relationship: '',
    physician: '',
    diagnosis: '',
    receives_benefits: '',
    benefits_pay_date: '',
    services_needed: {},
    heard_about_us: '',
    additional_info: '',
  })
  const [attempted, setAttempted] = useState(false)

  React.useEffect(() => {
    (async () => {
      try {
        const all = await SettingsStore.get()
        const regions = all?.regions || {}
        const stateCode = (String(form.state||'').trim() || 'GA')
        const current = regions[stateCode] || []
        setCountyOptions(Array.isArray(current) ? current : [])
      } catch {}
    })()
  }, [form.state])

  const requiredErrors = useMemo(()=>{
    const e = {}
    if (!form.requested_program) e.requested_program = 'Required'
    if (!form.sex) e.sex = 'Required'
    if (!form.referral_name) e.referral_name = 'Required'
    if (!form.caregiver_name) e.caregiver_name = 'Required'
    if (!form.referral_dob) e.referral_dob = 'Required'
    if (!form.medicaid_or_ssn) e.medicaid_or_ssn = 'Required'
    if (!form.phone) e.phone = 'Required'
    if (!form.caregiver_phone) e.caregiver_phone = 'Required'
    if (!form.address_line1) e.address_line1 = 'Required'
    if (!form.city) e.city = 'Required'
    if (!form.zip) e.zip = 'Required'
    if (!form.county) e.county = 'Required'
    if (!form.caregiver_lives_in_home) e.caregiver_lives_in_home = 'Required'
    if (!form.caregiver_relationship) e.caregiver_relationship = 'Required'
    if (!form.physician) e.physician = 'Required'
    if (!form.diagnosis) e.diagnosis = 'Required'
    if (!form.receives_benefits) e.receives_benefits = 'Required'
    if (form.receives_benefits === 'Yes' && !form.benefits_pay_date) e.benefits_pay_date = 'Required'
    if (!form.heard_about_us) e.heard_about_us = 'Required'
    return e
  }, [form])

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const toggleService = (k, v) => setForm(prev => ({ ...prev, services_needed: { ...prev.services_needed, [k]: v } }))

  const save = async (e) => {
    e.preventDefault()
    setAttempted(true)
    if (Object.keys(requiredErrors).length > 0) return
    
    try {
      // Find or create marketer record for this user
      let marketerRecord = null
      if (user) {
        try {
          // Try to find existing marketer linked to this user
          const marketers = await Marketer.list()
          marketerRecord = marketers.find(m => m.user_id === user.id)
          
          // If no marketer record exists, create one
          if (!marketerRecord) {
            marketerRecord = await Marketer.create({
              name: user.name,
              email: user.email,
              user_id: user.id,
              is_active: true
            })
          }
        } catch (err) {
          console.error('Error handling marketer record (permissions issue):', err)
          // This is expected - marketers don't have permission to read/write marketers table
          // That's OK - admins will handle marketer records
        }
      }
      
      // ALWAYS store marketer name/email for filtering, even if we can't create marketer record
      // The marketer_id will be null if record creation failed (permissions), but that's OK
      // Admins can link it later
      const marketerInfo = user ? { 
        marketer_id: marketerRecord?.id || null, // Null if creation failed
        marketer_name: user.name,  // ALWAYS store name
        marketer_email: user.email // ALWAYS store email
      } : {}
      
      const referralData = {
        client_id: null, // No client yet - created during intake process
        referred_by: user?.name || 'Unknown',
        referral_date: new Date().toISOString().split('T')[0],
        referral_source: form.heard_about_us,
        // All form fields will be stored in notes field as JSON
        referral_name: form.referral_name,
        sex: form.sex,
        referral_dob: form.referral_dob,
        medicaid_or_ssn: form.medicaid_or_ssn,
        phone: form.phone,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        county: form.county,
        caregiver_name: form.caregiver_name,
        caregiver_phone: form.caregiver_phone,
        caregiver_relationship: form.caregiver_relationship,
        caregiver_lives_in_home: form.caregiver_lives_in_home,
        physician: form.physician,
        diagnosis: form.diagnosis,
        requested_program: form.requested_program,
        services_needed: form.services_needed,
        receives_benefits: form.receives_benefits,
        benefits_pay_date: form.benefits_pay_date,
        heard_about_us: form.heard_about_us,
        additional_info: form.additional_info,
        ...marketerInfo
      }
      
      await Referral.create(referralData)
      
      // Reset form
      setForm({
        requested_program: '', sex: '', referral_name: '', caregiver_name: '', referral_dob: '', medicaid_or_ssn: '', phone: '', caregiver_phone: '', address_line1: '', address_line2: '', city: '', state: 'GA', zip: '', county: '', caregiver_lives_in_home: '', caregiver_relationship: '', physician: '', diagnosis: '', receives_benefits: '', benefits_pay_date: '', services_needed: {}, heard_about_us: '', additional_info: '',
      })
      setAttempted(false)
      alert('Referral saved successfully!')
      navigate(createPageUrl('Prospects'))
    } catch (error) {
      console.error('Error saving referral:', error)
      alert('Error saving referral: ' + error.message)
    }
  }

  const serviceRows = ['Ambulating/Transferring','Bathing','Dressing','Feeding','Hygiene/Grooming','Basic Housekeeping','Errand Assistance','Emergency Response/Alert System or Device','Do you require supplies to accommodate your individual needs?']
  const HEARD_OPTIONS = ['Physician Referral','Signage in my Community','Family or Friend','Word of Mouth','Brochure or Handout from Resource Partners','Social Media','Other (specify)']

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Referral Capture"
        title="Referral Form"
        description="Log referral details, requested services, and caregiver contacts to kick off the marketer onboarding workflow."
      />
      <form onSubmit={save} className="space-y-8">
          <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
            <CardHeader className="p-6"><CardTitle className="text-heading-primary">Intake & Referral Information</CardTitle></CardHeader>
            <CardContent className="p-6 grid md:grid-cols-2 gap-6">
              <div>
                <Label className="text-heading-subdued font-medium">Submitted By</Label>
                <Input value={user?.name || 'Current user'} disabled className="rounded-xl py-3 opacity-70" />
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">Service/Program Requested*</Label>
                <Select value={form.requested_program} onValueChange={(v)=>setField('requested_program', v)}>
                  <SelectTrigger className={`rounded-xl py-3 ${attempted && requiredErrors.requested_program ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                {attempted && requiredErrors.requested_program && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
            <CardHeader className="p-6"><CardTitle className="text-heading-primary">Referral & Caregiver Details</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Referral (top half) */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued font-medium">Referral Name*</Label>
                  <Input value={form.referral_name} onChange={(e)=>setField('referral_name', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.referral_name ? 'border-red-500' : ''}`} />
                  {attempted && requiredErrors.referral_name && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
                <div>
                  <Label className="text-heading-subdued font-medium">Sex*</Label>
                  <Select value={form.sex} onValueChange={(v)=>setField('sex', v)}>
                    <SelectTrigger className={`rounded-xl py-3 ${attempted && requiredErrors.sex ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEX.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {attempted && requiredErrors.sex && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
                <div>
                  <Label className="text-heading-subdued font-medium">Referral DOB*</Label>
                  <Input type="date" value={form.referral_dob} onChange={(e)=>setField('referral_dob', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.referral_dob ? 'border-red-500' : ''}`} />
                  {attempted && requiredErrors.referral_dob && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
                <div>
                <Label className="text-heading-subdued font-medium">GA Medicaid or SS#*</Label>
                <Input
                  value={form.medicaid_or_ssn}
                  onChange={(e)=>setField('medicaid_or_ssn', formatSSN(e.target.value))}
                  inputMode="numeric"
                  placeholder="___-__-____"
                  className={`rounded-xl py-3 ${attempted && requiredErrors.medicaid_or_ssn ? 'border-red-500' : ''}`}
                />
                  {attempted && requiredErrors.medicaid_or_ssn && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
                <div>
                  <Label className="text-heading-subdued font-medium">Phone #*</Label>
                <Input
                  value={form.phone}
                  onChange={(e)=>setField('phone', formatUSPhone(e.target.value))}
                  inputMode="tel"
                  placeholder="(###) ###-####"
                  className={`rounded-xl py-3 ${attempted && requiredErrors.phone ? 'border-red-500' : ''}`}
                />
                  {attempted && requiredErrors.phone && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
              </div>

              {/* Caregiver (bottom half) */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued font-medium">Caregiver’s Name*</Label>
                  <Input value={form.caregiver_name} onChange={(e)=>setField('caregiver_name', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.caregiver_name ? 'border-red-500' : ''}`} />
                  {attempted && requiredErrors.caregiver_name && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
                <div>
                  <Label className="text-heading-subdued font-medium">Caregiver’s Relationship to Client*</Label>
                  <Select value={form.caregiver_relationship} onValueChange={(v)=>setField('caregiver_relationship', v)}>
                    <SelectTrigger className={`rounded-xl py-3 ${attempted && requiredErrors.caregiver_relationship ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAREGIVER_RELATIONSHIPS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {attempted && requiredErrors.caregiver_relationship && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
                <div>
                <Label className="text-heading-subdued font-medium">Caregiver’s Phone #*</Label>
                <Input
                  value={form.caregiver_phone}
                  onChange={(e)=>setField('caregiver_phone', formatUSPhone(e.target.value))}
                  inputMode="tel"
                  placeholder="(###) ###-####"
                  className={`rounded-xl py-3 ${attempted && requiredErrors.caregiver_phone ? 'border-red-500' : ''}`}
                />
                  {attempted && requiredErrors.caregiver_phone && <div className="text-red-600 text-sm mt-1">Required</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
            <CardHeader className="p-6"><CardTitle className="text-heading-primary">Location & Living Situation</CardTitle></CardHeader>
            <CardContent className="p-6 grid md:grid-cols-2 gap-6">
              <div>
                <Label className="text-heading-subdued font-medium">Street Address*</Label>
                <Input value={form.address_line1 || ''} onChange={(e)=>setField('address_line1', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.address_line1 ? 'border-red-500' : ''}`} />
                {attempted && requiredErrors.address_line1 && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">Apt, Suite, etc.</Label>
                <Input value={form.address_line2 || ''} onChange={(e)=>setField('address_line2', e.target.value)} className="rounded-xl py-3" />
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">City*</Label>
                <Input value={form.city || ''} onChange={(e)=>setField('city', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.city ? 'border-red-500' : ''}`} />
                {attempted && requiredErrors.city && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">ZIP Code*</Label>
                <Input value={form.zip || ''} onChange={(e)=>setField('zip', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.zip ? 'border-red-500' : ''}`} />
                {attempted && requiredErrors.zip && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">County & State*</Label>
                {countyOptions.length > 0 ? (
                  <>
                    <Select value={form.county} onValueChange={(v)=>setField('county', v)}>
                      <SelectTrigger className={`rounded-xl py-3 ${attempted && requiredErrors.county ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select county & state" />
                      </SelectTrigger>
                      <SelectContent>
                        {countyOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{`${opt}, ${form.state || 'GA'}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {attempted && requiredErrors.county && <div className="text-red-600 text-sm mt-1">Required</div>}
                  </>
                ) : (
                  <>
                    <Input value={form.county} onChange={(e)=>setField('county', e.target.value)} placeholder="e.g., Bibb, GA" className={`rounded-xl py-3 ${attempted && requiredErrors.county ? 'border-red-500' : ''}`} />
                    {attempted && requiredErrors.county && <div className="text-red-600 text-sm mt-1">Required</div>}
                  </>
                )}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">Does your Caregiver live in the home?*</Label>
                <div className="flex gap-3">
                  {['Yes','No'].map(opt => (
                    <label key={opt} className="flex items-center gap-2">
                      <input type="radio" name="cg_home" checked={form.caregiver_lives_in_home===opt} onChange={()=>setField('caregiver_lives_in_home', opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {attempted && requiredErrors.caregiver_lives_in_home && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
            </CardContent>
          </Card>

          {/* Relationship & Medical Info section removed per spec; relevant fields moved */}

          <Card className="bg-[rgb(var(--card))] border rounded-2xl surface-main">
            <CardHeader className="p-6"><CardTitle className="text-heading-primary">Benefits & Services</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <Label className="text-heading-subdued font-medium">Do you receive Social Security or Disability Benefits?*</Label>
                <div className="flex gap-4 py-2">
                  {['Yes','No'].map(opt => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="receives_benefits"
                        checked={form.receives_benefits===opt}
                        onChange={()=>setForm(prev => ({ ...prev, receives_benefits: opt, ...(opt !== 'Yes' ? { benefits_pay_date: '' } : {}) }))}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {attempted && requiredErrors.receives_benefits && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className={`text-heading-subdued font-medium ${form.receives_benefits==='Yes' ? '' : 'opacity-60'}`}>Received on the 1st or 3rd?</Label>
                <div className="flex gap-4 py-2">
                  {['1st','3rd'].map(opt => (
                    <label key={opt} className={`flex items-center gap-2 ${form.receives_benefits==='Yes' ? '' : 'pointer-events-none opacity-60'}`}>
                      <input
                        type="radio"
                        name="benefits_pay_date"
                        disabled={form.receives_benefits!=='Yes'}
                        checked={form.benefits_pay_date===opt}
                        onChange={()=>setField('benefits_pay_date', opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {attempted && requiredErrors.benefits_pay_date && form.receives_benefits==='Yes' && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">Physician’s Full Name & Location*</Label>
                <Input value={form.physician} onChange={(e)=>setField('physician', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.physician ? 'border-red-500' : ''}`} />
                {attempted && requiredErrors.physician && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">Member’s Diagnosis/Disability*</Label>
                <Input value={form.diagnosis} onChange={(e)=>setField('diagnosis', e.target.value)} className={`rounded-xl py-3 ${attempted && requiredErrors.diagnosis ? 'border-red-500' : ''}`} />
                {attempted && requiredErrors.diagnosis && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">Services Needed/Requested</Label>
                <div className="grid md:grid-cols-2 gap-3 py-2 mt-2">
                  {serviceRows.map(row => (
                    <label key={row} className="flex items-center gap-2">
                      <input type="checkbox" checked={Boolean(form.services_needed[row])} onChange={(e)=>toggleService(row, e.target.checked)} />
                      <span>{row}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[rgb(var(--card))] border border-[rgb(var(--border))] rounded-2xl">
            <CardHeader className="p-6"><CardTitle className="text-heading-primary">Referral Source & Additional Info</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <Label className="text-heading-subdued font-medium">How did you hear about us?*</Label>
                <div className="grid md:grid-cols-2 gap-2 py-2 mt-2">
                  {HEARD_OPTIONS.map(opt => (
                    <label key={opt} className="flex items-center gap-2">
                      <input type="radio" name="heard" checked={form.heard_about_us===opt} onChange={()=>setField('heard_about_us', opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {attempted && requiredErrors.heard_about_us && <div className="text-red-600 text-sm mt-1">Required</div>}
              </div>
              <div>
                <Label className="text-heading-subdued font-medium">Any additional information (Email, etc.)?</Label>
                <Textarea value={form.additional_info} onChange={(e)=>setField('additional_info', e.target.value)} className="rounded-xl h-28" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="default" borderRadius="1rem" className="gap-2 px-6">
              Submit
            </Button>
          </div>
        </form>
    </div>
  )
}
