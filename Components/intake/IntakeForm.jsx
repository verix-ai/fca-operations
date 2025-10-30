
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import Program from "@/entities/Program";

const PROGRAMS_DEFAULT = ["PSS", "PCA", "Companion Care", "Respite Care"];

export default function IntakeForm({ onSubmit, isSubmitting, referral }) {
  const [programs, setPrograms] = useState(PROGRAMS_DEFAULT);
  React.useEffect(() => {
    (async () => {
      try {
        const list = await Program.list();
        setPrograms(list.map(p => p.name));
      } catch {}
    })();
  }, []);
  const [formData, setFormData] = useState({
    client_name: '',
    company: 'FCA',
    program: '',
    caregiver_name: '',
    client_phone: '',
    caregiver_phone: '',
    caregiver_relationship: '',
    email: '',
    location: '',
    frequency: '',
    cost_share_amount: '',
    director_of_marketing: '',
    notes: ''
  });
  // Prefill from referral: lock fields that came from referral and hide redundant inputs
  React.useEffect(() => {
    if (!referral) return
    const next = { ...formData }
    // map referral -> intake
    next.client_name = referral.referral_name || next.client_name
    next.caregiver_name = referral.caregiver_name || next.caregiver_name
    next.caregiver_relationship = referral.caregiver_relationship || next.caregiver_relationship
    next.client_phone = referral.phone || next.client_phone
    next.caregiver_phone = referral.caregiver_phone || next.caregiver_phone
    next.location = referral.county || next.location
    next.program = referral.requested_program || next.program
    next.director_of_marketing = referral.marketer_name || next.director_of_marketing
    setFormData(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referral])
  const [freqHours, setFreqHours] = useState('');
  const [freqDays, setFreqDays] = useState('');
  const [errors, setErrors] = useState({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateFrequency = (hours, days) => {
    const h = hours ?? freqHours;
    const d = days ?? freqDays;
    if (hours !== undefined) setFreqHours(hours);
    if (days !== undefined) setFreqDays(days);
    const value = h && d ? `${h}hrs/${d}days` : '';
    handleInputChange('frequency', value);
  };

  // Legacy multi-phone handlers removed; now using explicit fields

  const validate = (state) => {
    const s = state || formData
    const next = {}
    if (!(s.client_name||'').trim()) next.client_name = 'Client name is required'
    if (!(s.program||'').trim()) next.program = 'Program is required'
    if (!(s.caregiver_name||'').trim()) next.caregiver_name = 'Caregiver name is required'
    // Removed redundant fields collected on referral profile; Email is optional
    if (!(freqHours||'').trim()) next.freqHours = 'Hours/day is required'
    if (!(freqDays||'').trim()) next.freqDays = 'Days/week is required'
    if (s.cost_share_amount === '' || s.cost_share_amount == null) next.cost_share_amount = 'Cost share amount is required'
    return next
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setAttemptedSubmit(true)
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }
    // Filter out empty phone numbers
    const cleanedData = {
      ...formData,
      phone_numbers: [formData.client_phone, formData.caregiver_phone].filter(phone => (phone || '').trim() !== ''),
      cost_share_amount: formData.cost_share_amount ? parseFloat(formData.cost_share_amount) : 0
    };
    onSubmit(cleanedData);
  };

  const isFormComplete = (
    (formData.client_name || '').trim() !== '' &&
    (formData.program || '').trim() !== '' &&
    (formData.caregiver_name || '').trim() !== '' &&
    (formData.frequency || '').trim() !== '' &&
    formData.cost_share_amount !== ''
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Client Information Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label htmlFor="client_name" className="text-white/70 font-medium">Client Name *</Label>
          <Input
            id="client_name"
            value={formData.client_name}
            onChange={(e) => { handleInputChange('client_name', e.target.value); if (attemptedSubmit) setErrors(validate({ ...formData, client_name: e.target.value })) }}
            placeholder="e.g., Susie Q"
            required
            disabled={Boolean(referral)}
            className={`rounded-xl py-3 ${errors.client_name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
          />
          {attemptedSubmit && errors.client_name && (<div className="text-red-600 text-sm">{errors.client_name}</div>)}
        </div>

        <div className="space-y-3">
          <Label htmlFor="program" className="text-white/70 font-medium">Approved Program *</Label>
          <Select value={formData.program} onValueChange={(value) => { handleInputChange('program', value); if (attemptedSubmit) setErrors(validate({ ...formData, program: value })) }}>
            <SelectTrigger className={`rounded-xl py-3 ${errors.program ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}>
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((program) => (
                <SelectItem key={program} value={program}>
                  {program}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {attemptedSubmit && errors.program && (<div className="text-red-600 text-sm">{errors.program}</div>)}
        </div>

        <div className="space-y-3">
          <Label htmlFor="caregiver_name" className="text-white/70 font-medium">Caregiver Name *</Label>
          <Input
            id="caregiver_name"
            value={formData.caregiver_name}
            onChange={(e) => { handleInputChange('caregiver_name', e.target.value); if (attemptedSubmit) setErrors(validate({ ...formData, caregiver_name: e.target.value })) }}
            placeholder="e.g., John Q"
            required
            disabled={Boolean(referral)}
            className={`rounded-xl py-3 ${errors.caregiver_name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
          />
          {attemptedSubmit && errors.caregiver_name && (<div className="text-red-600 text-sm">{errors.caregiver_name}</div>)}
        </div>

        <div className="space-y-3">
          <Label htmlFor="email" className="text-white/70 font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => { handleInputChange('email', e.target.value); if (attemptedSubmit) setErrors(validate({ ...formData, email: e.target.value })) }}
            placeholder="example@test.com"
            className={`rounded-xl py-3 ${errors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
          />
          {attemptedSubmit && errors.email && (<div className="text-red-600 text-sm">{errors.email}</div>)}
        </div>

        {/* Location removed from intake (already captured on referral) */}
      </div>

      {/* Phone numbers removed from intake (already captured on referral) */}

      {/* Additional Information */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-white/70 font-medium">Frequency *</Label>
          <div className="grid grid-cols-2 gap-3">
            <Select value={freqHours} onValueChange={(v) => updateFrequency(v, undefined)}>
                <SelectTrigger className={`rounded-xl py-3 ${errors.freqHours ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}>
                <SelectValue placeholder="Hrs/day" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => String(i + 1)).map((h) => (
                  <SelectItem key={h} value={h}>{h} hrs</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={freqDays} onValueChange={(v) => updateFrequency(undefined, v)}>
                <SelectTrigger className={`rounded-xl py-3 ${errors.freqDays ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}>
                <SelectValue placeholder="Days/week" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 7 }, (_, i) => String(i + 1)).map((d) => (
                  <SelectItem key={d} value={d}>{d} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-white/70">Selected: {formData.frequency || '—'}</div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="cost_share_amount" className="text-white/70 font-medium">Cost Share Amount *</Label>
          <Input
            id="cost_share_amount"
            type="number"
            min="0"
            step="0.01"
            value={formData.cost_share_amount}
            onChange={(e) => { handleInputChange('cost_share_amount', e.target.value); if (attemptedSubmit) setErrors(validate({ ...formData, cost_share_amount: e.target.value })) }}
            placeholder="0.00"
            required
            className={`rounded-xl py-3 ${errors.cost_share_amount ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
          />
          {attemptedSubmit && errors.cost_share_amount && (<div className="text-red-600 text-sm">{errors.cost_share_amount}</div>)}
        </div>
      </div>

      {/* Director of Marketing removed from intake (already captured on referral) */}

      <div className="space-y-3">
        <Label htmlFor="notes" className="text-white/70 font-medium">Additional Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="Any additional information or notes..."
          className="rounded-xl py-3 h-32"
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-6">
        <Button
          type="submit"
          disabled={isSubmitting}
          variant="default"
          borderRadius="1rem"
          className="gap-3 px-10 text-lg"
        >
          {isSubmitting ? (
            <>
              <div className="mr-3 h-5 w-5 animate-spin rounded-full border-b-2 border-current" />
              Creating...
            </>
          ) : (
            <>
              <Save className="w-5 h-5 mr-3" />
              Create Client Intake
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
